import { NextResponse } from "next/server";
import { assertProxyConfigured, PROXY_URL, TENANT_ID } from "@/lib/env";

const PROXY_TIMEOUT_MS = 8_000;

// Shape of GET /v1/sports/availability on the proxy. Untrusted input is
// only used for display, so unknown members are simply not read here.
type AvailabilityResponse = {
  facilities?: Array<{
    facility_id: string;
    name: string;
    busy?: Array<{ start: string; end: string; kind?: string }>;
  }>;
};

/** Strict YYYY-MM-DD validation (Date() would accept 2026-02-31). */
function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  if (!isISODate(date)) {
    return NextResponse.json({ error: "date must be a valid YYYY-MM-DD" }, { status: 400 });
  }

  try {
    assertProxyConfigured();
    const r = await fetch(
      `${PROXY_URL}/v1/sports/availability/?date=${encodeURIComponent(date)}&tenant_id=${encodeURIComponent(TENANT_ID)}&type=badminton`,
      { cache: "no-store", signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) }
    );
    const data = (await r.json().catch(() => ({}))) as AvailabilityResponse;
    if (!r.ok) {
      // Backend down: empty BUT flagged, so the board warns instead of
      // showing fake all-green availability.
      return NextResponse.json(
        { date, facilities: data.facilities ?? [], degraded: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    // Availability is polled every few seconds by every open board.
    // Cache at the shared edge briefly (30s) so a burst of visitors all
    // polling the same date don't each hammer the proxy; SWR keeps it
    // fresh after expiry.
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    // Network error or missing configuration — empty + degraded flag,
    // never a silent 200-ok.
    return NextResponse.json(
      { date, facilities: [], degraded: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
