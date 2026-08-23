"use server";

import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";
import {
  getTodaySummary,
  getRangeSummary,
  getTopCustomers,
} from "@/lib/ai/tools";
import { todayISO, formatIDR } from "@/lib/availability";

export interface ChatMsg {
  role: "user" | "model";
  text: string;
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

/* ------------------------------------------------------------------ */
/* Tool declarations for Gemini                                        */
/* ------------------------------------------------------------------ */

const DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "getTodaySummary",
    description:
      "Ringkasan satu hari: pendapatan (cash/qris), jumlah booking, okupansi, daftar booking, dan yang belum bayar. Gunakan untuk pertanyaan tentang 'hari ini' atau tanggal tertentu.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: "Tanggal format YYYY-MM-DD (opsional, default hari ini)" },
      },
    },
  },
  {
    name: "getRangeSummary",
    description:
      "Ringkasan rentang tanggal: pendapatan kotor, cash, qris, beban, laba bersih, hari terbaik, jam terpopuler, tren harian. Untuk pertanyaan mingguan/bulanan/perbandingan.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        start: { type: Type.STRING, description: "Tanggal mulai YYYY-MM-DD (inklusif)" },
        end: { type: Type.STRING, description: "Tanggal akhir YYYY-MM-DD (eksklusif)" },
      },
      required: ["start", "end"],
    },
  },
  {
    name: "getTopCustomers",
    description: "Pelanggan paling sering bermain beserta kunjungan dan no-show.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: "Jumlah pelanggan (default 5)" },
      },
    },
  },
];

function toolImpl(name: string): ((args: Record<string, unknown>) => Promise<unknown>) | null {
  if (name === "getTodaySummary") return (a) => getTodaySummary(a as { date?: string });
  if (name === "getRangeSummary")
    return (a) => getRangeSummary(a as unknown as { start: string; end: string });
  if (name === "getTopCustomers") return (a) => getTopCustomers(a as { limit?: number });
  return null;
}

