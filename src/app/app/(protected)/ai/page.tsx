import Link from "next/link";
import { requireStaffPage, getRole } from "@/lib/guard";
import { ArrowLeft, Bot } from "lucide-react";
import AiChat from "@/components/app/AiChat";

export const metadata = { title: "AI Asisten · Centrum Manager" };

export default async function AiPage() {
  await requireStaffPage();
  const role = await getRole();

  return (
    /* A chat page should own the viewport: header pinned, transcript
       scrolling, composer always reachable. The 9rem/8rem deductions cover
       the shell's pt/pb plus this header, so the card ends flush with the
       bottom nav on mobile and the viewport on desktop. */
    <div className="manager-rise flex h-[calc(100dvh-9rem)] min-h-[26rem] flex-col gap-3 lg:h-[calc(100dvh-8rem)]">
      <div className="space-y-1">
        <Link
          href="/app"
          className="manager-tap inline-flex min-h-[32px] items-center gap-1 rounded-lg text-[11px] font-bold text-zinc-500 transition hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Beranda
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Bot className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base leading-tight font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              Asisten Centrum
            </h1>
            <p className="truncate text-[11px] font-medium text-zinc-500 sm:whitespace-normal dark:text-zinc-400">
              {role === "owner"
                ? "Tanya apa saja soal usaha — dijawab dari data asli via AgentsProxy"
                : "Tanya jadwal, stok, atau laporan harian — via AgentsProxy"}
            </p>
          </div>
        </div>
      </div>

      {/* The Closing Report card used to sit directly above the chat, which
          made this page read as "chat + a form bolted on" and pushed the
          actual conversation below the fold. It is a report generator, not a
          chat feature, so it now lives with the other owner reports in
          /app/laporan. This page is just a chat. */}
      <AiChat role={role} />
    </div>
  );
}
