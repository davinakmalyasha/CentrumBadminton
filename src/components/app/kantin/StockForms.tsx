"use client";

import { useActionState } from "react";
import {
  adjustStock,
  type KantinActionState,
} from "@/app/app/(protected)/kantin/actions";

const initial: KantinActionState = { error: null };

const field =
  "w-full rounded-xl border border-sky-brand-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-sky-brand-400 focus:outline-none";

export function StockAdjustForm({
  productId,
  stock,
}: {
  productId: string;
  stock: number;
}) {
  const [state, formAction, pending] = useActionState(adjustStock, initial);

  return (
    <form action={formAction} className="mt-2 space-y-2 border-t border-sky-brand-200 pt-2.5">
      <input type="hidden" name="product_id" value={productId} />
      <div className="grid grid-cols-3 gap-1.5">
        <select name="reason" className={`${field} py-2 text-xs`} defaultValue="restock">
          <option value="restock">+ Restock</option>
          <option value="waste">− Rusak/Habis</option>
          <option value="correction">= Stok opname</option>
        </select>
        <input
          name="qty"
          inputMode="numeric"
          required
          placeholder={String(stock)}
          title="Restock/waste: jumlah. Opname: hasil hitung fisik."
          className={`${field} py-2 text-xs`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-navy-800 px-2 py-2 text-xs font-black text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {pending ? "…" : "Simpan"}
        </button>
      </div>
      <input
        name="note"
        placeholder="Catatan (opsional — cth. beli 2 krat)"
        className={`${field} py-1.5 text-[11px]`}
      />
      {state.error && <p className="text-[10px] font-semibold text-red-500">{state.error}</p>}
      {state.ok && <p className="text-[10px] font-semibold text-emerald-600">Stok diperbarui</p>}
    </form>
  );
}
