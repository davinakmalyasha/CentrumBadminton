"use client";

import { useActionState } from "react";
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
        className="px-1.5 text-xs text-navy-700/40 transition hover:text-red-500"
      >
        🗑
      </button>
    </form>
  );
}
