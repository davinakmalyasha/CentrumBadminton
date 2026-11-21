import { afterEach, describe, expect, it, vi } from "vitest";

// env.ts reads process.env at module load. Each case must reset the module
// graph so the constants are re-evaluated with the stubbed environment.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production proxy pin", () => {
  it("accepts the expected origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_PROXY_URL", "https://prod.example");
    vi.stubEnv("NEXT_PUBLIC_PROXY_EXPECTED_ORIGIN", "https://prod.example");
    const env = await import("@/lib/env");
    expect(() => env.assertProxyConfigured()).not.toThrow();
  });

  it("rejects a copied staging origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_PROXY_URL", "https://staging.example");
    vi.stubEnv("NEXT_PUBLIC_PROXY_EXPECTED_ORIGIN", "https://prod.example");
    const env = await import("@/lib/env");
    expect(() => env.assertProxyConfigured()).toThrow(/origin produksi/);
  });

  it("keeps previews without a pin working", async () => {
    vi.stubEnv("NEXT_PUBLIC_PROXY_URL", "https://staging.example");
    vi.stubEnv("NEXT_PUBLIC_PROXY_EXPECTED_ORIGIN", "");
    const env = await import("@/lib/env");
    expect(() => env.assertProxyConfigured()).not.toThrow();
  });
});
