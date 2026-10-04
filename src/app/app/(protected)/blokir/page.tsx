import { requireOwnerPage } from "@/lib/guard";
import { todayISO } from "@/lib/availability";
import { Ban } from "lucide-react";
import BlockForm from "@/components/app/BlockForm";
import DeleteBlockButton from "@/components/app/DeleteBlockButton";
import { DataUnavailable, EmptyState, firstError } from "@/components/app/EmptyState";

export const metadata = { title: "Blokir Jadwal · Centrum Manager" };

type BlockRow = {
  id: string;
  court_id: string | null;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string;
};

export default async function BlokirPage() {
  const supabase = await requireOwnerPage();
  const today = todayISO();

  const [courtsRes, blocksRes] = await Promise.all([
    supabase.from("courts").select("id,name").eq("is_active", true).order("sort_order"),
    supabase
      .from("court_blocks")
      .select("*")
      .gte("block_date", today)
      .order("block_date")
      .order("start_time"),
  ]);

  // Without this, a proxy outage rendered "Tidak ada blokir mendatang." —
  // the same words as a genuinely empty list, so a failed read looked like
  // a quiet calendar.
  const readError = firstError(courtsRes, blocksRes);
  if (readError) {
    return (
      <div className="space-y-4">
        <DataUnavailable detail={readError} />
      </div>
    );
  }

  const blocks = (blocksRes.data ?? []) as BlockRow[];
  const courtList = (courtsRes.data ?? []) as Array<{ id: string; name: string }>;
  // Resolve the court name from the list we already loaded.
  //
  // The query used to ask for `courts(name)` as an embedded relation, but
  // `.select()` is a no-op in this connector and the court_blocks row
  // shape carries no court name, so every block rendered as the literal
  // fallback "Lapangan" — including blocks on Court 2, which the owner
  // could not tell apart.
  const courtName = (id: string | null) =>
    id ? courtList.find((c) => c.id === id)?.name ?? "Lapangan" : "Semua lapangan";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Maintenance / private event — booking di jam ini akan ditolak, dan
          disappear dari jadwal publik.
        </p>
      </div>

      <BlockForm courts={(courtsRes.data ?? []) as Array<{ id: string; name: string }>} today={today} />

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Aktif ({blocks.length})
        </h2>
        {blocks.length === 0 ? (
          <EmptyState
            title="Tidak ada blokir mendatang"
            body="Kalau ada lapangan yang perlu diperbaiki atau disewa untuk acara pribadi, blokir di sini — booking pada jam itu akan ditolak."
          />
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
                    <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                      {b.court_id ? courtName(b.court_id) : courtName(null)} · {b.reason}
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
