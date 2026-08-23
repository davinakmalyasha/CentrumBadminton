"use client";

import { useActionState } from "react";
import { createSeries, type SeriesState } from "@/app/app/(protected)/actions";

const initial: SeriesState = { error: null };

export default function SeriesForm({
  courts,
  today,
}: {
  courts: Array<{ id: string; name: string }>;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createSeries, initial);

  const hours = Array.from({ length: 17 }, (_, i) => i + 7);
  const field =
    "w-full rounded-xl border border-sky-brand-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-sky-brand-400 focus:outline-none";
  const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-navy-700/60";

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-sky-brand-200 bg-white p-4">
      <div>
        <span className={label}>Lapangan</span>
        <select name="court_id" required className={field}>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              🏸 {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="sname" className={label}>
          Nama Komunitas / Pelanggan
        </label>
        <input id="sname" name="customer_name" required placeholder="cth. Komunitas Sabtu" className={field} />
      </div>

      <div>
        <label htmlFor="sphone" className={label}>
          No. WA (opsional)
        </label>
        <input id="sphone" name="customer_phone" inputMode="tel" placeholder="08xx" className={field} />
      </div>

      <div>
        <label htmlFor="sdate" className={label}>
          Mulai tanggal (hari ini = pola mingguan)
        </label>
        <input id="sdate" type="date" name="start_date" defaultValue={today} required className={field} />
      </div>

      <div>
        <label htmlFor="senddate" className={label}>
          Berakhir tanggal (opsional — batasi durasi langganan)
        </label>
        <input id="senddate" type="date" name="end_date" min={today} className={field} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="sstart" className={label}>
            Jam main
          </label>
          <select id="sstart" name="start_hour" defaultValue={19} className={field}>
            {hours.slice(0, -1).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}.00
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="send" className={label}>
            Selesai
          </label>
          <select id="send" name="end_hour" defaultValue={21} className={field}>
            {hours.slice(1).map((h) => (
              <option key={h + 1} value={h}>
                {String(h).padStart(2, "0")}.00
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sweeks" className={label}>
            Minggu
          </label>
          <select id="sweeks" name="weeks" defaultValue={8} className={field}>
            {[4, 6, 8, 12].map((w) => (
              <option key={w} value={w}>
                {w}×
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error && (
        <p className="text-xs font-semibold text-red-500">⚠️ {state.error}</p>
      )}
      {state.ok && (
        <p className="text-xs font-semibold text-emerald-600">
          ✅ Langganan dibuat — {state.info}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent-500 py-2.5 text-sm font-black text-white transition hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Membuat…" : "🔁 Buat Langganan"}
      </button>
    </form>
  );
}
