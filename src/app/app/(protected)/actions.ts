"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/proxy/client";
import {
  ALL_BOOKING_STATUSES,
  MUTABLE_BOOKING_STATUSES,
  OCCUPIES_COURT,
} from "@/lib/booking-status";
import { addDaysISO, computePrice, todayISO, wibNowMinutes, type PricingRule } from "@/lib/availability";
import { rateLimit } from "@/lib/ratelimit";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/app/login");
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");
  return { supabase, user };
}

async function isOwner(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.rpc("is_owner");
  return data === true;
}

async function getActivePricing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dateISO: string
) {
  const { data } = await supabase.rpc<PricingRule[]>("get_pricing_for", { p_date: dateISO });
  const p = data?.[0];
  if (!p) {
    return {
      openHour: 7,
      closeHour: 23,
      dayEndHour: 17,
      priceDay: 40000,
      priceEvening: 50000,
    };
  }
  return {
    openHour: Number(p.open_time.slice(0, 2)),
    closeHour: Number(p.close_time.slice(0, 2)),
    dayEndHour: Number(p.day_end.slice(0, 2)),
    priceDay: Number(p.price_day),
    priceEvening: Number(p.price_evening),
  };
}

/** Look up or create the customer directory entry for a phone number. */
async function upsertCustomerByPhone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  phoneRaw: string
): Promise<string | null> {
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", phoneRaw)
    .maybeSingle();
  if (existingCustomer?.id) return existingCustomer.id as string;

  // Insert; on a concurrent unique-phone race, re-select instead of
  // surfacing a raw duplicate-key error.
  const { data: newCustomer, error } = await supabase
    .from("customers")
    .insert({ name, phone: phoneRaw })
    .select("id")
    .single();
  if (newCustomer?.id) return newCustomer.id as string;
  if (error?.code === "23505") {
    const { data: raced } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", phoneRaw)
      .maybeSingle();
    return (raced?.id as string) ?? null;
  }
  return null;
}

export type ActionState = { error: string | null; ok?: boolean };

const DB_OVERLAP_CODE = "23P01";

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

export type BookingFormState = ActionState & { fieldErrors?: Record<string, string> };

export async function createBooking(
  _prev: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const { supabase, user } = await requireUser();

  const courtId = String(formData.get("court_id") ?? "");
  const dateISO = String(formData.get("date") ?? "");
  const startH = Number(formData.get("start_hour"));
  const endH = Number(formData.get("end_hour"));
  const name = String(formData.get("customer_name") ?? "").trim().slice(0, 80);
  const phoneRaw = String(formData.get("customer_phone") ?? "")
    .replace(/\D/g, "")
    .slice(0, 16);
  const source = String(formData.get("source") ?? "walk_in") as "whatsapp" | "walk_in";
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;
  const overrideRaw = String(formData.get("override_price") ?? "").replace(/\D/g, "").slice(0, 9);
  const unconfirmed = String(formData.get("unconfirmed") ?? "") === "1";

  // Spam guard: 30 booking / menit / user
  if (!rateLimit(`booking:${user.id}`, 30, 60_000).ok) {
    return { error: "Terlalu banyak booking sekaligus — coba lagi sebentar." };
  }

  const fieldErrors: Record<string, string> = {};
  if (!courtId) fieldErrors.court_id = "Pilih lapangan";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) fieldErrors.date = "Tanggal tidak valid";
  if (!Number.isInteger(startH) || !Number.isInteger(endH) || endH <= startH)
    fieldErrors.end_hour = "Jam selesai harus setelah jam mulai";
  if (!name) fieldErrors.customer_name = "Nama wajib diisi";
  if (phoneRaw.length < 8) fieldErrors.customer_phone = "Nomor WhatsApp tidak valid";
  if (Object.keys(fieldErrors).length > 0)
    return { error: "Periksa kembali form.", fieldErrors };

  // Date sanity: reject past dates and anything beyond ±1 year
  const today = todayISO();
  const maxDate = addDaysISO(today, 366);
  if (dateISO < addDaysISO(today, -1) || dateISO > maxDate) {
    return { error: "Tanggal di luar rentang yang diizinkan." };
  }

  // Same-day slots that already started are not bookable
  if (dateISO === today && startH * 60 <= wibNowMinutes()) {
    return { error: "Jam sudah lewat — pilih slot lain." };
  }

  // Validate against operating hours + resolve owner & customer in parallel
  const [pricing, owner, customerId] = await Promise.all([
    getActivePricing(supabase, dateISO),
    isOwner(supabase),
    upsertCustomerByPhone(supabase, name, phoneRaw),
  ]);

  if (startH < pricing.openHour || endH > pricing.closeHour) {
    return {
      error: `Jam operasional ${String(pricing.openHour).padStart(2, "0")}.00–${String(
        pricing.closeHour
      ).padStart(2, "0")}.00 WIB.`,
    };
  }

  // Owner-only manual price override
  const overridePrice = owner && overrideRaw ? Number(overrideRaw) : null;
  const computedPrice = computePrice(pricing, startH, endH);

  const { error } = await supabase.from("bookings").insert({
    court_id: courtId,
    booking_date: dateISO,
    start_time: `${String(startH).padStart(2, "0")}:00`,
    end_time: `${String(endH).padStart(2, "0")}:00`,
    status: unconfirmed ? "pending" : "confirmed",
    source,
    customer_id: customerId,
    customer_name: name,
    customer_phone: phoneRaw,
    computed_price: computedPrice,
    override_price: overridePrice,
    notes,
    created_by: user.id,
  });

  if (error) {
    if (error.code === DB_OVERLAP_CODE) {
      return { error: "Slot bentrok — sudah ada booking di jam tersebut." };
    }
    return { error: `Gagal membuat booking: ${error.message}` };
  }

  revalidatePath("/app");
  revalidatePath("/app/jadwal");
  revalidatePath("/");
  redirect(`/app/jadwal?date=${dateISO}&created=1`);
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["completed", "no_show"],
};

