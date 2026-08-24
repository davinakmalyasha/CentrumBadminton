import type { ComponentType } from "react";
import {
  Car,
  Check,
  Coffee,
  Droplets,
  Lightbulb,
  MoonStar,
  Sparkles,
  Trophy,
  Warehouse,
} from "lucide-react";
import { FACILITIES } from "@/lib/constants";
import type { Dict, Lang } from "@/lib/i18n";
import Shuttlecock from "@/components/icons/Shuttlecock";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  court: Shuttlecock,
  score: Trophy,
  light: Lightbulb,
  indoor: Warehouse,
  lounge: Coffee,
  mosque: MoonStar,
  toilet: Droplets,
  parkir: Car,
};

export default function FacilitiesSection({
  t,
  lang,
}: {
  t: Dict;
  lang: Lang;
}) {

  return (
    <section id="fasilitas" className="scroll-mt-20 bg-ice-100 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <h2 className="flex items-center justify-center gap-3 text-2xl font-black tracking-tight text-navy-900 md:text-4xl">
            <Sparkles
              className="h-5 w-5 text-sky-brand-500 md:h-6 md:w-6"
              strokeWidth={1.75}
            />
            {t.facilities.title}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-navy-700/70 md:text-base">
            {t.facilities.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {FACILITIES.map((f) => {
            const Icon = ICONS[f.icon] ?? Check;
            return (
              <div
                key={f.icon}
                className="flex flex-col items-center gap-2 rounded-2xl border border-sky-brand-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-sky-brand-300 hover:shadow-md"
              >
                <Icon className="h-6 w-6 text-sky-brand-600" />
                <span className="text-xs font-bold leading-snug text-navy-800 md:text-sm">
                  {lang === "id" ? f.id : f.en}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
