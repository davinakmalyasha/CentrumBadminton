import { VENUE, waLink } from "@/lib/constants";
import { getDict, type Lang } from "@/lib/i18n";
import LangToggle from "./LangToggle";

const links = [
  { href: "#jadwal", key: "book" },
  { href: "#harga", key: "pricing" },
  { href: "#fasilitas", key: "facilities" },
  { href: "#lokasi", key: "location" },
  { href: "#ulasan", key: "reviews" },
] as const;

export default function Navbar({ lang }: { lang: Lang }) {
  const t = getDict(lang);

  return (
    <header className="sticky top-0 z-40 border-b border-sky-brand-200/60 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/centrumLOGO-badge.avif" alt="Centrum Badminton Arena" width={256} height={256} className="h-9 w-9 rounded-full object-cover" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight text-navy-800">
              Centrum
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-sky-brand-500">
              Badminton Arena
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-navy-700 transition hover:bg-ice-100 hover:text-navy-800"
            >
              {t.nav[l.key]}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LangToggle lang={lang} />
          <a
            href={waLink(
              lang === "id"
                ? "Halo Centrum Badminton Arena! Saya mau tanya-tanya soal booking."
                : "Hi Centrum Badminton Arena! I'd like to ask about booking."
            )}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={lang === "id" ? "Chat WhatsApp" : "Chat on WhatsApp"}
            className="rounded-xl bg-accent-500 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-600 sm:px-4 sm:py-2"
          >
            <span className="sm:hidden">WA</span>
            <span className="hidden sm:inline">{VENUE.shortName} · WA</span>
          </a>
        </div>
      </div>
    </header>
  );
}
