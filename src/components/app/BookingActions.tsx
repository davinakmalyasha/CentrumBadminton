"use client";

import { useActionState } from "react";
import { Check, Flag, Trash2, UserX } from "lucide-react";
import { updateBookingStatus, deleteBooking, type ActionState } from "@/app/app/(protected)/actions";
import { useRole } from "./RoleContext";

const initial: ActionState = { error: null };

export default function BookingActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const { role } = useRole();
  const [state, formAction, pending] = useActionState(updateBookingStatus, initial);
  const [delState, delAction, delPending] = useActionState(deleteBooking, initial);

  const btn =
    "manager-tap inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50";

  const err = state.error || delState.error;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
