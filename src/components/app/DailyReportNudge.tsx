"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

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
    <div className="flex items-center gap-3 rounded-2xl border border-accent-400/50 bg-accent-500/10 p-3.5">
      <span className="text-xl">📋</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-navy-900">Sudah tutup buku hari ini?</p>
        <p className="text-[11px] font-medium text-navy-700/60">
          Buat laporan harian &amp; kirim ke WhatsApp.
        </p>
      </div>
      <Link
        href="/app/ai"
        className="flex-shrink-0 rounded-xl bg-accent-500 px-3 py-2 text-xs font-black text-white transition hover:bg-accent-600"
      >
        Buat
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup"
        className="flex-shrink-0 px-1 text-navy-700/40 transition hover:text-navy-800"
      >
        ✕
      </button>
    </div>
  );
}
