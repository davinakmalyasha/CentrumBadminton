"use client";

import { useActionState, useEffect, useState } from "react";
import {
  adjustStock,
  type KantinActionState,
} from "@/app/app/(protected)/kantin/actions";

const initial: KantinActionState = { error: null };

const field =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

export function StockAdjustForm({
  productId,
  stock,
}: {
  productId: string;
  stock: number;
}) {
  // The qty/note inputs are uncontrolled, so a successful submit left
  // their values in place AND left state.ok set: pressing "Simpan" again
  // applied the very same adjustment a second time — restocking 24 twice
  // added 48. Remount on success so the fields clear and the confirmation
  // is a flash rather than a permanent state.
  const [formKey, setFormKey] = useState(0);
  const [justSaved, setJustSaved] = useState(false);
  return (
    <StockAdjustFields
      key={`${productId}:${formKey}`}
      productId={productId}
      stock={stock}
      onSaved={() => {
        setJustSaved(true);
        setFormKey((k) => k + 1);
      }}
      justSaved={justSaved}
    />
  );
}

function StockAdjustFields({
  productId,
  stock,
  onSaved,
  justSaved,
}: {
  productId: string;
  stock: number;
  onSaved: () => void;
  justSaved: boolean;
}) {
  const [state, formAction, pending] = useActionState(adjustStock, initial);

  useEffect(() => {
    if (state.ok) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <form action={formAction} className="mt-2 space-y-2 border-t border-zinc-200 pt-2.5 dark:border-zinc-800">
      <input type="hidden" name="product_id" value={productId} />
      <div className="grid grid-cols-3 gap-1.5">
        <select name="reason" className={`${field} py-2 text-xs`} defaultValue="restock">
          <option value="restock">+ Restock</option>
          <option value="waste">− Rusak/Habis</option>
          <option value="correction">= Stok opname (hasil hitung)</option>
        </select>
        <input
          name="qty"
          inputMode="numeric"
          required
          placeholder={String(stock)}
          title="Restock/rusak: jumlah yang bertambah atau berkurang. Opname: hasil hitung fisik — sistem menghitung selisihnya."
          className={`${field} py-2 text-xs`}
        />
        <button
          type="submit"
          disabled={pending}
          className="manager-tap rounded-xl bg-zinc-900 px-2 py-2 text-xs font-black text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
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
      {justSaved && (
        <p className="text-[10px] font-semibold text-emerald-600">Stok diperbarui</p>
      )}
    </form>
  );
}
