import { NextResponse } from "next/server";
import { assertProxyConfigured, PROXY_URL, TENANT_ID } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// Client bot: fully LLM via AgentsProxy — no hardcoded model key here.
// Single shared LLM_API_KEY lives in AgentsProxy/.env, never in this repo.
// POST /v1/agent/client-chat (role=client, pricing+availability tools) with
// central history ag:{tenant}:client:client:{ip}.
// DELETE clears the caller's client memory (server Redis only).

const PROXY_TIMEOUT_MS = 30_000;
const FALLBACK_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_WORDS = 20;
const MAX_MESSAGE_CHARS = 2_000;

/**
 * Forward the visitor IP so the proxy keys memory + quota per visitor, not
 * per Next.js server (all landing visitors would otherwise share one key).
 *
 * clientIp() prefers the platform-set x-real-ip and then the LAST
 * X-Forwarded-For hop, never the first (client-controlled) one.
 */
function visitorIP(req: Request): string {
  const ip = clientIp(req.headers);
  return ip === "unknown" ? "" : ip;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("BAD_BODY");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("BAD_BODY");
  }
  return parsed as Record<string, unknown>;
}

export async function POST(req: Request) {
  const ip = visitorIP(req);
  const rl = rateLimit(`landing:${ip || "unknown"}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak pesan. Coba lagi sebentar." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    assertProxyConfigured();
    const body = await readJsonBody(req);
    const msg = String(body.message ?? "").trim();
    if (!msg) return NextResponse.json({ error: "Pesan kosong" }, { status: 400 });
    if (msg.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: "Pesan terlalu panjang" }, { status: 400 });
    }
    if (msg.split(/\s+/).length > MAX_WORDS) {
      return NextResponse.json({ error: "Pesan maksimal 20 kata ya" }, { status: 400 });
    }

    const fwd: Record<string, string> = { "Content-Type": "application/json" };
    if (ip) fwd["X-Forwarded-For"] = ip;

    async function callProxy() {
      return fetch(`${PROXY_URL}/v1/agent/client-chat`, {
        method: "POST",
        headers: fwd,
        body: JSON.stringify({ message: msg, tenant_id: TENANT_ID, vertical: "sports" }),
        cache: "no-store",
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
    }
    let r = await callProxy();
    let data = (await r.json().catch(() => ({}))) as { reply?: string; error?: string };
    // Retry once on transient provider errors before falling back.
    if (!r.ok && (r.status === 502 || r.status === 503 || r.status === 504)) {
      console.warn(`[landing-chat] proxy ${r.status}, retrying once:`, data.error ?? "");
      await new Promise((res) => setTimeout(res, 1000));
      r = await callProxy();
      data = (await r.json().catch(() => ({}))) as { reply?: string; error?: string };
    }
    if (r.ok && data.reply) return NextResponse.json({ reply: data.reply });
    console.error(`[landing-chat] proxy failed status=${r.status} error=${data.error ?? "?"}`);
    // Honest message on rate limit — never disguise it as a bot answer.
    if (r.status === 429) {
      return NextResponse.json({
        reply: "Ups, terlalu banyak chat dalam 1 menit — tunggu sebentar lalu coba lagi ya 🙏",
      });
    }

    // Fallback when the LLM/provider is down — never surface "provider
    // error" to a guest. Use static Centrum info so chat still answers.
    let priceDay = 40000;
    let priceEve = 50000;
    try {
      const fb = await fetch(
        `${PROXY_URL}/v1/sports/pricing/?tenant_id=${encodeURIComponent(TENANT_ID)}&type=badminton`,
        { cache: "no-store", signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS) }
      );
      if (fb.ok) {
        const pj = (await fb.json().catch(() => ({}))) as {
          items?: Array<Record<string, unknown>>;
        };
        const rule = (pj.items ?? []).find((x) => x.is_active !== false) ?? pj.items?.[0];
        if (rule) {
          const pd = Number(rule.price_day ?? priceDay);
          const pe = Number(rule.price_evening ?? priceEve);
          if (pd) priceDay = pd;
          if (pe) priceEve = pe;
        }
      }
    } catch {
      /* ignore — use static fallback */
    }
    const fallback =
      `Halo! Saya asisten Centrum Badminton Arena 🏸\n\n` +
      `Buka tiap hari 07.00–23.00 WIB · 2 lapangan vinyl interlock\n` +
      `Harga standar: siang Rp${priceDay.toLocaleString("id-ID")}/jam (07–17), malam Rp${priceEve.toLocaleString("id-ID")}/jam (17–23)\n` +
      `(Jawaban otomatis — harga bisa berubah, konfirmasi via WhatsApp ya!)\n` +
      `Cek slot kosong di atas (pilih tanggal → slot hijau = tersedia), lalu Booking via WhatsApp. Ada yang bisa dibantu lagi?`;
    return NextResponse.json({ reply: fallback, degraded: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === "BODY_TOO_LARGE") {
      return NextResponse.json({ error: "Pesan terlalu panjang" }, { status: 413 });
    }
    if (message === "BAD_BODY") {
      return NextResponse.json({ error: "Format pesan tidak valid" }, { status: 400 });
    }
    // Even if fetch itself throws (network/timeout), return a friendly
    // fallback, not a 500.
    console.error("[landing-chat] request failed:", message);
    return NextResponse.json({
      reply:
        `Halo! Saya asisten Centrum Badminton Arena 🏸\n\n` +
        `Buka 07.00–23.00 WIB · Harga standar siang Rp40.000/jam, malam Rp50.000/jam (konfirmasi via WhatsApp ya!)\n` +
        `Cek slot hijau di atas untuk slot kosong, lalu Booking via WhatsApp ya!`,
      degraded: true,
    });
  }
}

export async function DELETE(req: Request) {
  const ip = visitorIP(req);
  const rl = rateLimit(`landing-delete:${ip || "unknown"}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    assertProxyConfigured();
    const headers: Record<string, string> = {};
    if (ip) headers["X-Forwarded-For"] = ip;
    const r = await fetch(
      `${PROXY_URL}/v1/agent/history?tenant_id=${encodeURIComponent(TENANT_ID)}`,
      {
        method: "DELETE",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!r.ok) {
      console.error(`[landing-chat] clear history failed status=${r.status}`);
      return NextResponse.json({ error: "Gagal menghapus riwayat" }, { status: 502 });
    }
    return NextResponse.json({ cleared: true });
  } catch (e) {
    console.error(
      "[landing-chat] clear history threw:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ error: "Gagal menghapus riwayat" }, { status: 502 });
  }
}