export async function updateBookingStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("booking_id") ?? "");
  const next = String(formData.get("status") ?? "");
  if (!id || !next) return { error: "Permintaan tidak valid" };

  // Status-change pre-read. The list endpoint defaults to
  // `status=confirmed`, so without an explicit set a `pending` booking
  // came back as "not found" and the transition silently did nothing.
  const { data: current, error: curErr } = await supabase
    .from("bookings")
    .select("status,customer_id")
    .eq("id", id)
    .in("status", MUTABLE_BOOKING_STATUSES)
    .maybeSingle();
  if (curErr) {
    return { error: `Gagal memuat booking: ${curErr.message}` };
  }
  const from = current?.status as string | undefined;
  if (!from) return { error: "Booking tidak ditemukan." };

  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(next)) {
    return { error: `Tidak bisa ubah status dari ${from} ke ${next}.` };
  }

  // Guarded transition: only applies when the row is still in `from`.
  // Two racing updates cannot both succeed → no invalid double-hop.
  // Note: QueryBuilder update ignores second eq("status") filter; proxy validates transition server-side.
  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ status: next })
    .eq("id", id)
    .eq("status", from)
    .select("id");

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[updateBookingStatus] patch failed", { id, from, next, error: error.message, status: (error as unknown as { status?: number }).status });
    return { error: `Gagal update: ${error.message} (${(error as unknown as { status?: number }).status ?? ""})` };
  }
  if (!updated || updated.length === 0) {
    return { error: "Status sudah diubah oleh staf lain — muat ulang halaman." };
  }

  if (next === "no_show" && current?.customer_id) {
    // Atomic increment via SQL (no read-modify-write lost-update race)
    await supabase.rpc("bump_no_show", { p_booking_id: id });
  }

  revalidatePath("/app");
  revalidatePath("/app/jadwal");
  revalidatePath("/app/pembayaran");
  revalidatePath("/");
  return { error: null, ok: true };
}

export async function deleteBooking(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  if (!(await isOwner(supabase)))
    return { error: "Hanya owner yang bisa menghapus booking." };

  const id = String(formData.get("booking_id") ?? "");
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) return { error: `Gagal hapus: ${error.message}` };

  revalidatePath("/app");
  revalidatePath("/app/jadwal");
  revalidatePath("/");
  return { error: null, ok: true };
}

