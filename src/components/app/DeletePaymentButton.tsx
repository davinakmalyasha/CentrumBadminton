"use client";

import { useActionState } from "react";
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
        className="px-1.5 text-[11px] text-navy-700/40 transition hover:text-red-500"
      >
        🗑
      </button>
    </form>
  );
}
