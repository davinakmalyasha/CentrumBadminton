import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AiChat from "@/components/app/AiChat";
import ClosingReportCard from "@/components/app/ClosingReportCard";

export const metadata = { title: "AI Asisten · Centrum Manager" };

export default async function AiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "owner") redirect("/app");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-black text-navy-900">🤖 Asisten Centrum</h1>
        <p className="text-xs font-semibold text-navy-700/60">
          Tanya apa saja soal usaha — dijawab dari data asli (Gemini).
        </p>
      </div>

      <ClosingReportCard />
      <AiChat />
    </div>
  );
}
