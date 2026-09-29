import { createClient } from "@/lib/proxy/client";
import { VISIBLE_ON_SCHEDULE } from "@/lib/booking-status";
import {
  addDaysISO,
  formatIDR,
  hourLabel,
  todayISO,
  wibNowMinutes,
  type PricingRule,
} from "@/lib/availability";
import type { Booking } from "@/lib/types";
import {
  ArrowUpRight,
  BarChart3,
  Footprints,
  MessageCircle,
  SkipForward,
  TrendingUp,
  TriangleAlert,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import Shuttlecock from "@/components/icons/Shuttlecock";
import StatCard from "@/components/app/StatCard";
import StatusBadge from "@/components/app/StatusBadge";
import BookingActions from "@/components/app/BookingActions";
import OwnerMenu from "@/components/app/OwnerMenu";
import DailyReportNudge from "@/components/app/DailyReportNudge";
import LiveLapangan from "@/components/app/LiveLapangan";

export const metadata = { title: "Dashboard · Centrum Manager" };

type Row = Booking & { courts: { name: string } | null };

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  const [bookingsRes, paymentsRes, courtsRes, pricingRes, kantinRes, lowStockRes] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("*, courts(name)")
        .eq("booking_date", today)
        .in("status", VISIBLE_ON_SCHEDULE)
        .order("start_time"),
      supabase
        .from("payments")
        .select("amount,method")
        .gte("paid_at", `${today}T00:00:00+07:00`)
        .lt("paid_at", `${tomorrow}T00:00:00+07:00`),
      supabase.from("courts").select("id").eq("is_active", true),
      supabase.rpc<PricingRule[]>("get_pricing_for", { p_date: today }),
      supabase
        .from("kantin_sales")
        .select("total")
        .gte("created_at", `${today}T00:00:00+07:00`)
        .lt("created_at", `${tomorrow}T00:00:00+07:00`),
      supabase
        .from("kantin_products")
        .select("name,stock,low_stock_threshold")
        .eq("track_stock", true)
        .order("name"),
    ]);

  const bookings = (bookingsRes.data ?? []) as Row[];
  const payments = (paymentsRes.data ?? []) as Array<{
    amount: number;
    method: string;
  }>;
  const courtCount = Math.max(courtsRes.data?.length ?? 0, 1);
  const p = pricingRes.data?.[0];
  const openHours =
    (p ? Number(p.close_time.slice(0, 2)) - Number(p.open_time.slice(0, 2)) : 16) ||
    16;

  // Revenue stats
  const cash = payments
    .filter((x) => x.method === "cash")
    .reduce((a, b) => a + Number(b.amount), 0);
  const qris = payments
    .filter((x) => x.method === "qris")
    .reduce((a, b) => a + Number(b.amount), 0);

  // Occupancy: booked hours vs capacity
  const activeBookings = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "no_show"
  );
  const bookedHours = activeBookings.reduce((sum, b) => {
    const s = Number(b.start_time.slice(0, 2));
    const e = Number(b.end_time.slice(0, 2));
    return sum + Math.max(e - s, 0);
  }, 0);
  const occupancy = Math.round((bookedHours / (courtCount * openHours)) * 100);

  // Next up: first active booking whose end is in the future
  const nowMin = wibNowMinutes();
  const nextUp = activeBookings.find((b) => {
    const endMin = Number(b.end_time.slice(0, 2)) * 60;
    return endMin > nowMin && (b.status === "confirmed" || b.status === "checked_in");
  });

  // Kantin: revenue today + low-stock alert
  const kantinToday = ((kantinRes.data ?? []) as Array<{ total: number }>).reduce(
    (a, s) => a + Number(s.total),
    0
  );
  const lowStock = (
    (lowStockRes.data ?? []) as Array<{
      stock: number;
      low_stock_threshold: number;
      name: string;
    }>
  ).filter((p) => p.stock <= p.low_stock_threshold);

  return (
    <div className="manager-rise space-y-5">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          <BarChart3 className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" /> Hari Ini{" "}
          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {new Intl.DateTimeFormat("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "short",
              timeZone: "Asia/Jakarta",
            }).format(new Date(`${today}T00:00:00+07:00`))}
          </span>
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Pendapatan"
          value={formatIDR(cash + qris + kantinToday)}
          sub={`Lapangan ${formatIDR(cash + qris)} · Kantin ${formatIDR(kantinToday)}`}
        />
        <StatCard
          icon={Shuttlecock}
          label="Booking aktif"
          value={activeBookings.length}
          sub={`${bookings.length} total hari ini`}
        />
        <StatCard icon={TrendingUp} label="Okupansi" value={`${occupancy}%`} sub={`${bookedHours} jam terpakai`} />
        <StatCard
          icon={SkipForward}
          label="Berikutnya"
          value={
            nextUp
              ? `${hourLabel(Number(nextUp.start_time.slice(0, 2)))}`
              : "—"
          }
          sub={nextUp ? `${nextUp.customer_name} · ${nextUp.courts?.name ?? ""}` : "Tidak ada lagi"}
        />
      </div>

      {/* Body — single column until xl, then Agenda takes the wide 2/3
          column and the tools stack in a 1/3 rail beside it. */}
      <div className="grid gap-5 xl:grid-cols-3 xl:items-start">
        <div className="space-y-5 xl:col-start-3 xl:row-start-1">
          {/* Low stock alert */}
          {lowStock.length > 0 && (
            <Link
              href="/app/kantin/stok"
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/40"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden="true" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">
                Stok kantin menipis: <b>{lowStock.map((p) => p.name).join(", ")}</b>
              </span>
            </Link>
          )}

          {/* Live lapangan — which is in use till when, + nambah jam / kosongkan */}
          <LiveLapangan bookings={bookings as unknown as Array<{ id: string; court_id: string; courts: { name: string } | null; customer_name: string; start_time: string; end_time: string; status: string }>} />

          {/* Daily closing nudge (after 20:00 WIB) */}
          <DailyReportNudge />

          {/* Owner tools */}
          <OwnerMenu />
        </div>

        {/* Agenda */}
        <div className="xl:col-start-1 xl:row-start-1 xl:col-span-2">
        <h2 className="mb-2 text-xs font-bold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
          Agenda Lapangan
        </h2>
        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Belum ada booking hari ini
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5 2xl:grid 2xl:grid-cols-2 2xl:gap-2.5 2xl:space-y-0">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {hourLabel(Number(b.start_time.slice(0, 2)))}–
                      {hourLabel(Number(b.end_time.slice(0, 2)))}
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {b.courts?.name ?? "—"}
                      </span>
                      <StatusBadge status={b.status} />
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      <User className="mr-1 inline-block h-3.5 w-3.5 align-[-1px]" />
                      {b.customer_name}
                      {b.customer_phone && (
                        <>
                          {" · "}
                          <a
                            href={`https://wa.me/62${b.customer_phone.replace(/^0/, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:underline"
                          >
                            WA
                            <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
                          </a>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {formatIDR(Number(b.override_price ?? b.computed_price))}{" · "}
                      {b.source === "whatsapp" ? (
                        <>
                          <MessageCircle className="mr-0.5 inline-block h-3 w-3 align-[-1px]" />
                          WA
                        </>
                      ) : (
                        <>
                          <Footprints className="mr-0.5 inline-block h-3 w-3 align-[-1px]" />
                          Walk-in
                        </>
                      )}
                      {" · "}
                      {b.payment_status === "paid" ? (
                        <>
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          Lunas
                        </>
                      ) : b.payment_status === "partial" ? (
                        <>
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
                          DP
                        </>
                      ) : (
                        <>
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />
                          Belum bayar
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5">
                  <BookingActions bookingId={b.id} status={b.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>
    </div>
  );
}
