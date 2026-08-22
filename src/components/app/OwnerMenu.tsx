"use client";

import Link from "next/link";
import { useRole } from "./RoleContext";

const OWNER_LINKS = [
  { href: "/app/laporan", label: "Laporan", icon: "📊" },
  { href: "/app/pengeluaran", label: "Pengeluaran", icon: "🧾" },
  { href: "/app/series", label: "Langganan", icon: "🔁" },
  { href: "/app/blokir", label: "Blokir", icon: "⛔" },
  { href: "/app/pengaturan", label: "Pengaturan", icon: "⚙️" },
] as const;

export default function OwnerMenu() {
  const { role } = useRole();
  if (role !== "owner") return null;

  return (
    <section className="rounded-2xl border border-accent-400/40 bg-white p-3.5">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-accent-600">
        💎 Menu Owner
      </p>
      <div className="flex flex-wrap gap-2">
        {OWNER_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-sky-brand-200 bg-ice-100 px-3 py-2 text-xs font-bold text-navy-800 transition hover:border-accent-400 hover:bg-accent-500/10"
          >
            {l.icon} {l.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
