/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * This is the fallback: it is per-server-instance and resets on cold start.
 * `rateLimitDistributed` uses Upstash/Vercel KV when configured, so a burst
 * spread across serverless instances still shares one counter.
 */
const buckets = new Map<string, number[]>();

const MAX_BUCKETS = 5000;
const EVICT_SAMPLE = 20;
const DISTRIBUTED_TIMEOUT_MS = 1_500;

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
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

/**
 * Redis keys must not contain emails/IPs in clear text. Hash the caller's
 * logical key (which may include an email) before it leaves the process.
 */
async function hashedKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function redisConfig(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL ??
    process.env.REDIS_REST_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    process.env.REDIS_REST_TOKEN;

  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

// Atomic INCR + PEXPIRE + PTTL. Doing this in Lua avoids the classic
// INCR-then-EXPIRE race where a crashed request leaves a permanent key.
const LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`.trim();

/**
 * Distributed limiter with an in-memory fallback.
 *
 * Configure one of:
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV/Upstash)
 *
 * If Redis is unreachable or unconfigured, the local limiter still protects
 * the instance. A Redis outage must not lock every user out of login.
 */
export async function rateLimitDistributed(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const config = redisConfig();
  if (!config) return rateLimit(key, max, windowMs);

  try {
    const hashed = await hashedKey(key);
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        LIMIT_SCRIPT,
        "1",
        `cba:rl:${hashed}`,
        String(windowMs),
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(DISTRIBUTED_TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`redis ${res.status}`);
    const data = (await res.json()) as { result?: [number, number] };
    const [count, pttl] = data.result ?? [];
    if (typeof count !== "number" || typeof pttl !== "number") {
      throw new Error("redis returned an unexpected result");
    }

    if (count <= max) return { ok: true, retryAfterSec: 0 };
    return {
      ok: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((pttl > 0 ? pttl : windowMs) / 1000)
      ),
    };
  } catch {
    // Keep auth/chat available during a Redis incident.
    return rateLimit(key, max, windowMs);
  }
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
