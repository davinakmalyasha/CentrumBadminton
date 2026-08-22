"use client";

import { FACILITIES } from "@/lib/constants";
import { useLang } from "@/lib/i18n";

const ICONS: Record<string, string> = {
  court: "🏸",
  score: "🪧",
  light: "💡",
  indoor: "🏟️",
  lounge: "☕",
  mosque: "🕌",
  toilet: "🚿",
  parkir: "🅿️",
};

export default function FacilitiesSection() {
  const { lang, t } = useLang();

  return (
    <section id="fasilitas" className="scroll-mt-20 bg-ice-100 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-black tracking-tight text-navy-900 md:text-4xl">
            ✨ {t.facilities.title}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-navy-700/70 md:text-base">
            {t.facilities.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {FACILITIES.map((f) => (
            <div
              key={f.icon}
              className="flex flex-col items-center gap-2 rounded-2xl border border-sky-brand-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-sky-brand-300 hover:shadow-md"
            >
              <span className="text-2xl">{ICONS[f.icon] ?? "✅"}</span>
              <span className="text-xs font-bold leading-snug text-navy-800 md:text-sm">
                {lang === "id" ? f.id : f.en}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
