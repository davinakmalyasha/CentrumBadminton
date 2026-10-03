"use client";

import Link from "next/link";
import { PRIMARY_NAV } from "./AppNav";
import { useRole } from "./RoleContext";

// Nav data is owned by AppNav so this card can never drift apart from the
// sidebar and the drawer.
const AI_LINK = PRIMARY_NAV.find((i) => i.href === "/app/ai")!;

/**
 * Pitch card for the AI assistant.
 *
 * Used to be `OwnerMenu`, which also carried the owner shortcut grid. That
 * grid duplicated the drawer's "Menu Owner" section verbatim — the same
 * `OWNER_NAV`/`SETTINGS_NAV` arrays — so it is gone and the owner links live
 * in the drawer (listed first for owners, so a phone reaches them without
 * scrolling).
 */
export default function AiNudge() {
  const { role } = useRole();
  const isOwner = role === "owner";

  return (
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
  );
}
