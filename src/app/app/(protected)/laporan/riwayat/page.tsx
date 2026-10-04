import Link from "next/link";
import { createClient } from "@/lib/proxy/client";
import { VISIBLE_ON_SCHEDULE } from "@/lib/booking-status";
import { DataUnavailable, EmptyState, firstError } from "@/components/app/EmptyState";
import PaymentForm from "@/components/app/PaymentForm";
import DeletePaymentButton from "@/components/app/DeletePaymentButton";
import {
  addDaysISO,
  durationHours,
  formatHours,
  formatIDR,
  timeLabel,
  todayISO,
} from "@/lib/availability";

export const metadata = { title: "Riwayat Booking · Centrum Manager" };

function PayBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: {
      label: "Lunas",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    },
    partial: {
      label: "DP",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    },
  };
  const b = map[status] ?? {
    label: "Belum bayar",
    cls: "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${b.cls}`}
    >
      {b.label}
    </span>
  );
}

export default async function RiwayatPage() {
  const today = todayISO();
  const from = addDaysISO(today, -30);

  const supabase = await createClient();
  const [bookingsRes, paymentsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, courts(name)")
      .gte("booking_date", from)
      .lt("booking_date", addDaysISO(today, 1))
      .in("status", VISIBLE_ON_SCHEDULE)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(200),
    supabase
      .from("payments")
      .select("id,booking_id,amount,method,note,paid_at")
      .order("paid_at", { ascending: false })
      .limit(2000),
  ]);

  const readError = firstError(bookingsRes, paymentsRes);
  const bookings = (bookingsRes.data ?? []) as Array<{
    id: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    customer_name: string;
    status: string;
    payment_status: string;
    computed_price: number;
    override_price: number | null;
    courts: { name: string } | null;
  }>;
  const payments = (paymentsRes.data ?? []) as Array<{
    id: string;
    booking_id: string;
    amount: number;
    method: string;
    note: string | null;
    paid_at: string;
  }>;

  const paidByBooking = new Map<string, number>();
  for (const p of payments) {
    paidByBooking.set(
      p.booking_id,
      (paidByBooking.get(p.booking_id) ?? 0) + Number(p.amount)
    );
  }
  const paymentsByBooking = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = paymentsByBooking.get(p.booking_id) ?? [];
    list.push(p);
    paymentsByBooking.set(p.booking_id, list);
  }

  const unpaidCount = bookings.filter(
    (b) =>
      Number(b.override_price ?? b.computed_price) >
      (paidByBooking.get(b.id) ?? 0)
  ).length;

  return (
    <div className="space-y-4">
      {readError ? (
        <DataUnavailable detail={readError} />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="Belum ada riwayat"
          body="Tidak ada booking dalam 30 hari terakhir."
          action={{ href: "/app/booking/baru", label: "Catat booking" }}
        />
      ) : (
        <>
          {unpaidCount > 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              {unpaidCount} booking belum lunas. Catat pelunasan langsung di
              bloknya masing-masing.
            </p>
          )}

          <ul className="space-y-2.5">
            {bookings.map((b) => {
              const price = Number(b.override_price ?? b.computed_price);
              const paid = paidByBooking.get(b.id) ?? 0;
              const outstanding = Math.max(price - paid, 0);
              const rows = paymentsByBooking.get(b.id) ?? [];
              return (
                <li
                  key={b.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                        {new Intl.DateTimeFormat("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          timeZone: "Asia/Jakarta",
                        }).format(
                          new Date(`${b.booking_date}T00:00:00+07:00`)
                        )}{" "}
                        · {timeLabel(b.start_time)}–{timeLabel(b.end_time)}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {b.courts?.name ?? "—"}
                        </span>
                        <span className="truncate">{b.customer_name}</span>
                        <span>
                          {formatHours(durationHours(b.start_time, b.end_time))}{" "}
                          jam
                        </span>
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                          {formatIDR(price)}
                        </span>
                        <PayBadge status={b.payment_status} />
                        {outstanding > 0 && (
                          <span className="text-[11px] font-semibold text-red-500 dark:text-red-400">
                            sisa {formatIDR(outstanding)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {rows.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                      {rows.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400"
                        >
                          <span className="min-w-0 truncate">
                            {p.method === "qris" ? "QRIS" : "Tunai"}
                            {p.note ? ` · ${p.note}` : ""}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="font-bold text-zinc-700 dark:text-zinc-200">
                              {formatIDR(Number(p.amount))}
                            </span>
                            <DeletePaymentButton paymentId={p.id} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {outstanding > 0 && b.status !== "no_show" && (
                    <div className="mt-2.5">
                      <PaymentForm
                        bookingId={b.id}
                        outstanding={outstanding}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2">
            <Link
              href="/app/pembayaran"
              className="manager-tap rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Tutup hari ini &amp; tagihan — Bayar
            </Link>
            <Link
              href="/app/pelanggan"
              className="manager-tap rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Direktori pelanggan
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
