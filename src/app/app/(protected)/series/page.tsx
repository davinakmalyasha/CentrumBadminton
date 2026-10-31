import { requireOwnerPage } from "@/lib/guard";
import { todayISO } from "@/lib/availability";
import { Users } from "lucide-react";
import Shuttlecock from "@/components/icons/Shuttlecock";
import { EmptyState } from "@/components/app/EmptyState";
import SeriesCreate from "@/components/app/SeriesCreate";
import SeriesControls from "@/components/app/SeriesControls";

export const metadata = { title: "Member · Centrum Manager" };

type SeriesRow = {
  id: string;
  court_id: string;
  customer_name: string;
  customer_phone: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  status: string;
};

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default async function SeriesPage() {
  const supabase = await requireOwnerPage();
  const today = todayISO();

  const [seriesRes, upcomingRes, courtsRes] = await Promise.all([
    supabase
      .from("recurring_series")
      .select("*")
      .neq("status", "ended")
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("recurring_series_id,date")
      .gte("booking_date", today)
      .neq("status", "cancelled")
      .neq("status", "no_show")
      .not("recurring_series_id", "is", null)
      // The row cap is 500 and this counts in memory. Without asking for
      // headroom, a venue with a lot of weekly play undercounts silently and
      // the number is simply wrong.
      .limit(2000),
    supabase.from("courts").select("id,name").eq("is_active", true).order("sort_order"),
  ]);

  const series = (seriesRes.data ?? []) as SeriesRow[];
  const courtList = (courtsRes.data ?? []) as Array<{ id: string; name: string }>;
  // Same trap as the Blokir page: `courts(name)` as an embedded relation is
  // a no-op in this connector, so every row rendered with an empty court
  // name. The list is already loaded, so resolve from it.
  const courtName = (cid: string) =>
    courtList.find((c) => c.id === cid)?.name ?? "Lapangan";
  const upcoming =
    (upcomingRes.data ?? []) as Array<{
      recurring_series_id: string | null;
      // The proxy returns `date`; booking_date is only the connector's name
      // for it on writes and in filters. Typing it as booking_date here let
      // a read return undefined and the grouping below quietly mis-count.
      date: string;
    }>;
  // If the proxy hit its cap, the counts below are a floor, not a total.
  // Say so rather than presenting a partial count as the whole thing.
  const upcomingTruncated = upcomingRes.truncated === true;

  const futureCount = new Map<string, number>();
  for (const b of upcoming) {
    if (!b.recurring_series_id) continue;
    futureCount.set(
      b.recurring_series_id,
      (futureCount.get(b.recurring_series_id) ?? 0) + 1
    );
  }

  return (
    <div className="space-y-4">
      <SeriesCreate courts={courtList} today={today} />

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Berjalan ({series.length})
        </h2>
        {series.length === 0 ? (
          <EmptyState
            title="Belum ada member aktif"
            body="Tekan “Member baru” di atas untuk membuat jadwal rutin mingguan — slotnya dibuat otomatis, tanpa booking satu per satu."
          />
        ) : (
          <ul className="space-y-2.5">
            {series.map((s) => {
              const count = futureCount.get(s.id) ?? 0;
              return (
                <li key={s.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-zinc-900 dark:text-zinc-50">
                        <Users className="mr-1 inline h-3 w-3" />
                        {s.customer_name}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 align-middle text-[9px] font-bold uppercase ${
                            s.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : s.status === "paused"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-neutral-200 text-neutral-600"
                          }`}
                        >
                          {s.status}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                        {DAY_NAMES[s.weekday]} · {String(s.start_time).slice(0, 5)}–
                        {String(s.end_time).slice(0, 5)} ·{" "}
                        <Shuttlecock className="mr-1 inline h-3 w-3" />
                        {courtName(s.court_id)}
                        {s.end_date
                          ? ` · s.d. ${new Intl.DateTimeFormat("id-ID", {
                              day: "numeric",
                              month: "short",
                              timeZone: "Asia/Jakarta",
                            }).format(new Date(`${s.end_date}T00:00:00+07:00`))}`
                          : ""}{" "}
                        ·{" "}
                        <span className="font-bold text-zinc-600 dark:text-zinc-300">
                          {count} jadwal ke depan
                        </span>
                        {upcomingTruncated ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {" "}
                            (Sebagian terpotong — angka mungkin kurang)
                          </span>
                        ) : null}
                        </p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <SeriesControls seriesId={s.id} status={s.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
