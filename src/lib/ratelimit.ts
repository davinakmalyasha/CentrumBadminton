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

  // Amortized cleanup: evict stale buckets per call instead of an O(n)
  // full scan on every request once the map is saturated. If the map is
  // far past the cap (attack traffic), sweep the whole thing once.
  if (buckets.size > MAX_BUCKETS) {
    const sweepAll = buckets.size > MAX_BUCKETS * 2;
    let n = sweepAll ? buckets.size : EVICT_SAMPLE;
    for (const [k, v] of buckets) {
      if (n-- <= 0) break;
      if (v.length === 0 || now - v[v.length - 1] >= windowMs) {
        buckets.delete(k);
      }
    }
  }
  return { ok: true, retryAfterSec: 0 };
}

const IP_RE = /^[0-9a-fA-F:.]{3,45}$/;

function validIP(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && IP_RE.test(trimmed) ? trimmed : null;
}

/**
 * Best-effort client IP for rate limiting.
 *
 * `x-real-ip` is set by the platform/ingress (Vercel, a reverse proxy) and
 * is not client-spoofable there. `x-forwarded-for` may be client-supplied;
 * when trusting it, take the LAST hop (added by our own proxy) rather than
 * the first (attacker-controlled), so header rotation cannot evade the
 * limiter. Values are validated so a junk header cannot poison a Redis key
 * or a log line.
 */
export function clientIp(headers: Headers): string {
  const real = validIP(headers.get("x-real-ip"));
  if (real) return real;

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = validIP(hops[i]);
      if (hop) return hop;
    }
  }
  return "unknown";
}
