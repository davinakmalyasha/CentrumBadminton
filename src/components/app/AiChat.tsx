"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AlertTriangle,
  Bot,
  FileSpreadsheet,
  RotateCcw,
  Send,
} from "lucide-react";
import { askAi, type ChatMsg } from "@/app/app/(protected)/ai/actions";

const OWNER_SUGGESTIONS = [
  "Ringkas pendapatan hari ini",
  "Buatkan laporan Excel bulan ini",
  "Jam tersibuk bulan ini?",
  "Siapa pelanggan paling sering?",
  "Bandingkan pendapatan bulan ini vs bulan lalu",
];

const PEGAWAI_SUGGESTIONS = [
  "Jadwal hari ini ada berapa?",
  "Stok shuttlecock sisa berapa?",
  "Booking jam 19 kosong?",
  "Buatkan pengingat order kok",
];

function isErrorReply(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("gagal") ||
    t.includes("koneksi gagal") ||
    t.includes("tidak dapat dihubungi") ||
    t.includes("coba lagi")
  );
}

/** Grow the composer up to 120px, then scroll inside it. */
function resizeTextarea(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

export default function AiChat({
  role = "owner",
  embedded = false,
  inputRef: externalInputRef,
}: {
  role?: "owner" | "pegawai";
  embedded?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef ?? localInputRef;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  useEffect(() => {
    resizeTextarea(inputRef.current);
  }, [input, inputRef]);

  // Render bot replies: an XLSX:/v1/reports/... marker becomes a real
  // download button (token-authed, no session needed); bare URLs linkify.
  // Logic identical — only colors changed to monochrome.
  function renderReply(text: string, keyPrefix: string) {
    const urlSplit = /(https?:\/\/[^\s)]+)/g;
    const urlTest = /^https?:\/\/[^\s)]+$/;
    // The marker is matched ANYWHERE in a line, not as a whole line. It was
    // anchored to the full line, and the system prompt tells the model to
    // present it "along with its one-line summary" — which invites exactly
    // the inline form, so the button silently never appeared for any reply
    // that did what it was asked.
    //
    // Two regexes on purpose: `xlsxRe` has no /g so `match()[1]` yields the
    // capture group. A /g regex makes String.match return whole matches
    // instead, which silently produced href=".../undefined" — a button that
    // looked correct and downloaded nothing.
    //
    // The capture is the bare 64-hex token, not the full proxy path, so the
    // link can point at our own origin (see the href below).
    const xlsxRe = /XLSX:\/v1\/reports\/([0-9a-f]{64})\.xlsx/;
    const xlsxStrip = new RegExp(xlsxRe.source, "g");
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const hit = line.match(xlsxRe);
      if (hit) {
        const token = hit[1];
        // The model often wraps the marker as a markdown link, e.g.
        // "[Unduh laporan](XLSX:/v1/reports/….xlsx)". Drop the link
        // text too, otherwise the button is preceded by a duplicate
        // "Download this report (Download Excel)" fragment.
        const prose = line
          .replace(/\[[^\]]*\]\(\s*XLSX:[^)]*\)/gi, "")
          .replace(xlsxStrip, "")
          .replace(/[[\]]/g, "")
          .replace(/\(\s*/g, "")
          .replace(/\s{2,}/g, " ")
          .trim();
        return (
          <span key={`${keyPrefix}-${i}`} className="block">
            {prose ? prose : null}
            <a
              // Same-origin on purpose. Linking the proxy directly was a
              // cross-origin download, so Chrome ignored the proxy's
              // Content-Disposition and saved the file under the URL's
              // last segment — the 64-hex token. Relaying through our own
              // origin (/api/reports/download) makes the header stick.
              // `download` is left valueless on purpose: a valued
              // download attribute would override the server filename
              // and reintroduce the same bug.
              href={`/api/reports/download/${token}.xlsx`}
              download
              className="manager-tap mt-1.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[13px] font-bold text-white transition hover:bg-emerald-700"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Download Excel (.xlsx)
            </a>
          </span>
        );
      }
      const parts = line.split(urlSplit);
      return (
        <span key={`${keyPrefix}-${i}`} className="block">
          {parts.map((p, j) =>
            urlTest.test(p) ? (
              <a
                key={j}
                href={p}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                {p}
              </a>
            ) : (
              <span key={j}>{p}</span>
            ),
          )}
          {i < lines.length - 1 ? "\n" : ""}
        </span>
      );
    });
  }

  async function callAi(history: ChatMsg[]) {
    setPending(true);
    try {
      const res = await askAi(history);
      setMessages([
        ...history,
        {
          role: "model",
          text: res.reply ?? `${res.error ?? "Gagal memproses."}`,
        },
      ]);
    } catch {
      setMessages([...history, { role: "model", text: "Koneksi gagal — coba lagi." }]);
    } finally {
      setPending(false);
    }
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending || retrying) return;
    const next: ChatMsg[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    requestAnimationFrame(() => resizeTextarea(inputRef.current));
    await callAi(next);
  }

  async function retry() {
    if (pending || retrying || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "model" || !isErrorReply(last.text)) return;
    // History without the error bubble ends with the user question — resend it
    // without duplicating the user bubble. Pure UI helper, server logic same.
    const history = messages.slice(0, -1);
    if (history.length === 0 || history[history.length - 1]?.role !== "user") return;
    setRetrying(true);
    try {
      const res = await askAi(history);
      setMessages([
        ...history,
        { role: "model", text: res.reply ?? `${res.error ?? "Gagal memproses."}` },
      ]);
    } catch {
      setMessages([...history, { role: "model", text: "Koneksi gagal — coba lagi." }]);
    } finally {
      setRetrying(false);
    }
  }

  const suggestions = role === "pegawai" ? PEGAWAI_SUGGESTIONS : OWNER_SUGGESTIONS;
  const lastIsError =
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "model" &&
    isErrorReply(messages[messages.length - 1]?.text ?? "");

  return (
    <section
      aria-label="Chat AI Asisten"
      /* Fills the viewport between the page header and the shell's bottom
         padding, so the transcript scrolls inside the card and the composer
         stays put — the behaviour people expect from a chat. It used to be
         capped with min-h/max-h percentages, which left a short card with a
         lot of dead space on a tall screen and pushed the composer off the
         fold on a short one. `min-h-0` is required for a flex child to be
         allowed to shrink below its content height. */
      className={
        embedded
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }
    >
      {/* Messages */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Riwayat chat"
        className="manager-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4"
      >
        {messages.length === 0 && (
          <div className="manager-rise rounded-2xl bg-zinc-100 p-3 text-center sm:p-5 dark:bg-zinc-800">
            <p className="text-[13px] font-extrabold tracking-tight text-zinc-900 sm:text-sm dark:text-zinc-50">
              {role === "pegawai"
                ? "Halo! Tanya jadwal atau stok di sini."
                : "Halo! Tanya data usaha kamu di sini."}
            </p>
            <div className="manager-scroll mt-2 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-3 sm:flex-wrap sm:justify-center sm:gap-2 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="manager-tap min-h-[36px] shrink-0 snap-start rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 sm:whitespace-normal dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              {role === "pegawai"
                ? "Akses: jadwal, stok, income harian"
                : "Akses: semua laporan + transaksi"}
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.role === "user";
          const showRetry =
            !mine && isErrorReply(m.text) && i === messages.length - 1 && !pending;
          return (
            <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <span
                  aria-hidden="true"
                  className="mt-1 mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  <Bot className="h-3.5 w-3.5" />
                </span>
              )}
              <div
                className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap sm:max-w-[78%] ${
                  mine
                    ? "rounded-2xl rounded-br-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "rounded-2xl rounded-bl-md border border-zinc-100 bg-zinc-100 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {mine ? m.text : renderReply(m.text, `m${i}`)}
                {showRetry && (
                  <button
                    type="button"
                    onClick={() => void retry()}
                    disabled={retrying}
                    className="manager-tap mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-white disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    {retrying ? "Mencoba lagi…" : "Coba lagi"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {pending && (
          <div className="flex justify-start">
            <span
              aria-hidden="true"
              className="mt-1 mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            >
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div className="rounded-2xl rounded-bl-md border border-zinc-100 bg-zinc-100 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800">
              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="manager-dot h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                <span className="manager-dot h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                <span className="manager-dot h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
              </span>
              <span className="sr-only">Asisten sedang cek data…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {lastIsError && !pending && (
        <p
          role="status"
          className="flex items-center gap-1.5 border-t border-amber-200 bg-amber-50 px-3.5 py-2 text-[11px] font-semibold text-amber-800 sm:px-4 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Gagal terhubung — periksa koneksi lalu tekan “Coba lagi”.
        </p>
      )}

      {/* Input — sticky, safe-area aware */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="border-t border-zinc-200 bg-white px-3 pt-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] sm:px-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onInput={(e) => resizeTextarea(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Tanya sesuatu… (Enter untuk kirim)"
            aria-label="Pertanyaan untuk asisten"
            disabled={pending || retrying}
            className="manager-scroll max-h-[120px] min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:bg-white focus:ring-2 focus:ring-zinc-200 focus:outline-none disabled:opacity-60 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:bg-zinc-900 dark:focus:ring-zinc-800"
          />
          <button
            type="submit"
            disabled={pending || retrying || !input.trim()}
            aria-label="Kirim pertanyaan"
            title="Kirim"
            className="manager-tap inline-flex h-[44px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white transition hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
          Ditenagai AgentsProxy · Data usaha kamu tetap aman
        </p>
      </form>
    </section>
  );
}
