export const VENUE = {
  name: "Centrum Badminton Arena",
  shortName: "Centrum",
  tagline: {
    id: "GOR badminton indoor di jantung Cirebon. 2 lapangan vinyl interlock, sejuk & nyaman.",
    en: "Indoor badminton hall in the heart of Cirebon. 2 vinyl interlock courts, cool & comfortable.",
  },
  address:
    "Jl. Pangeran Cakra Buana, Griya Cempaka Arum – Talun, Cirebon 45171 (belakang Indomaret Cempaka Arum)",
  addressEn:
    "Jl. Pangeran Cakra Buana, Griya Cempaka Arum – Talun, Cirebon 45171 (behind Indomaret Cempaka Arum)",
  hours: { open: 7, close: 23 }, // WIB
  whatsappNumber: "628159408136",
  instagram: "centrum_badminton_arena",
  facebook: "Centrum Badminton Arena",
  mapsQuery: "Centrum+Badminton+Arena+Cempaka+Arum+Cirebon",
  /** Fallback when GOOGLE_PLACES_API_KEY is not configured */
  fallbackRating: { score: 4.7, total: 59 },
} as const;

export const FACILITIES = [
  { icon: "court", id: "2 Lapangan Vinyl Interlock", en: "2 Vinyl Interlock Courts" },
  { icon: "score", id: "Tempat Wasit & Score Board", en: "Referee Area & Scoreboard" },
  { icon: "light", id: "Lampu Penerangan Lapangan", en: "Court Floodlighting" },
  { icon: "indoor", id: "Bangunan Tertutup (Indoor)", en: "Fully Enclosed Building" },
  { icon: "lounge", id: "Ruang Tunggu & Kantin", en: "Lounge & Canteen" },
  { icon: "mosque", id: "Musholla", en: "Prayer Room" },
  { icon: "toilet", id: "Toilet Bersih", en: "Clean Toilets" },
  { icon: "parkir", id: "Lahan Parkir", en: "Parking Area" },
] as const;

/** Build a wa.me deep link with prefilled message */
export function waLink(message: string): string {
  return `https://wa.me/${VENUE.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/** Google Maps directions URL — opens native app on mobile */
export function mapsDirectionsUrl(): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${VENUE.mapsQuery}`;
}

export function mapsEmbedUrl(): string {
  return `https://maps.google.com/maps?q=${VENUE.mapsQuery}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
}