export async function extendBooking(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = String(formData.get("booking_id") ?? "");
  const hours = Math.min(Math.max(Number(formData.get("hours") ?? 1), 1), 3);
  if (!id) return { error: "Booking tidak valid" };

  const { data: cur } = await supabase
    .from("bookings")
    .select("court_id,booking_date,start_time,end_time,status")
    .eq("id", id)
    .in("status", MUTABLE_BOOKING_STATUSES)
    .maybeSingle();
  if (!cur) return { error: "Booking tidak ditemukan" };
  const curRow = cur as unknown as {
    court_id: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    status: string;
  };
  if (curRow.status !== "confirmed" && curRow.status !== "checked_in") {
    return { error: "Hanya booking aktif yang bisa ditambah jam." };
  }
  const sHour = Number(String(curRow.start_time).slice(0, 2));
  const eHour = Number(String(curRow.end_time).slice(0, 2));
  const newEnd = eHour + hours;
  if (newEnd > 23) return { error: "Melebihi jam operasional (23.00)" };
  const newEndStr = `${String(newEnd).padStart(2, "0")}:00`;

  // Check next booking overlap on same court/date. Only statuses that
  // actually hold the court count: a cancelled or no-show slot is free.
  const { data: nexts } = await supabase
    .from("bookings")
    .select("start_time,end_time")
    .eq("court_id", curRow.court_id)
    .eq("booking_date", curRow.booking_date)
    .in("status", OCCUPIES_COURT)
    .neq("id", id);
  const nextList = (nexts ?? []) as Array<{ start_time: string; end_time: string }>;
  for (const n of nextList) {
    const ns = Number(String(n.start_time).slice(0, 2));
    const ne = Number(String(n.end_time).slice(0, 2));
    if (ns < newEnd && ne > eHour) {
      // suggest next free slot after ne
      return {
        error: `Bentrok dengan booking ${String(n.start_time).slice(0, 5)}-${String(n.end_time).slice(0, 5)}. Next free ${String(ne).padStart(2, "0")}:00`,
      };
    }
  }

  // Also check court_blocks
  const { data: blocks } = await supabase
    .from("court_blocks")
    .select("start_time,end_time")
    .eq("court_id", curRow.court_id)
    .eq("block_date", curRow.booking_date);
  for (const b of (blocks ?? []) as Array<{ start_time: string; end_time: string }>) {
    const bs = Number(String(b.start_time).slice(0, 2));
    const be = Number(String(b.end_time).slice(0, 2));
    if (bs < newEnd && be > eHour) return { error: `Bentrok dengan blokir ${String(b.start_time).slice(0, 5)}-${String(b.end_time).slice(0, 5)}` };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ end_time: newEndStr })
    .eq("id", id);
  if (error) return { error: `Gagal nambah jam: ${error.message}` };

  revalidatePath("/app");
  revalidatePath("/app/jadwal");
  revalidatePath("/");
  return { error: null, ok: true };
}

