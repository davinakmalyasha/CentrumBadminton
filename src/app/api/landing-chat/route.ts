import { NextResponse } from "next/server";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:8080";
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? "centrum";

// Client bot: fully LLM via AgentsProxy — no hardcoded fallback.
// Single shared LLM_API_KEY lives in AgentsProxy/.env, never here.
// POST /v1/agent/client-chat (role=client, pricing+availability tools) with central history ag:{tenant}:client:client:{ip}
// DELETE clears the caller's client memory (server Redis + nothing else — quotas untouched).

// Forward the real visitor IP so the proxy keys memory + quota per visitor,
// not per Next.js server (all landing visitors would otherwise share one key).
// Standard: FIRST X-Forwarded-For entry is the original client. Entries are
// validated (digits/hex/dots/colons only) so a spoofed header can't poison keys.
function validIP(s: string): boolean {
  return /^[0-9a-fA-F:.]{3,45}$/.test(s);
}

function visitorIP(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff
      .split(",")
      .map((s) => s.trim())
      .find((s) => validIP(s));
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim() ?? "";
  if (real && validIP(real)) return real;
  return "";
}

export async function POST(req: Request) {
  try {
    const { message } = (await req.json()) as {
      message: string;
    };
    const msg = String(message ?? "").trim();
    if (!msg) return NextResponse.json({ error: "Pesan kosong" }, { status: 400 });
    if (msg.split(/\s+/).length > 20) {
      return NextResponse.json({ error: "Pesan maksimal 20 kata ya" }, { status: 400 });
    }
    const fwd: Record<string, string> = { "Content-Type": "application/json" };
    const ip = visitorIP(req);
    if (ip) fwd["X-Forwarded-For"] = ip;

    async function callProxy() {
      return fetch(`${PROXY_URL}/v1/agent/client-chat`, {
        method: "POST",
        headers: fwd,
        body: JSON.stringify({ message: msg, tenant_id: TENANT_ID, vertical: "sports" }),
        cache: "no-store",
      });
    }
    let r = await callProxy();
    let data = (await r.json().catch(() => ({}))) as { reply?: string; error?: string };
    // Retry once on transient provider errors (LLM 502/503/504) before falling back
    if (!r.ok && (r.status === 502 || r.status === 503 || r.status === 504)) {
      // eslint-disable-next-line no-console
      console.warn(`[landing-chat] proxy ${r.status}, retrying once:`, data.error ?? "");
      await new Promise((res) => setTimeout(res, 1000));
      r = await callProxy();
      data = (await r.json().catch(() => ({}))) as { reply?: string; error?: string };
    }
    if (r.ok && data.reply) return NextResponse.json({ reply: data.reply });
    // eslint-disable-next-line no-console
    console.error(`[landing-chat] proxy failed status=${r.status} error=${data.error ?? "?"}`);
    // Honest message on rate limit — never disguise it as a bot answer
    if (r.status === 429) {
      return NextResponse.json({
        reply: "Ups, terlalu banyak chat dalam 1 menit — tunggu sebentar lalu coba lagi ya 🙏",
      });
    }
    // Fallback when LLM/provider is down — never surface "provider error" to guest
    // Use static Centrum info so chat always answers even if proxy/LLM is 429/502
    let priceDay = 40000;
    let priceEve = 50000;
    // Try to enrich with live pricing if proxy is reachable, but don't fail if not
    try {
      const fb = await fetch(`${PROXY_URL}/v1/sports/pricing/?tenant_id=${TENANT_ID}&type=badminton`, { cache: "no-store" });
      if (fb.ok) {
        const pj = (await fb.json().catch(() => ({}))) as { items?: Array<Record<string, unknown>> };
        const rule = (pj.items ?? []).find((x) => x.is_active !== false) ?? pj.items?.[0];
        if (rule) {
          const pd = Number((rule as Record<string, unknown>).price_day ?? priceDay);
          const pe = Number((rule as Record<string, unknown>).price_evening ?? priceEve);
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
    // Even if fetch itself throws (network), return friendly fallback, not 500
    // eslint-disable-next-line no-console
    console.error("[landing-chat] fetch to proxy threw:", e instanceof Error ? e.message : e);
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
  try {
    const headers: Record<string, string> = {};
    const ip = visitorIP(req);
    if (ip) headers["X-Forwarded-For"] = ip;
    const r = await fetch(
      `${PROXY_URL}/v1/agent/history?tenant_id=${encodeURIComponent(TENANT_ID)}`,
      { method: "DELETE", headers, cache: "no-store" }
    );
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error(`[landing-chat] clear history failed status=${r.status}`);
      return NextResponse.json({ error: "Gagal menghapus riwayat" }, { status: 502 });
    }
    return NextResponse.json({ cleared: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[landing-chat] clear history threw:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Gagal menghapus riwayat" }, { status: 502 });
  }
}
