import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Page-level guard for owner-only routes (laporan, pengeluaran, series,
 * blokir, pengaturan). Pegawai / guests are redirected to the dashboard.
 */
export async function requireOwnerPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_owner");
  if (data !== true) redirect("/app");
  return supabase;
}
