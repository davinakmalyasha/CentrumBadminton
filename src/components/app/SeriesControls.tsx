"use client";

import { useActionState } from "react";
import { Pause, Play, Plus } from "lucide-react";
import {
  extendSeries,
  setSeriesStatus,
  type SeriesState,
} from "@/app/app/(protected)/actions";

const initial: SeriesState = { error: null };

export default function SeriesControls({
  seriesId,
  status,
}: {
  seriesId: string;
  status: string;
}) {
  const [statusState, statusAction, statusPending] = useActionState(setSeriesStatus, initial);
  const [extState, extAction, extPending] = useActionState(extendSeries, initial);

  const btn =
    "manager-tap inline-flex min-h-[40px] items-center gap-1 rounded-lg border px-2.5 py-2 text-[11px] font-bold transition disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "active" ? (
        <form action={statusAction}>
          <input type="hidden" name="series_id" value={seriesId} />
          <input type="hidden" name="status" value="paused" />
          <button type="submit" disabled={statusPending} className={`${btn} border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}>
            <Pause className="h-3.5 w-3.5" />
            Jeda
          </button>
        </form>
      ) : (
        <form action={statusAction}>
          <input type="hidden" name="series_id" value={seriesId} />
          <input type="hidden" name="status" value="active" />
          <button type="submit" disabled={statusPending} className={`${btn} border-emerald-300 text-emerald-600 hover:bg-emerald-50`}>
            <Play className="h-3.5 w-3.5" />
            Aktifkan
          </button>
        </form>
      )}
      {status !== "ended" && (
        <>
          <form action={extAction}>
            <input type="hidden" name="series_id" value={seriesId} />
            <button
              type="submit"
              disabled={extPending || status !== "active"}
              title={status === "active" ? "Tambah 8 minggu ke depan" : "Aktifkan dulu"}
              className={`${btn} border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
            >
              <Plus className="h-3.5 w-3.5" />
              +8 mgg
            </button>
          </form>
          <form action={statusAction}>
            <input type="hidden" name="series_id" value={seriesId} />
            <input type="hidden" name="status" value="ended" />
            <button type="submit" disabled={statusPending} className={`${btn} border-red-200 text-red-500 hover:bg-red-50`}>
              Akhiri
            </button>
          </form>
        </>
      )}
      {/* Pausing or ending releases the courts the series was holding.
          The result was thrown away, so the buttons gave no feedback at
          all and the schedule silently emptied. */}
      {statusState.ok && statusState.info && (
        <span className="text-[10px] font-bold text-emerald-600">{statusState.info}</span>
      )}
      {statusState.error && (
        <span className="text-[10px] font-semibold text-red-500">{statusState.error}</span>
      )}
      {extState.ok && extState.info && (
        <span className="text-[10px] font-bold text-emerald-600">{extState.info}</span>
      )}
      {extState.error && (
        <span className="text-[10px] font-semibold text-red-500">{extState.error}</span>
      )}
    </div>
  );
}
