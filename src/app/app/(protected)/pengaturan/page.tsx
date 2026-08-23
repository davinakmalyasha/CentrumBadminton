import { requireOwnerPage } from "@/lib/guard";
import { addMonths, currentMonthKey } from "@/lib/months";
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-black text-navy-900">⚙️ Pengaturan</h1>
      </div>

      {/* Courts */}
      <section className="rounded-2xl border border-sky-brand-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-extrabold text-navy-900">🏸 Lapangan</h2>
        <ul className="mb-3 space-y-1.5">
          {courts.map((c) => (
            <li key={c.id} className="group flex items-center gap-2 rounded-xl bg-ice-100 px-2.5 py-2">
              <RenameCourtForm courtId={c.id} name={c.name} />
              <ToggleCourtActiveButton courtId={c.id} active={c.is_active} />
            </li>
          ))}
        </ul>
        <NewCourtForm />
      </section>

      {/* Pricing */}
      <section className="rounded-2xl border border-sky-brand-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-extrabold text-navy-900">💰 Aturan Harga</h2>
        <div className="mb-3 rounded-xl bg-ice-100 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-navy-700/50">
            Berlaku sekarang (sejak {activeRule?.valid_from ?? "—"})
          </p>
          <p className="mt-1 text-sm font-black text-navy-900">
            Siang Rp{Number(activeRule?.price_day ?? 0).toLocaleString("id-ID")} · Malam Rp
            {Number(activeRule?.price_evening ?? 0).toLocaleString("id-ID")}{" "}
            <span className="font-semibold text-navy-700/50">
              ({String(activeRule?.open_time ?? "").slice(0, 5)}–
              {String(activeRule?.close_time ?? "").slice(0, 5)})
            </span>
          </p>
        </div>
        <PricingRuleForm nextMonth={addMonths(currentMonthKey(), 1)} />
        {rules.length > 1 && (
          <div className="mt-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-navy-700/40">
              Riwayat aturan
            </p>
            {rules.slice(1).map((r) => (
              <p key={r.id} className="text-[11px] font-semibold text-navy-700/50">
                sejak {r.valid_from}: siang {formatK(Number(r.price_day))} / malam{" "}
                {formatK(Number(r.price_evening))}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Staff */}
      <section className="rounded-2xl border border-sky-brand-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-extrabold text-navy-900">👥 Staf</h2>
        <p className="mb-3 text-[11px] font-medium text-navy-700/50">
          Buat akun pegawai langsung dari sini, lalu bagikan email &amp; password.
          Nonaktifkan akses kapan pun tanpa menghapus data.
        </p>
        <NewStaffForm />
        <ul className="mt-3 space-y-2">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-ice-100 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy-900">
                  {p.full_name || "(tanpa nama)"}{" "}
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 align-middle text-[9px] font-bold uppercase ${
                      p.role === "owner"
                        ? "bg-accent-500/15 text-accent-600"
                        : "bg-sky-brand-400/15 text-sky-brand-600"
                    }`}
                  >
                    {p.role}
                  </span>
                </p>
                <p className="truncate text-[11px] text-navy-700/50">{p.phone ?? "—"}</p>
              </div>
              <ToggleStaffActiveButton profileId={p.id} active={p.is_active} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function formatK(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}
