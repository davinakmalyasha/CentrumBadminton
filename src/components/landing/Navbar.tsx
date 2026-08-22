"use client";

import { VENUE, waLink } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import LangToggle from "./LangToggle";

const links = [
  { href: "#jadwal", key: "book" },
  { href: "#harga", key: "pricing" },
  { href: "#fasilitas", key: "facilities" },
  { href: "#lokasi", key: "location" },
  { href: "#ulasan", key: "reviews" },
] as const;

export default function Navbar() {
  const { t, lang } = useLang();

  return (
    <header className="sticky top-0 z-40 border-b border-sky-brand-200/60 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-sm font-black text-white shadow-sm">
            CB
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

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 transition hover:bg-ice-100 hover:text-navy-800"
            >
              {t.nav[l.key]}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LangToggle />
          <a
            href={waLink(
              lang === "id"
                ? "Halo Centrum Badminton Arena! Saya mau tanya-tanya soal booking."
                : "Hi Centrum Badminton Arena! I'd like to ask about booking."
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-xl bg-accent-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-accent-600 sm:block"
          >
            {VENUE.shortName} · WA
          </a>
        </div>
      </div>
    </header>
  );
}
