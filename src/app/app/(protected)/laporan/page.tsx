import Link from "next/link";
import { getRole } from "@/lib/guard";
import { BarChart3, ChevronRight, History, Receipt, ShoppingBasket } from "lucide-react";

export const metadata = { title: "Laporan · Centrum Manager" };

const BLOCKS = [
  {
    href: "/app/laporan/keuangan",
    icon: BarChart3,
    label: "Keuangan",
    desc: "Omzet, beban & laba",
    ownerOnly: false,
  },
  {
    href: "/app/laporan/riwayat",
    icon: History,
    label: "Riwayat Booking",
    desc: "Per booking: lapangan, jam, harga",
    ownerOnly: false,
  },
  {
    href: "/app/laporan/kantin",
    icon: ShoppingBasket,
    label: "Kantin",
    desc: "Omzet, modal & laba",
    ownerOnly: false,
  },
  {
    href: "/app/pengeluaran",
    icon: Receipt,
    label: "Pengeluaran",
    desc: "Biaya operasional",
    ownerOnly: true,
  },
];

export default async function LaporanHubPage() {
  const isOwner = (await getRole()) === "owner";
  const blocks = BLOCKS.filter((b) => !b.ownerOnly || isOwner);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {blocks.map((b) => (
        <Link
          key={b.href}
          href={b.href}
          className="manager-tap group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <b.icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {b.label}
            </span>
            <span className="block truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {b.desc}
            </span>
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-300"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );
}
