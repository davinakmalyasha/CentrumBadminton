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
  courtName: string;
  phone: string | null;
}

const STATUS_STYLE: Record<string, { bar: string; chip: string }> = {
  pending: {
    bar: "bg-amber-400/80 border-amber-500",
    chip: "bg-amber-100 text-amber-700",
  },
  confirmed: {
    bar: "bg-sky-brand-400/85 border-sky-brand-500 text-white",
    chip: "bg-sky-brand-400/15 text-sky-brand-600",
  },
  checked_in: {
    bar: "bg-emerald-500/90 border-emerald-600 text-white",
    chip: "bg-emerald-100 text-emerald-700",
  },
  completed: {
    bar: "bg-navy-800/25 border-navy-800/40",
    chip: "bg-navy-800/10 text-navy-800",
  },
  no_show: { bar: "bg-red-200 border-red-300", chip: "bg-red-100 text-red-500" },
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
    <div className="overflow-hidden rounded-2xl border border-sky-brand-200 bg-white">
      <div className="overflow-x-auto">
        <div
          className="grid border-b border-sky-brand-200 bg-ice-100"
          style={{
            gridTemplateColumns: `44px repeat(${courts.length}, minmax(96px,1fr))`,
          }}
        >
          <div />
          {courts.map((c) => (
            <div
              key={c.id}
              className="py-2 text-center text-[11px] font-black uppercase tracking-wide text-sky-brand-600"
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
              <div className="pr-1 text-right text-[10px] font-semibold text-navy-700/40">
                {String(h).padStart(2, "0")}
              </div>
              {courts.map((c) => {
                const block = blocks.find(
                  (b) => b.courtId === c.id && h >= b.startHour && h < b.endHour
                );
                if (block && block.startHour === h) {
                  const style = STATUS_STYLE[block.status] ?? STATUS_STYLE.confirmed;
                  const spanH = (block.endHour - block.startHour) * ROW_H - 4;
                  return (
                    <div key={c.id} className="relative" style={{ height: ROW_H }}>
                      <div
                        className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 ${style.bar}`}
                        style={{ height: spanH }}
                        title={`${block.label} · ${formatIDR(block.price)}`}
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
                      className={`mx-0.5 flex h-full items-center justify-center rounded-md border border-dashed text-[11px] transition hover:bg-ice-200 ${
                        h >= pricing.dayEndHour
                          ? "border-amber-300 text-amber-500"
                          : "border-emerald-300 text-emerald-400"
                      }`}
                      title={`Booking ${hourLabel(h)} · ${c.name}`}
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

      <div className="border-t border-sky-brand-200 bg-ice-50 px-3 py-2 text-[10px] font-medium text-navy-700/60">
        Tap <span className="font-bold text-emerald-500">+</span> untuk buat booking ·{" "}
        {formatIDR(pricing.priceDay)}/jam siang · {formatIDR(pricing.priceEvening)}
        /jam malam
      </div>
    </div>
  );
}
