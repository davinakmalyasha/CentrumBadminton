import Link from "next/link";

/**
 * Kantin's own sub-navigation: Kasir · Stok · Produk · Riwayat.
 *
 * `KANTIN_NAV` has been defined in AppNav since the POS was ported but was
 * never imported by anything, and `drawerSections()` only ever returned
 * PRIMARY_NAV + OWNER/SETTINGS. The result was that /app/kantin/produk and
 * /app/kantin/riwayat had zero inbound links anywhere in the app — pages
 * reachable only by typing the URL — and /app/kantin/stok surfaced solely
 * through the dashboard's low-stock banner, which a staff account could see
 * but not follow (that page is owner-only). The POS page itself linked to
 * none of them, and its empty state told the user to visit a "menu Kantin
 * Produk" that did not exist.
 *
 * Kept in one place so the four pages can't drift apart again.
 */
const ITEMS = [
  { href: "/app/kantin", label: "Kasir" },
  { href: "/app/kantin/stok", label: "Stok" },
  { href: "/app/kantin/produk", label: "Produk" },
  { href: "/app/kantin/riwayat", label: "Riwayat" },
] as const;

export default function KantinSubnav({ active }: { active: string }) {
  return (
    <nav className="flex gap-1" aria-label="Navigasi kantin">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active === i.href ? "page" : undefined}
          className={`manager-tap inline-flex min-h-[36px] flex-1 items-center justify-center rounded-xl px-3 text-[11px] font-bold whitespace-nowrap transition ${
            active === i.href
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
