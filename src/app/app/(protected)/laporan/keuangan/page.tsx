import Link from "next/link";
import { requireStaffPage, getRole } from "@/lib/guard";
import ClosingReportCard from "@/components/app/ClosingReportCard";
import { DataUnavailable, firstError } from "@/components/app/EmptyState";
import { formatIDR, type PricingRule } from "@/lib/availability";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Flame,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Shuttlecock from "@/components/icons/Shuttlecock";
import {
  addMonths,
  currentMonthKey,
  daysInMonth,
  monthEndExclusive,
  monthStart,
  formatMonthLabel,
} from "@/lib/months";
import { todayISO } from "@/lib/availability";

export const metadata = { title: "Keuangan · Centrum Manager" };

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonthKey();
  const start = monthStart(month);
  const endEx = monthEndExclusive(month);

  const supabase = await requireStaffPage();
  const isOwner = (await getRole()) === "owner";

  const [pricingForMonth, paymentsRes, bookingsRes, expensesRes, courtsRes] =
    await Promise.all([
      supabase.rpc<PricingRule[]>("get_pricing_for", { p_date: start }),
      supabase
        .from("payments")
        .select("amount,method,paid_at")
        .gte("paid_at", `${start}T00:00:00+07:00`)
        .lt("paid_at", `${endEx}T00:00:00+07:00`),
      supabase
        .from("bookings")
        .select("court_id,start_time,end_time,courts(name)")
        .neq("status", "cancelled")
        .neq("status", "no_show")
        .gte("booking_date", start)
        .lt("booking_date", endEx),
      supabase
        .from("expenses")
        .select("amount")
        .gte("spent_at", start)
        .lt("spent_at", endEx),
      supabase.from("courts").select("id,name").eq("is_active", true),
    ]);

  const pRule = pricingForMonth.data?.[0];

  const payments = (paymentsRes.data ?? []) as Array<{
    amount: number;
    method: string;
    paid_at: string;
  }>;
  const bookings = (bookingsRes.data ?? []) as unknown as Array<{
    court_id: string;
    start_time: string;
    end_time: string;
    courts: { name: string } | null;
  }>;
  const expenses = (expensesRes.data ?? []) as Array<{ amount: number }>;
  const courtList = (courtsRes.data ?? []) as Array<{ id: string; name: string }>;

  // Every figure below is a sum over one of those lists. Each list is
  // capped by the proxy, and a capped sum is a wrong number that looks
  // right — "Pendapatan kotor Rp0" is indistinguishable from "Rp0 of the
  // rows we happened to fetch". So the report says which of its inputs
  // were shortened instead of presenting a partial total as final.
  const cappedBy = {
    pembayaran: paymentsRes.truncated,
    booking: bookingsRes.truncated,
    pengeluaran: expensesRes.truncated,
  };
  const capped = Object.entries(cappedBy)
    .filter(([, wasCapped]) => wasCapped)
    .map(([name]) => name);
  // Real COGS + top products live on the Kantin detail page, which fetches
  // its own sales. This page covers court money only.

  const openHours = pRule
    ? Math.max(
        Number(pRule.close_time.slice(0, 2)) -
          Number(pRule.open_time.slice(0, 2)),
        1
      )
    : 16;

  // Totals
  let cash = 0;
  let qris = 0;
  for (const p of payments) {
    if (p.method === "qris") qris += Number(p.amount);
    else cash += Number(p.amount);
  }
  const gross = cash + qris;
  const expenseTotal = expenses.reduce((a, b) => a + Number(b.amount), 0);

  // Net is court money only: kantin has its own Omzet/Modal/Laba on the
  // Kantin detail page, so mixing it in here would double-report it across
  // the two pages.
  const net = gross - expenseTotal;

  // Daily revenue (WIB)
  const daily = new Map<string, number>();
  for (const p of payments) {
    const d = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date(p.paid_at));
    daily.set(d, (daily.get(d) ?? 0) + Number(p.amount));
  }
  const maxDay = Math.max(1, ...daily.values());
  const nDays = daysInMonth(month);
  const days = Array.from({ length: nDays }, (_, i) => {
    const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { iso, day: i + 1, value: daily.get(iso) ?? 0 };
  });

  // Per-court utilization
  const courtCount = Math.max(courtList.length, 1);
  const capacityHours = courtCount * openHours * nDays;
  const bookedHoursByCourt = new Map<string, number>();
  const hourTally = new Map<number, number>();
  let totalBooked = 0;
  for (const b of bookings) {
    const s = Number(String(b.start_time).slice(0, 2));
    const e = Number(String(b.end_time).slice(0, 2));
    const hrs = Math.max(e - s, 0);
    totalBooked += hrs;
    bookedHoursByCourt.set(
      b.court_id,
      (bookedHoursByCourt.get(b.court_id) ?? 0) + hrs
    );
    hourTally.set(s, (hourTally.get(s) ?? 0) + 1);
  }
  const utilization = Math.round((totalBooked / Math.max(capacityHours, 1)) * 100);
  const peakHours = [...hourTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Every figure on this page comes from reads that used to fail silently.
  // `.neq("status", …)` in particular was serialised as a comma-joined
  // `status.neq` param, which the bookings handler rejects with 400 — so
  // utilisation, occupancy and peak hours rendered as a confident 0% or an
  // empty list with nothing to indicate a failure.
  const readError = firstError(
    paymentsRes,
    bookingsRes,
    expensesRes,
    courtsRes,
    pricingForMonth
  );
  if (readError) {
    return (
      <div className="space-y-5">
        <DataUnavailable detail={readError} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {capped.length > 0 && (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
        >
          Data {capped.join(", ")} untuk bulan ini melebihi batas tampilan, jadi angka di
          bawah hanya menghitung {capped.length === 1 ? "bagian yang terambil" : "bagian yang terambil"}.
          Bulatkan dengan kolom <code className="font-mono">from</code>/<code className="font-mono">to</code> yang lebih
          sempit.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/laporan?month=${addMonths(month, -1)}`}
          className="manager-tap flex h-9 w-9 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-black capitalize tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatMonthLabel(month)}
          </h1>
        </div>
        <Link
          href={`/app/laporan?month=${addMonths(month, 1)}`}
          className="manager-tap flex h-9 w-9 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Closing report generator. Moved here from /app/ai, where it sat
          directly above the chat and made the assistant page read as
          "chat + a bolted-on form". It is a report generator for closing
          time, so it belongs beside the other owner reports.
          Laporan is reachable by staff (the nav only shows it to owners, but
          the page guard is requireStaffPage) and this card has no internal
          role check — it relied on the check that used to live in ai/page.
          Without it here a pegawai would get a Generate button whose server
          action only ever answers "Hanya owner." */}
      {isOwner && <ClosingReportCard />}

      {/* Quick Excel — Harian / Bulanan / Tahunan for both owner & staff */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Export Excel — cepat
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/reports/export?date=${todayISO()}&format=xlsx`}
            className="manager-tap inline-flex min-h-[40px] items-center rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Harian ({todayISO()})
          </a>
          <a
            href={`/api/reports/export?month=${month}&format=xlsx`}
            className="manager-tap inline-flex min-h-[40px] items-center rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Bulanan ({month})
          </a>
          <a
            href={`/api/reports/export?year=${month.slice(0, 4)}&format=xlsx`}
            className="manager-tap inline-flex min-h-[40px] items-center rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-100"
          >
            Tahunan ({month.slice(0, 4)})
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Pendapatan kotor
            </p>
            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{formatIDR(gross)}</p>
          </div>
          <div className="flex gap-1.5">
            <a
              href={`/api/reports/export?month=${month}`}
              className="manager-tap inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </a>
            <a
              href={`/api/reports/export?month=${month}&format=xlsx`}
              className="manager-tap inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-600"
            >
              <Download className="h-3.5 w-3.5" /> Excel
            </a>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 py-2">
            <p className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400">Lapangan</p>
            <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">{formatIDR(gross)}</p>
          </div>
          <div className="rounded-xl bg-red-50 py-2">
            <p className="text-[10px] font-bold uppercase text-red-400">Beban</p>
            <p className="text-sm font-black text-red-500">−{formatIDR(expenseTotal)}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wide text-emerald-600">
            Laba bersih
          </span>
          <span className="text-lg font-black text-emerald-700">{formatIDR(net)}</span>
        </div>
        <p className="mt-1 text-right text-[9px] font-medium text-zinc-500 dark:text-zinc-400">
          lapangan {formatIDR(gross)} − beban {formatIDR(expenseTotal)}
        </p>
      </div>

      {/* Utilization */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
            <TrendingUp className="h-4 w-4" /> Okupansi
          </h2>
          <span className="text-xs font-black text-zinc-600 dark:text-zinc-300">{utilization}%</span>
        </div>
        <ul className="space-y-2">
          {courtList.map((c) => {
            const hrs = bookedHoursByCourt.get(c.id) ?? 0;
            const pct = Math.min(
              100,
              Math.round((hrs / Math.max(openHours * nDays, 1)) * 100)
            );
            return (
              <li key={c.id}>
                <div className="mb-0.5 flex justify-between text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                  <span className="flex items-center gap-1">
                    <Shuttlecock className="h-3 w-3" />
                    {c.name}
                  </span>
                  <span>
                    {hrs} jam · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-zinc-500 dark:bg-zinc-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Peak hours */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
          <Flame className="h-4 w-4" /> Jam Terpopuler
        </h2>
        {peakHours.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Belum ada data bulan ini.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {peakHours.map(([h, count]) => (
              <span
                key={h}
                className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200"
              >
                {String(h).padStart(2, "0")}.00 · {count}×
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Daily revenue */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
          <Wallet className="h-4 w-4" /> Pendapatan Harian
        </h2>
        <div className="space-y-1">
          {days.map(({ iso, day, value }) => (
            <div key={iso} className="flex items-center gap-2">
              <span className="w-6 flex-shrink-0 text-right text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                {day}
              </span>
              <div className="h-3.5 flex-1 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-700">
                <div
                  className={`h-full rounded-md ${value > 0 ? "bg-emerald-400" : ""}`}
                  style={{ width: `${value > 0 ? (value / maxDay) * 100 : 0}%` }}
                />
              </div>
              <span className="w-20 flex-shrink-0 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                {value > 0 ? formatIDR(value) : ""}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
