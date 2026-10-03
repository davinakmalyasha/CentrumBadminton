"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { drawerSections, isActivePath } from "./AppNav";
import { useRole } from "./RoleContext";

/**
 * Desktop-only persistent left rail (lg+). Mobile keeps the bottom bar +
 * drawer, so this is hidden below lg and never mounts there.
 *
 * Nav data comes from AppNav.drawerSections() — the same source the mobile
 * drawer renders — so role gating and labels can never drift apart.
 */
export default function Sidebar({
  displayName,
  roleLabel,
  onLogout,
}: {
  displayName: string;
  roleLabel: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { role } = useRole();
  const isOwner = role === "owner";
  const sections = drawerSections(isOwner);

  return (
    <aside
      className="manager-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200 bg-white lg:flex dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="Navigasi utama"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800">
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-extrabold tracking-tight">
            Centrum Manager
          </p>
          <p className="truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {displayName} · {roleLabel}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="manager-scroll flex-1 overflow-y-auto px-3 py-3">
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
                      className={`manager-tap flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 transition ${
                        active
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          active
                            ? "bg-white/15 dark:bg-zinc-900/10"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        <item.icon
                          className="h-4 w-4"
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

      {/* Logout */}
      <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={onLogout}
          className="manager-tap flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar
        </button>
      </div>
    </aside>
  );
}
