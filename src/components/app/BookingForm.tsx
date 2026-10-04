"use client";

import { useActionState, useState } from "react";
import {
  Check,
  ClipboardList,
  Clock,
  Footprints,
  Gem,
  MessageCircle,
  User,
} from "lucide-react";
import Link from "next/link";
import {
  createBooking,
  type BookingFormState,
} from "@/app/app/(protected)/actions";
import type { PricingInfo } from "@/lib/availability";
import { computePrice, formatIDR, timeLabel } from "@/lib/availability";
import { useRole } from "./RoleContext";
import Shuttlecock from "@/components/icons/Shuttlecock";

const initial: BookingFormState = { error: null };

/** 7 → "07:00 PM", 19 → "07:00 PM", 12 → "12:00 PM", 9 → "09:00 AM". */
function hourLabel12(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${String(hr).padStart(2, "0")}:00 ${ampm}`;
}

/**
 * "+62" is drawn as its own prefix element, so the field itself only ever
 * holds the national number: 08123451234 → "812-3456-1234".
 */
function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = `0${d.slice(2)}`;
  return d.slice(0, 15);
}

function phoneDisplay(local: string): string {
  const rest = local.startsWith("0") ? local.slice(1) : local;
  if (!rest) return "";
  const tail = rest.slice(3).replace(/(\d{4})(?=\d)/g, "$1-");
  return `+62 ${rest.slice(0, 3)}${tail ? ` ${tail}` : ""}`;
}

export default function BookingForm({
  courts,
  pricing,
  customers,
  defaultDate,
  defaultCourtId,
  defaultStartHour,
}: {
  courts: Array<{ id: string; name: string }>;
  pricing: PricingInfo;
  customers: Array<{ name: string; phone: string }>;
  defaultDate: string;
  defaultCourtId: string | null;
  defaultStartHour: number | null;
}) {
  const { role } = useRole();
  const [state, formAction, pending] = useActionState(createBooking, initial);

  const [startH, setStartH] = useState<number | null>(defaultStartHour ?? null);
  const [endH, setEndH] = useState<number | null>(null);
  const [courtId, setCourtId] = useState(defaultCourtId ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [override, setOverride] = useState("");
  const [source, setSource] = useState<"walk_in" | "whatsapp">("walk_in");

  const hours = Array.from(
    { length: pricing.closeHour - pricing.openHour },
    (_, i) => pricing.openHour + i
  );
  // End options are exclusive hours: startH+1 … closeHour. Derived
  // independently of `hours` so the final slot (e.g. 22→23) is bookable.
  const endHours = startH
    ? Array.from({ length: pricing.closeHour - startH }, (_, i) => startH + 1 + i)
    : [];

  let preview: number | null = null;
  if (startH !== null && endH !== null && endH > startH) {
    preview = computePrice(pricing, startH, endH);
  }

  const court = courts.find((c) => c.id === courtId) ?? null;
  const totalHours = startH !== null && endH !== null && endH > startH ? endH - startH : 0;
  const total = override
    ? Number(override.replace(/\D/g, "") || 0)
    : preview;

  function pickCustomer(selectedName: string) {
    setName(selectedName);
    const hit = customers.find((c) => c.name === selectedName);
    if (hit) setPhone(phoneDigits(hit.phone));
  }

  /**
   * The swap button moves the later hour into "mulai". The old start is
   * almost never a legal end for the new start (19→21 becomes 21→19, and
   * 19 is not an option above 21), so "selesai" is cleared rather than
   * silently submitting an end before the start.
   */
  function swapTimes() {
    if (startH === null || endH === null) return;
    setStartH(endH);
    setEndH(null);
  }

  const card = "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";
  const label =
    "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
  const field =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
  const pill =
    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold";

  return (
    <form action={formAction} className="space-y-4">
      {/* hidden mirrors so FormData always has values */}
      <input type="hidden" name="start_hour" value={startH ?? ""} />
      <input type="hidden" name="end_hour" value={endH ?? ""} />
      <input type="hidden" name="court_id" value={courtId} />
      <input type="hidden" name="source" value={source} />

      {/* 1 — where and when */}
      <section className={card}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="court_id" className={label}>
              Lapangan
            </label>
            {state.fieldErrors?.court_id && (
              <p className="mb-1 text-[11px] font-semibold text-red-500">
                {state.fieldErrors.court_id}
              </p>
            )}
            <select
              id="court_id"
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className={field}
            >
              <option value="">Pilih lapangan</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {/* Design shows a hint line here; wording pending the next mockup. */}
            <p className="mt-1 truncate text-[10px] text-zinc-400 dark:text-zinc-500">
              {court ? court.name : "Tidak ada lapangan dipilih"}
            </p>
          </div>

          <div>
            <label htmlFor="date" className={label}>
              Tanggal
            </label>
            {state.fieldErrors?.date && (
              <p className="mb-1 text-[11px] font-semibold text-red-500">
                {state.fieldErrors.date}
              </p>
            )}
            {/* Only the native indicator: adding a decorative icon put a
                second calendar glyph in the field. */}
            <input
              id="date"
              type="date"
              name="date"
              defaultValue={defaultDate}
              required
              className={field}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="start_hour" className={label}>
              Jam Mulai
            </label>
            <select
              id="start_hour"
              value={startH ?? ""}
              onChange={(e) => {
                setStartH(e.target.value ? Number(e.target.value) : null);
                setEndH(null);
              }}
              className={field}
            >
              <option value="">—</option>
              {hours.map((h) => (
                <option key={h} value={h}>
                  {hourLabel12(h)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="end_hour" className={label}>
              Selesai
            </label>
            {state.fieldErrors?.end_hour && (
              <p className="mb-1 text-[11px] font-semibold text-red-500">
                {state.fieldErrors.end_hour}
              </p>
            )}
            <div className="flex gap-1.5">
              <select
                id="end_hour"
                value={endH ?? ""}
                onChange={(e) => setEndH(e.target.value ? Number(e.target.value) : null)}
                className={field}
                disabled={startH === null}
              >
                <option value="">—</option>
                {endHours.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel12(h)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={swapTimes}
                disabled={startH === null || endH === null}
                aria-label="Tukar jam mulai dan selesai"
                title="Tukar jam mulai dan selesai"
                className="manager-tap flex w-10 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 3v18M16 21V3M8 3 5 6M8 3l3 3M16 21l3-3M16 21l-3-3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-2 text-right text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
          {totalHours > 0 ? `Durasi ${totalHours} Jam` : "Durasi —"}
        </p>
      </section>

      {/* 2 — who is booking */}
      <section className={card}>
        <p className={label}>Pemesan / Komunitas</p>

        <div className="relative">
          <User
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            id="customer_name"
            list="customer-list"
            name="customer_name"
            value={name}
            onChange={(e) => pickCustomer(e.target.value)}
            placeholder="cth. Budi"
            required
            autoComplete="off"
            className={`${field} pl-9`}
          />
          <datalist id="customer-list">
            {customers.map((c) => (
              <option key={c.phone} value={c.name} />
            ))}
          </datalist>
        </div>
        {state.fieldErrors?.customer_name && (
          <p className="mt-1 text-[11px] font-semibold text-red-500">
            {state.fieldErrors.customer_name}
          </p>
        )}

        <div className="mt-3">
          <label htmlFor="customer_phone" className={`${label} text-right`}>
            No. WhatsApp
          </label>
          {state.fieldErrors?.customer_phone && (
            <p className="mb-1 text-[11px] font-semibold text-red-500">
              {state.fieldErrors.customer_phone}
            </p>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
              +62
            </span>
            <input
              id="customer_phone"
              name="customer_phone"
              inputMode="tel"
              value={phoneDisplay(phone)}
              onChange={(e) => setPhone(phoneDigits(e.target.value))}
              placeholder="812-3456-1234"
              required
              className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="mt-3">
          <span className={label}>Sumber Reservasi</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSource("walk_in")}
              aria-pressed={source === "walk_in"}
              className={`manager-tap inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                source === "walk_in"
                  ? "border-zinc-900 bg-zinc-100 text-zinc-800 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              }`}
            >
              <Footprints className="h-4 w-4" />
              Walk-in
            </button>
            <button
              type="button"
              onClick={() => setSource("whatsapp")}
              aria-pressed={source === "whatsapp"}
              className={`manager-tap inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                source === "whatsapp"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                  : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="notes" className={label}>
            Catatan (opsional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="Cth. Pinjam raket, minta ban..."
            className={field}
          />
        </div>
      </section>

      {/* 3 — options, then the sticky order summary */}
      <section className={card}>
        <label
          htmlFor="unconfirmed"
          className="flex cursor-pointer items-center justify-between gap-3 border-l-2 border-amber-500 pl-3"
          title="Simpan sebagai provisional — konfirmasi nanti dari tombol Confirm di jadwal"
        >
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Konfirmasi Booking
            </span>
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-600 uppercase dark:text-amber-400">
              Pending
            </span>
          </span>
          <span className="relative inline-flex flex-shrink-0">
            <input
              id="unconfirmed"
              name="unconfirmed"
              value="1"
              type="checkbox"
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="block h-5 w-9 rounded-full bg-zinc-300 transition peer-checked:bg-amber-500 dark:bg-zinc-700"
            />
            <span
              aria-hidden="true"
              className="absolute top-0.5 left-0.5 block h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4"
            />
          </span>
        </label>

        {role === "owner" && (
          <div className="mt-3 border-l-2 border-zinc-300 pl-3 dark:border-zinc-700">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                <Gem className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                Harga Normal (Owner Override)
              </span>
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Normal: {preview !== null ? formatIDR(preview) : "—"}
              </span>
            </div>
            <input
              id="override_price"
              name="override_price"
              inputMode="numeric"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder={preview !== null ? "Kosongkan = otomatis" : "Kosongkan = otomatis"}
              className={`${field} mt-2`}
            />
          </div>
        )}

        {/* Order summary — the floating block. Court, span and total in one
            place, so the numbers can be checked without scrolling back up. */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-zinc-200 bg-white/95 px-4 pt-4 pb-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Total Pembayaran
              </p>
              <p className="mt-0.5 text-xl leading-none font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
                {total !== null ? formatIDR(total) : "—"}
              </p>
            </div>
            <span className={`${pill} shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300`}>
              <Shuttlecock className="h-3 w-3" aria-hidden="true" />
              <span className="max-w-[9rem] truncate">
                {court?.name ?? "Belum pilih"}
              </span>
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {startH !== null && endH !== null
                ? `${timeLabel(`${String(startH).padStart(2, "0")}:00`)} — ${timeLabel(`${String(endH).padStart(2, "0")}:00`)}`
                : "— —"}
            </span>
            {totalHours > 0 && (
              <span className={`${pill} border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300`}>
                {totalHours} jam
              </span>
            )}
          </div>

          {preview !== null && (
            <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
              {formatIDR(preview)} harga basis (diskon + override)
            </p>
          )}
        </div>
      </section>

      {/* Order summary — fixed to the bottom so the total, court, span and
          duration are readable while the rest of the form is still being
          filled. It clears the bottom tab bar (z-30) on mobile and sits on the
          viewport edge from lg up, where there is no tab bar. z-40 keeps it
          above the header and the nav but below the drawer (z-[60]). */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:bottom-0">
        <div className="mx-auto max-w-3xl px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:max-w-7xl lg:px-6 lg:pb-4">
          {/* Opaque, not translucent: at 95% + a light blur the page behind was
              legible through the bar and the total appeared twice. */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Total Pembayaran
                </p>
                <p className="mt-0.5 text-xl leading-none font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
                  {total !== null ? formatIDR(total) : "—"}
                </p>
              </div>
              <span className={`${pill} shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300`}>
                <Shuttlecock className="h-3 w-3" aria-hidden="true" />
                <span className="max-w-[9rem] truncate">
                  {court?.name ?? "Belum pilih"}
                </span>
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {startH !== null && endH !== null
                  ? `${timeLabel(`${String(startH).padStart(2, "0")}:00`)} — ${timeLabel(`${String(endH).padStart(2, "0")}:00`)}`
                  : "— —"}
              </span>
              {totalHours > 0 && (
                <span className={`${pill} border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300`}>
                  {totalHours} jam
                </span>
              )}
            </div>

            {state.error && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="manager-tap mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {pending ? "Menyimpan…" : "Buat Booking Baru"}
            </button>

            <Link
              href="/app/jadwal"
              className="mt-2 block text-center text-[11px] font-medium text-zinc-500 hover:underline dark:text-zinc-400"
            >
              Batal &amp; Kembali ke Jadwal
            </Link>
          </div>
        </div>
      </div>

      {/* Keeps the last field clear of the fixed summary. */}
      <div aria-hidden="true" className="h-36 lg:h-44" />
    </form>
  );
}