"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, Check, ClipboardList } from "lucide-react";
import { buildClosingReport } from "@/app/app/(protected)/ai/actions";
import { todayISO } from "@/lib/availability";

type ClosingState = { text?: string; error?: string };

export default function ClosingReportCard() {
  const [state, formAction, pending] = useActionState<ClosingState, FormData>(
    async (_prev, formData) => {
      const date = String(formData.get("date") ?? "");
      return buildClosingReport(date);
    },
    {},
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
    <section
      aria-label="Laporan tutup buku"
      className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="flex items-center gap-2 text-[13px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        Laporan Tutup Buku
      </h2>
      <p className="mt-1 mb-2 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
        Ringkasan harian siap kirim ke WhatsApp owner/komunitas.
      </p>

      <form action={formAction} className="flex gap-2">
        <input
          type="date"
          name="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Tanggal laporan tutup buku"
          className="manager-tap min-h-[44px] w-[148px] shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2.5 text-sm text-zinc-900 focus:border-zinc-500 focus:bg-white focus:ring-2 focus:ring-zinc-200 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:bg-zinc-900 dark:focus:ring-zinc-800"
        />
        <button
          type="submit"
          disabled={pending}
          className="manager-tap inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "Menyusun…" : "Generate"}
        </button>
      </form>

      {state.error && (
        <p
          role="alert"
          className="mt-2.5 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      {state.text && (
        <>
          <pre className="manager-scroll mt-3 max-h-72 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
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
            className={`manager-tap mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-[0.99] ${
              copied
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Tersalin!
              </>
            ) : (
              <>
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Copy untuk WhatsApp
              </>
            )}
          </button>
        </>
      )}
    </section>
  );
}
