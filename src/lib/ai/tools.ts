import { createClient } from "@/lib/supabase/server";
import { todayISO, addDaysISO, wibNowMinutes } from "@/lib/availability";

/**
 * Safe data providers exposed to Gemini as function-calling tools.
 * Each returns compact JSON — no raw SQL reaches the model.
 * Server-side only (uses cookies()).
 */

export interface ToolResult {
  [key: string]: unknown;
}

async function sb() {
  return createClient();
}

function dayRange(dateISO: string): [string, string] {
  return [
    `${dateISO}T00:00:00+07:00`,
    `${addDaysISO(dateISO, 1)}T00:00:00+07:00`,
  ];
}

/** Ringkasan hari tertentu (default: hari ini) */
export async function getTodaySummary(p?: { date?: string }): Promise<ToolResult> {
  const supabase = await sb();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p?.date ?? "") ? p!.date! : todayISO();
  const [start, end] = dayRange(date);

  const [bookingsRes, paymentsRes, courtsRes, pricingRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("*,courts(name)")
      .eq("booking_date", date)
      .order("start_time"),
    supabase
      .from("payments")
      .select("amount,method")
      .gte("paid_at", start)
      .lt("paid_at", end),
    supabase.from("courts").select("id").eq("is_active", true),
    supabase.rpc("get_pricing_for", { p_date: date }),
  ]);

  type B = {
    id: string;
    status: string;
    start_time: string;
    end_time: string;
    customer_name: string;
    payment_status: string;
    computed_price: number;
    override_price: number | null;
    courts: { name: string }[] | null;
  };
  const bookings = (bookingsRes.data ?? []) as unknown as B[];
  const payments = (paymentsRes.data ?? []) as Array<{ amount: number; method: string }>;

  let cash = 0;
  let qris = 0;
  for (const pay of payments) {
    if (pay.method === "qris") qris += Number(pay.amount);
    else cash += Number(pay.amount);
  }

  const active = bookings.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
  const bookedHours = active.reduce((sum, b) => {
    const s = Number(b.start_time.slice(0, 2));
    const e = Number(b.end_time.slice(0, 2));
    return sum + Math.max(e - s, 0);
  }, 0);
  const courtCount = Math.max(courtsRes.data?.length ?? 1, 1);
  const openH = pricingRes.data?.[0]
    ? Number(String(pricingRes.data[0].close_time).slice(0, 2)) -
      Number(String(pricingRes.data[0].open_time).slice(0, 2))
    : 16;
  const occupancy = Math.round((bookedHours / Math.max(courtCount * openH, 1)) * 100);

  const nowMin = wibNowMinutes();
  const isToday = date === todayISO();

  return {
    tanggal: date,
    pendapatan_total: cash + qris,
    cash,
    qris,
    jumlah_transaksi: payments.length,
    booking_aktif: active.length,
    okupansi_persen: occupancy,
    jam_terpakai: bookedHours,
    belum_bayar: active.filter(
      (b) => b.payment_status !== "paid" && (!isToday || Number(b.end_time.slice(0, 2)) * 60 > nowMin)
    ).map((b) => ({
      nama: b.customer_name,
      jam: `${b.start_time.slice(0, 5)}-${b.end_time.slice(0, 5)}`,
      lapangan: b.courts?.[0]?.name ?? "",
      harga: Number(b.override_price ?? b.computed_price),
      status_pembayaran: b.payment_status,
    })),
    daftar_booking: bookings.map((b) => ({
      jam: `${b.start_time.slice(0, 5)}-${b.end_time.slice(0, 5)}`,
      pelanggan: b.customer_name,
      lapangan: b.courts?.[0]?.name ?? "",
      status: b.status,
    })),
  };
}

/** Ringkasan rentang tanggal inklusif–eksklusif (untuk bulan/minggu) */
export async function getRangeSummary(p: {
  start: string;
  end: string; // exclusive
}): Promise<ToolResult> {
  const supabase = await sb();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(p.start ?? "") ? p.start : "";
  const end = /^\d{4}-\d{2}-\d{2}$/.test(p.end ?? "") ? p.end : "";
  if (!start || !end || end <= start) return { error: "Rentang tanggal tidak valid." };

  const [paymentsRes, expensesRes, bookingsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("amount,method,paid_at")
      .gte("paid_at", `${start}T00:00:00+07:00`)
      .lt("paid_at", `${end}T00:00:00+07:00`),
    supabase
      .from("expenses")
      .select("amount")
      .gte("spent_at", start)
      .lt("spent_at", end),
    supabase
      .from("bookings")
      .select("id,start_time")
      .neq("status", "cancelled")
      .neq("status", "no_show")
      .gte("booking_date", start)
      .lt("booking_date", end),
  ]);

  const pays = (paymentsRes.data ?? []) as Array<{
    amount: number;
    method: string;
    paid_at: string;
  }>;
  const exps = (expensesRes.data ?? []) as Array<{ amount: number }>;

  let cash = 0;
  let qris = 0;
  const daily = new Map<string, number>();
  for (const pay of pays) {
    const amt = Number(pay.amount);
    if (pay.method === "qris") qris += amt;
    else cash += amt;
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
      new Date(pay.paid_at)
    );
    daily.set(d, (daily.get(d) ?? 0) + amt);
  }
  const beban = exps.reduce((a, b) => a + Number(b.amount), 0);

  // busiest hours
  const hourTally = new Map<number, number>();
  for (const b of (bookingsRes.data ?? []) as Array<{ start_time: string }>) {
    const h = Number(b.start_time.slice(0, 2));
    hourTally.set(h, (hourTally.get(h) ?? 0) + 1);
  }
  const peakHours = [...hourTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([jam, jumlah]) => ({ jam: `${String(jam).padStart(2, "0")}.00`, jumlah }));

  const bestDay = [...daily.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    periode: { dari: start, sampai_sebelum: end },
    pendapatan_kotor: cash + qris,
    cash,
    qris,
    beban_pengeluaran: beban,
    laba_bersih: cash + qris - beban,
    jumlah_transaksi: pays.length,
    booking_count: bookingsRes.data?.length ?? 0,
    hari_terbaik: bestDay ? { tanggal: bestDay[0], total: bestDay[1] } : null,
    jam_terpopuler: peakHours,
    tren_harian: [...daily.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([tanggal, total]) => ({ tanggal, total })),
  };
}

