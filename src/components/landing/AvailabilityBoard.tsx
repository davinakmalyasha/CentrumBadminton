"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, MessageCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addDaysISO,
  buildSlots,
  formatIDR,
  formatK,
  groupHours,
  hourLabel,
  type BusyInterval,
  type PricingInfo,
} from "@/lib/availability";
import { waLink } from "@/lib/constants";
import { getDict, type Lang } from "@/lib/i18n";
import Shuttlecock from "@/components/icons/Shuttlecock";

interface CourtLite {
  id: string;
  name: string;
}

const DATE_DAYS = 14;

// Intl.DateTimeFormat construction is the expensive part — cache formatters
// module-level instead of building ~45 per render (every slot tap re-renders).
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Jakarta", ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

export default function AvailabilityBoard({
  courts,
  pricing,
  initialBusy,
  todayStr,
  lang,
}: {
  courts: CourtLite[];
  pricing: PricingInfo;
  initialBusy: BusyInterval[];
  todayStr: string;
  lang: Lang;
}) {
  const t = getDict(lang);
  const [dateISO, setDateISO] = useState(todayStr);
  const [busy, setBusy] = useState<BusyInterval[]>(initialBusy);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // courtId -> selected starting hours
  const [selection, setSelection] = useState<Record<string, number[]>>({});

  const supabase = useMemo(() => createClient(), []);
  const dateRef = useRef(dateISO);

  useEffect(() => {
    dateRef.current = dateISO;
  }, [dateISO]);

  // Refetch busy intervals whenever the user picks a different date
  // (initial data comes server-rendered; no effect needed)
  const loadBusy = useCallback(
    async (d: string) => {
      try {
        const { data, error } = await supabase.rpc("get_day_busy", { p_date: d });
        if (error) throw error;
        setBusy(Array.isArray(data) ? (data as BusyInterval[]) : []);
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // Realtime updates — refetch current day on any booking/block change.
  // Single subscription for the component lifetime (current date read
  // from a ref, so switching dates doesn't tear down the channel).
  useEffect(() => {
    const channel = supabase
      .channel("landing-availability")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          setLoading(true);
          void loadBusy(dateRef.current);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "court_blocks" },
        () => {
          setLoading(true);
          void loadBusy(dateRef.current);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, loadBusy]);

  function toggle(courtId: string, hour: number) {
    setSelection((prev) => {
      const cur = prev[courtId] ?? [];
      const next = cur.includes(hour)
        ? cur.filter((h) => h !== hour)
        : [...cur, hour];
      return { ...prev, [courtId]: next };
    });
  }

  function pickDate(iso: string) {
    if (iso === dateISO) return;
    setLoading(true);
    setDateISO(iso);
    setSelection({});
    void loadBusy(iso);
  }

  const dates = useMemo(
    () => Array.from({ length: DATE_DAYS }, (_, i) => addDaysISO(todayStr, i)),
    [todayStr]
  );

  const locale = lang === "id" ? "id-ID" : "en-US";

  function dateLabelParts(iso: string) {
    const d = new Date(`${iso}T00:00:00+07:00`);
    const weekday = fmt(locale, { weekday: "short" }).format(d);
    const num = fmt(locale, { day: "numeric" }).format(d);
    const month = fmt(locale, { month: "short" }).format(d);
    return { weekday, num, month };
  }

  function longDateLabel(iso: string): string {
    const d = new Date(`${iso}T00:00:00+07:00`);
    return fmt(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(d);
  }

  const totalSelected = useMemo(() => {
    let sum = 0;
    for (const c of courts) {
      for (const h of selection[c.id] ?? []) {
        sum += h >= pricing.dayEndHour ? pricing.priceEvening : pricing.priceDay;
      }
    }
    return sum;
  }, [selection, courts, pricing]);

  const countSelected = Object.values(selection).reduce((a, b) => a + b.length, 0);

  const waHref = useMemo(() => {
    if (countSelected === 0) return "#jadwal";
    const lines: string[] = [];
    for (const c of courts) {
      const hours = selection[c.id] ?? [];
      if (hours.length === 0) continue;
      for (const [s, e] of groupHours(hours)) {
        let rangePrice = 0;
        for (let h = s; h < e; h++) {
          rangePrice +=
            h >= pricing.dayEndHour ? pricing.priceEvening : pricing.priceDay;
        }
        lines.push(
          t.availability.waSlotLine
            .replace("{court}", c.name)
            .replace("{date}", longDateLabel(dateISO))
            .replace("{time}", `${hourLabel(s)}–${hourLabel(e)}`)
            .replace("{price}", formatIDR(rangePrice))
        );
      }
    }
    const msg = t.availability.waMessage
      .replace("{slots}", lines.join("\n"))
      .replace("{total}", formatIDR(totalSelected));
    return waLink(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, courts, pricing, dateISO, totalSelected, countSelected, lang]);

  return (
    <section id="jadwal" className="scroll-mt-20 bg-ice-100 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 text-center">
          <h2 className="flex items-center justify-center gap-3 text-2xl font-black tracking-tight text-navy-900 md:text-4xl">
            <CalendarDays
              className="h-5 w-5 text-sky-brand-500 md:h-6 md:w-6"
              strokeWidth={1.75}
            />
            {t.availability.title}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-navy-700/70 md:text-base">
            {t.availability.subtitle}
          </p>
        </div>

        {/* Date strip */}
        <div className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dates.map((iso, i) => {
            const { weekday, num } = dateLabelParts(iso);
            const label =
              i === 0 ? t.availability.today : i === 1 ? t.availability.tomorrow : weekday;
            const active = iso === dateISO;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => pickDate(iso)}
                className={`min-w-[68px] flex-shrink-0 rounded-2xl border px-3 py-2.5 text-center transition ${
                  active
                    ? "border-sky-brand-500 bg-navy-800 text-white shadow-md"
                    : "border-sky-brand-200 bg-white text-navy-800 hover:border-sky-brand-300 hover:bg-ice-200"
                }`}
              >
                <span
                  className={`block text-[10px] font-semibold uppercase tracking-wide ${
                    active ? "text-sky-brand-200" : "text-sky-brand-500"
                  }`}
                >
                  {label}
                </span>
                <span className="block text-lg font-black leading-tight">{num}</span>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-navy-700/70">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md border border-emerald-500 bg-emerald-100" />
            {t.availability.legendAvailable}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-navy-800/15" />
            {t.availability.legendBooked}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-neutral-200" />
            {t.availability.legendPast}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-red-100" />
            {t.availability.legendBlocked}
          </span>
          <span className="hidden sm:inline">· {t.availability.normalNote}</span>
          <span className="hidden sm:inline">· {t.availability.peakNote}</span>
        </div>

        {loadError && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
            <span>{lang === "id" ? "Gagal memuat jadwal." : "Failed to load schedule."}</span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadBusy(dateRef.current);
              }}
              className="rounded-lg border border-red-300 px-2 py-1 font-bold text-red-600 hover:bg-red-100"
            >
              {lang === "id" ? "Coba lagi" : "Retry"}
            </button>
          </div>
        )}

        {/* Courts */}
        <div className={`mt-6 space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {courts.map((c) => {
            const slots = buildSlots(pricing, busy, c.id, dateISO, todayStr);
            const sel = selection[c.id] ?? [];
            return (
              <div key={c.id} className="rounded-3xl border border-sky-brand-200 bg-white p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-extrabold text-navy-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-500/10">
                      <Shuttlecock className="h-4 w-4 text-accent-500" />
                    </span>
                    {c.name}
                  </h3>
                  {sel.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-brand-400/10 px-2.5 py-1 text-xs font-bold text-sky-brand-600">
                      <Check className="h-3.5 w-3.5" />
                      {sel.length}
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
                  {slots.map((s) => {
                    const selected = sel.includes(s.hour);
                    const base =
                      "min-w-[62px] flex-shrink-0 rounded-xl border px-2 py-2.5 text-center transition select-none";
                    let cls: string;
                    if (selected) {
                      cls = "border-sky-brand-600 bg-sky-brand-500 text-white shadow";
                    } else if (s.status === "available") {
                      cls =
                        s.isEvening === false
                          ? "border-emerald-200 bg-emerald-50 text-navy-800 hover:border-emerald-400 hover:bg-emerald-100 cursor-pointer"
                          : "border-amber-200 bg-amber-50 text-navy-800 hover:border-amber-400 hover:bg-amber-100 cursor-pointer";
                    } else if (s.status === "booked") {
                      cls = "border-transparent bg-navy-800/10 text-navy-800/40 line-through cursor-not-allowed";
                    } else if (s.status === "past") {
                      cls = "border-transparent bg-neutral-100 text-neutral-400 cursor-default";
                    } else {
                      cls = "border-transparent bg-red-50 text-red-300 line-through cursor-not-allowed";
                    }
                    const clickable = s.status === "available";
                    return (
                      <button
                        key={s.hour}
                        type="button"
                        disabled={!clickable}
                        onClick={() => toggle(c.id, s.hour)}
                        className={`${base} ${cls}`}
                        title={`${hourLabel(s.hour)} · ${formatIDR(s.price)}`}
                      >
                        <span className="block text-xs font-bold leading-none">
                          {hourLabel(s.hour)}
                        </span>
                        <span className="mt-1 block text-[10px] font-medium opacity-70">
                          {formatK(s.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spacer so the sticky bar never covers the footer */}
      {countSelected > 0 && <div className="h-24" aria-hidden="true" />}

      {/* Sticky booking bar */}
      {countSelected > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-navy-800/10 bg-navy-800 p-3 pl-4 shadow-2xl shadow-navy-800/30">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sky-brand-200">
                {t.availability.selectedTitle}:{" "}
                <span className="font-bold text-white">{countSelected}</span> slot
              </p>
              <p className="truncate text-sm font-black text-white">
                {t.availability.totalPrice}: {formatIDR(totalSelected)}
              </p>
            </div>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-accent-600/30 transition hover:bg-accent-600"
            >
              <MessageCircle className="h-4 w-4" />
              {t.availability.bookWa}
            </a>
            <button
              type="button"
              onClick={() => setSelection({})}
              className="flex-shrink-0 rounded-xl p-2 text-sky-brand-200 transition hover:text-white"
              aria-label={t.common.clearSelection}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
