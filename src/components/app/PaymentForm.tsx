"use client";

import { useActionState, useState } from "react";
import { Banknote, QrCode } from "lucide-react";
import { recordPayment, type ActionState } from "@/app/app/(protected)/actions";
import { formatIDR } from "@/lib/availability";

const initial: ActionState = { error: null };

export default function PaymentForm({
  bookingId,
  outstanding,
}: {
  bookingId: string;
  outstanding: number;
}) {
  const [state, formAction, pending] = useActionState(recordPayment, initial);
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState<"cash" | "qris">("cash");

  if (state.ok) {
    return (
      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
        Pembayaran tercatat
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-2.5">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="method" value={method} />

      <div className="flex gap-1.5">
        <input
          name="amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          placeholder="Nominal"
          required
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={() => setAmount(String(Math.ceil(outstanding / 2)))}
          title="Setengah harga (DP)"
          className="manager-tap rounded-xl border border-zinc-200 bg-white px-2.5 text-[11px] font-bold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ½ DP
        </button>
        <button
          type="button"
          onClick={() => setMethod(method === "cash" ? "qris" : "cash")}
          aria-pressed={method === "qris"}
          className={`manager-tap inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition ${
            method === "cash"
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-emerald-500 bg-emerald-500 text-white"
          }`}
        >
          {method === "cash" ? (
            <>
              <Banknote className="h-3.5 w-3.5" />
              Cash
            </>
          ) : (
            <>
              <QrCode className="h-3.5 w-3.5" />
              QRIS
            </>
          )}
        </button>
      </div>

      <input
        name="note"
        placeholder="Catatan (opsional — cth. DP via transfer)"
        maxLength={120}
        className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-[11px] text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />

      {state.error && (
        <p className="mt-1.5 text-[11px] font-semibold text-red-500">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="manager-tap mt-1.5 min-h-[44px] w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-black text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Menyimpan…" : `Catat Pembayaran ${formatIDR(Number(amount || 0))}`}
      </button>
    </form>
  );
}
