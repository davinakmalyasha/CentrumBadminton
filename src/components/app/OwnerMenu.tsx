"use client";

import Link from "next/link";
import {
  Ban,
  BarChart3,
  Bot,
  FolderKanban,
  Receipt,
  Repeat,
  Settings,
} from "lucide-react";
import { useRole } from "./RoleContext";

const OWNER_LINKS = [
  { href: "/app/laporan", label: "Laporan", icon: BarChart3, desc: "Omzet & rekap" },
  { href: "/app/pengeluaran", label: "Pengeluaran", icon: Receipt, desc: "Biaya operasional" },
  { href: "/app/series", label: "Langganan", icon: Repeat, desc: "Jadwal rutin" },
  { href: "/app/blokir", label: "Blokir", icon: Ban, desc: "Tutup slot" },
  { href: "/app/pengaturan", label: "Pengaturan", icon: Settings, desc: "Harga & staff" },
] as const;

const AI_LINK = { href: "/app/ai", label: "AI Asisten", icon: Bot } as const;

export default function OwnerMenu() {
  const { role } = useRole();
  const isOwner = role === "owner";

  return (
    <section className="space-y-3" aria-label="Menu cepat">
      {/* AI always visible — role determines tools inside */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-1 text-[11px] font-bold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
          Asisten {isOwner ? "Owner" : "Pegawai"}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Tanya data usaha pakai bahasa sehari-hari
          </p>
          <Link
            href={AI_LINK.href}
            className="manager-tap inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <AI_LINK.icon className="h-4 w-4" aria-hidden="true" />
            {AI_LINK.label} {isOwner ? "" : "(jadwal/stok)"}
          </Link>
        </div>
      </div>

      {isOwner && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
            <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
            Menu Owner
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {OWNER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                title={l.desc}
                className="manager-tap inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
              >
                <l.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
