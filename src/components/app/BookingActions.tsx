"use client";

import { useActionState } from "react";
import { Check, Flag, LogOut, Plus, Trash2, UserX } from "lucide-react";
import {
  updateBookingStatus,
  deleteBooking,
  extendBooking,
  releaseBooking,
  type ActionState,
} from "@/app/app/(protected)/actions";
import { useRole } from "./RoleContext";

const initial: ActionState = { error: null };

export default function BookingActions({
  bookingId,
  status,
  inPlay = false,
}: {
  bookingId: string;
  status: string;
  /**
   * Whether this booking is on a court right now. Passed in rather than read
   * from the clock here so the row's highlight and these buttons can never
   * disagree — and so "+1 jam" is offered for a court that is actually in use,
   * not for one that starts in three hours.
   */
  inPlay?: boolean;
}) {
  const { role } = useRole();
  const [state, formAction, pending] = useActionState(updateBookingStatus, initial);
  const [delState, delAction, delPending] = useActionState(deleteBooking, initial);
  const [extState, extAction, extPending] = useActionState(extendBooking, initial);
  const [relState, relAction, relPending] = useActionState(releaseBooking, initial);

  const btn =
    "manager-tap inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50";

  const err = state.error || delState.error || extState.error || relState.error;
  const busy = pending || delPending || extPending || relPending;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Live-court actions. Used to live in a separate "Live Lapangan" card
          that listed the same booking the agenda row below already showed;
          the row is now the only place court state appears. */}
      {inPlay && (
        <form action={extAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="hours" value="1" />
          <button
            type="submit"
            disabled={busy}
            className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
            title="Nambah 1 jam — cek slot berikutnya, hitung harga otomatis"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            +1 jam
          </button>
        </form>
      )}
      {inPlay && status === "checked_in" && (
        <form action={relAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <button
            type="submit"
            disabled={busy}
            className={`${btn} border border-amber-300 bg-white text-amber-600 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-950/40`}
            title="Kosongkan sekarang — set selesai, uang tetap dihitung, slot jadi free"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Kosongkan
          </button>
        </form>
      )}
      {(status === "pending" || status === "confirmed") && (
        <form action={formAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="status" value="checked_in" />
          <button
            type="submit"
            disabled={pending || status !== "confirmed"}
            className={`${btn} bg-emerald-500 text-white hover:bg-emerald-600`}
            title={status === "pending" ? "Confirm dulu sebelum check-in" : ""}
          >
            <Check className="h-3.5 w-3.5" />
            Check-in
          </button>
        </form>
      )}
      {status === "pending" && (
        <form action={formAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="status" value="confirmed" />
          <button
            type="submit"
            disabled={pending}
            className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`}
          >
            Confirm
          </button>
        </form>
      )}
      {status === "checked_in" && (
        <form action={formAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="status" value="completed" />
          <button
            type="submit"
            disabled={pending}
            className={`${btn} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white`}
          >
            <Flag className="h-3.5 w-3.5" />
            Selesai
          </button>
        </form>
      )}
      {status === "confirmed" && (
        <form action={formAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="status" value="no_show" />
          <button
            type="submit"
            disabled={pending}
            className={`${btn} border border-red-200 text-red-400 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40`}
            title="Tandai no-show (menambah counter pelanggan)"
          >
            <UserX className="h-3.5 w-3.5" />
            No-show
          </button>
        </form>
      )}
      {(status === "pending" || status === "confirmed") && (
        <form action={formAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="status" value="cancelled" />
          <button
            type="submit"
            disabled={pending}
            className={`${btn} border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40`}
          >
            Batal
          </button>
        </form>
      )}
      {status === "checked_in" && (
        <form action={formAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="status" value="no_show" />
          <button
            type="submit"
            disabled={pending}
            className={`${btn} border border-red-200 text-red-400 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40`}
            title="Tandai no-show (menambah counter pelanggan)"
          >
            <UserX className="h-3.5 w-3.5" />
            No-show
          </button>
        </form>
      )}
      {role === "owner" && (
        <form action={delAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <button
            type="submit"
            disabled={delPending}
            className={`${btn} text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-zinc-800`}
            // "Hapus permanen" was a lie: the proxy sets status='cancelled'
            // and keeps the row, because deleting it would cascade into
            // sports_payments and destroy the ledger entry. Say what it
            // actually does, and which states accept it.
            title="Batalkan booking (owner) — booking tetap tersimpan dengan status dibatalkan"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
      {err && <span role="alert" className="text-[10px] font-semibold text-red-500 dark:text-red-400">{err}</span>}
    </div>
  );
}
