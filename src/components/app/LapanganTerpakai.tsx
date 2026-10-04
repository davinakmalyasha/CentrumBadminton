"use client";

import { Clock, LogOut, Plus, Timer } from "lucide-react";
import { useActionState } from "react";
import {
  extendBooking,
  releaseBooking,
  type ActionState,
} from "@/app/app/(protected)/actions";
import {
  isInPlay,
  minutesLeft,
  timeLabel,
  wibNowMinutes,
} from "@/lib/availability";

type CourtBooking = {
  id: string;
  courts: { name: string } | null;
  customer_name: string;
  start_time: string;
  end_time: string;
  status: string;
};

const initial: ActionState = { error: null };

/**
 * "Lapangan Terpakai" and "Live Lapangan" in one card.
 *
 * They were two cards, and then a third one for the next booking, which meant
 * one booking could appear three times on a screen whose whole job is "what is
 * happening on my courts". Both numbers answer the same question at different
 * granularities — how much of the day is sold, and who is on a court right now
 * — so they sit side by side instead of in separate boxes.
 *
 * `percent` and `note` are computed on the server from the day's bookings;
 * the live half needs the clock and the form actions, so it is a client
 * component. `isInPlay` decides both, which is why the highlight and the
 * buttons can never disagree about who is playing.
 */
export default function LapanganTerpakai({
  bookings,
  percent,
  note,
}: {
  bookings: CourtBooking[];
  /** null when capacity is unknown — never a made-up 0%. */
  percent: number | null;
  note: string;
}) {
  const [extState, extAction, extPending] = useActionState(extendBooking, initial);
  const [relState, relAction, relPending] = useActionState(releaseBooking, initial);

  const nowMin = wibNowMinutes();
  const live = bookings.filter((b) =>
    isInPlay(b.start_time, b.end_time, b.status, nowMin)
  );
  const err = extState.error || relState.error;
  const busy = extPending || relPending;

  return (
    <div className="flex h-full items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {/* How much of the day is sold. */}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          <Timer className="h-4 w-4" aria-hidden="true" />
          Lapangan Terpakai
        </p>
        <p className="mt-1.5 text-xl leading-none font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
          {percent === null ? "—" : `${percent}%`}
        </p>
        <p className="mt-1.5 text-[11px] leading-snug font-medium text-zinc-500 dark:text-zinc-400">
          {note}
        </p>
      </div>

      {/* Who is on a court right now, and the two things you can do about it. */}
      <div className="min-w-0 flex-1 border-l border-zinc-200 pl-4 dark:border-zinc-800">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Live Lapangan
          {live.length > 0 && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              {live.length} dipakai
            </span>
          )}
        </p>

        {live.length === 0 ? (
          <p className="mt-1.5 text-[11px] leading-snug font-medium text-zinc-500 dark:text-zinc-400">
            Tidak ada yang sedang main sekarang.
            {bookings.length > 0 && " Sisa bookings menunggu di jadwal."}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {live.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-zinc-900 dark:text-zinc-50">
                    {b.courts?.name ?? "Lapangan"} — {b.customer_name}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    sampai {timeLabel(b.end_time)} · sisa{" "}
                    {minutesLeft(b.end_time, nowMin)}m
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <form action={extAction}>
                    <input type="hidden" name="booking_id" value={b.id} />
                    <input type="hidden" name="hours" value="1" />
                    <button
                      type="submit"
                      disabled={busy}
                      className="manager-tap inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      title="Nambah 1 jam — cek slot berikutnya, hitung harga otomatis"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      +1 jam
                    </button>
                  </form>
                  {b.status === "checked_in" ? (
                    <form action={relAction}>
                      <input type="hidden" name="booking_id" value={b.id} />
                      <button
                        type="submit"
                        disabled={busy}
                        className="manager-tap inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-bold text-amber-600 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900/60 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-950/40"
                        title="Kosongkan sekarang — set selesai, uang tetap dihitung, slot jadi free"
                      >
                        <LogOut className="h-3 w-3" aria-hidden="true" />
                        Kosongkan
                      </button>
                    </form>
                  ) : (
                    // "Kosongkan" completes a booking and completed is only
                    // reachable from checked_in, so on a plain confirmed
                    // walk-in the button would 409. Say why instead of
                    // offering one that cannot work.
                    <span
                      className="inline-flex min-h-[32px] items-center rounded-lg border border-zinc-200 px-2 text-[10px] font-semibold text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                      title="Tandai masuk dulu untuk bisa dikosongkan lebih awal"
                    >
                      Belum masuk
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {err && (
          <p role="alert" className="mt-2 text-[11px] font-semibold text-red-500 dark:text-red-400">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}