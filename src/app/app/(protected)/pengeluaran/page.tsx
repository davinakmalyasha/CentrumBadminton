import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireOwnerPage } from "@/lib/guard";
import { DataUnavailable, EmptyState, firstError } from "@/components/app/EmptyState";
import { formatIDR, todayISO } from "@/lib/availability";
import { addMonths, currentMonthKey, monthEndExclusive, monthStart, formatMonthLabel } from "@/lib/months";
import ExpenseForm from "@/components/app/ExpenseForm";
import DeleteExpenseButton from "@/components/app/DeleteExpenseButton";

export const metadata = { title: "Pengeluaran · Centrum Manager" };

type ERow = {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  spent_at: string;
};

export default async function PengeluaranPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonthKey();

  const supabase = await requireOwnerPage();
  const { data, error } = await supabase
    .from("expenses")
    .select("id,category,amount,note,spent_at")
    .gte("spent_at", monthStart(month))
    .lt("spent_at", monthEndExclusive(month))
    .order("spent_at", { ascending: false });

  const rows = (data ?? []) as ERow[];
  const total = rows.reduce((a, b) => a + Number(b.amount), 0);
  const readError = firstError({ error });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/pengeluaran?month=${addMonths(month, -1)}`}
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
          href={`/app/pengeluaran?month=${addMonths(month, 1)}`}
          className="manager-tap flex h-9 w-9 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <ExpenseForm today={today} />

      <div className="flex items-center justify-between rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          Total bulan ini
        </span>
        <span className="text-xl font-black text-white">{formatIDR(total)}</span>
      </div>

      {readError ? (
        <DataUnavailable detail={readError} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Belum ada pengeluaran bulan ini"
          body="Catat biaya listrik, gaji, atau pengeluaran lain di form atas supaya laba bersih di Laporan akurat."
        />
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {e.category}
                  {e.note && (
                    <span className="ml-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {e.note}
                    </span>
                  )}
                </p>
                <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(`${e.spent_at}T00:00:00+07:00`))}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-black text-red-500">
                  −{formatIDR(Number(e.amount))}
                </span>
                <DeleteExpenseButton expenseId={e.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
