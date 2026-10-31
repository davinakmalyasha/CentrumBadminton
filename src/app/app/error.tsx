"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw, ServerCrash } from "lucide-react";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // The App Router already reports the error server-side. Log locally
    // for client-side diagnosis without rendering the raw message.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <ServerCrash className="h-12 w-12 text-rose-500" strokeWidth={1.5} />
      <div>
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50">
          Aplikasi sedang tidak bisa memuat data
        </h1>
        <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Server manajemen tidak merespons. Data yang sudah tampil tetap aman —
          coba lagi sebentar lagi.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-black text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <RotateCcw className="h-4 w-4" />
          Coba lagi
        </button>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-black text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <Home className="h-4 w-4" />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
