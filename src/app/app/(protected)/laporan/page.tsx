import Link from "next/link";
import { requireOwnerPage } from "@/lib/guard";
import { formatIDR } from "@/lib/availability";
import {
  BarChart3,
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

export const metadata = { title: "Laporan · Centrum Manager" };

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonthKey();
  const start = monthStart(month);
  const endEx = monthEndExclusive(month);

  const supabase = await requireOwnerPage();

  const [pricingForMonth, paymentsRes, bookingsRes, expensesRes, courtsRes] =
    await Promise.all([
      supabase.rpc("get_pricing_for", { p_date: start }),
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/laporan?month=${addMonths(month, -1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-brand-200 bg-white text-navy-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <h1 className="flex items-center justify-center gap-2 text-base font-black capitalize text-navy-900">
            <BarChart3 className="h-5 w-5" strokeWidth={1.75} /> Laporan
          </h1>
          <p className="text-xs font-semibold text-navy-700/60">{formatMonthLabel(month)}</p>
        </div>
        <Link
          href={`/app/laporan?month=${addMonths(month, 1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-brand-200 bg-white text-navy-800"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-sky-brand-200 bg-white p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-navy-700/50">
              Pendapatan kotor
            </p>
            <p className="text-2xl font-black text-navy-900">{formatIDR(gross)}</p>
          </div>
          <a
            href={`/api/reports/export?month=${month}`}
            className="inline-flex items-center gap-1 rounded-xl border border-sky-brand-300 px-3 py-2 text-xs font-bold text-sky-brand-600 transition hover:bg-ice-100"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-ice-100 py-2">
            <p className="text-[10px] font-bold uppercase text-navy-700/50">Cash</p>
            <p className="text-sm font-black text-navy-900">{formatIDR(cash)}</p>
          </div>
          <div className="rounded-xl bg-ice-100 py-2">
            <p className="text-[10px] font-bold uppercase text-navy-700/50">QRIS</p>
            <p className="text-sm font-black text-navy-900">{formatIDR(qris)}</p>
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
      </div>

      {/* Utilization */}
      <section className="rounded-2xl border border-sky-brand-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-navy-900">
            <TrendingUp className="h-4 w-4" /> Okupansi
          </h2>
          <span className="text-xs font-black text-sky-brand-600">{utilization}%</span>
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
                <div className="mb-0.5 flex justify-between text-[11px] font-semibold text-navy-700/70">
                  <span className="flex items-center gap-1">
                    <Shuttlecock className="h-3 w-3" />
                    {c.name}
                  </span>
                  <span>
                    {hrs} jam · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ice-200">
                  <div
                    className="h-full rounded-full bg-sky-brand-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Peak hours */}
      <section className="rounded-2xl border border-sky-brand-200 bg-white p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-navy-900">
          <Flame className="h-4 w-4" /> Jam Terpopuler
        </h2>
        {peakHours.length === 0 ? (
          <p className="text-xs text-navy-700/50">Belum ada data bulan ini.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {peakHours.map(([h, count]) => (
              <span
                key={h}
                className="rounded-full bg-accent-500/10 px-3 py-1.5 text-xs font-bold text-accent-600"
              >
                {String(h).padStart(2, "0")}.00 · {count}×
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Daily revenue */}
      <section className="rounded-2xl border border-sky-brand-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-navy-900">
          <Wallet className="h-4 w-4" /> Pendapatan Harian
        </h2>
        <div className="space-y-1">
          {days.map(({ iso, day, value }) => (
            <div key={iso} className="flex items-center gap-2">
              <span className="w-6 flex-shrink-0 text-right text-[10px] font-semibold text-navy-700/40">
                {day}
              </span>
              <div className="h-3.5 flex-1 overflow-hidden rounded-md bg-ice-200">
                <div
                  className={`h-full rounded-md ${value > 0 ? "bg-emerald-400" : ""}`}
                  style={{ width: `${value > 0 ? (value / maxDay) * 100 : 0}%` }}
                />
              </div>
              <span className="w-20 flex-shrink-0 text-[10px] font-bold text-navy-700/70">
                {value > 0 ? formatIDR(value) : ""}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