export async function releaseBooking(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = String(formData.get("booking_id") ?? "");
  if (!id) return { error: "Booking tidak valid" };

  const { data: cur } = await supabase
    .from("bookings")
    .select("start_time,end_time,status,booking_date")
    .eq("id", id)
    .in("status", MUTABLE_BOOKING_STATUSES)
    .maybeSingle();
  if (!cur) return { error: "Booking tidak ditemukan" };
  const row = cur as unknown as { start_time: string; end_time: string; status: string; booking_date: string };
  if (row.status !== "confirmed" && row.status !== "checked_in") {
    return { error: "Hanya yang sedang main bisa dikosongkan." };
  }
  const nowMin = wibNowMinutes();
  const sMin = Number(String(row.start_time).slice(0, 2)) * 60 + Number(String(row.start_time).slice(3, 5) || 0);
  const eMin = Number(String(row.end_time).slice(0, 2)) * 60 + Number(String(row.end_time).slice(3, 5) || 0);
  if (nowMin < sMin) return { error: "Belum mulai — batalkan saja." };
  if (nowMin >= eMin) return { error: "Sudah selesai." };

  const nowHour = Math.floor(nowMin / 60);
  const nowStr = `${String(nowHour).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`;

  // Kosongkan = completed early, keep money, free slot now->end
  const { error } = await supabase
    .from("bookings")
    .update({ end_time: nowStr, status: "completed" })
    .eq("id", id);
  if (error) return { error: `Gagal kosongkan: ${error.message}` };

  revalidatePath("/app");
  revalidatePath("/app/jadwal");
  revalidatePath("/");
  return { error: null, ok: true };
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export async function recordPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const bookingId = String(formData.get("booking_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").replace(/\D/g, "").slice(0, 9);
  const method = String(formData.get("method") ?? "cash") as "cash" | "qris";
  const amount = Number(amountRaw);
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  if (!bookingId) return { error: "Booking tidak valid" };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Nominal harus lebih dari 0." };
  if (amount > 100_000_000) return { error: "Nominal melebihi batas maksimum." };
  if (!rateLimit(`payment:${user.id}`, 60, 60_000).ok) {
    return { error: "Terlalu banyak transaksi — coba lagi sebentar." };
  }

  // Reject overpayment against the booking's outstanding balance. Any
  // status can be paid, so ask for the full set rather than relying on
  // the confirmed-only list default.
  const { data: booking } = await supabase
    .from("bookings")
    .select("computed_price,override_price")
    .eq("id", bookingId)
    .in("status", ALL_BOOKING_STATUSES)
    .maybeSingle();
  if (!booking) return { error: "Booking tidak ditemukan." };

  const price = Number(booking.override_price ?? booking.computed_price) || 0;
  const { data: paidRows } = await supabase
    .from("payments")
    .select("amount")
    .eq("booking_id", bookingId);
  const paid = ((paidRows ?? []) as Array<{ amount: number }>).reduce(
    (a, p) => a + Number(p.amount),
    0
  );
  const outstanding = Math.max(price - paid, 0);

  if (outstanding === 0) {
    return { error: "Booking ini sudah lunas." };
  }
  if (amount > outstanding) {
    return {
      error: `Nominal melebihi sisa tagihan (sisa ${outstanding.toLocaleString("id-ID")}).`,
    };
  }

  const { error: insertError } = await supabase.from("payments").insert({
    booking_id: bookingId,
    amount,
    method,
    note,
    recorded_by: user.id,
  });

  if (insertError) return { error: `Gagal catat pembayaran: ${insertError.message}` };

  revalidatePath("/app/pembayaran");
  revalidatePath("/app");
  revalidatePath("/app/jadwal");
  return { error: null, ok: true };
}

export async function deletePayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  if (!(await isOwner(supabase)))
    return { error: "Hanya owner yang bisa menghapus pembayaran." };

  const id = String(formData.get("payment_id") ?? "");
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return { error: `Gagal hapus pembayaran: ${error.message}` };

  revalidatePath("/app/pembayaran");
  revalidatePath("/app");
  return { error: null, ok: true };
}

/* ------------------------------------------------------------------ */
/* Owner: court blocks                                                 */
/* ------------------------------------------------------------------ */

async function requireOwner() {
  const { supabase, user } = await requireUser();
  if (!(await isOwner(supabase))) {
    throw new Error("FORBIDDEN");
  }
  return { supabase, user };
}

