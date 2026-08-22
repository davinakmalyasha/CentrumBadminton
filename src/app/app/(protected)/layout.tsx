import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/app/AppShell";
import { RoleProvider } from "@/components/app/RoleContext";
import type { Profile } from "@/lib/types";

/**
 * Real session validation + role loading.
 * Combined with the optimistic check in src/proxy.ts this guards /app/*.
 * Sessions are permanent — no idle timeout; logout is manual only.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  let profile: Profile | null = null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  profile = data as Profile | null;

  if (profile && !profile.is_active) {
    redirect("/app/login");
  }

  return (
    <RoleProvider role={profile?.role ?? "pegawai"}>
      <AppShell
        displayName={profile?.full_name || user.email || "Pengguna"}
        roleLabel={profile?.role === "owner" ? "Owner" : "Pegawai"}
      >
        {children}
      </AppShell>
    </RoleProvider>
  );
}
