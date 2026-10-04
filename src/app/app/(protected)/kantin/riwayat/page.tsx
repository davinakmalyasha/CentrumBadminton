import { createClient, proxyFetch } from "@/lib/proxy/client";
import KantinSubnav from "@/components/app/kantin/KantinSubnav";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysISO, formatIDR, todayISO } from "@/lib/availability";
import VoidSaleButton from "@/components/app/kantin/VoidSaleButton";

export const metadata = { title: "Kantin · Riwayat · Centrum Manager" };

type SRow = {
  id: string;
  total: number;
  method: string;
  customer_name: string | null;
  note: string | null;
  created_at: string;
  recorded_by: string | null;
  /**
   * The recorder's name, joined by the backend.
   *
   * This used to come from an embedded `profiles(full_name)` relation, which
   * this connector never resolved -- every row rendered "Dicatat: —" as if
   * nobody had rung it up. Voiding now also records who voided it.
   */
  recorded_by_name: string | null;
  voided_at: string | null;
  voided_by: string | null;
  kantin_sale_items: Array<{
    id: string;
    product_name: string;
    qty: number;
    unit_price: number;
  }>;
};

export default async function KantinRiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const next = addDaysISO(date, 1);

  const supabase = await createClient();
  const [salesRes, ownerRes] = await Promise.all([
supabase
      .from("kantin_sales")
      .select(
        "id,total,method,customer_name,note,created_at,recorded_by,recorded_by_name,voided_at,voided_by"
      )
      .gte("created_at", `${date}T00:00:00+07:00`)
      .lt("created_at", `${next}T00:00:00+07:00`)
      .order("created_at", { ascending: false }),
    supabase.rpc("is_owner"),
  ]);
  const owner = ownerRes.data === true;

  // Voided sales stay in this list -- it is the record of what happened --
  // but they are not part of the day's takings. Counting them was possible
  // only because voiding used to delete the row, so the total quietly grew
  // by exactly the amounts the owner had just given back.
  const rawSales = (salesRes.data ?? []) as unknown as SRow[];
  const voidedCount = rawSales.filter((s) => s.voided_at).length;
  // Line items live behind GET /kantin/sales/{id}/items — fetch per
  // recent sale (one day's worth; cap 100) instead of the dead join.
const sales = await Promise.all(
    (salesRes.data ?? []).slice(0, 100).map(async (sRaw: unknown) => {
      const s = sRaw as SRow;
      try {
        const res = await proxyFetch<{
          items: Array<{ id: string; product_name: string; qty: number; unit_price: number }>;
        }>(`/v1/sports/kantin/sales/${s.id}/items`);
        return { ...s, kantin_sale_items: res.items ?? [] };
      } catch {
        return { ...s, kantin_sale_items: [] as SRow["kantin_sale_items"] };
      }
    })
  );
  // Sorted live-only first so the day's takings lead, then the corrections
  // underneath them.
  const ordered = [...sales].sort(
    (a, b) => Number(Boolean(a.voided_at)) - Number(Boolean(b.voided_at))
  );
  // Only the live sales count towards the day's takings.
  const dayTotal = sales
    .filter((s) => !s.voided_at)
    .reduce((a, s) => a + Number(s.total), 0);
  const cash = sales
    .filter((s) => !s.voided_at && s.method === "cash")
    .reduce((a, s) => a + Number(s.total), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/kantin/riwayat?date=${addDaysISO(date, -1)}`}
          className="manager-tap flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="Hari sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            {date === today ? "Hari Ini" : date}
          </h1>
          {date === today && (
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {date}
            </p>
          )}
        </div>
        <Link
          href={`/app/kantin/riwayat?date=${addDaysISO(date, 1)}`}
          className="manager-tap flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="Hari berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <KantinSubnav active="/app/kantin/riwayat" />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-300/80">
          Total penjualan kantin
        </p>
        <p className="mt-1 text-3xl font-black tracking-tight">{formatIDR(dayTotal)}</p>
<p className="mt-1 text-xs font-semibold text-zinc-300/80">
          Cash {formatIDR(cash)} · QRIS {formatIDR(dayTotal - cash)} · {sales.length} transaksi
          {voidedCount > 0 ? ` · ${voidedCount} dibatalkan` : ""}
        </p>
      </div>

      {sales.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Belum ada penjualan di tanggal ini.
        </p>
      ) : (
        <ul className="space-y-2">
{ordered.map((s) => {
            const items = (s.kantin_sale_items ?? []) as SRow["kantin_sale_items"];
            const time = new Intl.DateTimeFormat("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Jakarta",
            }).format(new Date(s.created_at));
            const voidTime = s.voided_at
              ? new Intl.DateTimeFormat("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Jakarta",
                }).format(new Date(s.voided_at))
              : null;
            return (
              <li
                key={s.id}
                className={`rounded-2xl border p-3.5 dark:bg-zinc-900 ${
                  s.voided_at
                    ? "border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800"
                    : "border-zinc-200 bg-white dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-zinc-900 dark:text-zinc-50">
                      {s.voided_at ? (
                        <span className="line-through decoration-zinc-400">
                          {formatIDR(Number(s.total))}
                        </span>
                      ) : (
                        formatIDR(Number(s.total))
                      )}
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {s.method}
                      </span>
                      <span className="ml-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">· {time}</span>
                      {s.voided_at && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase text-red-700 dark:bg-red-950 dark:text-red-300">
                          dibatalkan {voidTime}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {items.map((i) => `${i.product_name} ×${i.qty}`).join(", ")}
                      {s.customer_name ? ` · ${s.customer_name}` : ""}
                    </p>
                    {s.note && (
                      <p className="truncate text-[10px] italic text-zinc-500 dark:text-zinc-400">{s.note}</p>
                    )}
<p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                      Dicatat: {s.recorded_by_name ?? "—"}
                    </p>
                  </div>
                  {/* Already corrected; offering the button again would only
                      produce a conflict. */}
                  {owner && !s.voided_at && <VoidSaleButton saleId={s.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
