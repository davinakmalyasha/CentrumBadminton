import { requireOwnerPage } from "@/lib/guard";
import { DataUnavailable, EmptyState, firstError } from "@/components/app/EmptyState";
import { addMonths, currentMonthKey } from "@/lib/months";
import { Settings, Users, Wallet } from "lucide-react";
import Shuttlecock from "@/components/icons/Shuttlecock";
import {
  NewCourtForm,
  NewStaffForm,
  PricingRuleForm,
  RenameCourtForm,
} from "@/components/app/SettingsForms";
import { ToggleCourtActiveButton, ToggleStaffActiveButton } from "@/components/app/SettingsControls";

export const metadata = { title: "Pengaturan · Centrum Manager" };

type CourtRow = { id: string; name: string; is_active: boolean; sort_order: number };
type PriceRow = {
  id: string;
  valid_from: string;
  open_time: string;
  close_time: string;
  day_end: string;
  price_day: number;
  price_evening: number;
};
type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
};

export default async function PengaturanPage() {
  const supabase = await requireOwnerPage();
  // listMyDevices() scopes to the caller via RLS + explicit profile filter;
  // the previous raw push_subscriptions query worked only because RLS
  // happened to scope it — brittle and easy to regress.
  const [courtsRes, pricingRes, profilesRes] = await Promise.all([
    supabase.from("courts").select("id,name,is_active,sort_order").order("sort_order"),
    supabase
      .from("pricing_rules")
      .select("id,valid_from,open_time,close_time,day_end,price_day,price_evening")
      .eq("is_active", true)
      .order("valid_from", { ascending: false }),
    supabase
      .from("profiles")
      .select("id,full_name,phone,role,is_active")
      .order("created_at"),
  ]);

  const courts = (courtsRes.data ?? []) as CourtRow[];
  const rules = (pricingRes.data ?? []) as PriceRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const activeRule = rules[0];
  const readError = firstError(courtsRes, pricingRes, profilesRes);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-zinc-50">
          <Settings className="h-5 w-5" strokeWidth={1.75} /> Pengaturan
        </h1>
      </div>

      {readError ? (
        <DataUnavailable detail={readError} />
      ) : (
        <>
          {/* Courts. This list used to render an empty <ul> with no message
              at all, so a tenant with no courts looked identical to one whose
              courts failed to load — and every other page then rendered
              empty too, which reads as "the app is broken". */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
              <Shuttlecock className="h-4 w-4" /> Lapangan
            </h2>
            {courts.length === 0 ? (
              <EmptyState
                title="Belum ada lapangan"
                body="Mulai dari sini — tambah lapangan dulu, baru bisa membuat booking, melihat jadwal dan menghitung pendapatan."
              />
            ) : (
              <ul className="mb-3 space-y-1.5">
                {courts.map((c) => (
                  <li
                    key={c.id}
                    className="group flex items-center gap-2 rounded-xl bg-zinc-100 px-2.5 py-2 dark:bg-zinc-800"
                  >
                    <RenameCourtForm courtId={c.id} name={c.name} sortOrder={c.sort_order} />
                    <ToggleCourtActiveButton courtId={c.id} active={c.is_active} />
                  </li>
                ))}
              </ul>
            )}
            <NewCourtForm />
          </section>
        </>
      )}

      {!readError && (
        <>

      {/* Pricing */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
          <Wallet className="h-4 w-4" /> Aturan Harga
        </h2>
        <div className="mb-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Berlaku sekarang (sejak {activeRule?.valid_from ?? "—"})
          </p>
          <p className="mt-1 text-sm font-black text-zinc-900 dark:text-zinc-50">
            Siang Rp{Number(activeRule?.price_day ?? 0).toLocaleString("id-ID")} · Malam Rp
            {Number(activeRule?.price_evening ?? 0).toLocaleString("id-ID")}{" "}
            <span className="font-semibold text-zinc-500 dark:text-zinc-400">
              ({String(activeRule?.open_time ?? "").slice(0, 5)}–
              {String(activeRule?.close_time ?? "").slice(0, 5)})
            </span>
          </p>
        </div>
        <PricingRuleForm nextMonth={addMonths(currentMonthKey(), 1)} />
        {rules.length > 1 && (
          <div className="mt-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Riwayat aturan
            </p>
            {rules.slice(1).map((r) => (
              <p key={r.id} className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                sejak {r.valid_from}: siang {formatK(Number(r.price_day))} / malam{" "}
                {formatK(Number(r.price_evening))}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Staff */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
          <Users className="h-4 w-4" /> Staf
        </h2>
        <p className="mb-3 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          Buat akun pegawai langsung dari sini, lalu bagikan email &amp; password.
          Nonaktifkan akses kapan pun tanpa menghapus data.
        </p>
        <NewStaffForm />
        <ul className="mt-3 space-y-2">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {p.full_name || "(tanpa nama)"}{" "}
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 align-middle text-[9px] font-bold uppercase ${
                      p.role === "owner"
                        ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {p.role}
                  </span>
                </p>
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{p.phone ?? "—"}</p>
              </div>
              <ToggleStaffActiveButton profileId={p.id} active={p.is_active} />
            </li>
          ))}
        </ul>
      </section>
        </>
      )}
    </div>
  );
}

function formatK(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}
