import { NextResponse } from "next/server";
import { PROXY_URL, TENANT_ID } from "@/lib/env";

const PROXY_TIMEOUT_MS = 3_000;

export const dynamic = "force-dynamic";

/**
 * GET /api/health — deployment health for uptime checks and debugging.
 *
 * Returns 200 only when the frontend is configured and the proxy answers
 * /healthz. The body intentionally contains no secrets.
 */
export async function GET() {
  const started = Date.now();
  const base = { tenant: TENANT_ID, configured: Boolean(PROXY_URL) };

  if (!PROXY_URL) {
    return NextResponse.json(
      { ...base, status: "error", error: "NEXT_PUBLIC_PROXY_URL is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const res = await fetch(`${PROXY_URL}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    return NextResponse.json(
      {
        ...base,
        status: res.ok ? "ok" : "degraded",
        proxyStatus: res.status,
        latencyMs: Date.now() - started,
      },
      {
        status: res.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    return NextResponse.json(
      {
        ...base,
        status: "error",
        error: "proxy unreachable",
        latencyMs: Date.now() - started,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
