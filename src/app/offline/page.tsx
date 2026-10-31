import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Offline · Centrum Manager",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-ice-100 px-6 text-center">
      <WifiOff className="h-12 w-12 text-sky-brand-600" strokeWidth={1.5} />
      <h1 className="mt-4 text-xl font-black text-navy-900">Kamu sedang offline</h1>
      <p className="mt-2 max-w-sm text-sm text-navy-700/70">
        Koneksi internet terputus. Halaman manajemen membutuhkan koneksi agar
        data booking dan pembayaran selalu akurat — sambungkan internet lalu
        muat ulang halaman.
      </p>
      <p className="mt-6 text-xs font-semibold text-sky-brand-600">
        Data tidak disimpan di perangkat ini.
      </p>
    </main>
  );
}
