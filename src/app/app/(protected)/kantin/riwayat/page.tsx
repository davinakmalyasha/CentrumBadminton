import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { addDaysISO, formatIDR, todayISO } from "@/lib/availability";
import VoidSaleButton from "@/components/app/kantin/VoidSaleButton";

export const metadata = { title: "Kantin · Riwayat · Centrum Manager" };

type SRow = {
  id: string;
  total: number;
  method: string;
  customer_name: string | null;
  note: string | null;
  created_at: string;
  recorded_by: string | null;
  kantin_sale_items: Array<{
    id: string;
    product_name: string;
    qty: number;
    unit_price: number;
  }>;
  profiles: { full_name: string } | null;
};

export default async function KantinRiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const next = addDaysISO(date, 1);

  const supabase = await createClient();
  const [salesRes, ownerRes] = await Promise.all([
    supabase
      .from("kantin_sales")
      .select(
        "id,total,method,customer_name,note,created_at,recorded_by,kantin_sale_items(product_name,qty,unit_price,id),profiles(full_name)"
      )
      .gte("created_at", `${date}T00:00:00+07:00`)
      .lt("created_at", `${next}T00:00:00+07:00`)
      .order("created_at", { ascending: false }),
    supabase.rpc("is_owner"),
  ]);
  const owner = ownerRes.data === true;

  const sales = (salesRes.data ?? []) as unknown as SRow[];
  const dayTotal = sales.reduce((a, s) => a + Number(s.total), 0);
  const cash = sales.filter((s) => s.method === "cash").reduce((a, s) => a + Number(s.total), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/app/kantin/riwayat?date=${addDaysISO(date, -1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-brand-200 bg-white text-navy-800"
          aria-label="Hari sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <h1 className="flex items-center justify-center gap-2 text-base font-black text-navy-900">
            <Receipt className="h-4 w-4" strokeWidth={1.75} /> Riwayat Kantin
          </h1>
          <p className="text-xs font-semibold capitalize text-navy-700/60">
            {date === today ? "Hari ini" : date}
          </p>
        </div>
        <Link
          href={`/app/kantin/riwayat?date=${addDaysISO(date, 1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-brand-200 bg-white text-navy-800"
          aria-label="Hari berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="rounded-2xl border border-navy-800/10 bg-navy-800 p-4 text-white">
        <p className="text-[11px] font-bold uppercase tracking-widest text-sky-brand-200/70">
          Total penjualan kantin
        </p>
        <p className="mt-1 text-3xl font-black tracking-tight">{formatIDR(dayTotal)}</p>
        <p className="mt-1 text-xs font-semibold text-sky-brand-200/80">
          Cash {formatIDR(cash)} · QRIS {formatIDR(dayTotal - cash)} · {sales.length} transaksi
        </p>
      </div>

      {sales.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sky-brand-300 bg-white p-8 text-center text-sm text-navy-700/50">
          Belum ada penjualan di tanggal ini.
        </p>
      ) : (
        <ul className="space-y-2">
          {sales.map((s) => {
            const items = s.kantin_sale_items ?? [];
            const time = new Intl.DateTimeFormat("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Jakarta",
            }).format(new Date(s.created_at));
            return (
              <li key={s.id} className="rounded-2xl border border-sky-brand-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-navy-900">
                      {formatIDR(Number(s.total))}
                      <span className="ml-2 rounded-full bg-ice-100 px-2 py-0.5 text-[9px] font-bold uppercase text-navy-700/60">
                        {s.method}
                      </span>
                      <span className="ml-1 text-[10px] font-medium text-navy-700/40">· {time}</span>
                    </p>
                    <p className="truncate text-[11px] font-semibold text-navy-700/50">
                      {items.map((i) => `${i.product_name} ×${i.qty}`).join(", ")}
                      {s.customer_name ? ` · ${s.customer_name}` : ""}
                    </p>
                    {s.note && (
                      <p className="truncate text-[10px] italic text-navy-700/40">{s.note}</p>
                    )}
                    <p className="text-[10px] font-medium text-navy-700/40">
                      Dicatat: {s.profiles?.full_name ?? "—"}
                    </p>
                  </div>
                  {owner && <VoidSaleButton saleId={s.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
