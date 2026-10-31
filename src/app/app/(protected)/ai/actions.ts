"use server";

import { createClient } from "@/lib/proxy/client";
import { rateLimitDistributed } from "@/lib/ratelimit";
import { todayISO } from "@/lib/availability";

export interface ChatMsg {
  role: "user" | "model";
  text: string;
}

// LLM now lives in AgentsProxy (single shared key, see AgentsProxy/.env LLM_API_KEY).
// This action proxies to the Go agent via X-Session-Token — no Gemini SDK here.
// Tool calling + memory will be centralized in AgentsProxy/internal/agent; this
// Next action is a thin forwarder until the landing/Telegram chat widgets land.

/* ------------------------------------------------------------------ */
/* askAi                                                               */
/* ------------------------------------------------------------------ */

export async function askAi(
  history: ChatMsg[]
): Promise<{ reply?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Hanya staff yang bisa memakai AI. Silakan login." };
  const { data: isOwner } = await supabase.rpc("is_owner");
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (isOwner !== true && isStaff !== true) return { error: "Hanya staff yang bisa memakai AI." };

  // Cost guards: 10/menit + 150/hari per user (local in-memory, proxy also caps per-role 20/80/150)
  const rlMin = await rateLimitDistributed(`ai:min:${user.id}`, 10, 60_000);
  const rlDay = await rateLimitDistributed(`ai:day:${user.id}`, 150, 24 * 60 * 60_000);
  if (!rlMin.ok) {
    return { error: `Lambat sedikit — coba lagi dalam ${rlMin.retryAfterSec} detik.` };
  }
  if (!rlDay.ok) {
    return { error: "Kuota harian asisten tercapai. Coba lagi besok." };
  }

  const MAX_MSG_LEN = 2000;
  const trimmed = history
    .slice(-12)
    .filter((m) => m.text?.trim())
    .map((m) => ({ ...m, text: m.text.slice(0, MAX_MSG_LEN) }));
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== "user")
    return { error: "Tidak ada pertanyaan." };

  // Proxy LLM — single shared key in AgentsProxy/.env LLM_API_KEY.
  // All chat/memory/tool calling lives in AgentsProxy/internal/agent (RunWithRole).
  try {
    const last = trimmed[trimmed.length - 1]!;
    const { proxyFetch } = await import("@/lib/proxy/client");
    // Call role-aware agent in proxy (X-Session-Token auto-attached via proxyFetch cookies)
    // POST /v1/agent/chat {message, vertical} -> {reply, role}
    // Memory is Redis-side per user email — never client-forwarded. Staff/owner history is kept.
    try {
      const res = await proxyFetch<{ reply: string; role: string }>("/v1/agent/chat", {
        method: "POST",
        body: {
          message: last.text,
          vertical: "sports",
        },
        timeoutMs: 60_000,
      });
      if (res.reply) return { reply: res.reply };
    } catch (e) {
      // If proxy not yet ready or 401, fall through to role-aware stub
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("401") || msg.includes("403")) {
        return { error: "Sesi habis — silakan login ulang." };
      }
    }
    // Proxy unreachable (and not an auth problem): honest error, never
    // a canned reply disguised as an LLM answer.
    return {
      error: "Asisten AI tidak dapat dihubungi saat ini — coba lagi sebentar.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `AI proxy error: ${msg.slice(0, 140)}` };
  }
}

/* ------------------------------------------------------------------ */
/* Deterministic daily closing report (WhatsApp-ready)                 */
/* ------------------------------------------------------------------ */

export async function buildClosingReport(
  dateArg?: string
): Promise<{ text?: string; error?: string }> {
  const supabase = await createClient();
  const { data: flag } = await supabase.rpc("is_owner");
  if (flag !== true) return { error: "Hanya owner." };

  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateArg ?? "") ? dateArg! : todayISO();

  // Everything in proxy — single shared LLM_API_KEY, central memory
  try {
    const { proxyFetch } = await import("@/lib/proxy/client");
    const res = await proxyFetch<{ reply: string }>("/v1/agent/chat", {
      method: "POST",
      body: { message: `buat closing report ${date}`, vertical: "sports" },
      timeoutMs: 60_000,
    });
    if (res.reply) return { text: res.reply };
  } catch {
    // fall through to local fallback
  }

  // Proxy unreachable: honest error. The old count-only fallback was
  // actively wrong (the same outage also zeroes the bookings query).
  return { error: "Laporan tidak dapat disusun — server tidak dapat dihubungi. Coba lagi sebentar." };
}
