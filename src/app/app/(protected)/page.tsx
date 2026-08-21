const cards = [
  {
    title: "Booking Hari Ini",
    value: "—",
    desc: "Kalender & manajemen booking (Fase 3)",
  },
  {
    title: "Pendapatan Hari Ini",
    value: "—",
    desc: "Pencatatan pembayaran cash/QRIS (Fase 3)",
  },
  {
    title: "Okupansi",
    value: "—",
    desc: "Statistik okupansi lapangan (Fase 4)",
  },
  {
    title: "AI Assistant",
    value: "—",
    desc: "Ringkasan harian bertenaga Gemini (Fase 5)",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-lg font-bold text-neutral-900">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Autentikasi berfungsi. Sesi tersimpan permanen hingga kamu menekan
        &quot;Keluar&quot;.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-neutral-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-neutral-500">{c.title}</p>
            <p className="mt-2 text-3xl font-bold text-neutral-900">{c.value}</p>
            <p className="mt-2 text-xs text-neutral-400">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
