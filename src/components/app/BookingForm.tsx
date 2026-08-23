"use client";

import { useActionState, useState } from "react";
import {
  createBooking,
  type BookingFormState,
} from "@/app/app/(protected)/actions";
import type { PricingInfo } from "@/lib/availability";
import { computePrice, formatIDR } from "@/lib/availability";
import { useRole } from "./RoleContext";

const initial: BookingFormState = { error: null };

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

  const [startH, setStartH] = useState<number | null>(
    defaultStartHour ?? null
  );
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
  const endHours = startH
    ? hours.filter((h) => h > startH).map((h) => h + 1) // end is exclusive
    : [];

  // Live price preview
  let preview: number | null = null;
  if (startH !== null && endH !== null && endH > startH) {
    preview = computePrice(pricing, startH, endH);
  }

  function pickCustomer(selectedName: string) {
    setName(selectedName);
    const hit = customers.find((c) => c.name === selectedName);
    if (hit) setPhone(hit.phone);
  }

  const field =
    "w-full rounded-xl border border-sky-brand-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-sky-brand-400 focus:outline-none";
  const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-navy-700/60";

  return (
    <form action={formAction} className="space-y-4">
      {/* hidden mirrors so FormData always has values */}
      <input type="hidden" name="start_hour" value={startH ?? ""} />
      <input type="hidden" name="end_hour" value={endH ?? ""} />

      <div>
        <span className={label}>Lapangan</span>
        {state.fieldErrors?.court_id && (
          <p className="mb-1 text-[11px] font-semibold text-red-500">
            {state.fieldErrors.court_id}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {courts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCourtId(c.id)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                courtId === c.id
                  ? "border-accent-500 bg-accent-500/10 text-accent-600"
                  : "border-sky-brand-200 bg-white text-navy-800"
              }`}
            >
              🏸 {c.name}
            </button>
          ))}
        </div>
        <input type="hidden" name="court_id" value={courtId} />
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
        <input
          id="date"
          type="date"
          name="date"
          defaultValue={defaultDate}
          required
          className={field}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start_hour" className={label}>
            Mulai
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
                {String(h).padStart(2, "0")}.00
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
                {String(h - 1).padStart(2, "0")}.59
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="customer_name" className={label}>
          Nama Pelanggan
        </label>
        {state.fieldErrors?.customer_name && (
          <p className="mb-1 text-[11px] font-semibold text-red-500">
            {state.fieldErrors.customer_name}
          </p>
        )}
        <input
          id="customer_name"
          list="customer-list"
          name="customer_name"
          value={name}
          onChange={(e) => pickCustomer(e.target.value)}
          placeholder="cth. Budi"
          required
          autoComplete="off"
          className={field}
        />
        <datalist id="customer-list">
          {customers.map((c) => (
            <option key={c.phone} value={c.name} />
          ))}
        </datalist>
        {customers.length > 0 && (
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
            {customers.slice(0, 8).map((c) => (
              <button
                key={c.phone}
                type="button"
                onClick={() => pickCustomer(c.name)}
                className="flex-shrink-0 rounded-full border border-sky-brand-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-navy-700 hover:bg-ice-100"
              >
                👤 {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="customer_phone" className={label}>
          No. WhatsApp
        </label>
        {state.fieldErrors?.customer_phone && (
          <p className="mb-1 text-[11px] font-semibold text-red-500">
            {state.fieldErrors.customer_phone}
          </p>
        )}
        <input
          id="customer_phone"
          name="customer_phone"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08xxxxxxxxxx"
          required
          className={field}
        />
      </div>

      <div>
        <span className={label}>Sumber</span>
        <input type="hidden" name="source" value={source} />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSource("walk_in")}
            className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
              source === "walk_in"
                ? "border-accent-500 bg-accent-500/10 text-accent-600"
                : "border-sky-brand-200 bg-white text-navy-800"
            }`}
          >
            🚶 Walk-in
          </button>
          <button
            type="button"
            onClick={() => setSource("whatsapp")}
            className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
              source === "whatsapp"
                ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                : "border-sky-brand-200 bg-white text-navy-800"
            }`}
          >
            💬 WhatsApp
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={label}>
          Catatan (opsional)
        </label>
        <textarea id="notes" name="notes" rows={2} className={field} />
      </div>

      <label
        htmlFor="unconfirmed"
        className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
        title="Simpan sebagai provisional — konfirmasi nanti dari tombol Confirm di jadwal"
      >
        <input id="unconfirmed" name="unconfirmed" value="1" type="checkbox" className="mt-0.5 h-4 w-4 accent-amber-500" />
        <span className="text-[11px] font-semibold leading-snug text-amber-700">
          Simpan sebagai <b>belum konfirmasi</b> (pending)
          <span className="block font-medium text-amber-600/70">
            Untuk reservasi WA yang belum pasti — slot tetap terkunci, konfirmasi lewat tombol Confirm.
          </span>
        </span>
      </label>

      {role === "owner" && (
        <div className="rounded-xl border border-dashed border-accent-400 bg-accent-500/5 p-3">
          <label htmlFor="override_price" className={label}>
            💎 Harga Manual (owner)
          </label>
          <input
            id="override_price"
            name="override_price"
            inputMode="numeric"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder={preview !== null ? `otomatis ${preview}` : "kosongkan = otomatis"}
            className={field}
          />
        </div>
      )}

      {/* Price preview */}
      <div className="flex items-center justify-between rounded-2xl border border-sky-brand-200 bg-ice-100 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-wide text-navy-700/60">
          Total harga
        </span>
        <span className="text-lg font-black text-navy-900">
          {override ? formatIDR(Number(override.replace(/\D/g, "") || 0)) : preview !== null ? formatIDR(preview) : "—"}
        </span>
      </div>

      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
          ⚠️ {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-accent-500 py-3.5 text-sm font-black text-white shadow-lg shadow-accent-500/30 transition hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan Booking"}
      </button>
    </form>
  );
}
