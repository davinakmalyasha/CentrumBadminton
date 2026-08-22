"use client";

import { useActionState } from "react";
import { deleteExpense, type ActionState } from "@/app/app/(protected)/actions";

const initial: ActionState = { error: null };

export default function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const [, formAction, pending] = useActionState(deleteExpense, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="expense_id" value={expenseId} />
      <button
        type="submit"
        disabled={pending}
        title="Hapus"
        className="px-1.5 text-xs text-navy-700/40 transition hover:text-red-500"
      >
        🗑
      </button>
    </form>
  );
}
