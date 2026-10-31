"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, Trash2, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Jam kosong hari ini?",
  "Harga siang vs malam?",
  "Cara booking via WhatsApp?",
  "Lapangan ada berapa?",
];

// Client chat answers short questions; a long paste is almost never a
// real venue question. Mirrors the 20-word cap enforced server-side in
// /api/landing-chat so visitors get a hint instead of an error.
const MAX_WORDS = 20;

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("centrum_chat_history");
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Honesty banner: offline fallback replies + failed server wipes.
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, open]);

  useEffect(() => {
    try {
      localStorage.setItem("centrum_chat_history", JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  // One-time onboarding hint pointing at FAB. Only the delayed appearance
  // is scheduled here — dismissal already happens in the FAB handler
  // (the only place `open` flips to true), so this effect never has to
  // set state synchronously.
  useEffect(() => {
    if (open) return;
    const seen = typeof window !== "undefined" ? localStorage.getItem("centrum_chat_hint") : "1";
    if (!seen) {
      const t = setTimeout(() => setShowHint(true), 1200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    // don't lock scroll for docked panel, just handle ESC
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending || clearing) return;
    if (wordCount(q) > MAX_WORDS) return;
    const next = [...messages, { role: "user" as const, text: q }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/landing-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
        signal: AbortSignal.timeout(35_000),
      });
      const data = await res.json();
      if (data.degraded) {
        setNotice("Mode offline — jawaban standar, konfirmasi via WhatsApp ya!");
      } else {
        setNotice(null);
      }
      setMessages([
        ...next,
        { role: "assistant", text: data.reply ?? data.error ?? "Maaf, coba lagi." },
      ]);
    } catch {
      setMessages([...next, { role: "assistant", text: "Koneksi gagal — coba lagi." }]);
    } finally {
      setPending(false);
    }
  }

  // Real clear: wipes server memory (Redis ag:{tenant}:client:client:{ip})
  // AND local bubbles. Client-only — staff/owner memory is kept by design.
  async function clearHistory() {
    if (clearing) return;
    setClearing(true);
    try {
      const res = await fetch("/api/landing-chat", { method: "DELETE", cache: "no-store" });
      if (!res.ok) {
        // Server wipe failed: local UI still clears, but say so honestly.
        setNotice("Server tak terjangkau — riwayat lokal dihapus, memori server menyusul saat online.");
      } else {
        setNotice(null);
      }
    } catch {
      setNotice("Server tak terjangkau — riwayat lokal dihapus, memori server menyusul saat online.");
    } finally {
      try {
        localStorage.removeItem("centrum_chat_history");
      } catch {}
      setMessages([]);
      setClearing(false);
    }
  }

  return (
    <>
      {/* Onboarding highlight — big, pointing at FAB */}
      {showHint && !open && (
        <div className="fixed bottom-24 right-4 z-40 max-w-[280px] animate-in fade-in slide-in-from-bottom-2">
          <div className="relative rounded-2xl border border-amber-200 bg-white p-3 pr-9 shadow-xl shadow-navy-900/15">
            <p className="text-sm font-bold leading-tight text-navy-900">Mau tanya seputar Centrum? Chat di sini!</p>
            <p className="mt-1 text-xs leading-tight text-navy-700/70">Jadwal, harga, cara booking — jawab instan.</p>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem("centrum_chat_hint", "1");
                setShowHint(false);
              }}
              aria-label="Tutup hint"
              className="absolute right-1.5 top-1.5 rounded-full p-1 text-navy-700/50 hover:bg-ice-100 hover:text-navy-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {/* arrow pointing to FAB */}
            <span className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-amber-200 bg-white" aria-hidden />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (!open) {
            localStorage.setItem("centrum_chat_hint", "1");
            setShowHint(false);
          }
          setOpen((v) => !v);
        }}
        aria-label={open ? "Tutup chat" : "Buka chat"}
        aria-expanded={open}
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-black/5 transition hover:scale-105 md:right-6 md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:h-14 md:w-14"
      >
        {/* Logo as chat icon — perfect circle badge */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/centrumLOGO-badge.avif"
          alt="Centrum"
          width={256}
          height={256}
          className="h-11 w-11 rounded-full object-cover md:h-12 md:w-12"
        />
        <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-navy-800 text-white shadow">
          {open ? <X className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
        </span>
        {!open && <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-emerald-500" aria-hidden />}
      </button>

      {/* Vertical side chat — Render-like, right bottom, with open/close transition */}
      <div
        aria-hidden={!open}
        className={`fixed z-50 flex flex-col overflow-hidden border bg-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        } inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] h-[min(78dvh,620px)] rounded-[20px] border-slate-200 md:inset-x-auto md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:right-6 md:h-[min(82vh,640px)] md:w-[380px] md:rounded-2xl`}
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop for mobile when open — vertical panel still needs dim */}
        {open && <div className="fixed inset-0 -z-10 bg-navy-900/20 backdrop-blur-[1px] md:hidden" aria-hidden onClick={() => setOpen(false)} />}
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/centrumLOGO-badge.avif" alt="Centrum" width={256} height={256} className="h-8 w-8 rounded-full object-cover" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black text-navy-900">Tanya Centrum</p>
              <p className="text-[11px] text-navy-700/60">FAQ · jadwal · booking</p>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => void clearHistory()}
                  disabled={clearing}
                  aria-label="Hapus riwayat chat"
                  title="Hapus riwayat chat"
                  className="rounded-lg p-1.5 text-navy-700/60 hover:bg-white hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup chat"
                className="rounded-lg p-1.5 text-navy-700/60 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-sm font-semibold text-navy-800">Halo! Mau tanya jadwal atau harga?</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="min-h-[40px] rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-700 hover:border-accent-400"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void clearHistory()}
                    disabled={clearing}
                    className="text-[11px] font-medium text-navy-700/50 hover:text-navy-800 disabled:opacity-50"
                  >
                    {clearing ? "Menghapus…" : "Bersihkan riwayat"}
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-navy-700/40">Jawaban dari AgentsProxy · riwayat tersimpan</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "rounded-br-md bg-navy-800 text-white" : "rounded-bl-md bg-slate-100 text-navy-900"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-sm text-navy-700/60">
                  <span className="inline-flex animate-pulse items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5" /> sedang cek jadwal…
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {notice && (
            <p role="status" className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] font-semibold text-amber-800">
              {notice}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (wordCount(input) <= MAX_WORDS) void send(input);
            }}
            className="flex gap-2 border-t border-slate-200 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya jadwal, harga, cara booking…"
              disabled={pending}
              autoFocus={open}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base focus:border-sky-brand-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending || !input.trim() || wordCount(input) > MAX_WORDS}
              className="rounded-xl bg-navy-800 px-5 py-3 text-sm font-black text-white hover:bg-navy-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          {wordCount(input) > MAX_WORDS && (
            <p role="status" className="border-t border-rose-100 bg-rose-50 px-4 py-1 text-[11px] font-semibold text-rose-700">
              Pertanyaan maksimal {MAX_WORDS} kata — tulis lebih singkat ya.
            </p>
          )}
        </div>
      </div>
      {open && <div className="fixed inset-0 z-40 bg-navy-900/20 backdrop-blur-[1px] hidden md:block" aria-hidden onClick={() => setOpen(false)} />}
    </>
  );
}
