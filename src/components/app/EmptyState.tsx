// Intentionally NOT a client component. These render static markup, and
// `firstError` has to be callable from Server Components — pages run their
// reads on the server and pass the result here as a prop.
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared empty / unavailable states.
 *
 * These exist because the data layer used to convert EVERY transport
 * failure — unreachable proxy, 401, 500, timeout — into an empty list.
 * An outage therefore looked exactly like "no data yet" on every screen,
 * and a brand-new tenant looked like a broken app. Now that reads report
 * their error, these two components tell the two cases apart.
 *
 * Visual language matches blokir's existing empty state so the app stays
 * consistent: dashed 2xl border on a white/zinc card, short lowercase copy.
 */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The proxy could not be reached, or answered with an error. Deliberately
 * NOT styled like EmptyState: an outage is a fault the user can act on
 * (wait, check the backend, reload), not an absence of data.
 */
export function DataUnavailable({ detail }: { detail?: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10"
    >
      <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
        Data tidak bisa dimuat
      </p>
      <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">
        Server data sedang tidak bisa dihubungi. Ini bukan berarti tidak ada
        data — coba muat ulang sebentar.
      </p>
      {detail ? (
        <p className="mt-2 font-mono text-[11px] break-all text-amber-700/70 dark:text-amber-300/70">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Picks the right state for a query result in one call, so a page cannot
 * accidentally render "no data" for a failed request.
 *
 *   const err = firstError(bookingsRes, courtsRes);
 *   if (err) return <DataUnavailable detail={err} />
 */
export function firstError(...results: { error: unknown }[]): string | null {
  for (const r of results) {
    if (r.error) {
      const e = r.error as { message?: string; status?: number };
      return e.status ? `${e.status} · ${e.message ?? "error"}` : (e.message ?? "error");
    }
  }
  return null;
}

/** Wrap page children with the unavailable banner when a read failed. */
export function DataGuard({
  error,
  children,
}: {
  error: string | null;
  children: ReactNode;
}) {
  if (error) return <DataUnavailable detail={error} />;
  return <>{children}</>;
}
