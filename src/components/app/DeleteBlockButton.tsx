"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteBlock, type ActionState } from "@/app/app/(protected)/actions";

const initial: ActionState = { error: null };

export default function DeleteBlockButton({ blockId }: { blockId: string }) {
  const [, formAction, pending] = useActionState(deleteBlock, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="block_id" value={blockId} />
      <button
        type="submit"
        disabled={pending}
        title="Hapus blokir"
        aria-label="Hapus blokir"
        className="manager-tap px-1.5 text-xs text-zinc-400 transition hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
