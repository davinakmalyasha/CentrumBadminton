import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-5xl">🏸</span>
      <div>
        <h1 className="text-xl font-black text-navy-900">404 — Tidak ditemukan</h1>
        <p className="mt-1 max-w-sm text-sm text-navy-700/60">
          Halaman yang kamu cari tidak ada atau sudah dipindahkan.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-xl bg-navy-800 px-4 py-2.5 text-xs font-black text-white transition hover:bg-navy-700"
      >
        🏠 Halaman utama
      </Link>
    </div>
  );
}
