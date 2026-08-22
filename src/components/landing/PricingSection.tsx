"use client";

import { useLang } from "@/lib/i18n";

export default function PricingSection() {
  const { t } = useLang();

  return (
    <section id="harga" className="scroll-mt-20 bg-white py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-black tracking-tight text-navy-900 md:text-4xl">
            💰 {t.pricing.title}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-navy-700/70 md:text-base">
            {t.pricing.subtitle}
          </p>
        </div>

        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          {/* Day rate */}
          <div className="rounded-3xl border border-sky-brand-200 bg-ice-100 p-7">
            <span className="text-3xl">☀️</span>
            <p className="mt-3 text-sm font-bold uppercase tracking-wide text-sky-brand-600">
              {t.pricing.dayRate}
            </p>
            <p className="mt-1 text-xs font-medium text-navy-700/60">{t.pricing.dayTime}</p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tight text-navy-900">
                Rp40rb
              </span>
              <span className="text-sm font-semibold text-navy-700/60">
                {t.pricing.perHour}
              </span>
            </p>
          </div>

          {/* Evening rate */}
          <div className="relative overflow-hidden rounded-3xl border border-accent-400/50 bg-navy-800 p-7 shadow-xl shadow-navy-800/15">
            <span className="absolute right-4 top-4 rounded-full bg-accent-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              Peak
            </span>
            <span className="text-3xl">🌙</span>
            <p className="mt-3 text-sm font-bold uppercase tracking-wide text-accent-400">
              {t.pricing.eveningRate}
            </p>
            <p className="mt-1 text-xs font-medium text-sky-brand-200/70">
              {t.pricing.eveningTime}
            </p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tight text-white">Rp50rb</span>
              <span className="text-sm font-semibold text-sky-brand-200/70">
                {t.pricing.perHour}
              </span>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-navy-700/60">
          💵 {t.pricing.paymentNote}
        </p>
      </div>
    </section>
  );
}