export async function createBlock(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let ctx: Awaited<ReturnType<typeof requireOwner>>;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner yang bisa memblokir jadwal." };
  }
  const { supabase, user } = ctx;

  const courtId = String(formData.get("court_id") ?? ""); // "" = all courts
  const date = String(formData.get("date") ?? "");
  const startH = Number(formData.get("start_hour"));
  const endH = Number(formData.get("end_hour"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Tanggal tidak valid." };
  if (!Number.isFinite(startH) || !Number.isFinite(endH) || endH <= startH)
    return { error: "Jam selesai harus setelah jam mulai." };

  const { error } = await supabase.from("court_blocks").insert({
    court_id: courtId === "" ? null : courtId,
    block_date: date,
    start_time: `${String(startH).padStart(2, "0")}:00`,
    end_time: `${String(endH).padStart(2, "0")}:00`,
    reason: reason || "Maintenance",
    created_by: user.id,
  });

  if (error) return { error: `Gagal memblokir: ${error.message}` };

  revalidatePath("/app/blokir");
  revalidatePath("/app/jadwal");
  revalidatePath("/");
  return { error: null, ok: true };
}

export async function deleteBlock(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const id = String(formData.get("block_id") ?? "");
  const { error } = await supabase.from("court_blocks").delete().eq("id", id);
  if (error) return { error: `Gagal hapus blokir: ${error.message}` };

  revalidatePath("/app/blokir");
  revalidatePath("/");
  return { error: null, ok: true };
}

/* ------------------------------------------------------------------ */
/* Owner: recurring series (komunitas)                                 */
/* ------------------------------------------------------------------ */

const MAX_WEEKS = 12;

type SeriesBookingRow = {
  court_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: "confirmed";
  source: "walk_in";
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  recurring_series_id: string;
  computed_price: number;
  notes: string;
  created_by: string;
};

/**
 * Insert weekly instances. Batch first (1 round-trip); on any overlap,
 * fall back to per-week inserts so conflicting weeks are skipped.
 */
async function insertSeriesInstances(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: SeriesBookingRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const { data, error } = await supabase.from("bookings").insert(rows);
  // QueryBuilder array insert returns {created} with partial success
  if (!error && data && typeof (data as { created?: number }).created === "number") {
    return (data as { created: number }).created;
  }
  if (!error) return rows.length;

  let created = 0;
  for (const row of rows) {
    const { error: rowError } = await supabase.from("bookings").insert(row);
    if (!rowError) created++;
  }
  return created;
}

export async function createSeries(
  _prev: ActionState,
  formData: FormData
): Promise<SeriesState> {
  let ctx: Awaited<ReturnType<typeof requireOwner>>;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner yang bisa membuat langganan." };
  }
  const { supabase, user } = ctx;

  const courtId = String(formData.get("court_id") ?? "");
  const startDate = String(formData.get("start_date") ?? "");
  const startH = Number(formData.get("start_hour"));
  const endH = Number(formData.get("end_hour"));
  const name = String(formData.get("customer_name") ?? "").trim();
  const phoneRaw = String(formData.get("customer_phone") ?? "").replace(/\D/g, "");
  const weeksRaw = formData.get("weeks");
  const weeksNum = weeksRaw === null || weeksRaw === "" ? NaN : Number(weeksRaw);
  const weeks = Number.isFinite(weeksNum)
    ? Math.min(Math.max(Math.trunc(weeksNum), 1), MAX_WEEKS)
    : 8;
  const endDateRaw = String(formData.get("end_date") ?? "");

  if (!courtId) return { error: "Pilih lapangan." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { error: "Tanggal mulai tidak valid." };
  if (endDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(endDateRaw))
    return { error: "Tanggal akhir tidak valid." };
  if (endDateRaw && endDateRaw < startDate)
    return { error: "Tanggal akhir tidak boleh sebelum tanggal mulai." };
  if (!Number.isFinite(startH) || !Number.isFinite(endH) || endH <= startH)
    return { error: "Jam selesai harus setelah jam mulai." };
  if (!name) return { error: "Nama pelanggan wajib diisi." };
  if (phoneRaw.length > 0 && phoneRaw.length < 8)
    return { error: "Nomor WhatsApp tidak valid." };

  const customerId =
    phoneRaw.length >= 8 ? await upsertCustomerByPhone(supabase, name, phoneRaw) : null;

  const pricing = await getActivePricing(supabase, startDate);
  const price = computePrice(pricing, startH, endH);
  const weekday = new Date(`${startDate}T00:00:00Z`).getUTCDay();

  const { data: series, error: sErr } = await supabase
    .from("recurring_series")
    .insert({
      court_id: courtId,
      customer_id: customerId,
      customer_name: name,
      customer_phone: phoneRaw || null,
      weekday,
      start_time: `${String(startH).padStart(2, "0")}:00`,
      end_time: `${String(endH).padStart(2, "0")}:00`,
      start_date: startDate,
      end_date: endDateRaw || null,
      status: "active",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (sErr || !series)
    return { error: `Gagal membuat langganan: ${sErr?.message ?? "?"}` };

  // Generate weekly instances, capped by end_date
  const dates: string[] = [];
  for (let i = 0; i < weeks; i++) {
    const d = addDaysISO(startDate, i * 7);
    if (endDateRaw && d > endDateRaw) break;
    dates.push(d);
  }

  const created = await insertSeriesInstances(
    supabase,
    dates.map((d) => ({
      court_id: courtId,
      booking_date: d,
      start_time: `${String(startH).padStart(2, "0")}:00`,
      end_time: `${String(endH).padStart(2, "0")}:00`,
      status: "confirmed",
      source: "walk_in",
      customer_id: customerId,
      customer_name: name,
      customer_phone: phoneRaw || null,
      recurring_series_id: series.id,
      computed_price: price,
      notes: "Langganan mingguan",
      created_by: user.id,
    }))
  );

  revalidatePath("/app/series");
  revalidatePath("/app/jadwal");
  revalidatePath("/");
  return {
    error: null,
    ok: true,
    info: `${created} jadwal mingguan dibuat${dates.length - created > 0 ? `, ${dates.length - created} dilewati (bentrok)` : ""}`,
  };
}

export type SeriesState = ActionState & { info?: string };

export async function setSeriesStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const id = String(formData.get("series_id") ?? "");
  const next = String(formData.get("status") ?? "");
  if (!id || !["active", "paused", "ended"].includes(next))
    return { error: "Permintaan tidak valid." };

  const { error } = await supabase
    .from("recurring_series")
    .update({ status: next })
    .eq("id", id);
  if (error) return { error: `Gagal update langganan: ${error.message}` };

  revalidatePath("/app/series");
  return { error: null, ok: true };
}

/** Extend an existing series by generating more weekly instances */
export async function extendSeries(
  _prev: SeriesState,
  formData: FormData
): Promise<SeriesState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase, user } = ctx;

  const id = String(formData.get("series_id") ?? "");
  if (!id) return { error: "Langganan tidak valid." };

  const { data: s } = await supabase
    .from("recurring_series")
    .select(
      "court_id,customer_id,customer_name,customer_phone,start_time,end_time,start_date,end_date,status"
    )
    .eq("id", id)
    .maybeSingle();
  if (!s) return { error: "Langganan tidak ditemukan." };
  if (s.status !== "active")
    return { error: "Aktifkan langganan dulu sebelum menambah jadwal." };

  // Find furthest generated instance to continue from
  const { data: lastBooking } = await supabase
    .from("bookings")
    .select("booking_date")
    .eq("recurring_series_id", id)
    .neq("status", "cancelled")
    .order("booking_date", { ascending: false })
    .limit(1);

  const hasInstances = Boolean(lastBooking?.[0]?.booking_date);
  const baseDate =
    (lastBooking?.[0]?.booking_date as string | undefined) ?? (s.start_date as string);
  const weeks = 8;
  const endDate = s.end_date as string | null;

  const pricing = await getActivePricing(supabase, baseDate);
  const startH = Number(String(s.start_time).slice(0, 2));
  const endH = Number(String(s.end_time).slice(0, 2));
  const price = computePrice(pricing, startH, endH);

  // From an existing instance continue at +7d; from an empty series
  // start AT the start_date (previously skipped the first week).
  const dates: string[] = [];
  for (let i = hasInstances ? 1 : 0; i <= weeks; i++) {
    const d = addDaysISO(baseDate, i * 7);
    if (endDate && d > endDate) break;
    dates.push(d);
  }

  const created = await insertSeriesInstances(
    supabase,
    dates.map((d) => ({
      court_id: s.court_id as string,
      booking_date: d,
      start_time: s.start_time as string,
      end_time: s.end_time as string,
      status: "confirmed",
      source: "walk_in",
      customer_id: (s.customer_id as string) || null,
      customer_name: s.customer_name as string,
      customer_phone: (s.customer_phone as string) || null,
      recurring_series_id: id,
      computed_price: price,
      notes: "Langganan mingguan",
      created_by: user.id,
    }))
  );

  revalidatePath("/app/series");
  revalidatePath("/app/jadwal");
  return {
    error: null,
    ok: true,
    info:
      dates.length === 0
        ? "Semua jadwal sampai tanggal akhir sudah ada."
        : `${created} jadwal ditambahkan${dates.length - created > 0 ? `, ${dates.length - created} dilewati (bentrok)` : ""}`,
  };
}

