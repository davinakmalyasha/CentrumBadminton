import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // Matches the server clients — tokens never persist over plain HTTP
        secure: process.env.NODE_ENV === "production",
      },
    }
  );
}
