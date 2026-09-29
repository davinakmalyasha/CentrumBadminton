"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deletePayment, type ActionState } from "@/app/app/(protected)/actions";
import { useRole } from "./RoleContext";

const initial: ActionState = { error: null };

export default function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const { role } = useRole();
  const [, formAction, pending] = useActionState(deletePayment, initial);

  if (role !== "owner") return null;

  return (
    <form action={formAction}>
      <input type="hidden" name="payment_id" value={paymentId} />
      <button
        type="submit"
        disabled={pending}
        title="Hapus pembayaran (owner)"
        aria-label="Hapus pembayaran (owner)"
        className="manager-tap px-1.5 text-[11px] text-zinc-400 transition hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
