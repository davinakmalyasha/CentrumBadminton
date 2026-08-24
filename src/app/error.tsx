"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import Shuttlecock from "@/components/icons/Shuttlecock";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Shuttlecock
        className="h-12 w-12 text-accent-500"
        strokeWidth={1.5}
      />
      <div>
        <h1 className="text-xl font-black text-navy-900">
          Waduh, ada yang error
        </h1>
        <p className="mt-1 max-w-sm text-sm text-navy-700/60">
          Terjadi kesalahan tak terduga. Coba muat ulang — kalau masih muncul,
          hubungi owner.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-xl bg-navy-800 px-4 py-2.5 text-xs font-black text-white transition hover:bg-navy-700"
        >
          <RotateCcw className="h-4 w-4" />
          Coba lagi
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-sky-brand-200 bg-white px-4 py-2.5 text-xs font-black text-sky-brand-600"
        >
          <Home className="h-4 w-4" />
          Halaman utama
        </Link>
      </div>
    </div>
  );
}
