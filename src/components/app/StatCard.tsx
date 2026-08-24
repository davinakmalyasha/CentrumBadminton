import type { ComponentType, ReactNode } from "react";

export default function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-sky-brand-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-700/50">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="mt-1.5 text-xl font-black leading-none text-navy-900">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] font-medium text-navy-700/60">{sub}</p>}
    </div>
  );
}
