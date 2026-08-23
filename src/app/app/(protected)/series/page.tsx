import { requireOwnerPage } from "@/lib/guard";
import { todayISO } from "@/lib/availability";
import SeriesForm from "@/components/app/SeriesForm";
import SeriesControls from "@/components/app/SeriesControls";

export const metadata = { title: "Langganan · Centrum Manager" };

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
  courts: { name: string } | null;
};

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default async function SeriesPage() {
  const supabase = await requireOwnerPage();
  const today = todayISO();

  const [seriesRes, upcomingRes, courtsRes] = await Promise.all([
    supabase
      .from("recurring_series")
      .select("*, courts(name)")
      .neq("status", "ended")
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("recurring_series_id,booking_date")
      .gte("booking_date", today)
      .not("recurring_series_id", "is", null),
    supabase.from("courts").select("id,name").eq("is_active", true).order("sort_order"),
  ]);

  const series = (seriesRes.data ?? []) as SeriesRow[];
  const upcoming =
    (upcomingRes.data ?? []) as Array<{
      recurring_series_id: string | null;
      booking_date: string;
    }>;

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
      <div>
        <h1 className="text-lg font-black text-navy-900">🔁 Langganan Mingguan</h1>
        <p className="text-xs font-semibold text-navy-700/60">
          Komunitas rutin — slot dibuat otomatis setiap minggu.
        </p>
      </div>

      <SeriesForm
        courts={(courtsRes.data ?? []) as Array<{ id: string; name: string }>}
        today={today}
      />

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-navy-700/60">
          Berjalan ({series.length})
        </h2>
        {series.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-sky-brand-300 bg-white p-6 text-center text-sm text-navy-700/50">
            Belum ada langganan aktif.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {series.map((s) => {
              const count = futureCount.get(s.id) ?? 0;
              return (
                <li key={s.id} className="rounded-2xl border border-sky-brand-200 bg-white p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-navy-900">
                        👥 {s.customer_name}
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
                      <p className="mt-0.5 text-[11px] font-semibold text-navy-700/60">
                        {DAY_NAMES[s.weekday]} · {String(s.start_time).slice(0, 5)}–
                        {String(s.end_time).slice(0, 5)} · 🏸 {s.courts?.name ?? ""}
                        {s.end_date
                          ? ` · s.d. ${new Intl.DateTimeFormat("id-ID", {
                              day: "numeric",
                              month: "short",
                              timeZone: "Asia/Jakarta",
                            }).format(new Date(`${s.end_date}T00:00:00+07:00`))}`
                          : ""}{" "}
                        ·{" "}
                        <span className="font-bold text-sky-brand-600">
                          {count} jadwal ke depan
                        </span>
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