/* ------------------------------------------------------------------ */
/* Owner: expenses                                                     */
/* ------------------------------------------------------------------ */

export async function createExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let ctx: Awaited<ReturnType<typeof requireOwner>>;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase, user } = ctx;

  const category = String(formData.get("category") ?? "").trim().slice(0, 60);
  const amount = Number(
    String(formData.get("amount") ?? "").replace(/\D/g, "").slice(0, 10)
  );
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  const spentAt = String(formData.get("spent_at") ?? "");

  if (!category) return { error: "Kategori wajib diisi." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Nominal harus lebih dari 0." };
  if (amount > 1_000_000_000) return { error: "Nominal melebihi batas maksimum." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAt)) return { error: "Tanggal tidak valid." };

  const { error } = await supabase.from("expenses").insert({
    category,
    amount,
    note,
    spent_at: spentAt,
    created_by: user.id,
  });
  if (error) return { error: `Gagal simpan pengeluaran: ${error.message}` };

  revalidatePath("/app/pengeluaran");
  revalidatePath("/app/laporan");
  return { error: null, ok: true };
}

export async function deleteExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const id = String(formData.get("expense_id") ?? "");
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: `Gagal hapus: ${error.message}` };

  revalidatePath("/app/pengeluaran");
  revalidatePath("/app/laporan");
  return { error: null, ok: true };
}

