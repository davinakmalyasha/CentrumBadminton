import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline · Centrum Manager" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-ice-100 px-6 text-center">
      <WifiOff className="h-12 w-12 text-sky-brand-600" strokeWidth={1.5} />
      <h1 className="mt-4 text-xl font-black text-navy-900">Kamu sedang offline</h1>
      <p className="mt-2 max-w-sm text-sm text-navy-700/70">
        Koneksi internet terputus. Data terakhir yang pernah dibuka masih bisa
        dilihat — cek jadwal &amp; booking yang tersimpan di cache.
      </p>
      <p className="mt-6 text-xs font-semibold text-sky-brand-600">
        Sambungkan internet lalu muat ulang halaman.
      </p>
    </main>
  );
}
