import { createClient } from "@/lib/supabase/server";
import { todayISO, type PricingInfo } from "@/lib/availability";
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
    supabase.rpc("get_pricing_for", { p_date: date }),
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

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-black text-navy-900">➕ Booking Baru</h1>
      <BookingForm
        courts={(courtsRes.data ?? []) as Array<{ id: string; name: string }>}
        pricing={pricing}
        customers={(customersRes.data ?? []) as Array<{ name: string; phone: string }>}
        defaultDate={date}
        defaultCourtId={court}
        defaultStartHour={hour}
      />
    </div>
  );
}
