"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, computePrice } from "@/lib/availability";

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
  const { data } = await supabase.rpc("get_pricing_for", { p_date: dateISO });
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
  const name = String(formData.get("customer_name") ?? "").trim();
  const phoneRaw = String(formData.get("customer_phone") ?? "").replace(/\D/g, "");
  const source = String(formData.get("source") ?? "walk_in") as "whatsapp" | "walk_in";
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const overrideRaw = String(formData.get("override_price") ?? "").replace(/\D/g, "");

  const fieldErrors: Record<string, string> = {};
  if (!courtId) fieldErrors.court_id = "Pilih lapangan";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) fieldErrors.date = "Tanggal tidak valid";
  if (!Number.isFinite(startH) || !Number.isFinite(endH) || endH <= startH)
    fieldErrors.end_hour = "Jam selesai harus setelah jam mulai";
  if (!name) fieldErrors.customer_name = "Nama wajib diisi";
  if (phoneRaw.length < 8) fieldErrors.customer_phone = "Nomor WhatsApp tidak valid";
  if (Object.keys(fieldErrors).length > 0)
    return { error: "Periksa kembali form.", fieldErrors };

  // Validate against operating hours
  const pricing = await getActivePricing(supabase, dateISO);
  if (startH < pricing.openHour || endH > pricing.closeHour) {
    return {
      error: `Jam operasional ${String(pricing.openHour).padStart(2, "0")}.00–${String(
        pricing.closeHour
      ).padStart(2, "0")}.00 WIB.`,
    };
  }

  // Owner-only manual price override
  const owner = await isOwner(supabase);
  const overridePrice = owner && overrideRaw ? Number(overrideRaw) : null;

  const computedPrice = computePrice(pricing, startH, endH);

  // Upsert customer directory by phone
  let customerId: string | null = null;
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", phoneRaw)
    .maybeSingle();
  if (existingCustomer) {
    customerId = existingCustomer.id as string;
  } else {
    const { data: newCustomer } = await supabase
      .from("customers")
      .insert({ name, phone: phoneRaw })
      .select("id")
      .single();
    customerId = (newCustomer?.id as string) ?? null;
  }

  const { error } = await supabase.from("bookings").insert({
    court_id: courtId,
    booking_date: dateISO,
    start_time: `${String(startH).padStart(2, "0")}:00`,
    end_time: `${String(endH).padStart(2, "0")}:00`,
    status: "confirmed",
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

  const { data: current } = await supabase
    .from("bookings")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  const from = current?.status as string | undefined;
  if (!from) return { error: "Booking tidak ditemukan." };

  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(next)) {
    return { error: `Tidak bisa ubah status dari ${from} ke ${next}.` };
  }

  const patch: Record<string, unknown> = { status: next };
  if (next === "no_show") {
    // bump customer's no-show counter when known
    const { data: b } = await supabase
      .from("bookings")
      .select("customer_id")
      .eq("id", id)
      .maybeSingle();
    const cid = b?.customer_id as string | undefined;
    if (cid) {
      const { data: c } = await supabase
        .from("customers")
        .select("no_show_count")
        .eq("id", cid)
        .maybeSingle();
      await supabase
        .from("customers")
        .update({ no_show_count: ((c?.no_show_count as number) ?? 0) + 1 })
        .eq("id", cid);
    }
  }

  const { error } = await supabase.from("bookings").update(patch).eq("id", id);
  if (error) return { error: `Gagal update: ${error.message}` };

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

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export async function recordPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const bookingId = String(formData.get("booking_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").replace(/\D/g, "");
  const method = String(formData.get("method") ?? "cash") as "cash" | "qris";
  const amount = Number(amountRaw);

  if (!bookingId) return { error: "Booking tidak valid" };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Nominal harus lebih dari 0." };

  const { error } = await supabase.from("payments").insert({
    booking_id: bookingId,
    amount,
    method,
    recorded_by: user.id,
  });

  if (error) return { error: `Gagal catat pembayaran: ${error.message}` };

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
  const weeks = Math.min(Math.max(Number(formData.get("weeks") ?? 8), 1), MAX_WEEKS);

  if (!courtId) return { error: "Pilih lapangan." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { error: "Tanggal mulai tidak valid." };
  if (!Number.isFinite(startH) || !Number.isFinite(endH) || endH <= startH)
    return { error: "Jam selesai harus setelah jam mulai." };
  if (!name) return { error: "Nama pelanggan wajib diisi." };

  // Upsert customer
  let customerId: string | null = null;
  if (phoneRaw.length >= 8) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", phoneRaw)
      .maybeSingle();
    customerId =
      (existing?.id as string) ??
      (
        (
          await supabase
            .from("customers")
            .insert({ name, phone: phoneRaw })
            .select("id")
            .single()
        ).data?.id as string | undefined
      ) ??
      null;
  }

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
      status: "active",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (sErr || !series)
    return { error: `Gagal membuat langganan: ${sErr?.message ?? "?"}` };

  // Generate weekly instances, skipping conflicts
  let created = 0;
  for (let i = 0; i < weeks; i++) {
    const d = addDaysISO(startDate, i * 7);
    const { error } = await supabase.from("bookings").insert({
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
    });
    if (!error) created++;
  }

  revalidatePath("/app/series");
  revalidatePath("/app/jadwal");
  revalidatePath("/");
  return {
    error: null,
    ok: true,
    info: `${created} jadwal mingguan dibuat`,
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
    .select("*")
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

  const baseDate =
    (lastBooking?.[0]?.booking_date as string | undefined) ?? (s.start_date as string);
  const weeks = 8;

  const pricing = await getActivePricing(supabase, baseDate);
  const startH = Number(String(s.start_time).slice(0, 2));
  const endH = Number(String(s.end_time).slice(0, 2));
  const price = computePrice(pricing, startH, endH);

  let created = 0;
  for (let i = 1; i <= weeks; i++) {
    const d = addDaysISO(baseDate, i * 7);
    const { error } = await supabase.from("bookings").insert({
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
    });
    if (!error) created++;
  }

  revalidatePath("/app/series");
  revalidatePath("/app/jadwal");
  return { error: null, ok: true, info: `${created} jadwal ditambahkan` };
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

  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").replace(/\D/g, ""));
  const note = String(formData.get("note") ?? "").trim() || null;
  const spentAt = String(formData.get("spent_at") ?? "");

  if (!category) return { error: "Kategori wajib diisi." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Nominal harus lebih dari 0." };
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
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!name) return { error: "Nama lapangan wajib diisi." };

  const { error } = id
    ? await supabase.from("courts").update({ name, sort_order: sortOrder }).eq("id", id)
    : await supabase.from("courts").insert({ name, sort_order: sortOrder });

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
