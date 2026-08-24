"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Banknote,
  CalendarDays,
  Home,
  Plus,
  ShoppingBasket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/app/(protected)/actions";
import NotificationWatcher from "./NotificationWatcher";
import PushBell from "./PushBell";

const tabs: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  accent?: boolean;
}> = [
  { href: "/app", label: "Beranda", icon: Home },
  { href: "/app/jadwal", label: "Jadwal", icon: CalendarDays },
  { href: "/app/booking/baru", label: "Booking", icon: Plus, accent: true },
  { href: "/app/pembayaran", label: "Bayar", icon: Banknote },
  { href: "/app/kantin", label: "Kantin", icon: ShoppingBasket },
  { href: "/app/pelanggan", label: "Pelanggan", icon: Users },
];

export default function AppShell({
  displayName,
  roleLabel,
  children,
}: {
  displayName: string;
  roleLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-svh bg-ice-100">
      <header className="sticky top-0 z-20 border-b border-sky-brand-200/70 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-xs font-black text-white">
              CB
            </span>
            <div className="leading-tight">
              <p className="text-[13px] font-extrabold text-navy-800">
                Centrum Manager
              </p>
              <p className="text-[11px] text-navy-700/60">
                {displayName} · {roleLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <PushBell />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-sky-brand-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 transition hover:bg-ice-100"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">{children}</main>

      <NotificationWatcher />

      {/* Bottom tab bar — mobile app feel */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sky-brand-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2">
          {tabs.map((tab) => {
            const active =
              tab.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex min-w-[48px] flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[9px] font-semibold transition sm:text-[10px] ${
                  tab.accent ? "" : active ? "text-accent-600" : "text-navy-700/50"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    tab.accent
                      ? "-mt-3 bg-accent-500 text-white shadow-lg shadow-accent-500/40"
                      : ""
                  }`}
                >
                  <tab.icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
