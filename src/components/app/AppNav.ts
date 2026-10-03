import {
  Ban,
  Banknote,
  BarChart3,
  Bot,
  CalendarDays,
  History,
  Home,
  Package,
  ClipboardList,
  Plus,
  Receipt,
  Repeat,
  Settings,
  ShoppingBasket,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Single source of truth for manager navigation. URL & label sama, hanya tampilan. */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  desc?: string;
  badge?: string;
  ownerOnly?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/app", label: "Beranda", icon: Home, desc: "Ringkasan hari ini" },
  { href: "/app/jadwal", label: "Jadwal", icon: CalendarDays, desc: "Timeline lapangan" },
  { href: "/app/booking/baru", label: "Booking Baru", icon: Plus, desc: "Buat booking manual" },
  { href: "/app/pembayaran", label: "Bayar", icon: Banknote, desc: "Catat pembayaran" },
  { href: "/app/kantin", label: "Kantin", icon: ShoppingBasket, desc: "Kasir & stok" },
  { href: "/app/pelanggan", label: "Pelanggan", icon: Users, desc: "Data pelanggan" },
  {
    href: "/app/ai",
    label: "AI Asisten",
    icon: Bot,
    desc: "Tanya data usaha",
    badge: "Pintar",
  },
];

export const OWNER_NAV: NavItem[] = [
  { href: "/app/laporan", label: "Laporan", icon: BarChart3, desc: "Omzet & rekap" },
  { href: "/app/pengeluaran", label: "Pengeluaran", icon: Receipt, desc: "Biaya operasional" },
  { href: "/app/series", label: "Langganan", icon: Repeat, desc: "Jadwal rutin" },
  { href: "/app/blokir", label: "Blokir", icon: Ban, desc: "Tutup slot lapangan" },
];

export const KANTIN_NAV: NavItem[] = [
  { href: "/app/kantin", label: "Kasir", icon: ShoppingBasket },
  { href: "/app/kantin/stok", label: "Stok", icon: Package },
  { href: "/app/kantin/produk", label: "Produk", icon: ClipboardList },
  { href: "/app/kantin/riwayat", label: "Riwayat", icon: History },
];

export const SETTINGS_NAV: NavItem[] = [
  { href: "/app/pengaturan", label: "Pengaturan", icon: Settings, desc: "Lapangan, harga, staff" },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  // Kantin parent stays active for its sub-pages.
  if (href === "/app/kantin")
    return pathname === "/app/kantin" || pathname.startsWith("/app/kantin/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Drawer + desktop rail sections.
 *
 * For owners the owner tools come FIRST. On a phone the drawer is the only
 * route to Laporan / Pengeluaran / Langganan / Blokir / Pengaturan — the
 * bottom bar is just Beranda and Booking — and listing seven primary rows
 * above them meant scrolling past all of it to reach any of them.
 */
export function drawerSections(isOwner: boolean): NavSection[] {
  if (isOwner) {
    return [
      { title: "Menu Owner", items: [...OWNER_NAV, ...SETTINGS_NAV] },
      { title: "Menu Utama", items: PRIMARY_NAV },
    ];
  }
  return [
    { title: "Menu Utama", items: PRIMARY_NAV },
    { title: "Lainnya", items: SETTINGS_NAV },
  ];
}
