"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import {
  getPushState,
  subscribePush,
  unsubscribePush,
  type PushState,
} from "@/lib/push";

/**
 * Bell toggle for PWA push reminders. Lives in the app header next to
 * ThemeToggle (all staff roles see it; subscriptions are per-device).
 *
 * States: unsupported/unconfigured → hidden entirely (no dead UI);
 * denied → disabled with explanation; off → subscribe on click;
 * on → active, click unsubscribes. Failures surface as title text —
 * the button never silently no-ops.
 */
export default function PushToggle() {
  const [state, setState] = useState<PushState | "checking">("checking");
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    getPushState().then((s) => {
      if (live) setState(s);
    });
    return () => {
      live = false;
    };
  }, []);

  if (state === "unsupported" || state === "unconfigured" || state === "checking") {
    return null;
  }

  const busy = state === "working";
  const on = state === "on";

  async function toggle() {
    if (busy) return;
    setState("working");
    setNote("");
    if (on) {
      const r = await unsubscribePush();
      if (!r.ok) setNote(r.message);
      setState(await getPushState());
      return;
    }
    const r = await subscribePush();
    if (!r.ok) setNote(r.message);
    setState(await getPushState());
  }

  const Icon = busy ? Loader2 : on ? BellRing : state === "denied" ? BellOff : Bell;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || state === "denied"}
      aria-label={on ? "Matikan notifikasi" : "Aktifkan notifikasi"}
      title={note || (on ? "Notifikasi aktif di perangkat ini" : state === "denied" ? "Izin notifikasi diblokir di browser" : "Aktifkan notifikasi")}
      className={`manager-tap flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 disabled:opacity-60 ${
        on
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      }`}
    >
      <Icon className={`h-[18px] w-[18px]${busy ? " animate-spin" : ""}`} aria-hidden="true" />
    </button>
  );
}
