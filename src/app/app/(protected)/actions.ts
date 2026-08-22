"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computePrice } from "@/lib/availability";

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
