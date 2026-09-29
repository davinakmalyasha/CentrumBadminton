import { redirect } from "next/navigation";
import { createClient } from "@/lib/proxy/client";

/**
 * Page-level guard for owner-only routes (laporan, pengeluaran, series,
 * blokir, pengaturan). Pegawai / guests are redirected to the dashboard.
 */
export async function requireOwnerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/app/login");
  }
  const { data } = await supabase.rpc("is_owner");
  if (data !== true) redirect("/app");
  return supabase;
}

export async function requireStaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/app/login");
  }
  const { data } = await supabase.rpc("is_staff");
  // is_staff returns true for any authenticated staff (owner or pegawai) via proxy
  if (data !== true) {
    redirect("/app/login");
  }
  return supabase;
}

export async function getRole(): Promise<"owner" | "pegawai"> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_owner");
  return data === true ? "owner" : "pegawai";
}
