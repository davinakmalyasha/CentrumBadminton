import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Auth cookies carry JWTs — never ship them over plain HTTP in prod. */
const cookieOptions = {
  secure: process.env.NODE_ENV === "production",
};

/**
 * Server-side Supabase client for Server Components, Server Actions and
 * Route Handlers. Uses the cookie store so sessions persist permanently
 * (auto-refresh, no idle timeout) until the user logs out manually.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore because the
            // proxy refreshes sessions before page render.
          }
        },
      },
    }
  );
}
