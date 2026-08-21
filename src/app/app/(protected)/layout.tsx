import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
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

  const displayName = profile?.full_name || user.email || "Pengguna";
  const roleLabel =
    profile?.role === "owner" ? "Owner" : profile?.role === "pegawai" ? "Pegawai" : "-";

  return (
    <div className="min-h-svh bg-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white">
              CB
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Centrum Badminton Arena
              </p>
              <p className="text-xs text-neutral-500">
                {displayName} · {roleLabel}
              </p>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Keluar
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
