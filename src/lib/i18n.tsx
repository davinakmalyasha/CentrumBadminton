"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Lang = "id" | "en";

const dict = {
  id: {
    nav: {
      book: "Booking",
      pricing: "Harga",
      facilities: "Fasilitas",
      location: "Lokasi",
      reviews: "Ulasan",
    },
    hero: {
      badge: "Buka setiap hari · 07.00–23.00 WIB",
      titleA: "Ayo Main",
      titleB: "Badminton",
      subtitle:
        "2 lapangan indoor berlantai vinyl interlock di Cirebon. Cek jadwal, pilih jam, langsung booking lewat WhatsApp.",
      ctaBook: "Cek Jadwal & Booking",
      ctaWa: "Chat WhatsApp",
      ratingLabel: "ulasan di Google",
      courtsLabel: "Lapangan",
      openNow: "Buka sekarang",
      closedNow: "Tutup · buka 07.00",
    },
    availability: {
      title: "Jadwal Lapangan",
      subtitle: "Pilih tanggal, klik slot yang tersedia, lalu booking via WhatsApp.",
      legendAvailable: "Tersedia",
      legendBooked: "Terisi",
      legendPast: "Sudah lewat",
      legendBlocked: "Ditutup",
      today: "Hari ini",
      tomorrow: "Besok",
      selectedEmpty: "Belum ada slot dipilih — klik slot hijau untuk memilih",
      selectedTitle: "Slot Dipilih",
      totalPrice: "Total perkiraan",
      bookWa: "Booking via WhatsApp",
      peakNote: "Kuning = harga malam (Rp50rb/jam)",
      normalNote: "Biru = harga siang (Rp40rb/jam)",
      loading: "Memuat jadwal…",
      waMessage:
        "Halo Centrum Badminton Arena! Saya mau booking:\n\n{slots}\nTotal perkiraan: {total}\n\nTerima kasih!",
      waSlotLine: "• {court} — {date} {time} ({price})",
    },
    pricing: {
      title: "Harga Sewa",
      subtitle: "Transparan, tanpa biaya tersembunyi. Bayar tunai atau QRIS.",
      perHour: "/jam",
      dayRate: "Siang Hari",
      dayTime: "07.00 – 17.00 WIB",
      eveningRate: "Malam Hari",
      eveningTime: "17.00 – 23.00 WIB",
      paymentNote: "Pembayaran di tempat: tunai / QRIS",
    },
    facilities: { title: "Fasilitas", subtitle: "Semua yang kamu butuhkan untuk fokus bermain." },
    location: {
      title: "Lokasi & Jam Buka",
      subtitle: "Gampang dijangkau, parkir luas.",
      addressLabel: "Alamat",
      hoursLabel: "Jam Buka",
      hoursValue: "Setiap hari, 07.00 – 23.00 WIB",
      ctaMaps: "Buka di Google Maps",
    },
    reviews: {
      title: "Kata Mereka",
      subtitle: "Rating langsung dari Google — selalu up to date.",
      ctaGoogle: "Lihat semua ulasan",
      followIg: "Ikuti Instagram",
      followFb: "Facebook",
    },
    footer: { tagline: "Tempat main badminton favorit warga Cirebon.", manageApp: "Login Pengelola", rights: "Hak cipta dilindungi." },
    common: { close: "Tutup", language: "Bahasa" },
  },
  en: {
    nav: {
      book: "Book",
      pricing: "Pricing",
      facilities: "Facilities",
      location: "Location",
      reviews: "Reviews",
    },
    hero: {
      badge: "Open daily · 07.00–23.00 WIB",
      titleA: "Come Play",
      titleB: "Badminton",
      subtitle:
        "2 indoor courts with vinyl interlock floors in Cirebon. Check the schedule, pick your hour, book straight through WhatsApp.",
      ctaBook: "Check Schedule & Book",
      ctaWa: "WhatsApp Us",
      ratingLabel: "Google reviews",
      courtsLabel: "Courts",
      openNow: "Open now",
      closedNow: "Closed · opens 07.00",
    },
    availability: {
      title: "Court Schedule",
      subtitle: "Pick a date, tap available slots, then book via WhatsApp.",
      legendAvailable: "Available",
      legendBooked: "Booked",
      legendPast: "Past",
      legendBlocked: "Closed",
      today: "Today",
      tomorrow: "Tomorrow",
      selectedEmpty: "No slots selected yet — tap a green slot to pick it",
      selectedTitle: "Selected Slots",
      totalPrice: "Estimated total",
      bookWa: "Book via WhatsApp",
      peakNote: "Yellow = evening rate (IDR 50k/hr)",
      normalNote: "Blue = daytime rate (IDR 40k/hr)",
      loading: "Loading schedule…",
      waMessage:
        "Hi Centrum Badminton Arena! I'd like to book:\n\n{slots}\nEstimated total: {total}\n\nThank you!",
      waSlotLine: "• {court} — {date} {time} ({price})",
    },
    pricing: {
      title: "Rental Prices",
      subtitle: "Transparent, no hidden fees. Pay cash or QRIS.",
      perHour: "/hr",
      dayRate: "Daytime",
      dayTime: "07.00 – 17.00 WIB",
      eveningRate: "Evening",
      eveningTime: "17.00 – 23.00 WIB",
      paymentNote: "Pay on site: cash / QRIS",
    },
    facilities: { title: "Facilities", subtitle: "Everything you need to focus on your game." },
    location: {
      title: "Location & Hours",
      subtitle: "Easy to reach with ample parking.",
      addressLabel: "Address",
      hoursLabel: "Opening Hours",
      hoursValue: "Every day, 07.00 – 23.00 WIB",
      ctaMaps: "Open in Google Maps",
    },
    reviews: {
      title: "What Players Say",
      subtitle: "Rating pulled live from Google — always current.",
      ctaGoogle: "See all reviews",
      followIg: "Follow on Instagram",
      followFb: "Facebook",
    },
    footer: { tagline: "Cirebon's favourite place to play badminton.", manageApp: "Staff Login", rights: "All rights reserved." },
    common: { close: "Close", language: "Language" },
  },
};

export type Dict = (typeof dict)["id"];

/* ---- external store over localStorage (hydration-safe) ---- */

const STORAGE_KEY = "cba-lang";
let listeners: Array<() => void> = [];

function subscribe(cb: () => void): () => void {
  listeners.push(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Lang {
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "id";
}

function getServerSnapshot(): Lang {
  return "id";
}

function writeLang(l: Lang) {
  window.localStorage.setItem(STORAGE_KEY, l);
  for (const fn of listeners) fn();
}

const LangContext = createContext<{
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
}>({ lang: "id", t: dict.id, setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = useCallback((l: Lang) => writeLang(l), []);

  const value = useMemo(() => ({ lang, t: dict[lang], setLang }), [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
