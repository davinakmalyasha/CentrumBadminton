"use client";

import { useActionState, useState } from "react";
import { Check, Save } from "lucide-react";
import { updateCustomerNotes, type ActionState } from "@/app/app/(protected)/actions";

const initial: ActionState = { error: null };

export default function CustomerNotesForm({
  customerId,
  notes,
}: {
  customerId: string;
  notes: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateCustomerNotes, initial);
  const [value, setValue] = useState(notes ?? "");
  const dirty = value !== (notes ?? "");

  return (
    <form action={formAction} className="mt-1.5 flex items-center gap-1.5">
      <input type="hidden" name="customer_id" value={customerId} />
      <input
        name="notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="+ catatan (cth. suka lapangan 2, sering telat…)"
        maxLength={200}
        className="min-w-0 flex-1 rounded-lg border border-transparent bg-zinc-100 px-2 py-1 text-[11px] text-zinc-800 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-500 focus:bg-white focus:outline-none dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-700"
      />
      {dirty && (
        <button
          type="submit"
          disabled={pending}
          className="manager-tap flex-shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {pending ? "…" : <Save className="h-3.5 w-3.5" />}
        </button>
      )}
      {state.ok && !dirty && (
        <span className="flex-shrink-0 text-[10px] font-semibold text-emerald-600">
          <Check className="h-3 w-3" />
        </span>
      )}
      {state.error && (
        <span className="flex-shrink-0 text-[10px] font-semibold text-red-500">
          {state.error}
        </span>
      )}
    </form>
  );
}
