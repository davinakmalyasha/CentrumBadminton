// Report-download relay tests.
//
// WHY THIS FILE EXISTS: the chat used to link straight at the Go proxy,
// which is a CROSS-origin download. For one, Chrome ignores
// Content-Disposition and names the file from the URL path — so a
// perfectly good "laporan-2026-10-01_2026-10-31-semua-8ab12cd3.xlsx"
// arrived in the Downloads folder as "<64-hex-token>.xlsx". Nothing in
// the code looked wrong and the file was a valid workbook, so this only
// showed up in a real browser.
//
// The fix is a same-origin relay. These tests pin the three things that
// make the relay safe and correct:
//   1. a malformed token is rejected WITHOUT touching the proxy, so the
//      route can never be used as an open relay to arbitrary backend
//      paths;
//   2. a well-formed token is forwarded and its filename is passed
//      through, because the same-origin hop is what makes the header
//      authoritative again;
//   3. a filename that does not match the shape the proxy mints is
//      replaced, so a header can never inject a second filename or a
//      path separator.

import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/reports/download/[token]/route";

const VALID = "a".repeat(64);
const GOOD_NAME = "laporan-2026-10-01_2026-10-31-semua-bcab2a8e.xlsx";

let calls: string[] = [];

/** Stub the proxy with `headers`/`status`, recording the paths requested. */
function stubProxy(init: {
  status?: number;
  headers?: Record<string, string>;
  bytes?: Uint8Array;
}) {
  calls = [];
  const status = init.status ?? 200;
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(String(url));
    return new Response(
      init.bytes ? new Uint8Array(init.bytes) : JSON.stringify({ error: "x" }),
      { status, headers: init.headers ?? { "Content-Type": "application/json" } },
    );
  });
}

function get(token: string, requestInit?: RequestInit) {
  return GET(
    new Request(`http://localhost:3000/api/reports/download/${token}.xlsx`, requestInit),
    { params: Promise.resolve({ token }) },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("token validation", () => {
  it("rejects a short token and never calls the proxy", async () => {
    stubProxy({ headers: { "Content-Disposition": `attachment; filename="${GOOD_NAME}"` } });
    const res = await get("abc123");
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("rejects non-hex characters", async () => {
    stubProxy({});
    const res = await get("Z".repeat(64));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("rejects a 63-char token (off-by-one must not slip through)", async () => {
    stubProxy({});
    const res = await get("a".repeat(63));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("forwards a well-formed token to the proxy", async () => {
    stubProxy({
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${GOOD_NAME}"`,
      },
      bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    });
    const res = await get(VALID);
    expect(res.status).toBe(200);
    expect(calls).toEqual([`http://localhost:8080/v1/reports/${VALID}.xlsx`]);
  });
});

describe("filename handling", () => {
  it("passes the proxy's filename through", async () => {
    stubProxy({
      headers: { "Content-Disposition": `attachment; filename="${GOOD_NAME}"` },
      bytes: new Uint8Array([0x50, 0x4b]),
    });
    const res = await get(VALID);
    expect(res.headers.get("Content-Disposition")).toBe(
      `attachment; filename="${GOOD_NAME}"`,
    );
  });

  it("replaces a filename that does not match the minted shape", async () => {
    stubProxy({
      headers: {
        "Content-Disposition": 'attachment; filename="../../etc/passwd"',
      },
      bytes: new Uint8Array([0x50, 0x4b]),
    });
    const res = await get(VALID);
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).not.toContain("passwd");
    expect(cd).toContain("laporan-aaaaaaaa.xlsx");
  });

  it("falls back to a token-derived name when upstream sends no header", async () => {
    stubProxy({ bytes: new Uint8Array([0x50, 0x4b]) });
    const res = await get(VALID);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="laporan-aaaaaaaa.xlsx"',
    );
  });
});

describe("response headers", () => {
  it("always serves the XLSX mime type and stays uncacheable", async () => {
    stubProxy({
      headers: { "Content-Disposition": `attachment; filename="${GOOD_NAME}"` },
      bytes: new Uint8Array([0x50, 0x4b]),
    });
    const res = await get(VALID);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("forwards a Range request so large reports stay resumable", async () => {
    calls = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push(String(url));
      expect((init?.headers as Record<string, string>)?.Range).toBe("bytes=0-1023");
      return new Response(new Uint8Array([0x50, 0x4b]), {
        status: 206,
        headers: {
          "Content-Disposition": `attachment; filename="${GOOD_NAME}"`,
          "Content-Range": "bytes 0-1023/8046",
        },
      });
    });
    const res = await get(VALID, { headers: { Range: "bytes=0-1023" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-1023/8046");
  });
});

describe("failure modes", () => {
  it("maps an upstream 404 to 404 with a re-ask message", async () => {
    stubProxy({ status: 404 });
    const res = await get(VALID);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toMatch(/kedaluwarsa/);
  });

  it("maps an upstream 500 to 502, not a fake report", async () => {
    stubProxy({ status: 500 });
    expect((await get(VALID)).status).toBe(502);
  });

  it("maps a network failure to 502", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    expect((await get(VALID)).status).toBe(502);
  });
});
