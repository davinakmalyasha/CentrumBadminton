"use client";

import { VENUE } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import type { RatingData } from "@/lib/rating";

function Stars({ score, size = "text-3xl" }: { score: number; size?: string }) {
  return (
    <span className={`relative inline-block leading-none ${size}`}>
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

export default function SocialSection({ rating }: { rating: RatingData }) {
  const { t } = useLang();

  const reviewsUrl = `https://www.google.com/maps/search/?api=1&query=${VENUE.mapsQuery}`;
  const igUrl = `https://instagram.com/${VENUE.instagram}`;
  const fbUrl = `https://facebook.com/${encodeURIComponent(VENUE.facebook)}`;

  return (
    <section id="ulasan" className="scroll-mt-20 bg-navy-800 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <h2 className="text-2xl font-black tracking-tight text-white md:text-4xl">
          ⭐ {t.reviews.title}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-sky-brand-200/80 md:text-base">
          {t.reviews.subtitle}
        </p>

        <div className="mx-auto mt-10 max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="text-6xl font-black tracking-tight text-white">
            {rating.score.toFixed(1)}
          </p>
          <div className="mt-2">
            <Stars score={rating.score} />
          </div>
          <p className="mt-2 text-sm font-medium text-sky-brand-200/70">
            {rating.total} {t.hero.ratingLabel}
            {!rating.live && " · cached"}
          </p>

          <a
            href={reviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-navy-800 transition hover:bg-ice-200"
          >
            <span className="font-black text-[#4285F4]">G</span> {t.reviews.ctaGoogle}
          </a>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={igUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-sky-brand-100 transition hover:bg-white/10"
          >
            📷 @{VENUE.instagram}
          </a>
          <a
            href={fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-sky-brand-100 transition hover:bg-white/10"
          >
            👍 {t.reviews.followFb}
          </a>
        </div>
      </div>
    </section>
  );
}
