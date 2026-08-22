"use client";

import { useActionState, useState } from "react";
import { createBlock, type ActionState } from "@/app/app/(protected)/actions";

const initial: ActionState = { error: null };

export default function BlockForm({
  courts,
  today,
}: {
  courts: Array<{ id: string; name: string }>;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createBlock, initial);
  const [courtId, setCourtId] = useState("");

  const hours = Array.from({ length: 17 }, (_, i) => i + 7); // 07..23
  const field =
    "w-full rounded-xl border border-sky-brand-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-sky-brand-400 focus:outline-none";
  const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-navy-700/60";

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-sky-brand-200 bg-white p-4">
      <input type="hidden" name="court_id" value={courtId} />
      <div>
        <span className={label}>Lapangan</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCourtId("")}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
              courtId === ""
                ? "border-accent-500 bg-accent-500/10 text-accent-600"
                : "border-sky-brand-200 text-navy-800"
            }`}
          >
            ⛔ Semua
          </button>
          {courts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCourtId(c.id)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                courtId === c.id
                  ? "border-accent-500 bg-accent-500/10 text-accent-600"
                  : "border-sky-brand-200 text-navy-800"
              }`}
            >
              🏸 {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="bdate" className={label}>
            Tanggal
          </label>
          <input id="bdate" type="date" name="date" defaultValue={today} required className={field} />
        </div>
        <div>
          <label htmlFor="bstart" className={label}>
            Dari
          </label>
          <select id="bstart" name="start_hour" defaultValue={7} className={field}>
            {hours.slice(0, -1).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}.00
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bend" className={label}>
            Sampai
          </label>
          <select id="bend" name="end_hour" defaultValue={23} className={field}>
            {hours.slice(1).map((h) => (
              <option key={h + 1} value={h}>
                {String(h).padStart(2, "0")}.00
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="breason" className={label}>
          Alasan
        </label>
        <input
          id="breason"
          name="reason"
          placeholder="cth. Maintenance lampu, private event"
          className={field}
        />
      </div>

      {state.error && (
        <p className="text-xs font-semibold text-red-500">⚠️ {state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-black text-white transition hover:bg-red-600 disabled:opacity-50"
      >
        {pending ? "Memproses…" : "⛔ Blokir Jadwal"}
      </button>
    </form>
  );
}
