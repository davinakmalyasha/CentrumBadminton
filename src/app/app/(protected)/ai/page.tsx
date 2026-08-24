import { requireOwnerPage } from "@/lib/guard";
import { Bot } from "lucide-react";
import AiChat from "@/components/app/AiChat";
import ClosingReportCard from "@/components/app/ClosingReportCard";

export const metadata = { title: "AI Asisten · Centrum Manager" };

export default async function AiPage() {
  await requireOwnerPage();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black text-navy-900">
          <Bot className="h-5 w-5" strokeWidth={1.75} /> Asisten Centrum
        </h1>
        <p className="text-xs font-semibold text-navy-700/60">
          Tanya apa saja soal usaha — dijawab dari data asli (Gemini).
        </p>
      </div>

      <ClosingReportCard />
      <AiChat />
    </div>
  );
}
