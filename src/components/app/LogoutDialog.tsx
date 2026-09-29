"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { LogOut, X } from "lucide-react";
import { signOut } from "@/app/app/(protected)/actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      autoFocus
      className="manager-tap inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {pending ? "Keluar…" : "Ya, keluar"}
    </button>
  );
}

/** Modal konfirmasi keluar. Aksi signOut asli tetap dipakai tanpa perubahan. */
export default function LogoutDialog({
  open,
  displayName,
  roleLabel,
  onClose,
}: {
  open: boolean;
  displayName: string;
  roleLabel: string;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="logout-title"
      aria-describedby="logout-desc"
    >
      <button
        type="button"
        aria-label="Tutup dialog keluar"
        onClick={onClose}
        className="manager-backdrop fixed inset-0 cursor-default bg-zinc-950/50 backdrop-blur-[2px] dark:bg-black/60"
      />
      <div className="manager-modal relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2
              id="logout-title"
              className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Keluar dari akun?
            </h2>
            <p
              id="logout-desc"
              className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
            >
              {displayName} · {roleLabel}. Kamu harus masuk lagi untuk mengelola
              booking &amp; pembayaran.
            </p>
          </div>
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            aria-label="Batal keluar"
            className="manager-tap flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <form action={signOut} className="flex gap-2 px-5 pt-4 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="manager-tap inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Batal
          </button>
          <ConfirmButton />
        </form>
      </div>
    </div>
  );
}
