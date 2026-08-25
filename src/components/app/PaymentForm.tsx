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
          className="min-w-0 flex-1 rounded-xl border border-sky-brand-200 bg-white px-3 py-2 text-sm font-bold text-navy-900 focus:border-sky-brand-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setAmount(String(Math.ceil(outstanding / 2)))}
          title="Setengah harga (DP)"
          className="rounded-xl border border-sky-brand-200 bg-white px-2.5 text-[11px] font-bold text-sky-brand-600 hover:bg-ice-100"
        >
          ½ DP
        </button>
        <button
          type="button"
          onClick={() => setMethod(method === "cash" ? "qris" : "cash")}
          aria-pressed={method === "qris"}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition ${
            method === "cash"
              ? "border-navy-800 bg-navy-800 text-white"
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
        className="mt-1.5 w-full rounded-xl border border-sky-brand-200 bg-white px-3 py-1.5 text-[11px] text-navy-800 placeholder:text-navy-700/35 focus:border-sky-brand-400 focus:outline-none"
      />

      {state.error && (
        <p className="mt-1.5 text-[11px] font-semibold text-red-500">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1.5 w-full rounded-xl bg-navy-800 py-2.5 text-xs font-black text-white transition hover:bg-navy-700 disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : `Catat Pembayaran ${formatIDR(Number(amount || 0))}`}
      </button>
    </form>
  );
}
