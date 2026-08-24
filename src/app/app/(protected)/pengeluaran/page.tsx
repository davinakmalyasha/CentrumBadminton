import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { requireOwnerPage } from "@/lib/guard";
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
  const { data } = await supabase
    .from("expenses")
    .select("id,category,amount,note,spent_at")
    .gte("spent_at", monthStart(month))
    .lt("spent_at", monthEndExclusive(month))
    .order("spent_at", { ascending: false });

  const rows = (data ?? []) as ERow[];
  const total = rows.reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/pengeluaran?month=${addMonths(month, -1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-brand-200 bg-white text-navy-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <h1 className="flex items-center justify-center gap-2 text-base font-black capitalize text-navy-900">
            <Receipt className="h-5 w-5" strokeWidth={1.75} /> Pengeluaran
          </h1>
          <p className="text-xs font-semibold text-navy-700/60">{formatMonthLabel(month)}</p>
        </div>
        <Link
          href={`/app/pengeluaran?month=${addMonths(month, 1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-brand-200 bg-white text-navy-800"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <ExpenseForm today={today} />

      <div className="flex items-center justify-between rounded-2xl border border-navy-800/10 bg-navy-800 px-4 py-3 text-white">
        <span className="text-xs font-bold uppercase tracking-widest text-sky-brand-200/70">
          Total bulan ini
        </span>
        <span className="text-xl font-black">{formatIDR(total)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sky-brand-300 bg-white p-6 text-center text-sm text-navy-700/50">
          Belum ada pengeluaran bulan ini.
        </p>
      ) : (
        <ul className="divide-y divide-sky-brand-200/60 overflow-hidden rounded-2xl border border-sky-brand-200 bg-white">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy-900">
                  {e.category}
                  {e.note && (
                    <span className="ml-2 text-[11px] font-medium text-navy-700/50">
                      {e.note}
                    </span>
                  )}
                </p>
                <p className="text-[11px] font-semibold text-navy-700/40">
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
