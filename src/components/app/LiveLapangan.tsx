"use client";

import { Clock, LogOut, Plus, Timer } from "lucide-react";
import { useActionState } from "react";
import { extendBooking, releaseBooking, type ActionState } from "@/app/app/(protected)/actions";
import { minutesOf, timeLabel, wibNowMinutes } from "@/lib/availability";

type LiveBooking = {
  id: string;
  court_id: string;
  courts: { name: string } | null;
  customer_name: string;
  start_time: string;
  end_time: string;
  status: string;
};

const initial: ActionState = { error: null };

export default function LiveLapangan({ bookings }: { bookings: LiveBooking[] }) {
  const [extState, extAction, extPending] = useActionState(extendBooking, initial);
  const [relState, relAction, relPending] = useActionState(releaseBooking, initial);
  const nowMin = wibNowMinutes();

  const live = bookings.filter((b) => {
    if (b.status !== "confirmed" && b.status !== "checked_in") return false;
    return nowMin >= minutesOf(b.start_time) && nowMin < minutesOf(b.end_time);
  });

  const err = extState.error || relState.error;

  if (live.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          <Timer className="h-4 w-4" aria-hidden="true" /> Live Lapangan
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Tidak ada yang main sekarang — semua kosong.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-emerald-700 dark:text-emerald-300">
        <Timer className="h-4 w-4" aria-hidden="true" /> Live — {live.length} lapangan dipakai
      </p>
      <ul className="mt-3 space-y-2">
        {live.map((b) => {
          const endMin = minutesOf(b.end_time);
          const remain = Math.max(endMin - nowMin, 0);
          const till = timeLabel(b.end_time);
          return (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-zinc-900">
              <div className="min-w-0">
                <p className="truncate text-xs font-extrabold text-zinc-900 dark:text-zinc-50">
                  {b.courts?.name ?? "Lapangan"} — {b.customer_name}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <Clock className="h-3 w-3" aria-hidden="true" /> sampai {till} · sisa {remain}m
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <form action={extAction}>
                  <input type="hidden" name="booking_id" value={b.id} />
                  <input type="hidden" name="hours" value="1" />
                  <button
                    type="submit"
                    disabled={extPending || relPending}
                    className="manager-tap inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    title="Nambah 1 jam — cek slot berikutnya, hitung harga otomatis"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> +1 jam
                  </button>
                </form>
{b.status === "checked_in" ? (
                  <form action={relAction}>
                    <input type="hidden" name="booking_id" value={b.id} />
                    <button
                      type="submit"
                      disabled={extPending || relPending}
                      className="manager-tap inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-600 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900/60 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-950/40"
                      title="Kosongkan sekarang — set selesai, uang tetap dihitung, slot jadi free"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Kosongkan
                    </button>
                  </form>
                ) : (
                  // "Kosongkan" completes a booking, and completed is only
                  // reachable from checked_in. Offering it on a `confirmed`
                  // booking -- the normal walk-in, before anyone pressed
                  // "Tandai masuk" -- submitted a transition the proxy
                  // refuses, so the button always failed. The status
                  // actions elsewhere in the row already offer "Tandai
                  // masuk"; showing the release only where it works beats
                  // showing it and failing.
                  <span
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-zinc-200 px-2.5 text-[10px] font-semibold text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                    title="Tandai masuk dulu untuk bisa dikosongkan lebih awal"
                  >
                    Belum masuk
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {err && <p role="alert" className="mt-2 text-xs font-semibold text-red-500 dark:text-red-400">{err}</p>}
      <p className="mt-2 text-[10px] text-emerald-700/60 dark:text-emerald-300/60">
        Nambah jam cek bentrok otomatis, Kosongkan = selesai cepat, uang tetap kehitung.
      </p>
    </div>
  );
}
