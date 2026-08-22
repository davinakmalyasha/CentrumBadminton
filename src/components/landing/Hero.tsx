"use client";

import { VENUE, waLink } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import type { RatingData } from "@/lib/rating";

function Stars({ score }: { score: number }) {
  return (
    <span className="relative inline-block text-base leading-none">
      <span className="text-navy-800/15">★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden whitespace-nowrap text-amber-400"
        style={{ width: `${(score / 5) * 100}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}

export default function Hero({
  rating,
  openNow,
}: {
  rating: RatingData;
  openNow: boolean;
}) {
  const { t, lang } = useLang();

  return (
    <section id="top" className="relative overflow-hidden bg-white">
      {/* soft sky backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-[420px] bg-gradient-to-b from-ice-200 via-ice-100 to-transparent"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 md:grid-cols-2 md:pb-24 md:pt-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 shadow-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                openNow ? "animate-pulse bg-emerald-500" : "bg-navy-800/30"
              }`}
            />
            {openNow ? t.hero.openNow : t.hero.closedNow}
          </div>

          <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-navy-900 md:text-6xl">
            {t.hero.titleA}{" "}
            <span className="bg-gradient-to-r from-sky-brand-400 to-sky-brand-600 bg-clip-text text-transparent">
              {t.hero.titleB}
            </span>
          </h1>

          <p className="mt-4 max-w-md text-base leading-relaxed text-navy-700/80 md:text-lg">
            {t.hero.subtitle}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#jadwal"
              className="rounded-xl bg-accent-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent-500/25 transition hover:bg-accent-600"
            >
              🏸 {t.hero.ctaBook}
            </a>
            <a
              href={waLink(
                lang === "id"
                  ? "Halo Centrum Badminton Arena! Saya mau tanya-tanya soal booking."
                  : "Hi Centrum Badminton Arena! I'd like to ask about booking."
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-sky-brand-300 bg-white px-6 py-3.5 text-sm font-bold text-navy-800 transition hover:bg-ice-100"
            >
              💬 {t.hero.ctaWa}
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <Stars score={rating.score} />
              <span className="text-sm font-bold text-navy-800">
                {rating.score.toFixed(1)}
              </span>
              <span className="text-sm text-navy-700/60">
                · {rating.total} {t.hero.ratingLabel}
              </span>
            </div>
            <span className="hidden h-4 w-px bg-sky-brand-200 sm:block" />
            <span className="text-sm font-medium text-navy-700/70">
              🏸 2 {t.hero.courtsLabel}
            </span>
          </div>
        </div>

        {/* Visual placeholder */}
        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-sky-brand-200 bg-gradient-to-br from-ice-100 via-white to-sky-brand-200 shadow-2xl shadow-navy-800/10">
            <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,#93cdff_1px,transparent_1px),linear-gradient(to_bottom,#93cdff_1px,transparent_1px)] [background-size:44px_44px]" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-accent-500 text-6xl shadow-inner">
                🏸
              </div>
              <p className="text-lg font-extrabold tracking-wide text-navy-800">
                {VENUE.name}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-widest text-sky-brand-500">
                Cirebon · Indoor · 2 Courts
              </p>
            </div>
            <div className="absolute bottom-4 left-4 rounded-2xl border border-sky-brand-200 bg-white/90 px-4 py-2.5 shadow-md backdrop-blur">
              <p className="text-[11px] font-medium text-navy-700/60">07–17</p>
              <p className="text-lg font-black leading-none text-navy-800">Rp40rb</p>
            </div>
            <div className="absolute bottom-4 right-4 rounded-2xl border border-accent-400/40 bg-accent-500/95 px-4 py-2.5 shadow-md">
              <p className="text-[11px] font-medium text-white/75">17–23</p>
              <p className="text-lg font-black leading-none text-white">Rp50rb</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
