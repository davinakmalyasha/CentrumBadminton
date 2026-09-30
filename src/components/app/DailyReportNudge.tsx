"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ClipboardList, X } from "lucide-react";

const KEY_PREFIX = "cba-closing-";

function subscribe(cb: () => void) {
  const id = setInterval(cb, 60_000); // re-check every minute
  window.addEventListener("storage", cb);
  return () => {
    clearInterval(id);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): boolean {
  const now = new Date();
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [h, m] = hm.split(":").map(Number);
  const key =
    KEY_PREFIX +
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
  return h * 60 + m >= 20 * 60 && !window.localStorage.getItem(key);
}

function getServerSnapshot(): boolean {
  return false;
}

/** After 20:00 WIB, remind owner to generate the daily closing report. */
export default function DailyReportNudge() {
  const show = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function dismiss() {
    const key =
      KEY_PREFIX +
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
    window.localStorage.setItem(key, "1");
    window.dispatchEvent(new Event("storage"));
  }

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-300 bg-white p-3.5 dark:border-zinc-700 dark:bg-zinc-900">
      <ClipboardList className="h-6 w-6 flex-shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-50">Sudah tutup buku hari ini?</p>
        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          Buat laporan harian &amp; kirim ke WhatsApp.
        </p>
      </div>
      <Link
        href="/app/laporan"
        className="manager-tap flex-shrink-0 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Buat
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup pengingat"
        className="manager-tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
