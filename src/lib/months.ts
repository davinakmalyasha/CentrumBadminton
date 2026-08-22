/** Helpers for YYYY-MM month keys in WIB */

/** "YYYY-MM" for a given ISO date (WIB) */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function currentMonthKey(): string {
  return monthKey(todayIsoForMonth());
}

function todayIsoForMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** First date of month as ISO */
export function monthStart(month: string): string {
  return `${month}-01`;
}

/** Day after last day of month (exclusive end) as ISO */
export function monthEndExclusive(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m is 1-based here; Date.UTC month index m => next month
  return d.toISOString().slice(0, 10);
}

/** Number of days in month */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Date.UTC(y, m - 1, 15)));
}
