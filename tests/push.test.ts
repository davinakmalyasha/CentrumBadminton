import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bufToB64url, toBackendShape, vapidKeyToUint8 } from "../src/lib/push";

describe("push session transport", () => {
  it("never reads document.cookie and always uses the same-origin shim", () => {
    // The session cookie is httpOnly; reading it from JS silently broke
    // subscribe in production ("no session — log in first"). Pin the
    // transport so it cannot regress.
    const src = readFileSync(
      fileURLToPath(new URL("../src/lib/push.ts", import.meta.url)),
      "utf8",
    );
    expect(src).not.toContain("document.cookie");
    expect(src).toContain("/api/push/subscriptions");
  });
});

describe("vapidKeyToUint8", () => {
  it("round-trips base64url without padding", () => {
    // 65-byte uncompressed P-256 point (0x04 + x + y).
    const raw = new Uint8Array(65);
    raw[0] = 0x04;
    for (let i = 1; i < 65; i++) raw[i] = i;
    let s = "";
    for (const b of raw) s += String.fromCharCode(b);
    const b64 = btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    expect(vapidKeyToUint8(b64)).toEqual(raw);
  });

  it("accepts +/ characters", () => {
    const withPlus = "AB-CD_EF";
    const out = vapidKeyToUint8(withPlus);
    expect(out.length).toBe(6);
  });
});

describe("bufToB64url", () => {
  it("returns null for null (missing key)", () => {
    expect(bufToB64url(null)).toBeNull();
  });

  it("encodes without padding", () => {
    const buf = new Uint8Array([1, 2, 3]).buffer;
    expect(bufToB64url(buf)).toBe("AQID");
  });
});

describe("toBackendShape", () => {
  const key = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

  it("shapes a subscription for the backend", () => {
    const shape = toBackendShape({
      endpoint: "https://push.example.com/abc",
      getKey: (name: string) => (name === "p256dh" || name === "auth" ? key(name) : null),
    });
    expect(shape).toEqual({
      endpoint: "https://push.example.com/abc",
      p256dh: expect.any(String),
      auth: expect.any(String),
    });
  });

  it("returns null when a key is missing", () => {
    expect(
      toBackendShape({ endpoint: "https://x.test", getKey: () => null }),
    ).toBeNull();
  });
});
