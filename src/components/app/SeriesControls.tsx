"use client";

import { useActionState } from "react";
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
  const [, statusAction, statusPending] = useActionState(setSeriesStatus, initial);
  const [extState, extAction, extPending] = useActionState(extendSeries, initial);

  const btn =
    "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "active" ? (
        <form action={statusAction}>
          <input type="hidden" name="series_id" value={seriesId} />
          <input type="hidden" name="status" value="paused" />
          <button type="submit" disabled={statusPending} className={`${btn} border-sky-brand-300 text-sky-brand-600 hover:bg-ice-100`}>
            ⏸ Jeda
          </button>
        </form>
      ) : (
        <form action={statusAction}>
          <input type="hidden" name="series_id" value={seriesId} />
          <input type="hidden" name="status" value="active" />
          <button type="submit" disabled={statusPending} className={`${btn} border-emerald-300 text-emerald-600 hover:bg-emerald-50`}>
            ▶️ Aktifkan
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
              className={`${btn} border-sky-brand-300 text-sky-brand-600 hover:bg-ice-100`}
            >
              ➕+8 mgg
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
      {extState.ok && extState.info && (
        <span className="text-[10px] font-bold text-emerald-600">✅ {extState.info}</span>
      )}
      {extState.error && (
        <span className="text-[10px] font-semibold text-red-500">{extState.error}</span>
      )}
    </div>
  );
}
