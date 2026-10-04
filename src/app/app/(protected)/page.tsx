import { createClient } from "@/lib/proxy/client";
import { getRole } from "@/lib/guard";
import { OCCUPIES_COURT, VISIBLE_ON_SCHEDULE } from "@/lib/booking-status";
import {
  addDaysISO,
  durationHours,
  formatHours,
  formatIDR,
  todayISO,
  type PricingRule,
} from "@/lib/availability";
import { DataUnavailable, firstError } from "@/components/app/EmptyState";
import type { Booking } from "@/lib/types";
import { TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import Shuttlecock from "@/components/icons/Shuttlecock";
import StatCard from "@/components/app/StatCard";
import LapanganTerpakai from "@/components/app/LapanganTerpakai";
import DailyReportNudge from "@/components/app/DailyReportNudge";

export const metadata = { title: "Dashboard · Centrum Manager" };

type Row = Booking & { courts: { name: string } | null };

export default async function DashboardPage() {
  const supabase = await createClient();
  const role = await getRole();
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

  const heading = (
    <h1 className="flex flex-wrap items-baseline gap-2 text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
      Hari Ini{" "}
      <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        {new Intl.DateTimeFormat("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "short",
          timeZone: "Asia/Jakarta",
        }).format(new Date(`${today}T00:00:00+07:00`))}
      </span>
    </h1>
  );

  // Every figure below is a sum or a count over one of these reads. The
  // data layer reports a failed read in `error` rather than quietly handing
  // back an empty list, and this page used to ignore it — an unreachable
  // proxy rendered a confident "Okupansi 0%", "Tidak ada lagi" and "Belum
  // ada booking hari ini", which is indistinguishable from a quiet Sunday.
  const readError = firstError(
    bookingsRes,
    paymentsRes,
    courtsRes,
    pricingRes,
    kantinRes,
    lowStockRes
  );
  if (readError) {
    return (
      <div className="manager-rise space-y-5">
        {heading}
        <DataUnavailable detail={readError} />
      </div>
    );
  }

  // Each list is capped by the proxy. A capped sum is a wrong number that
  // looks right, so say which inputs were shortened instead of presenting a
  // partial total as final.
  const capped = Object.entries({
    booking: bookingsRes.truncated,
    pembayaran: paymentsRes.truncated,
    kantin: kantinRes.truncated,
  })
    .filter(([, wasCapped]) => wasCapped)
    .map(([name]) => name);

  const bookings = (bookingsRes.data ?? []) as Row[];
  const payments = (paymentsRes.data ?? []) as Array<{
    amount: number;
    method: string;
  }>;

  // Revenue stats
  const cash = payments
    .filter((x) => x.method === "cash")
    .reduce((a, b) => a + Number(b.amount), 0);
  const qris = payments
    .filter((x) => x.method === "qris")
    .reduce((a, b) => a + Number(b.amount), 0);

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

  // Booking status breakdown. The count is everything on the books today;
  // the sub-line is the part that still needs someone to do something.
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const liveCount = bookings.filter((b) => b.status === "checked_in").length;
  const bookingSub =
    pendingCount > 0
      ? `${pendingCount} menunggu konfirmasi`
      : liveCount > 0
        ? `${liveCount} sedang main`
        : "Semua sudah dikonfirmasi";

  // Occupancy, folded into the "Booking hari ini" tile below rather than
  // given its own card: both figures come from this one `bookings` array for
  // this one day, and a separate tile made the count and the ratio read as
  // unrelated numbers. OCCUPIES_COURT is exactly the set whose hours the
  // venue could not have sold to anyone else — a cancelled slot is free again
  // and a no-show never took the court — so it is the honest numerator.
  // Minutes are kept because truncating to whole hours discarded a
  // 07:00-07:30 booking as "0 jam terpakai".
  const occupiesCourt = bookings.filter((b) =>
    (OCCUPIES_COURT as readonly string[]).includes(b.status)
  );
  const bookedHours = occupiesCourt.reduce(
    (sum, b) => sum + durationHours(b.start_time, b.end_time),
    0
  );
  const courtCount = (courtsRes.data ?? []).length;
  const p = pricingRes.data?.[0];
  const openHours = p
    ? Number(p.close_time.slice(0, 2)) - Number(p.open_time.slice(0, 2))
    : 0;
  // No floor-to-1 and no silent 16-hour default: both used to turn "we
  // could not tell" into a plausible-looking percentage.
  const capacityHours =
    courtCount > 0 && openHours > 0 ? courtCount * openHours : null;
  const occupancySub =
    capacityHours === null
      ? !p
        ? "jam operasional belum diatur"
        : "belum ada lapangan aktif"
      : `${formatHours(bookedHours)} dari ${capacityHours} jam terpakai`;
  const occupancyPercent =
    capacityHours === null ? null : Math.round((bookedHours / capacityHours) * 100);

  // The court panel decides which bookings are live from the clock in the
  // browser; this side only needs the day's hours, which are stable per render.
  const courtBookings = bookings.map((b) => ({
    id: b.id,
    courts: b.courts,
    customer_name: b.customer_name,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
  }));

  return (
    <div className="manager-rise space-y-5">
      {heading}

      {capped.length > 0 && (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
        >
          Data {capped.join(", ")} hari ini melebihi batas tampilan, jadi angka di bawah
          hanya menghitung bagian yang terambil.
        </p>
      )}

      {/* Revenue keeps the full row: it is the number staff read first. */}
      <StatCard
        icon={Wallet}
        label="Pendapatan"
        value={formatIDR(cash + qris + kantinToday)}
        sub={`Lapangan ${formatIDR(cash + qris)} - Kantin ${formatIDR(kantinToday)}`}
      />

      {/* 40 / 60. A booking count is one short number and reads fine in a
          narrow column; the court panel needs room for a court name, a
          customer and two buttons on every live row. */}
      <div className="grid gap-3 sm:grid-cols-5">
        <StatCard
          className="sm:col-span-2"
          icon={Shuttlecock}
          label="Booking hari ini"
          value={bookings.length}
          sub={bookingSub}
        />
        <div className="sm:col-span-3">
          <LapanganTerpakai
            bookings={courtBookings}
            percent={occupancyPercent}
            note={occupancySub}
          />
        </div>
      </div>

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

      {/* Daily closing nudge (after 20:00 WIB). Owner-only: the closing
          report generator lives in /app/laporan and is gated there, so a
          pegawai tapping "Buat" would land on a page with no Generate button
          and no explanation. */}
      {role === "owner" && <DailyReportNudge />}
    </div>
  );
}
