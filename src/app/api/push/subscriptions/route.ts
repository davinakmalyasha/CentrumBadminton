import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";
const SESSION_COOKIE = "proxy_session";

// Same-origin shim for the browser push flow (lib/push.ts). The session
// cookie is httpOnly BY DESIGN (see lib/proxy/client.ts: it is a bearer
// credential and must not be reachable from document.cookie), so the
// browser cannot attach X-Session-Token itself — reading the cookie in
// client code silently broke subscribe in production once the connector
// made it httpOnly. This route reads it server-side and forwards, same
// posture as every other authenticated path.
async function session(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function POST(req: Request) {
  const token = await session();
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 });
  const body = await req.text();
  try {
    const r = await fetch(`${PROXY_URL}/v1/push/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": token },
      body,
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch {
    return NextResponse.json({ error: "backend unreachable" }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const token = await session();
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 });
  const endpoint = new URL(req.url).searchParams.get("endpoint") ?? "";
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  try {
    const r = await fetch(
      `${PROXY_URL}/v1/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`,
      { method: "DELETE", headers: { "X-Session-Token": token }, cache: "no-store" },
    );
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch {
    return NextResponse.json({ error: "backend unreachable" }, { status: 502 });
  }
}
