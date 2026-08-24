import { Lock } from "lucide-react";
import { VENUE } from "@/lib/constants";
import type { Dict } from "@/lib/i18n";

export default function Footer({ t }: { t: Dict }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-sky-brand-200/60 bg-white py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 md:flex-row md:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-sm font-black text-white">
            CB
          </span>
          <div>
            <p className="text-sm font-extrabold text-navy-800">{VENUE.name}</p>
            <p className="text-xs text-navy-700/60">{t.footer.tagline}</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-navy-700/70">
          <a href="#jadwal" className="hover:text-navy-800">{t.nav.book}</a>
          <a href="#harga" className="hover:text-navy-800">{t.nav.pricing}</a>
          <a href="#fasilitas" className="hover:text-navy-800">{t.nav.facilities}</a>
          <a href="#lokasi" className="hover:text-navy-800">{t.nav.location}</a>
          <a href="/app" className="inline-flex items-center gap-1.5 rounded-md border border-sky-brand-200 px-2 py-1 hover:bg-ice-100">
            <Lock className="h-3.5 w-3.5" />
            {t.footer.manageApp}
          </a>
        </nav>

        <p className="text-[11px] text-navy-700/50">
          © {year} {VENUE.name}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
