import Link from "next/link";
import { formatIDR, hourLabel, type PricingInfo } from "@/lib/availability";
import Shuttlecock from "@/components/icons/Shuttlecock";

export interface Block {
  id: string;
  courtId: string;
  startHour: number;
  endHour: number;
  label: string;
  status: string;
  price: number;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-400/80 border-amber-500",
  confirmed: "bg-zinc-500/85 border-zinc-600 text-white dark:bg-zinc-400 dark:border-zinc-300 dark:text-zinc-950",
  checked_in: "bg-emerald-500/90 border-emerald-600 text-white",
  completed: "bg-zinc-400/25 border-zinc-500/40 dark:bg-zinc-600/30 dark:border-zinc-500/40",
  no_show: "bg-red-200 border-red-300",
  blocked: "bg-red-100 border-red-300 text-red-600",
};

export default function TimelineGrid({
  courts,
  blocks,
  pricing,
  dateISO,
}: {
  courts: Array<{ id: string; name: string }>;
  blocks: Block[];
  pricing: PricingInfo;
  dateISO: string;
}) {
  const hours = Array.from(
    { length: pricing.closeHour - pricing.openHour },
    (_, i) => pricing.openHour + i
  );
  const ROW_H = 40; // px per hour — 40px keeps tap targets near 44px guideline

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="overflow-x-auto">
        <div
          className="grid border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800"
          style={{
            gridTemplateColumns: `44px repeat(${courts.length}, minmax(96px,1fr))`,
          }}
        >
          <div />
          {courts.map((c) => (
            <div
              key={c.id}
              className="py-2 text-center text-[11px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
            >
              {c.name}
            </div>
          ))}
        </div>

        <div className="p-2">
          {/* Hour rows */}
          {hours.map((h) => (
            <div
              key={h}
              className="grid items-center"
              style={{
                gridTemplateColumns: `44px repeat(${courts.length}, minmax(96px,1fr))`,
                height: ROW_H,
              }}
            >
              <div className="pr-1 text-right text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                {String(h).padStart(2, "0")}
              </div>
              {courts.map((c) => {
                const block = blocks.find(
                  (b) => b.courtId === c.id && h >= b.startHour && h < b.endHour
                );
                if (block && block.startHour === h) {
                  const style = STATUS_STYLE[block.status] ?? STATUS_STYLE.confirmed;
                  const spanH = (block.endHour - block.startHour) * ROW_H - 4;
                  const isBlocked = block.status === "blocked";
                  return (
                    <div key={c.id} className="relative" style={{ height: ROW_H }}>
                      <div
                        className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 ${style}`}
                        style={{ height: spanH }}
                        title={`${block.label}${!isBlocked ? ` · ${formatIDR(block.price)}` : ""}`}
                      >
                        <p className="truncate pt-1 text-[10px] font-bold leading-tight">
                          {block.label}{" "}
                          {block.status === "checked_in" && (
                            <Shuttlecock className="inline-block h-3 w-3 align-[-2px]" />
                          )}
                        </p>
                      </div>
                    </div>
                  );
                }
                if (block) {
                  // continuation row of a multi-hour block — render spacer
                  return <div key={c.id} style={{ height: ROW_H }} />;
                }
                return (
                  <div key={c.id} style={{ height: ROW_H }}>
                    <Link
                      href={`/app/booking/baru?date=${dateISO}&court=${c.id}&hour=${h}`}
                      className={`manager-tap mx-0.5 flex h-full items-center justify-center rounded-md border border-dashed text-[11px] transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                        h >= pricing.dayEndHour
                          ? "border-amber-300 text-amber-500"
                          : "border-emerald-300 text-emerald-400"
                      }`}
                      title={`Booking ${hourLabel(h)} · ${c.name}`}
                      aria-label={`Buat booking ${hourLabel(h)} di ${c.name}`}
                    >
                      +
                    </Link>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Tap <span className="font-bold text-emerald-500">+</span> untuk buat booking ·{" "}
        {formatIDR(pricing.priceDay)}/jam siang · {formatIDR(pricing.priceEvening)}
        /jam malam
      </div>
    </div>
  );
}
