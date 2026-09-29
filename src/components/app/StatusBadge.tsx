import type { ComponentType } from "react";
import type { BookingStatus } from "@/lib/types";
import Shuttlecock from "@/components/icons/Shuttlecock";

const MAP: Record<
  BookingStatus,
  { label: string; cls: string; Icon?: ComponentType<{ className?: string }> }
> = {
  pending: {
    label: "Menunggu",
    cls: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300",
  },
  confirmed: {
    label: "Confirmed",
    cls: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  },
  checked_in: {
    label: "Main",
    cls: "animate-pulse border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300",
    Icon: Shuttlecock,
  },
  completed: {
    label: "Selesai",
    cls: "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  },
  cancelled: {
    label: "Batal",
    cls: "border-red-200 bg-red-50 text-red-500 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  },
  no_show: {
    label: "No-show",
    cls: "border-red-300 bg-red-100 text-red-600 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300",
  },
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const m = MAP[status] ?? MAP.confirmed;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${m.cls}`}
    >
      {m.Icon && <m.Icon className="h-3 w-3" />}
      {m.label}
    </span>
  );
}
