import { VENUE } from "./constants";

export interface RatingData {
  score: number;
  total: number;
  /** true when fetched live from Google Places API */
  live: boolean;
}

/**
 * Fetches the venue's Google rating server-side, cached for 24h.
 * Falls back to the last-known constant when no API key is configured
 * or the API fails — the badge never breaks.
 */
export async function getGoogleRating(): Promise<RatingData> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!key || !placeId) {
    return { ...VENUE.fallbackRating, live: false };
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total&key=${encodeURIComponent(key)}`,
      { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(5_000) }
    );
    const json = (await res.json()) as {
      status?: string;
      result?: { rating?: number; user_ratings_total?: number };
    };
    if (json.status === "OK" && typeof json.result?.rating === "number") {
      return {
        score: json.result.rating,
        total: json.result.user_ratings_total ?? 0,
        live: true,
      };
    }
  } catch {
    // fall through to fallback
  }
  return { ...VENUE.fallbackRating, live: false };
}
