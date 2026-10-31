"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import SeriesForm from "./SeriesForm";

export default function SeriesCreate({
  courts,
  today,
}: {
  courts: Array<{ id: string; name: string }>;
  today: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Komunitas rutin — slot dibuat otomatis setiap minggu.
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="member-form"
          className={`manager-tap inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 ${
            open
              ? "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          }`}
        >
          {open ? (
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {open ? "Batal" : "Member baru"}
        </button>
      </div>

      <div id="member-form">
        {open && <SeriesForm courts={courts} today={today} />}
      </div>
    </div>
  );
}