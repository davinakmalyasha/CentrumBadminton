"use client";

import { useActionState } from "react";
import {
  toggleProfileActive,
  toggleCourtActive,
  type ActionState,
} from "@/app/app/(protected)/actions";

const initial: ActionState = { error: null };

export function ToggleCourtActiveButton({
  courtId,
  active,
}: {
  courtId: string;
  active: boolean;
}) {
  const [, formAction, pending] = useActionState(toggleCourtActive, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="court_id" value={courtId} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition ${
          active
            ? "border-emerald-300 bg-emerald-50 text-emerald-600"
            : "border-neutral-300 bg-neutral-100 text-neutral-500"
        }`}
      >
        {active ? "✓ Aktif" : "✕ Nonaktif"}
      </button>
    </form>
  );
}

export function ToggleStaffActiveButton({
  profileId,
  active,
}: {
  profileId: string;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(toggleProfileActive, initial);

  return (
    <div className="flex items-center gap-2">
      {state.error && (
        <span className="text-[10px] font-semibold text-red-500">{state.error}</span>
      )}
      <form action={formAction}>
        <input type="hidden" name="profile_id" value={profileId} />
        <input type="hidden" name="active" value={String(!active)} />
        <button
          type="submit"
          disabled={pending}
          className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition ${
            active
              ? "border-emerald-300 bg-emerald-50 text-emerald-600"
              : "border-red-200 bg-red-50 text-red-500"
          }`}
        >
          {active ? "✓ Aktif" : "✕ Dinonaktifkan"}
        </button>
      </form>
    </div>
  );
}
