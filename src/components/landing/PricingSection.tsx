import { Banknote, Moon, Sun, Wallet } from "lucide-react";
import { formatIDR } from "@/lib/availability";
import type { Dict } from "@/lib/i18n";
import type { PricingInfo } from "@/lib/availability";

export default function PricingSection({
  t,
  pricing,
}: {
  t: Dict;
  pricing: PricingInfo;
}) {
  const hours = (h: number) => `${String(h).padStart(2, "0")}.00`;
  return (
    <section id="harga" className="scroll-mt-20 bg-white py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <h2 className="flex items-center justify-center gap-3 text-2xl font-black tracking-tight text-navy-900 md:text-4xl">
            <Wallet
              className="h-5 w-5 text-sky-brand-500 md:h-6 md:w-6"
              strokeWidth={1.75}
            />
            {t.pricing.title}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-navy-700/70 md:text-base">
            {t.pricing.subtitle}
          </p>
        </div>

        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          {/* Day rate */}
          <div className="rounded-3xl border border-sky-brand-200 bg-ice-100 p-7">
            <Sun className="h-8 w-8 text-amber-500" strokeWidth={1.75} />
            <p className="mt-3 text-sm font-bold uppercase tracking-wide text-sky-brand-600">
              {t.pricing.dayRate}
            </p>
            <p className="mt-1 text-xs font-medium text-navy-700/60">
              {hours(pricing.openHour)} – {hours(pricing.dayEndHour)} WIB
            </p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tight text-navy-900">
                {formatIDR(pricing.priceDay)}
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
            <Moon className="h-8 w-8 text-accent-400" strokeWidth={1.75} />
            <p className="mt-3 text-sm font-bold uppercase tracking-wide text-accent-400">
              {t.pricing.eveningRate}
            </p>
            <p className="mt-1 text-xs font-medium text-sky-brand-200/70">
              {hours(pricing.dayEndHour)} – {hours(pricing.closeHour)} WIB
            </p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tight text-white">
                {formatIDR(pricing.priceEvening)}
              </span>
              <span className="text-sm font-semibold text-sky-brand-200/70">
                {t.pricing.perHour}
              </span>
            </p>
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-navy-700/60">
          <Banknote className="h-4 w-4 text-sky-brand-600" />
          {t.pricing.paymentNote}
        </p>
      </div>
    </section>
  );
}
