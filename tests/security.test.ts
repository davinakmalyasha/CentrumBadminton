import { describe, expect, it } from "vitest";
import { isSameOrigin } from "../src/lib/security";

function request(headers: Record<string, string>): Request {
  return new Request("https://app.example.com/api/push/subscriptions", {
    method: "POST",
    headers,
  });
}

describe("isSameOrigin", () => {
  it("accepts a matching Origin and Host", () => {
    expect(
      isSameOrigin(request({ origin: "https://app.example.com", host: "app.example.com" }))
    ).toBe(true);
  });

  it("uses x-forwarded-host behind a proxy", () => {
    expect(
      isSameOrigin(
        request({
          origin: "https://app.example.com",
          host: "internal:3000",
          "x-forwarded-host": "app.example.com",
        })
      )
    ).toBe(true);
  });

  it("rejects a cross-site Origin", () => {
    expect(
      isSameOrigin(request({ origin: "https://evil.example", host: "app.example.com" }))
    ).toBe(false);
  });

  it("rejects the opaque Origin: null", () => {
    expect(
      isSameOrigin(request({ origin: "null", host: "app.example.com" }))
    ).toBe(false);
  });

  it("allows non-browser callers that omit Origin (token still required)", () => {
    expect(isSameOrigin(request({ host: "app.example.com" }))).toBe(true);
  });
});
