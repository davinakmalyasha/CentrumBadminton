"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createExpense, type ActionState } from "@/app/app/(protected)/actions";

const initial: ActionState = { error: null };

const CATEGORIES = ["Listrik", "Gaji", "Sewa", "Perlengkapan", "Shuttlecock", "Lain-lain"];

export default function ExpenseForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(createExpense, initial);

  const field =
    "w-full rounded-xl border border-sky-brand-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-sky-brand-400 focus:outline-none";

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-sky-brand-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="ecat" className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-700/60">
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
          <label htmlFor="eamt" className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-700/60">
            Nominal
          </label>
          <input id="eamt" name="amount" inputMode="numeric" required placeholder="150000" className={field} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="edate" className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-700/60">
            Tanggal
          </label>
          <input id="edate" type="date" name="spent_at" defaultValue={today} required className={field} />
        </div>
        <div>
          <label htmlFor="enote" className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-700/60">
            Catatan
          </label>
          <input id="enote" name="note" placeholder="opsional" className={field} />
        </div>
      </div>

      {state.error && <p className="text-xs font-semibold text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-navy-800 py-2.5 text-sm font-black text-white transition hover:bg-navy-700 disabled:opacity-50"
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
