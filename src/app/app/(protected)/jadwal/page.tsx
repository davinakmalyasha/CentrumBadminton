import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  addDaysISO,
  formatIDR,
  todayISO,
  type PricingInfo,
} from "@/lib/availability";
import type { Booking } from "@/lib/types";
import TimelineGrid, { type Block } from "@/components/app/TimelineGrid";
import ScheduleRealtime from "@/components/app/ScheduleRealtime";

type Row = Booking & { courts: { name: string } | null };

export const metadata = { title: "Jadwal · Centrum Manager" };

const FALLBACK_PRICING: PricingInfo = {
  openHour: 7,
  closeHour: 23,
  dayEndHour: 17,
  priceDay: 40000,
  priceEvening: 50000,
};

export default async function JadwalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; created?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  const supabase = await createClient();
  const [bookingsRes, courtsRes, pricingRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, courts(name)")
      .eq("booking_date", date)
      .neq("status", "cancelled")
      .order("start_time"),
    supabase.from("courts").select("id,name").eq("is_active", true).order("sort_order"),
    supabase.rpc("get_pricing_for", { p_date: date }),
  ]);

  const bookings = (bookingsRes.data ?? []) as Row[];
  const courts = (courtsRes.data ?? []) as Array<{ id: string; name: string }>;

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

  const blocks: Block[] = bookings.map((b) => ({
    id: b.id,
    courtId: b.court_id,
    startHour: Number(b.start_time.slice(0, 2)),
    endHour: Number(b.end_time.slice(0, 2)),
    label: b.customer_name,
    status: b.status,
    price: Number(b.override_price ?? b.computed_price),
    courtName: b.courts?.name ?? "",
    phone: b.customer_phone,
  }));

  const dayLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${date}T00:00:00+07:00`));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/jadwal?date=${addDaysISO(date, -1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-brand-200 bg-white text-navy-800"
          aria-label="Hari sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <h1 className="flex items-center justify-center gap-2 text-base font-black text-navy-900">
            <CalendarDays className="h-5 w-5" strokeWidth={1.75} /> Jadwal
          </h1>
          <p className="text-xs font-semibold capitalize text-navy-700/60">
            {date === today ? "Hari ini" : dayLabel}
          </p>
        </div>
        <Link
          href={`/app/jadwal?date=${addDaysISO(date, 1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-brand-200 bg-white text-navy-800"
          aria-label="Hari berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {date !== today && (
        <div className="flex justify-center">
          <Link
            href={`/app/jadwal`}
            className="inline-flex items-center gap-1 rounded-full border border-sky-brand-200 bg-white px-3 py-1 text-[11px] font-bold text-sky-brand-600"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Kembali ke hari ini
          </Link>
        </div>
      )}

      {sp.created && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <Check className="mr-1 inline h-3.5 w-3.5" />
          Booking berhasil dibuat
        </div>
      )}

      <ScheduleRealtime dateISO={date} />

      <TimelineGrid
        courts={courts}
        blocks={blocks}
        pricing={pricing}
        dateISO={date}
      />

      {/* Agenda */}
      {blocks.length > 0 && (
        <ul className="space-y-2">
          {[...blocks]
            .sort((a, b) => a.startHour - b.startHour)
            .map((b) => (
              <li
                key={`agenda-${b.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-sky-brand-200 bg-white px-3.5 py-2.5"
              >
                <span className="min-w-0 truncate text-xs font-bold text-navy-900">
                  {String(b.startHour).padStart(2, "0")}.00–
                  {String(b.endHour).padStart(2, "0")}.00{" "}
                  <span className="ml-1 font-semibold text-navy-700/60">{b.label}</span>
                </span>
                <span className="flex-shrink-0 text-[11px] font-bold text-sky-brand-600">
                  {formatIDR(b.price)}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
