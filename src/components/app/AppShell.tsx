"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bot,
  Home,
  Menu,
  Plus,
  X,
} from "lucide-react";
import LogoutDialog from "./LogoutDialog";
import Sidebar from "./Sidebar";
import Breadcrumbs from "./Breadcrumbs";
import { useRole } from "./RoleContext";
import ThemeToggle from "./ThemeToggle";
import PushToggle from "./PushToggle";
import { drawerSections, isActivePath } from "./AppNav";

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
  const { role } = useRole();
  const isOwner = role === "owner";
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const aiActive = isActivePath(pathname, "/app/ai");
  const sections = drawerSections(isOwner);

  return (
    <div className="min-h-svh bg-zinc-100 text-zinc-900 lg:pl-64 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Desktop rail — fixed, so it never participates in page flow */}
      <Sidebar
        displayName={displayName}
        roleLabel={roleLabel}
        onLogout={() => setLogoutOpen(true)}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5 lg:max-w-7xl lg:px-6 2xl:max-w-[1700px]">
          {/* Breadcrumbs own this slot on every viewport. The brand + account
              line that used to sit here on mobile duplicated the drawer header
              verbatim (displayName · roleLabel), so it is gone; on desktop
              this fills the empty half the justify-end buttons left behind. */}
          <Breadcrumbs className="min-w-0 flex-1" />

          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/app/ai"
              aria-label="Buka AI Asisten"
              title="AI Asisten"
              aria-current={aiActive ? "page" : undefined}
              className={`manager-tap flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 ${
                aiActive
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              <Bot className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <ThemeToggle />
            <PushToggle />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Buka menu navigasi"
              aria-expanded={menuOpen}
              aria-controls="manager-drawer"
              className="manager-tap flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 lg:hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-28 lg:max-w-7xl lg:px-6 lg:pb-12 2xl:max-w-[1700px]">
        {children}
      </main>

      {/* Bottom bar — mobile only; the desktop rail owns navigation. Menu
          button removed: the header hamburger already opens the same drawer. */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-2 items-end px-4">
          {(() => {
            const homeActive = pathname === "/app";
            const bookingActive = isActivePath(pathname, "/app/booking/baru");
            return (
              <>
                <Link
                  href="/app"
                  aria-current={homeActive ? "page" : undefined}
                  className={`manager-tap flex min-h-[60px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold transition ${
                    homeActive
                      ? "text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                  }`}
                >
                  <Home
                    className="h-5 w-5"
                    strokeWidth={homeActive ? 2.25 : 1.75}
                    aria-hidden="true"
                  />
                  Beranda
                </Link>
                <Link
                  href="/app/booking/baru"
                  aria-current={bookingActive ? "page" : undefined}
                  className="manager-tap flex flex-col items-center justify-center gap-1 py-2"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg transition active:scale-95 ${
                      bookingActive
                        ? "bg-zinc-900 text-white shadow-zinc-900/30 dark:bg-zinc-50 dark:text-zinc-900 dark:shadow-black/50"
                        : "bg-zinc-900 text-white shadow-zinc-900/25 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    }`}
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      bookingActive
                        ? "text-zinc-900 dark:text-zinc-50"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    Booking
                  </span>
                </Link>
              </>
            );
          })()}
        </div>
      </nav>

      {/* Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Tutup menu navigasi"
            onClick={() => setMenuOpen(false)}
            className="manager-backdrop fixed inset-0 cursor-default bg-zinc-950/50 backdrop-blur-[2px] dark:bg-black/60"
          />
          <aside
            id="manager-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Semua menu"
            className="manager-drawer fixed top-0 right-0 bottom-0 flex w-[86%] max-w-xs flex-col border-l border-zinc-200 bg-white pt-[env(safe-area-inset-top)] dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-extrabold">Semua Menu</p>
                  <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    {displayName} · {roleLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Tutup menu"
                autoFocus
                className="manager-tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav
              aria-label="Daftar menu"
              className="manager-scroll flex-1 overflow-y-auto px-3 py-3"
            >
              {sections.map((section) => (
                <div key={section.title} className="mb-4 last:mb-1">
                  <p className="px-2 pb-1.5 text-[10px] font-bold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
                    {section.title}
                  </p>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = isActivePath(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            onClick={closeMenu}
                            className={`manager-tap flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                              active
                                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                active
                                  ? "bg-white/15 dark:bg-zinc-900/10"
                                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              <item.icon
                                className="h-[18px] w-[18px]"
                                strokeWidth={1.9}
                                aria-hidden="true"
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-sm font-bold">
                                {item.label}
                                {item.badge && (
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-black tracking-wide uppercase ${
                                      active
                                        ? "bg-white/20 text-white dark:bg-zinc-900/10 dark:text-zinc-900"
                                        : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                    }`}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </span>
                              {item.desc && (
                                <span
                                  className={`block truncate text-[11px] font-medium ${
                                    active
                                      ? "text-white/70 dark:text-zinc-700"
                                      : "text-zinc-400 dark:text-zinc-500"
                                  }`}
                                >
                                  {item.desc}
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="border-t border-zinc-100 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setLogoutOpen(true);
                }}
                className="manager-tap flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Keluar
              </button>
            </div>
          </aside>
        </div>
      )}

      <LogoutDialog
        open={logoutOpen}
        displayName={displayName}
        roleLabel={roleLabel}
        onClose={() => setLogoutOpen(false)}
      />
    </div>
  );
}
