import Link from "next/link";
import { requireStaffPage, getRole } from "@/lib/guard";
import { ArrowLeft, Bot } from "lucide-react";
import AiChat from "@/components/app/AiChat";
import ClosingReportCard from "@/components/app/ClosingReportCard";

export const metadata = { title: "AI Asisten · Centrum Manager" };

export default async function AiPage() {
  await requireStaffPage();
  const role = await getRole();

  return (
    <div className="manager-rise space-y-3">
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

      {role === "owner" && <ClosingReportCard />}
      <AiChat role={role} />
    </div>
  );
}
