"use client";

import { useActionState, useEffect, useState } from "react";
import { buildClosingReport } from "@/app/app/(protected)/ai/actions";
import { todayISO } from "@/lib/availability";

type ClosingState = { text?: string; error?: string };

export default function ClosingReportCard() {
  const [state, formAction, pending] = useActionState<ClosingState, FormData>(
    async (_prev, formData) => {
      const date = String(formData.get("date") ?? "");
      return buildClosingReport(date);
    },
    {}
  );
  const [copied, setCopied] = useState(false);
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  // Mark daily nudge as done once a report exists
  useEffect(() => {
    if (!state.text) return;
    const key =
      "cba-closing-" +
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
    window.localStorage.setItem(key, "1");
  }, [state.text]);

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <h2 className="text-sm font-extrabold text-navy-900">
        📋 Laporan Tutup Buku
      </h2>
      <p className="mt-0.5 mb-3 text-[11px] font-medium text-navy-700/60">
        Ringkasan harian siap kirim ke WhatsApp owner/komunitas.
      </p>

      <form action={formAction} className="flex gap-2">
        <input
          type="date"
          name="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-sky-brand-200 bg-white px-3 py-2 text-sm text-navy-900 focus:border-sky-brand-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-navy-800 px-4 py-2 text-sm font-black text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {pending ? "Menyusun…" : "Generate"}
        </button>
      </form>

      {state.error && (
        <p className="mt-2 text-xs font-semibold text-red-500">⚠️ {state.error}</p>
      )}

      {state.text && (
        <>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-sky-brand-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-navy-900">
            {state.text}
          </pre>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.text ?? "");
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className={`mt-2 w-full rounded-xl py-2.5 text-sm font-black transition ${
              copied
                ? "bg-emerald-500 text-white"
                : "bg-accent-500 text-white hover:bg-accent-600"
            }`}
          >
            {copied ? "✅ Tersalin!" : "📋 Copy untuk WhatsApp"}
          </button>
        </>
      )}
    </section>
  );
}
