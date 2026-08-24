import type { ComponentType } from "react";
import type { BookingStatus } from "@/lib/types";
import Shuttlecock from "@/components/icons/Shuttlecock";

const MAP: Record<
  BookingStatus,
  { label: string; cls: string; Icon?: ComponentType<{ className?: string }> }
> = {
  pending: { label: "Menunggu", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  confirmed: { label: "Confirmed", cls: "bg-sky-brand-400/10 text-sky-brand-600 border-sky-brand-200" },
  checked_in: {
    label: "Main",
    cls: "bg-emerald-100 text-emerald-700 border-emerald-200 animate-pulse",
    Icon: Shuttlecock,
  },
  completed: { label: "Selesai", cls: "bg-navy-800/10 text-navy-800 border-navy-800/20" },
  cancelled: { label: "Batal", cls: "bg-red-50 text-red-500 border-red-200" },
  no_show: { label: "No-show", cls: "bg-red-100 text-red-600 border-red-300" },
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const m = MAP[status] ?? MAP.confirmed;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.cls}`}
    >
      {m.Icon && <m.Icon className="h-3 w-3" />}
      {m.label}
    </span>
  );
}
