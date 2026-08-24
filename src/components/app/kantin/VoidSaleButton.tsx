"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { voidSale, type KantinActionState } from "@/app/app/(protected)/kantin/actions";

const initial: KantinActionState = { error: null };

export default function VoidSaleButton({ saleId }: { saleId: string }) {
  const [state, formAction, pending] = useActionState(voidSale, initial);

  return (
    <span className="flex items-center gap-1.5">
      {state.error && <span className="text-[10px] font-semibold text-red-500">{state.error}</span>}
      <form action={formAction}>
        <input type="hidden" name="sale_id" value={saleId} />
        <button
          type="submit"
          disabled={pending}
          title="Batalkan penjualan (stok dikembalikan)"
          className="rounded-lg border border-red-200 bg-white p-1.5 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </form>
    </span>
  );
}
