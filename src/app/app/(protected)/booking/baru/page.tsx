import { Plus } from "lucide-react";
import { createClient } from "@/lib/proxy/client";
import { DataUnavailable, EmptyState, firstError } from "@/components/app/EmptyState";
import { todayISO, type PricingInfo, type PricingRule } from "@/lib/availability";
import BookingForm from "@/components/app/BookingForm";

export const metadata = { title: "Booking Baru · Centrum Manager" };

const FALLBACK_PRICING: PricingInfo = {
  openHour: 7,
  closeHour: 23,
  dayEndHour: 17,
  priceDay: 40000,
  priceEvening: 50000,
};

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; court?: string; hour?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const hour = /^\d{1,2}$/.test(sp.hour ?? "") ? Number(sp.hour) : null;
  const court = /^[0-9a-f-]{36}$/i.test(sp.court ?? "") ? sp.court! : null;

  const supabase = await createClient();
  const [courtsRes, pricingRes, customersRes] = await Promise.all([
    supabase.from("courts").select("id,name").eq("is_active", true).order("sort_order"),
    supabase.rpc<PricingRule[]>("get_pricing_for", { p_date: date }),
    supabase
      .from("customers")
      .select("name,phone")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const p = pricingRes.data?.[0];
  const pricing: PricingInfo = p
    ? {
        openHour: Number(p.open_time.slice(0, 2)),
        closeHour: Number(p.close_time.slice(0, 2)),
        dayEndHour: Number(p.day_end.slice(0, 2)),
        priceDay: Number(p.price_day),
        priceEvening: Number(p.price_evening),
      }
    : FALLBACK_PRICING;

  const courts = (courtsRes.data ?? []) as Array<{ id: string; name: string }>;
  const readError = firstError(courtsRes, pricingRes, customersRes);

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-zinc-50">
        <Plus className="h-5 w-5" strokeWidth={1.75} /> Booking Baru
      </h1>
      {readError ? (
        <DataUnavailable detail={readError} />
      ) : courts.length === 0 ? (
        <EmptyState
          title="Belum ada lapangan"
          body="Booking baru butuh minimal satu lapangan. Tambahkan lapangan dulu di Pengaturan."
          action={{ href: "/app/pengaturan", label: "Buka Pengaturan" }}
        />
      ) : (
        <BookingForm
          courts={courts}
          pricing={pricing}
          customers={(customersRes.data ?? []) as Array<{ name: string; phone: string }>}
          defaultDate={date}
          defaultCourtId={court}
          defaultStartHour={hour}
        />
      )}
    </div>
  );
}
