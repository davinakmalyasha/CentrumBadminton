"use client";

import { useState } from "react";
import { useActionState } from "react";
import Image from "next/image";
import {
  CircleAlert,
  Clock,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-neutral-950 px-4 py-10">
      {/* ---- ambient background (decorative only) ---- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="login-orb login-orb-a absolute -top-32 -left-32 h-96 w-96 rounded-full bg-orange-600/25 blur-[110px]" />
        <div className="login-orb login-orb-b absolute -right-32 -bottom-32 h-[28rem] w-[28rem] rounded-full bg-sky-600/15 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,122,0,0.12),transparent)]" />
      </div>

      <div className="login-enter relative w-full max-w-sm">
        {/* ---- card ---- */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {/* top accent line */}
          <div
            aria-hidden="true"
            className="h-1 w-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400"
          />

          <div className="px-6 pt-7 pb-6 sm:px-7">
            {/* logo */}
            <div className="mb-5 text-center">
              <div className="relative mx-auto mb-4 h-[72px] w-[72px]">
                <div
                  aria-hidden="true"
                  className="absolute -inset-2 rounded-full bg-orange-500/20 blur-lg"
                />
                <Image
                  src="/centrumLOGO-circle.png"
                  alt="Logo Centrum Badminton Arena"
                  width={72}
                  height={72}
                  priority
                  className="relative h-[72px] w-[72px] rounded-full object-cover ring-2 ring-orange-500/50 shadow-[0_8px_28px_-6px_rgba(255,122,0,0.55)]"
                />
                <span
                  aria-hidden="true"
                  className="absolute right-0.5 bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-neutral-900 bg-emerald-500"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                </span>
              </div>

              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-widest text-orange-300 uppercase">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Portal Staff
              </p>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Centrum Badminton Arena
              </h1>
              <p className="mt-1 text-sm text-neutral-400">
                Masuk untuk mengelola booking &amp; pembayaran
              </p>
            </div>

            <form action={formAction} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-neutral-300"
                >
                  Email
                </label>
                <div className="group relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 h-[18px] w-[18px] -translate-y-1/2 text-neutral-500 transition-colors group-focus-within:text-orange-400"
                  />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="nama@email.com"
                    aria-invalid={Boolean(state.error)}
                    aria-describedby={state.error ? "login-error" : undefined}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 py-2.5 pr-3 pl-10 text-[15px] text-white placeholder:text-neutral-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-neutral-300"
                >
                  Kata Sandi
                </label>
                <div className="group relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 h-[18px] w-[18px] -translate-y-1/2 text-neutral-500 transition-colors group-focus-within:text-orange-400"
                  />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    aria-invalid={Boolean(state.error)}
                    aria-describedby={
                      state.error
                        ? `login-error${capsOn ? " caps-hint" : ""}`
                        : capsOn
                          ? "caps-hint"
                          : undefined
                    }
                    onKeyUp={(e) => {
                      const caps =
                        typeof e.getModifierState === "function" &&
                        e.getModifierState("CapsLock");
                      setCapsOn(caps);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "CapsLock" &&
                        typeof e.getModifierState === "function"
                      ) {
                        setCapsOn(e.getModifierState("CapsLock"));
                      }
                    }}
                    onBlur={() => setCapsOn(false)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 py-2.5 pr-11 pl-10 text-[15px] text-white placeholder:text-neutral-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                    aria-label={
                      showPassword
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                    }
                    title={
                      showPassword
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                    }
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg p-2 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200 focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:outline-none active:scale-95"
                  >
                    {showPassword ? (
                      <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {capsOn && (
                  <p
                    id="caps-hint"
                    className="login-fade-in mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-400"
                    role="status"
                  >
                    <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    Caps Lock aktif — periksa huruf besar/kecil.
                  </p>
                )}
              </div>

              {state.error && (
                <div
                  key={state.error}
                  id="login-error"
                  role="alert"
                  aria-live="polite"
                  className="login-shake flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-3 shadow-[0_8px_24px_-12px_rgba(239,68,68,0.5)]"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                    <CircleAlert
                      className="h-4 w-4 text-red-400"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-red-300">
                      Login gagal
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-red-400/90">
                      {state.error}
                    </span>
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 px-4 py-2.5 font-semibold text-white shadow-[0_12px_30px_-8px_rgba(255,122,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:from-orange-400 hover:to-orange-600 hover:shadow-[0_16px_36px_-8px_rgba(255,122,0,0.7)] focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-[0_12px_30px_-8px_rgba(255,122,0,0.6)]"
              >
                {/* shine sweep */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full group-disabled:translate-x-[-100%]"
                />
                <span className="relative flex items-center justify-center gap-2">
                  {pending ? (
                    <>
                      <LoaderCircle
                        className="h-[18px] w-[18px] animate-spin"
                        aria-hidden="true"
                      />
                      Memproses…
                    </>
                  ) : (
                    <>
                      <LogIn
                        className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                      Masuk
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* trust row */}
            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
              <ShieldCheck
                className="h-3.5 w-3.5 text-emerald-500/80"
                aria-hidden="true"
              />
              <span>Sesi aman · Khusus staff &amp; owner</span>
            </div>
          </div>
        </div>

        {/* footer meta */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-neutral-500">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <p>Buka setiap hari 07.00–23.00 WIB · Centrum Badminton Arena</p>
        </div>
      </div>

      {/* scoped keyframes — decorative only, no logic impact */}
      <style>{`
        .login-enter { animation: login-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes login-rise {
          from { opacity: 0; transform: translateY(14px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .login-orb-a { animation: login-drift-a 9s ease-in-out infinite alternate; }
        .login-orb-b { animation: login-drift-b 11s ease-in-out infinite alternate; }
        @keyframes login-drift-a {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(40px, 30px) scale(1.08); }
        }
        @keyframes login-drift-b {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(-36px, -28px) scale(1.06); }
        }
        .login-shake { animation: login-shake 0.4s ease, login-fade 0.25s ease both; }
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes login-fade {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-fade-in { animation: login-fade 0.2s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .login-enter, .login-orb-a, .login-orb-b, .login-shake, .login-fade-in {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
