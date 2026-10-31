/**
 * Canonical site URL for metadata, robots.txt and sitemap.xml.
 *
 * Order:
 *   1. NEXT_PUBLIC_SITE_URL (explicit, works on any host)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (set by Vercel for production)
 *   3. VERCEL_URL (preview deployments)
 *   4. localhost for development
 *
 * Vercel exposes hostnames without a protocol, so normalise those.
 */
const DEV_URL = "http://localhost:3000";
const PROD_FALLBACK = "https://centrum-badminton.vercel.app";

function withProtocol(value: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
}

export function siteUrl(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      const url = new URL(withProtocol(value));
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url;
      }
    } catch {
      // Ignore a malformed value and try the next source.
    }
  }

  return new URL(process.env.NODE_ENV === "production" ? PROD_FALLBACK : DEV_URL);
}

/** Canonical origin without a trailing slash (safe for string concatenation). */
export function siteUrlString(): string {
  return siteUrl().origin;
}
