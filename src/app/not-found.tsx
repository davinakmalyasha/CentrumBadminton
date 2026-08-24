import Link from "next/link";
import { Home } from "lucide-react";
import Shuttlecock from "@/components/icons/Shuttlecock";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Shuttlecock
        className="h-12 w-12 text-accent-500"
        strokeWidth={1.5}
      />
      <div>
        <h1 className="text-xl font-black text-navy-900">404 — Tidak ditemukan</h1>
        <p className="mt-1 max-w-sm text-sm text-navy-700/60">
          Halaman yang kamu cari tidak ada atau sudah dipindahkan.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-navy-800 px-4 py-2.5 text-xs font-black text-white transition hover:bg-navy-700"
      >
        <Home className="h-4 w-4" />
        Halaman utama
      </Link>
    </div>
  );
}
