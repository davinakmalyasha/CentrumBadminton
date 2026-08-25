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
    "inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-bold transition disabled:opacity-50";

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
            className={`${btn} border border-sky-brand-300 text-sky-brand-600 hover:bg-ice-100`}
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
            className={`${btn} bg-navy-800 text-white hover:bg-navy-700`}
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
            className={`${btn} border border-red-200 text-red-400 hover:bg-red-50`}
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
            className={`${btn} border border-red-200 text-red-500 hover:bg-red-50`}
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
            className={`${btn} border border-red-200 text-red-400 hover:bg-red-50`}
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
            className={`${btn} text-navy-700/40 hover:text-red-500`}
            title="Hapus permanen (owner)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
      {err && <span className="text-[10px] font-semibold text-red-500">{err}</span>}
    </div>
  );
}
