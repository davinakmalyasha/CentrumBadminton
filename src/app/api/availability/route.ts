import { NextResponse } from "next/server";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? "centrum";

// Shape of GET /v1/sports/availability on the proxy. Untrusted input is
// only used for display, so unknown members are simply not read here.
type AvailabilityResponse = {
  facilities?: Array<{
    facility_id: string;
    name: string;
    busy?: Array<{ start: string; end: string; kind?: string }>;
  }>;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + "T00:00:00").getTime())) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const r = await fetch(
      `${PROXY_URL}/v1/sports/availability/?date=${encodeURIComponent(date)}&tenant_id=${TENANT_ID}&type=badminton`,
      { cache: "no-store" }
    );
    const data = (await r.json().catch(() => ({}))) as AvailabilityResponse;
    if (!r.ok) {
      // Backend down: empty BUT flagged, so the board warns instead of
      // showing fake all-green availability.
      return NextResponse.json({ date, facilities: data.facilities ?? [], degraded: true });
    }
    // Availability is polled every few seconds by every open board.
    // Cache at the shared edge briefly (30s) so a burst of visitors all
    // polling the same date don't each hammer the proxy; SWR keeps it
    // fresh after expiry. Private browsers still bypass via no-store
    // request headers where set.
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    // Network error — empty + degraded flag, never a silent 200-ok.
    return NextResponse.json({ date, facilities: [], degraded: true });
  }
}
