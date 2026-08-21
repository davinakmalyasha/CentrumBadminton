"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-svh items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-2xl font-black text-white">
            CB
          </div>
          <h1 className="text-xl font-bold text-white">
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
              className="mb-1 block text-sm font-medium text-neutral-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="nama@email.com"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-600 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-neutral-300"
            >
              Kata Sandi
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-600 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {pending ? "Memproses…" : "Masuk"}
          </button>
        </form>
      </div>
    </main>
  );
}
