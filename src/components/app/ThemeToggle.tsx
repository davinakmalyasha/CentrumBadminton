"use client";

import { Moon, Sun } from "lucide-react";
import { useManagerTheme } from "./ThemeProvider";

/** Toggle terang/gelap khusus area manager. Murni UI. */
export default function ThemeToggle() {
  const { resolved, toggle } = useManagerTheme();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Ubah ke mode terang" : "Ubah ke mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
      aria-pressed={isDark}
      className="manager-tap flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
      ) : (
        <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}
