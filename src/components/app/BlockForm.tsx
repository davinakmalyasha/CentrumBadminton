"use client";

import { useActionState, useState } from "react";
import { Ban } from "lucide-react";
import { createBlock, type ActionState } from "@/app/app/(protected)/actions";
import Shuttlecock from "@/components/icons/Shuttlecock";

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
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
  const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <input type="hidden" name="court_id" value={courtId} />
      <div>
        <span className={label}>Lapangan</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCourtId("")}
            aria-pressed={courtId === ""}
            className={`manager-tap inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              courtId === ""
                ? "border-zinc-900 bg-zinc-100 text-zinc-800 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            }`}
          >
            <Ban className="h-3.5 w-3.5" />
            Semua
          </button>
          {courts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCourtId(c.id)}
              aria-pressed={courtId === c.id}
              className={`manager-tap inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                courtId === c.id
                  ? "border-zinc-900 bg-zinc-100 text-zinc-800 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              }`}
            >
              <Shuttlecock className="h-3.5 w-3.5" />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 sm:col-span-1">
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
        <p className="text-xs font-semibold text-red-500">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="manager-tap inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-black text-white transition hover:bg-red-600 disabled:opacity-50"
      >
        {pending ? (
          "Memproses…"
        ) : (
          <>
            <Ban className="h-4 w-4" />
            Blokir Jadwal
          </>
        )}
      </button>
    </form>
  );
}
