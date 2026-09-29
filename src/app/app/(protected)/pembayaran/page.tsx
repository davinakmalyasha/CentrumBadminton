import { createClient } from "@/lib/proxy/client";
import { addDaysISO, formatIDR, todayISO } from "@/lib/availability";
import type { Booking, PaymentStatus } from "@/lib/types";
import { Banknote, Check, QrCode, Receipt, User } from "lucide-react";
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
  const [bookingsRes, paymentsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, courts(name)")
      .eq("booking_date", date)
      .neq("status", "cancelled")
      .order("start_time"),
    supabase
      .from("payments")
      .select("id,booking_id,amount,method,note,paid_at")
      .gte("paid_at", `${date}T00:00:00+07:00`)
      .lt("paid_at", `${next}T00:00:00+07:00`)
      .order("paid_at", { ascending: false }),
  ]);

  const bookings = (bookingsRes.data ?? []) as BRow[];
  const payments = (paymentsRes.data ?? []) as PRow[];

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

  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const dayLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${date}T00:00:00+07:00`));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-zinc-50">
          <Banknote className="h-5 w-5" strokeWidth={1.75} /> Pembayaran
        </h1>
        <p className="text-xs font-semibold capitalize text-zinc-500 dark:text-zinc-400">{dayLabel}</p>
      </div>

      {/* Daily close summary */}
      <div className="rounded-2xl border border-zinc-900 bg-zinc-900 p-4 text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          Total masuk hari ini
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

      {/* Outstanding / collectible bookings */}
      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Tagihan Booking
        </h2>
        {bookings.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Tidak ada booking pada tanggal ini.
          </p>
        )}
        <ul className="space-y-2.5">
          {bookings.map((b) => {
            const price = Number(b.override_price ?? b.computed_price);
            const paid = paidByBooking.get(b.id) ?? 0;
            const outstanding = Math.max(price - paid, 0);
            return (
              <li key={b.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                      <User className="mr-1 inline-block h-3.5 w-3.5 align-[-1px]" />
                      {b.customer_name}
                      <span className="ml-2 rounded-md bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 align-middle text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                        {b.courts?.name ?? ""}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {String(b.start_time).slice(0, 5)}–{String(b.end_time).slice(0, 5)} ·{" "}
                      {formatIDR(paid)} / {formatIDR(price)}
                      {outstanding > 0 && (
                        <span className="ml-1 text-red-500">
                          (sisa {formatIDR(outstanding)})
                        </span>
                      )}
                    </p>
                  </div>
                  <PaymentBadge status={b.payment_status} />
                </div>

                {outstanding > 0 && b.status !== "no_show" && (
                  <PaymentForm bookingId={b.id} outstanding={outstanding} />
                )}

                {/* Payments recorded for this booking */}
                {payments
                  .filter((p) => p.booking_id === b.id)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="mt-1.5 flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5"
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
          })}
        </ul>
      </section>

      {/* All transactions today */}
      {payments.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Riwayat Transaksi
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
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
                    {p.note && (
                      <span className="block truncate text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                        {p.note}
                      </span>
                    )}
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
