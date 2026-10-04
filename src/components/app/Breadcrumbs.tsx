"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  KANTIN_NAV,
  OWNER_NAV,
  PRIMARY_NAV,
  SETTINGS_NAV,
  type NavItem,
} from "./AppNav";

const ALL: NavItem[] = [...PRIMARY_NAV, ...OWNER_NAV, ...KANTIN_NAV, ...SETTINGS_NAV];

/**
 * Where am I, in one line: Beranda › Tambah Booking.
 *
 * Derived from the pathname through the same NAV arrays as the drawer, so it
 * can never disagree with the menu about what a page is called. Query params
 * (?date=, ?month=) are ignored — matching is pathname-only, which is why
 * the date steppers keep working underneath it.
 *
 * Renders nothing on /app itself (Beranda needs no trail) and on paths no
 * menu item owns, so an unknown route never shows a wrong crumb.
 */
export default function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  if (pathname === "/app") return null;

  const match = ALL.filter(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return null;

  // /app/kantin/stok → Beranda / Kantin / Stok: the parent is the longest
  // NAV href that is a strict prefix of the match. /app itself is excluded —
  // the trail already starts at Beranda, or every deep page would name it twice.
  const parent =
    match.href.split("/").length > 3
      ? ALL.filter(
          (i) =>
            i.href !== "/app" &&
            i.href !== match.href &&
            match.href.startsWith(`${i.href}/`)
        ).sort((a, b) => b.href.length - a.href.length)[0]
      : undefined;

  return (
    <nav aria-label="Breadcrumb" className={className ?? "min-w-0"}>
      <ol className="flex min-w-0 items-center gap-1 text-xs">
        <li className="shrink-0">
          <Link
            href="/app"
            className="font-medium text-zinc-500 transition hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Beranda
          </Link>
        </li>
        {parent && (
          <>
            <li aria-hidden="true" className="shrink-0 text-zinc-300 dark:text-zinc-600">
              <ChevronRight className="h-3 w-3" />
            </li>
            <li className="shrink-0">
              <Link
                href={parent.href}
                className="font-medium text-zinc-500 transition hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {parent.label}
              </Link>
            </li>
          </>
        )}
        <li aria-hidden="true" className="shrink-0 text-zinc-300 dark:text-zinc-600">
          <ChevronRight className="h-3 w-3" />
        </li>
        <li
          aria-current="page"
          className="truncate font-bold text-zinc-800 dark:text-zinc-100"
        >
          {match.label}
        </li>
      </ol>
    </nav>
  );
}
