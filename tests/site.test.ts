import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl, siteUrlString } from "../src/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

function clearSiteEnv() {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("VERCEL_URL", "");
}

describe("siteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL when it is valid", () => {
    clearSiteEnv();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://centrum.example.com");
    expect(siteUrlString()).toBe("https://centrum.example.com");
  });

  it("adds https to a Vercel hostname without a protocol", () => {
    clearSiteEnv();
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "centrum.vercel.app");
    expect(siteUrlString()).toBe("https://centrum.vercel.app");
  });

  it("ignores malformed values and falls back instead of throwing", () => {
    clearSiteEnv();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    expect(siteUrl().toString()).toMatch(/^http:\/\/localhost:3000\/?$/);
  });
});
