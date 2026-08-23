import { requireOwnerPage } from "@/lib/guard";
import { todayISO } from "@/lib/availability";
import BlockForm from "@/components/app/BlockForm";
import DeleteBlockButton from "@/components/app/DeleteBlockButton";

export const metadata = { title: "Blokir Jadwal · Centrum Manager" };

type BlockRow = {
  id: string;
  court_id: string | null;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  courts: { name: string } | null;
};

export default async function BlokirPage() {
  const supabase = await requireOwnerPage();
  const today = todayISO();

  const [courtsRes, blocksRes] = await Promise.all([
    supabase.from("courts").select("id,name").eq("is_active", true).order("sort_order"),
    supabase
      .from("court_blocks")
      .select("*, courts(name)")
      .gte("block_date", today)
      .order("block_date")
      .order("start_time"),
  ]);

  const blocks = (blocksRes.data ?? []) as BlockRow[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-black text-navy-900">⛔ Blokir Jadwal</h1>
        <p className="text-xs font-semibold text-navy-700/60">
          Maintenance / private event — langsung hilang dari jadwal publik.
        </p>
      </div>

      <BlockForm courts={(courtsRes.data ?? []) as Array<{ id: string; name: string }>} today={today} />

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-navy-700/60">
          Aktif ({blocks.length})
        </h2>
        {blocks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-sky-brand-300 bg-white p-6 text-center text-sm text-navy-700/50">
            Tidak ada blokir mendatang.
          </p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => {
              const d = new Intl.DateTimeFormat("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: "Asia/Jakarta",
              }).format(new Date(`${b.block_date}T00:00:00+07:00`));
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/60 px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-xs font-black text-red-600">
                      {d} · {String(b.start_time).slice(0, 5)}–{String(b.end_time).slice(0, 5)}
                    </p>
                    <p className="text-[11px] font-semibold text-navy-700/70">
                      {b.court_id ? (b.courts?.name ?? "Lapangan") : "Semua lapangan"} ·{" "}
                      {b.reason}
                    </p>
                  </div>
                  <DeleteBlockButton blockId={b.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
