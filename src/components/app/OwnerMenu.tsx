"use client";

import Link from "next/link";
import {
  Ban,
  BarChart3,
  Bot,
  Gem,
  Receipt,
  Repeat,
  Settings,
} from "lucide-react";
import { useRole } from "./RoleContext";

const OWNER_LINKS = [
  { href: "/app/ai", label: "AI Asisten", icon: Bot },
  { href: "/app/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/app/pengeluaran", label: "Pengeluaran", icon: Receipt },
  { href: "/app/series", label: "Langganan", icon: Repeat },
  { href: "/app/blokir", label: "Blokir", icon: Ban },
  { href: "/app/pengaturan", label: "Pengaturan", icon: Settings },
] as const;

export default function OwnerMenu() {
  const { role } = useRole();
  if (role !== "owner") return null;

  return (
    <section className="rounded-2xl border border-accent-400/40 bg-white p-3.5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent-600">
        <Gem className="h-3.5 w-3.5" />
        Menu Owner
      </p>
      <div className="flex flex-wrap gap-2">
        {OWNER_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-brand-200 bg-ice-100 px-3 py-2 text-xs font-bold text-navy-800 transition hover:border-accent-400 hover:bg-accent-500/10"
          >
            <l.icon className="h-3.5 w-3.5" />
            {l.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
