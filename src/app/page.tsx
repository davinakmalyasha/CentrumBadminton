import { createClient } from "@/lib/supabase/server";
import {
  todayISO,
  wibNowMinutes,
  type BusyInterval,
  type PricingInfo,
} from "@/lib/availability";
import type { Metadata } from "next";
import { VENUE } from "@/lib/constants";
import { getGoogleRating } from "@/lib/rating";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import AvailabilityBoard from "@/components/landing/AvailabilityBoard";
import PricingSection from "@/components/landing/PricingSection";
import FacilitiesSection from "@/components/landing/FacilitiesSection";
import LocationSection from "@/components/landing/LocationSection";
import SocialSection from "@/components/landing/SocialSection";
import Footer from "@/components/landing/Footer";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return lang === "en"
    ? {
        title: "Centrum Badminton Arena — Book Indoor Badminton Courts in Cirebon",
        description:
          "2 indoor vinyl interlock badminton courts in Cirebon. Open daily 07.00–23.00 WIB. IDR 40k/hr daytime, IDR 50k/hr evening. Easy WhatsApp booking.",
      }
    : {
        title: "Centrum Badminton Arena — Booking Lapangan Badminton Cirebon",
        description:
          "2 lapangan badminton indoor vinyl interlock di Cirebon. Buka setiap hari 07.00–23.00 WIB. Rp40rb/jam siang, Rp50rb/jam malam. Booking mudah via WhatsApp.",
      };
}

const FALLBACK_PRICING: PricingInfo = {
  openHour: 7,
  closeHour: 23,
  dayEndHour: 17,
  priceDay: 40000,
  priceEvening: 50000,
};

export default async function LandingPage() {
  const today = todayISO();
  const lang = await getLang();
  const t = getDict(lang);

  const supabase = await createClient();
  const [courtsRes, pricingRes, busyRes, rating] = await Promise.all([
    supabase
      .from("courts")
      .select("id,name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.rpc("get_pricing_for", { p_date: today }),
    supabase.rpc("get_day_busy", { p_date: today }),
    getGoogleRating(),
  ]);

  const courts = (courtsRes.data ?? []) as Array<{ id: string; name: string }>;

  const p = pricingRes.data?.[0];
  const pricing: PricingInfo = p
    ? {
        openHour: Number(p.open_time.slice(0, 2)),
        closeHour: Number(p.close_time.slice(0, 2)),
        dayEndHour: Number(p.day_end.slice(0, 2)),
        priceDay: Number(p.price_day),
        priceEvening: Number(p.price_evening),
      }
    : FALLBACK_PRICING;

  const busy = (busyRes.data ?? []) as BusyInterval[];
  const nowMin = wibNowMinutes();
  const openNow =
    nowMin >= pricing.openHour * 60 && nowMin < pricing.closeHour * 60;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: VENUE.name,
    address: VENUE.address,
    openingHours: "Mo-Su 07:00-23:00",
    telephone: `+${VENUE.whatsappNumber}`,
    priceRange: "Rp40.000 - Rp50.000",
  };
  // Only claim a rating in structured data when it's a live Google value —
  // the offline fallback constant must not be published as fact.
  if (rating.live && rating.total > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.score,
      reviewCount: rating.total,
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar lang={lang} />
      <main>
        <Hero rating={rating} openNow={openNow} pricing={pricing} t={t} />
        <AvailabilityBoard
          courts={courts}
          pricing={pricing}
          initialBusy={busy}
          todayStr={today}
          lang={lang}
        />
        <PricingSection t={t} pricing={pricing} />
        <FacilitiesSection t={t} lang={lang} />
        <LocationSection t={t} lang={lang} />
        <SocialSection rating={rating} t={t} />
      </main>
      <Footer t={t} />
    </>
  );
}
