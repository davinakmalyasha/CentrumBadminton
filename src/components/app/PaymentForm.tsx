"use client";

import { useActionState, useEffect, useState } from "react";
import { Banknote, QrCode } from "lucide-react";
import { recordPayment, type ActionState } from "@/app/app/(protected)/actions";
import { formatIDR } from "@/lib/availability";

const initial: ActionState = { error: null };

/**
 * Payment entry for one booking.
 *
 * The form used to render a permanent "Pembayaran terekam" label the moment
 * `state.ok` became true. Because the action calls revalidatePath, the RSC
 * refresh reused the same keyed client component and `state.ok` survived —
 * so after recording a DP the form never came back, and the settlement had
 * to wait for a manual page reload. That is the normal two-tranche flow the
 * ½ DP button exists to support.
 *
 * The fix is the standard React shape for resetting a reducer-ish hook:
 * the stateful part lives in `PaymentFields`, and success increments a key
 * that remounts it, giving a clean `useActionState` with a fresh balance.
 */
export default function PaymentForm({
  bookingId,
  outstanding,
}: {
  bookingId: string;
  outstanding: number;
}) {
  const [formKey, setFormKey] = useState(0);
  const [justPaid, setJustPaid] = useState(false);

  return (
    <div className="mt-2">
      {justPaid ? (
        <p className="mb-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          Pembayaran tercatat
        </p>
      ) : null}
      <PaymentFields
        key={`${bookingId}:${formKey}`}
        bookingId={bookingId}
        outstanding={outstanding}
        onPaid={() => {
          setJustPaid(true);
          setFormKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function PaymentFields({
  bookingId,
  outstanding,
  onPaid,
}: {
  bookingId: string;
  outstanding: number;
  onPaid: () => void;
}) {
  const [state, formAction, pending] = useActionState(recordPayment, initial);
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState<"cash" | "qris">("cash");

  useEffect(() => {
    if (state.ok) onPaid();
    // `onPaid` is stable enough here: it only bumps a key in the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <form action={formAction}>
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
