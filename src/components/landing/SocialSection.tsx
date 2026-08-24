import { Camera, Star, ThumbsUp } from "lucide-react";
import { VENUE } from "@/lib/constants";
import type { Dict } from "@/lib/i18n";
import type { RatingData } from "@/lib/rating";

function Stars({ score, size = "h-8 w-8" }: { score: number; size?: string }) {
  return (
    <span className="relative inline-block leading-none">
      <span className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`${size} text-navy-800/15`} />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-1 overflow-hidden whitespace-nowrap"
        style={{ width: `${(score / 5) * 100}%` }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`${size} flex-shrink-0 fill-amber-400 text-amber-400`}
          />
        ))}
      </span>
    </span>
  );
}

export default function SocialSection({
  rating,
  t,
}: {
  rating: RatingData;
  t: Dict;
}) {

  const reviewsUrl = `https://www.google.com/maps/search/?api=1&query=${VENUE.mapsQuery}`;
  const igUrl = `https://instagram.com/${VENUE.instagram}`;
  const fbUrl = `https://facebook.com/${encodeURIComponent(VENUE.facebook)}`;

  return (
    <section id="ulasan" className="relative scroll-mt-20 overflow-hidden bg-navy-800 py-16 md:py-24">
      <Star
        aria-hidden
        className="pointer-events-none absolute -left-12 top-1/2 h-40 w-40 -translate-y-1/2 fill-current text-white opacity-[0.04] md:h-64 md:w-64"
      />
      <div className="mx-auto max-w-6xl px-4 text-center">
        <h2 className="flex items-center justify-center gap-3 text-2xl font-black tracking-tight text-white md:text-4xl">
          <Star
            className="h-5 w-5 fill-amber-400 text-amber-400 md:h-6 md:w-6"
          />
          {t.reviews.title}
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
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-sky-brand-100 transition hover:bg-white/10"
          >
              <Camera className="h-4 w-4" />
              @{VENUE.instagram}
          </a>
          <a
            href={fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-sky-brand-100 transition hover:bg-white/10"
          >
              <ThumbsUp className="h-4 w-4" />
            {t.reviews.followFb}
          </a>
        </div>
      </div>
    </section>
  );
}
