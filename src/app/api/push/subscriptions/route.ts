import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  assertProxyConfigured,
  LEGACY_SESSION_COOKIE,
  PROXY_URL,
  SESSION_COOKIE,
} from "@/lib/env";
import { isSameOrigin } from "@/lib/security";

const PROXY_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_ENDPOINT_LENGTH = 2_048;

// Same-origin shim for the browser push flow (lib/push.ts). The session
// cookie is httpOnly BY DESIGN (see lib/proxy/client.ts: it is a bearer
// credential and must not be reachable from document.cookie), so the
// browser cannot attach X-Session-Token itself. This route reads it
// server-side and forwards, same posture as every other authenticated path.
async function session(): Promise<string | null> {
  const store = await cookies();
  return (
    store.get(SESSION_COOKIE)?.value ??
    store.get(LEGACY_SESSION_COOKIE)?.value ??
    null
  );
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const token = await session();
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  try {
    assertProxyConfigured();
    const r = await fetch(`${PROXY_URL}/v1/push/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": token },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch {
    return NextResponse.json({ error: "backend unreachable" }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const token = await session();
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 });

  const endpoint = new URL(req.url).searchParams.get("endpoint") ?? "";
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  if (endpoint.length > MAX_ENDPOINT_LENGTH) {
    return NextResponse.json({ error: "endpoint too long" }, { status: 400 });
  }

  try {
    assertProxyConfigured();
    const r = await fetch(
      `${PROXY_URL}/v1/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`,
      {
        method: "DELETE",
        headers: { "X-Session-Token": token },
        cache: "no-store",
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      }
    );
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch {
    return NextResponse.json({ error: "backend unreachable" }, { status: 502 });
  }
}
