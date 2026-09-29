"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createExpense, type ActionState } from "@/app/app/(protected)/actions";

const initial: ActionState = { error: null };

const CATEGORIES = ["Listrik", "Gaji", "Sewa", "Perlengkapan", "Shuttlecock", "Lain-lain"];

export default function ExpenseForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(createExpense, initial);

  const field =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="ecat" className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Kategori
          </label>
          <input id="ecat" name="category" list="expense-cats" required placeholder="cth. Listrik" className={field} />
          <datalist id="expense-cats">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="eamt" className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Nominal
          </label>
          <input id="eamt" name="amount" inputMode="numeric" required placeholder="150000" className={field} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="edate" className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Tanggal
          </label>
          <input id="edate" type="date" name="spent_at" defaultValue={today} required className={field} />
        </div>
        <div>
          <label htmlFor="enote" className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Catatan
          </label>
          <input id="enote" name="note" placeholder="opsional" className={field} />
        </div>
      </div>

      {state.error && <p className="text-xs font-semibold text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="manager-tap inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2.5 text-sm font-black text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? (
          "Menyimpan…"
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Catat Pengeluaran
          </>
        )}
      </button>
    </form>
  );
}
