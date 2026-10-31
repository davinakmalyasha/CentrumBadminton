import { afterEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit } from "../src/lib/ratelimit";

// Unique keys per test so ordering never couples cases
let seq = 0;
const key = () => `test:${++seq}`;

describe("rateLimit", () => {
  afterEach(() => {
    // nothing to reset — keys are unique per run
  });

  it("allows up to max hits inside the window", () => {
    const k = key();
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(k, 5, 1000).ok).toBe(true);
    }
    expect(rateLimit(k, 5, 1000).ok).toBe(false);
  });

  it("reports a positive retry-after when blocked", () => {
    const k = key();
    for (let i = 0; i < 3; i++) rateLimit(k, 3, 60_000);
    const res = rateLimit(k, 3, 60_000);
    expect(res.ok).toBe(false);
    expect(res.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(res.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("independent buckets do not interfere", () => {
    const a = key();
    const b = key();
    for (let i = 0; i < 2; i++) rateLimit(a, 2, 1000);
    expect(rateLimit(a, 2, 1000).ok).toBe(false);
    expect(rateLimit(b, 2, 1000).ok).toBe(true);
  });

  it("evicts stale sampled buckets instead of growing unbounded", () => {
    // Saturate past the eviction threshold with long-expired windows
    const k = key();
    for (let i = 0; i < 5010; i++) {
      rateLimit(`bulk:${i}`, 1, 1); // expires immediately (1ms window)
    }
    // Must not throw or degrade: still allows fresh traffic
    const res = rateLimit(k, 5, 60_000);
    expect(res.ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the platform-set x-real-ip", () => {
    const headers = new Headers({
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "1.2.3.4, 203.0.113.7",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("uses the last x-forwarded-for hop, never the client-supplied first", () => {
    const headers = new Headers({
      "x-forwarded-for": "6.6.6.6, 198.51.100.20",
    });
    expect(clientIp(headers)).toBe("198.51.100.20");
  });

  it("ignores malformed values instead of poisoning a bucket key", () => {
    const headers = new Headers({
      "x-real-ip": "not an ip",
      "x-forwarded-for": "also bad, 2001:db8::1",
    });
    expect(clientIp(headers)).toBe("2001:db8::1");
  });

  it("returns unknown when no usable address is present", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