/* ------------------------------------------------------------------ */
/* Owner: settings (courts, pricing, staff)                            */
/* ------------------------------------------------------------------ */

export async function upsertCourt(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const id = String(formData.get("court_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sortRaw = formData.get("sort_order");

  if (!name) return { error: "Nama lapangan wajib diisi." };

  // sort_order is only patched when the form provides it — renaming must
  // not silently reset a court's ordering position.
  const patch: { name: string; sort_order?: number } = { name };
  if (sortRaw !== null && sortRaw !== "") {
    const sortOrder = Number(sortRaw);
    if (Number.isInteger(sortOrder)) patch.sort_order = sortOrder;
  }

  const { error } = id
    ? await supabase.from("courts").update(patch).eq("id", id)
    : await supabase
        .from("courts")
        .insert({ ...patch, sort_order: Number(sortRaw ?? 0) || 0 });

  if (error) return { error: `Gagal menyimpan lapangan: ${error.message}` };

  revalidatePath("/app/pengaturan");
  revalidatePath("/");
  return { error: null, ok: true };
}

export async function toggleCourtActive(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const id = String(formData.get("court_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  const { error } = await supabase
    .from("courts")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { error: `Gagal: ${error.message}` };

  revalidatePath("/app/pengaturan");
  revalidatePath("/");
  return { error: null, ok: true };
}

export async function createPricingRule(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const validFrom = String(formData.get("valid_from") ?? "");
  const openTime = String(formData.get("open_time") ?? "07:00");
  const closeTime = String(formData.get("close_time") ?? "23:00");
  const dayEnd = String(formData.get("day_end") ?? "17:00");
  const priceDay = Number(String(formData.get("price_day") ?? "").replace(/\D/g, ""));
  const priceEvening = Number(
    String(formData.get("price_evening") ?? "").replace(/\D/g, "")
  );

  if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom))
    return { error: "Tanggal berlaku tidak valid." };
  if (!Number.isFinite(priceDay) || !Number.isFinite(priceEvening) || priceDay <= 0)
    return { error: "Harga tidak valid." };

  const { error } = await supabase.from("pricing_rules").insert({
    valid_from: validFrom,
    open_time: openTime,
    close_time: closeTime,
    day_start: openTime,
    day_end: dayEnd,
    price_day: priceDay,
    price_evening: priceEvening,
    is_active: true,
  });
  if (error) return { error: `Gagal simpan aturan harga: ${error.message}` };

  revalidatePath("/app/pengaturan");
  revalidatePath("/");
  return { error: null, ok: true };
}

export async function toggleProfileActive(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase, user } = ctx;

  const id = String(formData.get("profile_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  if (id === user.id && !active)
    return { error: "Tidak bisa menonaktifkan akun sendiri." };

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { error: `Gagal: ${error.message}` };

  revalidatePath("/app/pengaturan");
  return { error: null, ok: true };
}

const PASSWORD_MAX_LENGTH = 72; // bcrypt input limit

export async function createStaff(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "").slice(0, 16);
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: "Nama wajib diisi." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Email tidak valid." };
  if (password.length < 8) return { error: "Password minimal 8 karakter." };
  if (password.length > PASSWORD_MAX_LENGTH)
    return { error: `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.` };

  // Create the staff account via the proxy (owner session is attached
  // automatically by the connector). Was Supabase admin.createUser.
  // phone is collected for display but not stored in sports_users yet
  // (proxy migrates phone column later); forward anyway for future compat.
  const { proxyRegister } = await import("@/lib/proxy/register");
  const { data, error } = await proxyRegister({
    email,
    password,
    full_name: fullName,
    phone: phone || undefined,
  } as { email: string; password: string; full_name: string; phone?: string });

  if (error || !data) {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || error?.status === 409)
      return { error: "Email sudah terdaftar." };
    return { error: `Gagal membuat akun: ${error?.message ?? "unknown"}` };
  }

  revalidatePath("/app/pengaturan");
  return { error: null, ok: true };
}

export async function updateCustomerNotes(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("customer_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;
  if (!id) return { error: "Pelanggan tidak valid." };

  const { error } = await supabase
    .from("customers")
    .update({ notes })
    .eq("id", id);
  if (error) return { error: `Gagal simpan catatan: ${error.message}` };

  revalidatePath("/app/pelanggan");
  return { error: null, ok: true };
}
