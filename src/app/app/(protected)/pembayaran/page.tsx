import Link from "next/link";
import { createClient } from "@/lib/proxy/client";
import { DataUnavailable, EmptyState, firstError } from "@/components/app/EmptyState";
import { VISIBLE_ON_SCHEDULE } from "@/lib/booking-status";
import { addDaysISO, formatIDR, todayISO } from "@/lib/availability";
import type { Booking, PaymentStatus } from "@/lib/types";
import { Banknote, Check, ChevronLeft, ChevronRight, QrCode, Receipt, User } from "lucide-react";
import PaymentForm from "@/components/app/PaymentForm";
import DeletePaymentButton from "@/components/app/DeletePaymentButton";

const PAY_BADGE: Record<PaymentStatus, { label: string; dot: string; cls: string }> = {
  unpaid: { label: "Belum bayar", dot: "bg-red-500", cls: "bg-red-50 text-red-500 border-red-200" },
  partial: { label: "DP", dot: "bg-amber-400", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  paid: { label: "Lunas", dot: "bg-emerald-500", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const m = PAY_BADGE[status] ?? PAY_BADGE.unpaid;
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.cls}`}
    >
      <span className={"inline-block h-2 w-2 rounded-full " + m.dot} />
      {m.label}
    </span>
  );
}

export const metadata = { title: "Pembayaran · Centrum Manager" };

type BRow = Booking & { courts: { name: string } | null };
type PRow = {
  id: string;
  booking_id: string;
  amount: number;
  method: string;
  note: string | null;
  paid_at: string;
};

export default async function PembayaranPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const next = addDaysISO(date, 1);

  const supabase = await createClient();
  const [bookingsRes, paymentsRes, unpaidRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, courts(name)")
      .eq("booking_date", date)
      .in("status", VISIBLE_ON_SCHEDULE)
      .order("start_time"),
    supabase
      .from("payments")
      .select("id,booking_id,amount,method,note,paid_at")
      .gte("paid_at", `${date}T00:00:00+07:00`)
      .lt("paid_at", `${next}T00:00:00+07:00`)
      .order("paid_at", { ascending: false }),
    // Everything still owed, regardless of date. Previously the only
    // bookings on this page were the ones dated `date` (today by default),
    // so an invoice from three days ago had no row to attach a form to and
    // "Catat pembayaran" looked broken. Scoped to a window so it stays a
    // collections list rather than a full history dump.
    supabase
      .from("bookings")
      .select("*, courts(name)")
      .gte("booking_date", addDaysISO(date, -60))
      .lt("booking_date", next)
      .in("status", VISIBLE_ON_SCHEDULE)
      .in("payment_status", ["unpaid", "partial"])
      .order("booking_date", { ascending: false })
      .limit(100),
  ]);

  const bookings = (bookingsRes.data ?? []) as BRow[];
  const payments = (paymentsRes.data ?? []) as PRow[];
  const readError = firstError(bookingsRes, paymentsRes, unpaidRes);

  // Tally paid per booking
  const paidByBooking = new Map<string, number>();
  let cash = 0;
  let qris = 0;
  for (const p of payments) {
    const amt = Number(p.amount);
    paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) ?? 0) + amt);
    if (p.method === "qris") qris += amt;
    else cash += amt;
  }

  // Older invoices need their lifetime paid total, not just today's — an
  // outstanding balance computed from today's payments alone offers the
  // wrong amount. One window query covers both the day summary and every
  // invoice on the outstanding list, so there is no per-row fetch.
  const windowStart = addDaysISO(date, -60);
  const [oldPaymentsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("booking_id,amount")
      .gte("paid_at", `${windowStart}T00:00:00+07:00`)
      .lt("paid_at", `${next}T00:00:00+07:00`)
      .limit(2000),
  ]);
  const paidInWindow = new Map<string, number>();
  for (const p of (oldPaymentsRes.data ?? []) as Array<{ booking_id: string; amount: number }>) {
    paidInWindow.set(p.booking_id, (paidInWindow.get(p.booking_id) ?? 0) + Number(p.amount));
  }
  const outstandingOnly = ((unpaidRes.data ?? []) as BRow[]).filter(
    (b) => b.booking_date !== date && !bookings.some((x) => x.id === b.id)
  );
  for (const b of outstandingOnly) {
    // Day payments already seeded paidByBooking; don't let the wider
    // window double-count them.
    if (!paidByBooking.has(b.id)) {
      paidByBooking.set(b.id, paidInWindow.get(b.id) ?? 0);
    }
  }

  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const dayLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${date}T00:00:00+07:00`));

  // One row renderer, shared by today's list and the outstanding list.
  const renderBooking = (b: BRow, showDate: boolean) => {
    const price = Number(b.override_price ?? b.computed_price);
    const paid = paidByBooking.get(b.id) ?? 0;
    const outstanding = Math.max(price - paid, 0);
    return (
      <li
        key={b.id}
        className="rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">
              <User className="mr-1 inline-block h-3.5 w-3.5 align-[-1px]" />
              {b.customer_name}
              {b.courts?.name ? (
                <span className="ml-2 rounded-md bg-zinc-200 px-1.5 py-0.5 align-middle text-[10px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {b.courts.name}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              {showDate ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {b.booking_date} ·{" "}
                </span>
              ) : null}
              {String(b.start_time).slice(0, 5)}–{String(b.end_time).slice(0, 5)} ·{" "}
              {formatIDR(paid)} / {formatIDR(price)}
              {outstanding > 0 ? (
                <span className="ml-1 text-red-500">(sisa {formatIDR(outstanding)})</span>
              ) : null}
            </p>
          </div>
          <PaymentBadge status={b.payment_status} />
        </div>

        {outstanding > 0 && b.status !== "no_show" ? (
          <PaymentForm
            key={`pay-${b.id}-${outstanding}`}
            bookingId={b.id}
            outstanding={outstanding}
          />
        ) : null}

        {payments
          .filter((p) => p.booking_id === b.id)
          .map((p) => (
            <div
              key={p.id}
              className="mt-1.5 flex items-center justify-between rounded-lg bg-zinc-100 px-2.5 py-1.5 dark:bg-zinc-800"
            >
              <span className="text-[11px] font-bold text-emerald-700">
                <Check className="mr-1 inline h-3 w-3" />
                {p.method.toUpperCase()} {formatIDR(Number(p.amount))}
                {" · "}
                <span className="font-medium text-zinc-500 dark:text-zinc-400">
                  {new Date(p.paid_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                  })}
                </span>
              </span>
              <DeletePaymentButton paymentId={p.id} />
            </div>
          ))}
      </li>
    );
  };

  return (
    <div className="space-y-5">
      {/* Day stepper. `?date=` was honoured by this page but nothing in the
          app ever linked to it, so there was no way to reach another
          day's takings. */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/pembayaran?date=${addDaysISO(date, -1)}`}
          className="manager-tap flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="Hari sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <h1 className="flex items-center justify-center gap-2 text-lg font-black text-zinc-900 dark:text-zinc-50">
            <Banknote className="h-5 w-5" strokeWidth={1.75} /> Pembayaran
          </h1>
          <p className="text-xs font-semibold capitalize text-zinc-500 dark:text-zinc-400">
            {date === today ? "Hari ini" : dayLabel}
          </p>
        </div>
        <Link
          href={`/app/pembayaran?date=${addDaysISO(date, 1)}`}
          className="manager-tap flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="Hari berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {readError ? (
        <DataUnavailable detail={readError} />
      ) : (
        <>
          {/* Daily close summary */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900 p-4 text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              {date === today ? "Total masuk hari ini" : `Total masuk ${dayLabel}`}
            </p>
            <p className="mt-1 text-3xl font-black tracking-tight text-white">
              {formatIDR(cash + qris)}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" /> Cash {formatIDR(cash)}
              </span>
              <span className="flex items-center gap-1">
                <QrCode className="h-3.5 w-3.5" /> QRIS {formatIDR(qris)}
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" /> {payments.length} transaksi
              </span>
            </div>
          </div>

          {/* Older invoices still owed — the "Catat pembayaran" the nav
              promised. Reachable regardless of which day is selected. */}
          {outstandingOnly.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Belum lunas ({outstandingOnly.length})
              </h2>
              <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                Tagihan dari 60 hari terakhir yang masih kurang. Pilih tanggal
                lain di atas untuk melihat semuanya.
              </p>
              <ul className="space-y-2.5">{outstandingOnly.map((b) => renderBooking(b, true))}</ul>
            </section>
          ) : null}

          {/* Today's bookings */}
          <section>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Tagihan Booking
            </h2>
            {bookings.length === 0 ? (
              <EmptyState
                title="Tidak ada booking pada tanggal ini"
                body="Pilih tanggal lain memakai tombol panah, atau catat booking baru dulu."
                action={{ href: "/app/booking/baru", label: "Catat booking" }}
              />
            ) : (
              <ul className="space-y-2.5">{bookings.map((b) => renderBooking(b, false))}</ul>
            )}
          </section>
        </>
      )}

      {/* All transactions today */}
      {!readError && payments.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Riwayat Transaksi
          </h2>
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {payments.map((p) => {
              const b = bookingById.get(p.booking_id);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100"
                >
                  <span className="min-w-0 truncate">
                    {p.method === "qris" ? (
                      <QrCode className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" />
                    ) : (
                      <Banknote className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" />
                    )}
                    {b?.customer_name ?? "—"}
                    {p.note ? (
                      <span className="block truncate text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                        {p.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex-shrink-0">{formatIDR(Number(p.amount))}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