const SYSTEM_INSTRUCTION = `Kamu adalah "Asisten Centrum" — asisten manajemen GOR Centrum Badminton Arena, Cirebon (2 lapangan indoor, buka 07.00–23.00 WIB).
Aturan:
- Selalu panggil tool untuk mendapat angka AKTUAL. Jangan pernah mengarang angka.
- Jawab dalam Bahasa Indonesia, singkat & padat (maks ~120 kata kecuali diminta detail).
- Format rupiah: Rp150.000. Jam: 19.00–21.00.
- Boleh gunakan emoji secukupnya (💰🏸📅).
- Jika data kosong/kurang, katakan jujur.
- Owner bertanya untuk mengelola usaha: beri insight singkat jika relevan (misal tren naik/turun).`;

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
  if (!user) return { error: "Hanya owner yang bisa memakai AI." };
  const { data: flag } = await supabase.rpc("is_owner");
  if (flag !== true) return { error: "Hanya owner yang bisa memakai AI." };

  // Cost guard: 10 pertanyaan / menit / user
  const rl = rateLimit(`ai:${user.id}`, 10, 60_000);
  if (!rl.ok) {
    return { error: `Lambat sedikit 🙏 Coba lagi dalam ${rl.retryAfterSec} detik.` };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      error:
        "⚙️ GEMINI_API_KEY belum diset. Tambahkan di .env.local lalu restart server.",
    };
  }

  const trimmed = history.slice(-12).filter((m) => m.text?.trim());
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== "user")
    return { error: "Tidak ada pertanyaan." };

  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }> = trimmed.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

  try {
    // Function-calling loop (max 3 rounds)
    for (let round = 0; round < 3; round++) {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: DECLARATIONS }],
          temperature: 0.4,
        },
      });

      const calls = res.functionCalls ?? [];
      if (calls.length === 0) {
        const text = res.text?.trim();
        return { reply: text || "(AI tidak merespons)" };
      }

      // Append model's function calls — preserve thoughtSignature
      // (required by Gemini 3.x for multi-round tool use)
      contents.push({
        role: "model",
        parts: (res.candidates?.[0]?.content?.parts ??
          calls.map((fc) => ({ functionCall: fc }))) as never,
      });

      // Execute and append responses
      const responseParts: Array<{
        functionResponse: { name: string; response: unknown };
      }> = [];
      for (const fc of calls) {
        const fn = toolImpl(fc.name ?? "");
        let payload: unknown;
        try {
          payload = fn
            ? await fn((fc.args ?? {}) as Record<string, unknown>)
            : { error: `Tool ${fc.name} tidak dikenal.` };
        } catch (e) {
          payload = { error: e instanceof Error ? e.message : "tool error" };
        }
        responseParts.push({
          functionResponse: { name: fc.name ?? "", response: payload },
        });
      }
      contents.push({ role: "user", parts: responseParts } as never);
    }

    return { error: "Terlalu banyak langkah — coba pertanyaan yang lebih spesifik." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|quota/i.test(msg))
      return {
        error:
          "⚠️ Kuota AI gratis sudah tercapai. Coba lagi nanti atau ganti API key.",
      };
    if (/503|overloaded|unavailable/i.test(msg))
      return { error: "AI sedang sibuk — coba lagi sebentar ya." };
    if (/API key|API_KEY|permission/i.test(msg))
      return { error: "🔑 API key tidak valid — cek GEMINI_API_KEY." };
    if (/404|not found|no longer available/i.test(msg))
      return {
        error:
          "🤖 Model AI tidak tersedia. Set GEMINI_MODEL di env (mis. gemini-3.5-flash) lalu restart.",
      };
    return { error: `AI error: ${msg.slice(0, 140)}` };
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
  const summary = (await getTodaySummary({ date })) as {
    pendapatan_total?: number;
    cash?: number;
    qris?: number;
    jumlah_transaksi?: number;
    booking_aktif?: number;
    okupansi_persen?: number;
    belum_bayar?: Array<{ nama: string; jam: string; harga: number }>;
    daftar_booking?: Array<{
      jam: string;
      pelanggan: string;
      lapangan: string;
      status: string;
    }>;
  };

  const labelHari = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${date}T00:00:00+07:00`));

  const lines: string[] = [
    "🏸 *CENTRUM DAILY REPORT*",
    `📅 ${labelHari}`,
    "",
    `💰 Pendapatan: *${formatIDR(Number(summary.pendapatan_total ?? 0))}*`,
    `💵 Cash ${formatIDR(Number(summary.cash ?? 0))} · 📱 QRIS ${formatIDR(Number(summary.qris ?? 0))}`,
    `🧾 Transaksi: ${summary.jumlah_transaksi ?? 0}`,
    "",
    `🏸 Booking aktif: ${summary.booking_aktif ?? 0} · Okupansi ${summary.okupansi_persen ?? 0}%`,
  ];

  const bookings = summary.daftar_booking ?? [];
  if (bookings.length > 0) {
    lines.push("");
    for (const b of bookings.slice(0, 12)) {
      const icon =
        b.status === "completed"
          ? "✅"
          : b.status === "checked_in"
            ? "🏸"
            : b.status === "no_show"
              ? "🚫"
              : "🕒";
      lines.push(`${icon} ${b.jam} · ${b.lapangan} · ${b.pelanggan}`);
    }
  }

  const unpaid = summary.belum_bayar ?? [];
  if (unpaid.length > 0) {
    lines.push("");
    lines.push(`🔴 *Belum dibayar (${unpaid.length}):*`);
    for (const u of unpaid) {
      lines.push(`• ${u.nama} (${u.jam}) — ${formatIDR(u.harga)}`);
    }
  }

  lines.push("");
  lines.push("_Dibuat otomatis oleh Centrum Manager_");

  return { text: lines.join("\n") };
}
