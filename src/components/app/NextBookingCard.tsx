import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { minutesOf, timeLabel, wibNowMinutes } from "@/lib/availability";

type NextBooking = {
  id: string;
  status: string;
  customer_name: string;
  start_time: string;
  end_time: string;
  courts: { name: string } | null;
};

/**
 * "Who is on the court next?" — the one question the old four-tile grid
 * answered worst. A lone `19.00` in a `StatCard` hid the two things you
 * actually need (which court, whose booking) and the label "Berikutnya"
 * never said next *what*, so this is a row rather than a tile.
 *
 * `pending` is included on purpose: an unconfirmed WhatsApp hold locks the
 * court (`OCCUPIES_COURT` contains `pending`), so hiding it here is how a
 * hold that should be playing right now stayed invisible.
 */
export default function NextBookingCard({
  booking,
}: {
  booking: NextBooking | null;
}) {
  const nowMin = wibNowMinutes();

  const heading = (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
      <CalendarClock className="h-4 w-4" aria-hidden="true" />
      Booking Berikutnya
    </p>
  );

  if (!booking) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {heading}
        <p className="mt-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Tidak ada booking lagi hari ini
        </p>
      </div>
    );
  }

  const startMin = minutesOf(booking.start_time);
  const endMin = minutesOf(booking.end_time);
  const inPlay = nowMin >= startMin && nowMin < endMin;
  const isPending = booking.status === "pending";

  const chip = isPending
    ? { label: "Perlu konfirmasi", cls: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300" }
    : inPlay
      ? { label: "Sedang main", cls: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300" }
      : { label: "Akan datang", cls: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" };

  return (
    <Link
      href="/app/jadwal"
      aria-label={`Booking berikutnya: ${timeLabel(booking.start_time)}-${timeLabel(booking.end_time)}, ${booking.courts?.name ?? "lapangan"}, ${booking.customer_name}`}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="min-w-0">
        {heading}
        <p className="mt-1.5 text-xl leading-none font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
          {timeLabel(booking.start_time)}–{timeLabel(booking.end_time)}
        </p>
        <p className="mt-1.5 truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {booking.courts?.name ?? "—"}
          </span>{" "}
          {booking.customer_name}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${chip.cls}`}
        >
          {chip.label}
        </span>
        <ArrowUpRight
          className="h-4 w-4 text-zinc-400 transition group-hover:text-zinc-700 dark:group-hover:text-zinc-200"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
