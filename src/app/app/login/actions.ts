"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export type SignInState = { error: string | null };

export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email dan kata sandi wajib diisi." };
  }

  // Brute-force guard: 5 attempts / minute / IP+email
  const h = await headers();
  const rl = rateLimit(`login:${clientIp(h)}:${email.toLowerCase()}`, 5, 60_000);
  if (!rl.ok) {
    return { error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSec} detik.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Email atau kata sandi salah." };
  }

  // redirect() throws internally — must not be inside try/catch
  redirect("/app");
}
