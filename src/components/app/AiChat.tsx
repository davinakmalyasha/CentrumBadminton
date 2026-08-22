"use client";

import { useEffect, useRef, useState } from "react";
import { askAi, type ChatMsg } from "@/app/app/(protected)/ai/actions";

const SUGGESTIONS = [
  "Ringkas pendapatan hari ini",
  "Jam tersibuk bulan ini?",
  "Siapa pelanggan paling sering?",
  "Bandingkan pendapatan bulan ini vs bulan lalu",
];

export default function AiChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const next: ChatMsg[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await askAi(next);
      setMessages([
        ...next,
        {
          role: "model",
          text: res.reply ?? `⚠️ ${res.error ?? "Gagal memproses."}`,
        },
      ]);
    } catch {
      setMessages([
        ...next,
        { role: "model", text: "⚠️ Koneksi gagal — coba lagi." },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex min-h-[60vh] flex-col rounded-2xl border border-sky-brand-200 bg-white">
      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "55vh" }}>
        {messages.length === 0 && (
          <div className="rounded-2xl bg-ice-100 p-4 text-center">
            <p className="text-sm font-bold text-navy-800">
              👋 Halo! Tanya data usaha kamu di sini.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-sky-brand-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-navy-700 transition hover:border-accent-400 hover:text-accent-600"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-navy-800 text-white"
                  : "rounded-bl-md bg-ice-100 text-navy-900"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-ice-100 px-3.5 py-2.5 text-sm text-navy-700/60">
              <span className="inline-block animate-pulse">🤖 sedang cek data…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex gap-2 border-t border-sky-brand-200 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya sesuatu…"
          disabled={pending}
          className="min-w-0 flex-1 rounded-xl border border-sky-brand-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-sky-brand-400 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="flex-shrink-0 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-accent-600 disabled:opacity-50"
        >
          ➤
        </button>
      </form>
      <p className="px-3 pb-3 text-center text-[10px] font-medium text-navy-700/40">
        Ditenagai Gemini · angka dari database asli
      </p>
    </section>
  );
}
