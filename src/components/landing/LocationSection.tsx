"use client";

import { mapsDirectionsUrl, mapsEmbedUrl } from "@/lib/constants";
import { useLang } from "@/lib/i18n";

export default function LocationSection() {
  const { t, lang } = useLang();

  return (
    <section id="lokasi" className="scroll-mt-20 bg-white py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-black tracking-tight text-navy-900 md:text-4xl">
            📍 {t.location.title}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-navy-700/70 md:text-base">
            {t.location.subtitle}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          {/* Info card */}
          <div className="flex flex-col justify-between rounded-3xl border border-sky-brand-200 bg-ice-100 p-6 md:col-span-2">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-brand-500">
                  {t.location.addressLabel}
                </p>
                <p className="mt-2 text-sm leading-relaxed font-medium text-navy-800">
                  🏢{" "}
                  {lang === "id"
                    ? "Jl. Pangeran Cakra Buana, Griya Cempaka Arum – Talun, Cirebon 45171 (belakang Indomaret Cempaka Arum)"
                    : "Jl. Pangeran Cakra Buana, Griya Cempaka Arum – Talun, Cirebon 45171 (behind Indomaret Cempaka Arum)"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-brand-500">
                  {t.location.hoursLabel}
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  {t.location.hoursValue}
                </p>
              </div>
            </div>

            <a
              href={mapsDirectionsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-accent-500/25 transition hover:bg-accent-600"
            >
              🗺️ {t.location.ctaMaps}
            </a>
          </div>

          {/* Map embed */}
          <div className="overflow-hidden rounded-3xl border border-sky-brand-200 shadow-md md:col-span-3">
            <iframe
              src={mapsEmbedUrl()}
              title="Centrum Badminton Arena — Google Maps"
              width="100%"
              height="100%"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[320px] w-full border-0 md:h-full md:min-h-[380px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
