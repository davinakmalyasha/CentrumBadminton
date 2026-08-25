/**
 * Minimal in-memory sliding-window rate limiter.
 * Per-server-instance only (resets on cold start) — enough to deter
 * brute-force and AI spam without external infrastructure.
 */
const buckets = new Map<string, number[]>();

const MAX_BUCKETS = 5000;
const EVICT_SAMPLE = 20;

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= max) {
    const oldest = hits[0];
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Amortized cleanup: evict a few stale buckets per call instead of an
  // O(n) full scan on every request once the map is saturated. Hits are
  // appended chronologically, so checking only the tail detects staleness.
  if (buckets.size > MAX_BUCKETS) {
    let n = EVICT_SAMPLE;
    for (const k of buckets.keys()) {
      if (n-- === 0) break;
      const v = buckets.get(k)!;
      if (v.length === 0 || now - v[v.length - 1] >= windowMs) {
        buckets.delete(k);
      }
    }
  }
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Best-effort client IP for rate limiting.
 *
 * `x-real-ip` is set by the platform/ingress and is not client-spoofable.
 * `x-forwarded-for` may be client-supplied; when trusting it, take the
 * LAST hop (added by our own proxy) rather than the first (attacker-
 * controlled), so header rotation cannot evade the limiter.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
}