/** Pelanggan paling sering main */
export async function getTopCustomers(p?: { limit?: number }): Promise<ToolResult> {
  const supabase = await sb();
  const limit = Math.min(Math.max(p?.limit ?? 5, 1), 20);

  const [customersRes, bookingsRes] = await Promise.all([
    supabase.from("customers").select("id,name,no_show_count").limit(200),
    supabase
      .from("bookings")
      .select("customer_id,booking_date,status")
      .neq("status", "no_show")
      .order("booking_date", { ascending: false })
      .limit(2000),
  ]);

  const tally = new Map<string, { visits: number; last?: string }>();
  for (const b of (bookingsRes.data ?? []) as Array<{
    customer_id: string | null;
    booking_date: string;
  }>) {
    if (!b.customer_id) continue;
    const t = tally.get(b.customer_id) ?? { visits: 0 };
    t.visits += 1;
    if (!t.last || b.booking_date > t.last) t.last = b.booking_date;
    tally.set(b.customer_id, t);
  }

  const customers = (customersRes.data ?? []) as Array<{
    id: string;
    name: string;
    no_show_count: number;
  }>;

  const top = customers
    .map((c) => ({ ...c, ...(tally.get(c.id) ?? { visits: 0 }) }))
    .sort((a, b) => b.visits - a.visits || (b.last ?? "").localeCompare(a.last ?? ""))
    .slice(0, limit);

  return {
    pelanggan_teratas: top.map((c) => ({
      nama: c.name,
      kunjungan: c.visits,
      kunjungan_terakhir: c.last ?? null,
      no_show_total: c.no_show_count,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Kantin tools                                                        */
/* ------------------------------------------------------------------ */

/** Ringkasan penjualan kantin hari ini (default) atau tanggal tertentu */
export async function getKantinTodaySummary(p?: { date?: string }): Promise<ToolResult> {
  const supabase = await sb();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p?.date ?? "") ? p!.date! : todayISO();
  const [start, end] = dayRange(date);

  const { data } = await supabase
    .from("kantin_sale_items")
    .select("qty,unit_price,unit_cost,product_name,kantin_sales!inner(created_at)")
    .gte("kantin_sales.created_at", start)
    .lt("kantin_sales.created_at", end);

  const items = (data ?? []) as unknown as Array<{
    qty: number;
    unit_price: number;
    unit_cost: number;
    product_name: string;
    kantin_sales: { created_at: string };
  }>;

  const revenue = items.reduce((a, i) => a + i.unit_price * i.qty, 0);
  const cogs = items.reduce((a, i) => a + i.unit_cost * i.qty, 0);
  const qty = items.reduce((a, i) => a + i.qty, 0);
  const tally = new Map<string, number>();
  for (const i of items) tally.set(i.product_name, (tally.get(i.product_name) ?? 0) + i.qty);
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    tanggal: date,
    omzet_kantin: revenue,
    modal: cogs,
    laba_kotor: revenue - cogs,
    item_terjual: qty,
    produk_terlaris: top.map(([nama, jml]) => ({ nama, jumlah: jml })),
  };
}

/** Produk kantin paling laku dalam rentang tanggal (inklusif-exklusif) */
export async function getKantinTopProducts(p: {
  start: string;
  end: string;
}): Promise<ToolResult> {
  const supabase = await sb();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(p.start) ? p.start : todayISO();
  const end = /^\d{4}-\d{2}-\d{2}$/.test(p.end) ? p.end : addDaysISO(start, 1);

  const { data } = await supabase
    .from("kantin_sale_items")
    .select("qty,unit_price,product_name,kantin_sales!inner(created_at)")
    .gte("kantin_sales.created_at", `${start}T00:00:00+07:00`)
    .lt("kantin_sales.created_at", `${end}T00:00:00+07:00`);

  const items = (data ?? []) as unknown as Array<{
    qty: number;
    unit_price: number;
    product_name: string;
  }>;

  const tally = new Map<string, { qty: number; revenue: number }>();
  for (const i of items) {
    const t = tally.get(i.product_name) ?? { qty: 0, revenue: 0 };
    t.qty += i.qty;
    t.revenue += i.unit_price * i.qty;
    tally.set(i.product_name, t);
  }
  const top = [...tally.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);

  return {
    rentang: `${start} s.d. ${end}`,
    total_omzet: items.reduce((a, i) => a + i.unit_price * i.qty, 0),
    produk_teratas: top.map(([nama, t]) => ({ nama, jumlah: t.qty, omzet: t.revenue })),
  };
}
