export interface BusyInterval {
  court_id: string | null; // null = all courts
  start_time: string; // "HH:MM:SS"
  end_time: string;
  kind: "booked" | "blocked";
}

export interface PricingInfo {
  openHour: number;
  closeHour: number;
  dayEndHour: number; // evening starts here
  priceDay: number;
  priceEvening: number;
}

export type SlotStatus = "available" | "booked" | "past" | "blocked";

export interface Slot {
  hour: number; // starting hour, e.g. 7 => 07:00-08:00
  status: SlotStatus;
  isEvening: boolean;
  price: number;
}

const WIB = "Asia/Jakarta";

/** Current wall-clock time in WIB as minutes since midnight */
export function wibNowMinutes(): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Today's date in WIB as ISO string (YYYY-MM-DD) */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatIDR(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

/** Compact thousands label for tight slot chips: 40000 → "40rb" */
export function formatK(n: number): string {
  if (n > 0 && n % 1000 === 0) return `${n / 1000}rb`;
  return formatIDR(n);
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}.00`;
}

function overlaps(
  busyStart: string,
  busyEnd: string,
  slotStartH: number,
  slotEndH: number
): boolean {
  const bs = Number(busyStart.slice(0, 2)) * 60 + Number(busyStart.slice(3, 5));
  const be = Number(busyEnd.slice(0, 2)) * 60 + Number(busyEnd.slice(3, 5));
  const ss = slotStartH * 60;
  const se = slotEndH * 60;
  return bs < se && be > ss;
}

/**
 * Compute hourly slots for one court on a given date.
 * `dateISO` must be the selected day; `isToday` enables past-slot marking.
 */
export function buildSlots(
  pricing: PricingInfo,
  busy: BusyInterval[],
  courtId: string,
  dateISO: string,
  todayStr: string
): Slot[] {
  const slots: Slot[] = [];
  const nowMin = wibNowMinutes();
  const isToday = dateISO === todayStr;

  for (let h = pricing.openHour; h < pricing.closeHour; h++) {
    const isEvening = h >= pricing.dayEndHour;

    let status: SlotStatus = "available";
    if (isToday && h * 60 <= nowMin) status = "past";

    if (status === "available") {
      const hit = busy.find(
        (b) =>
          (b.court_id === null || b.court_id === courtId) &&
          overlaps(b.start_time, b.end_time, h, h + 1)
      );
      if (hit) status = hit.kind === "booked" ? "booked" : "blocked";
    }

    slots.push({
      hour: h,
      status,
      isEvening,
      price: isEvening ? pricing.priceEvening : pricing.priceDay,
    });
  }
  return slots;
}

/** Group consecutive selected hours per court into readable ranges */
export function groupHours(hours: number[]): Array<[number, number]> {
  if (hours.length === 0) return [];
  const sorted = [...hours].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (const h of sorted.slice(1)) {
    if (h === prev + 1) {
      prev = h;
      continue;
    }
    ranges.push([start, prev + 1]);
    start = h;
    prev = h;
  }
  ranges.push([start, prev + 1]);
  return ranges;
}

/** Sum hourly prices for [startH, endH) using day/evening boundary */
export function computePrice(
  pricing: { dayEndHour: number; priceDay: number; priceEvening: number },
  startH: number,
  endH: number
): number {
  let total = 0;
  for (let h = startH; h < endH; h++) {
    total += h >= pricing.dayEndHour ? pricing.priceEvening : pricing.priceDay;
  }
  return total;
}
