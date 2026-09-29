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
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 transition dark:border-zinc-800 dark:bg-zinc-900">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="mt-1.5 text-xl leading-none font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 text-[11px] leading-snug font-medium text-zinc-500 dark:text-zinc-400">
          {sub}
        </p>
      )}
    </div>
  );
}
