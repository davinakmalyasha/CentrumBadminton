import Link from "next/link";
import { requireStaffPage } from "@/lib/guard";
import { DataUnavailable, firstError } from "@/components/app/EmptyState";
import { formatIDR } from "@/lib/availability";
import { proxyFetch } from "@/lib/proxy/client";
import { ChevronLeft, ChevronRight, Download, ShoppingBasket } from "lucide-react";
import {
  addMonths,
  currentMonthKey,
  monthEndExclusive,
  monthStart,
  formatMonthLabel,
} from "@/lib/months";

export const metadata = { title: "Kantin · Centrum Manager" };

export default async function LaporanKantinPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonthKey();
  const start = monthStart(month);
  const endEx = monthEndExclusive(month);

  const supabase = await requireStaffPage();
  const kantinSalesRes = await supabase
    .from("kantin_sales")
    .select("id,total,created_at")
    .gte("created_at", `${start}T00:00:00+07:00`)
    .lt("created_at", `${endEx}T00:00:00+07:00`);

  const kantinSales = (kantinSalesRes.data ?? []) as Array<{
    id: string;
    total: number;
    created_at: string;
  }>;

  const readError = firstError(kantinSalesRes);

  // Real COGS + top products via GET /kantin/sales/{id}/items
  // (one sale at a time; month scope is small — cap at 500 sales).
  const kantinItems: Array<{
    qty: number;
    unit_price: number;
    unit_cost: number;
    product_name: string;
  }> = [];
  if (!readError) {
    await Promise.all(
      kantinSales.slice(0, 500).map(async (s) => {
        try {
          const res = await proxyFetch<{
            items: Array<{
              qty: number;
              unit_price: number;
              unit_cost: number;
              product_name: string;
            }>;
          }>(`/v1/sports/kantin/sales/${s.id}/items`);
          for (const it of res.items ?? []) kantinItems.push(it);
        } catch {
          /* one bad sale must not kill the report */
        }
      })
    );
  }

  const kRevenue = kantinSales.reduce((a, s) => a + Number(s.total ?? 0), 0);
  const kCogs = kantinItems.reduce(
    (a, i) => a + Number(i.unit_cost ?? 0) * Number(i.qty ?? 0),
    0
  );
  const kProfit = kRevenue - kCogs;
  const kTransactions = kantinSales.length;
  const kQty = kantinItems.reduce((a, i) => a + Number(i.qty ?? 0), 0);
  const topMap = new Map<string, { qty: number; revenue: number }>();
  for (const i of kantinItems) {
    const name = String(i.product_name ?? "Lainnya");
    const cur = topMap.get(name) ?? { qty: 0, revenue: 0 };
    cur.qty += Number(i.qty ?? 0);
    cur.revenue += Number(i.unit_price ?? 0) * Number(i.qty ?? 0);
    topMap.set(name, cur);
  }
  const kTop: Array<[string, { qty: number; revenue: number }]> = [
    ...topMap.entries(),
  ]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/laporan/kantin?month=${addMonths(month, -1)}`}
          className="manager-tap flex h-9 w-9 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-black capitalize tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatMonthLabel(month)}
          </h1>
        </div>
        <Link
          href={`/app/laporan/kantin?month=${addMonths(month, 1)}`}
          className="manager-tap flex h-9 w-9 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {readError ? (
        <DataUnavailable detail={readError} />
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
              <ShoppingBasket className="h-4 w-4" /> Kantin
            </h2>
            <div className="flex gap-1">
              <a
                href={`/api/reports/export?type=kantin&month=${month}`}
                className="manager-tap inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-bold text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
              >
                <Download className="h-3 w-3" /> CSV
              </a>
              <a
                href={`/api/reports/export?type=kantin&month=${month}&format=xlsx`}
                className="manager-tap inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-black text-white"
              >
                <Download className="h-3 w-3" /> Excel
              </a>
            </div>
          </div>
          {kQty === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Belum ada penjualan kantin bulan ini.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-zinc-100 py-2 dark:bg-zinc-800">
                  <p className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
                    Omzet
                  </p>
                  <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                    {formatIDR(kRevenue)}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-100 py-2 dark:bg-zinc-800">
                  <p className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
                    Modal
                  </p>
                  <p className="text-sm font-black text-red-500">
                    −{formatIDR(kCogs)}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 py-2">
                  <p className="text-[10px] font-bold uppercase text-emerald-600">
                    Laba kotor
                  </p>
                  <p className="text-sm font-black text-emerald-700">
                    {formatIDR(kProfit)}
                  </p>
                </div>
              </div>
              <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                {kQty} item · {kTransactions} transaksi
              </p>
              <ul className="space-y-1">
                {kTop.map(([name, t], idx) => (
                  <li key={name} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-center font-black text-zinc-500 dark:text-zinc-400">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-zinc-800 dark:text-zinc-100">
                      {name}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">{t.qty}×</span>
                    <span className="w-20 flex-shrink-0 text-right font-bold text-zinc-900 dark:text-zinc-50">
                      {formatIDR(t.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
