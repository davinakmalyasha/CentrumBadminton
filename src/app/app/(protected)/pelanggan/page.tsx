import { createClient } from "@/lib/proxy/client";
import { DataUnavailable, EmptyState, firstError } from "@/components/app/EmptyState";
import { MessageCircle, Phone, UserX, Users } from "lucide-react";
import CustomerNotesForm from "@/components/app/CustomerNotesForm";

export const metadata = { title: "Pelanggan · Centrum Manager" };

type StatsRow = { customer_id: string; visits: number; last_visit: string | null };

export default async function PelangganPage() {
  const supabase = await createClient();

  const [customersRes, statsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id,name,phone,notes,no_show_count")
      .order("name")
      .limit(200),
    // Aggregated server-side (excludes cancelled & no-show) — replaces the
    // previous 2000-row booking fetch + JS tally.
    supabase.rpc("customer_stats"),
  ]);

  type C = {
    id: string;
    name: string;
    phone: string;
    notes: string | null;
    no_show_count: number;
  };

  const customers = (customersRes.data ?? []) as C[];
  const statRows = (statsRes.data ?? []) as unknown as StatsRow[];
  const readError = firstError(customersRes, statsRes);

  const stats = new Map<string, { visits: number; last?: string }>();
  for (const s of statRows) {
    stats.set(s.customer_id, {
      visits: Number(s.visits),
      last: s.last_visit ?? undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-zinc-50">
          <Users className="h-5 w-5" strokeWidth={1.75} /> Pelanggan
        </h1>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {customers.length} terdaftar · dibuat otomatis dari booking
        </p>
      </div>

      {readError ? (
        <DataUnavailable detail={readError} />
      ) : customers.length === 0 ? (
        <EmptyState
          title="Belum ada pelanggan"
          body="Daftar terisi otomatis begitu ada booking yang mencantumkan nama dan nomor. Tidak perlu ditambah manual."
          action={{ href: "/app/booking/baru", label: "Catat booking pertama" }}
        />
      ) : (
        <ul className="space-y-2">
          {customers.map((c) => {
            const s = stats.get(c.id);
            const wa = `https://wa.me/62${c.phone.replace(/^62/, "").replace(/^0/, "")}`;
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm font-black text-zinc-600 dark:text-zinc-300">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-zinc-900 dark:text-zinc-50">
                    {c.name}
                    {(c.no_show_count ?? 0) > 0 && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 align-middle text-[9px] font-bold uppercase text-red-500">
                        <UserX className="mr-0.5 inline h-3 w-3" />
                        {c.no_show_count}× no-show
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    <Phone className="mr-1 inline h-3 w-3" />
                    {c.phone}
                    {s?.visits ? ` · ${s.visits}x main` : ""}
                    {s?.last
                      ? ` · terakhir ${new Intl.DateTimeFormat("id-ID", {
                          day: "numeric",
                          month: "short",
                          timeZone: "Asia/Jakarta",
                        }).format(new Date(`${s.last}T00:00:00+07:00`))}`
                      : ""}
                  </p>
                  <CustomerNotesForm customerId={c.id} notes={c.notes} />
                </div>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Chat WhatsApp"
                  aria-label={`Chat WhatsApp dengan ${c.name}`}
                  className="manager-tap flex h-9 w-9 min-h-[40px] min-w-[40px] flex-shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
