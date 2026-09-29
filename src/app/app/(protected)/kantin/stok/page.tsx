import { requireOwnerPage } from "@/lib/guard";
import { PackageSearch, TriangleAlert } from "lucide-react";
import { StockAdjustForm } from "@/components/app/kantin/StockForms";
import { lowStockProducts } from "@/lib/kantin";

export const metadata = { title: "Kantin · Stok · Centrum Manager" };

type PRow = {
  id: string;
  name: string;
  track_stock: boolean;
  stock: number;
  low_stock_threshold: number;
};

type MRow = {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  created_at: string;
  kantin_products: { name: string } | null;
};

const REASON_LABEL: Record<string, string> = {
  sale: "Terjual",
  restock: "Restock",
  waste: "Rusak/Habis",
  correction: "Opname",
  void: "Batal",
};

export default async function KantinStokPage() {
  const supabase = await requireOwnerPage();

  const [productsRes, movementsRes] = await Promise.all([
    supabase
      .from("kantin_products")
      .select("id,name,track_stock,stock,low_stock_threshold")
      .order("name"),
    supabase
      .from("kantin_stock_movements")
      .select("id,delta,reason,note,created_at,kantin_products(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const products = (productsRes.data ?? []) as PRow[];
  const movements = (movementsRes.data ?? []) as unknown as MRow[];
  const low = lowStockProducts(
    products.map((p) => ({
      name: p.name,
      track_stock: p.track_stock,
      stock: p.stock,
      low_stock_threshold: p.low_stock_threshold,
    }))
  );
  const tracked = products.filter((p) => p.track_stock);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-zinc-50">
          <PackageSearch className="h-5 w-5" strokeWidth={1.75} /> Stok Kantin
        </h1>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {tracked.length} produk dilacak · stok berkurang otomatis saat terjual
        </p>
      </div>

      {low.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/40">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">
            Stok menipis: <b>{low.join(", ")}</b> — segera restock.
          </p>
        </div>
      )}

      {/* Tracked products + adjust */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">Sesuaikan Stok</h2>
        {tracked.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Belum ada produk dengan pelacakan stok — aktifkan di Produk Kantin.
          </p>
        ) : (
          <ul className="space-y-2">
            {tracked.map((p) => (
              <li key={p.id} className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{p.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p.stock <= p.low_stock_threshold
                        ? "bg-amber-100 text-amber-700"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    stok {p.stock}
                  </span>
                </div>
                <StockAdjustForm productId={p.id} stock={p.stock} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Movement log */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">Riwayat Pergerakan</h2>
        {movements.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Belum ada pergerakan stok.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2 text-xs">
                <span
                  className={`w-10 flex-shrink-0 text-right font-black ${
                    m.delta > 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <b className="text-zinc-900 dark:text-zinc-50">{m.kantin_products?.name ?? "?"}</b>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {" "}
                    · {REASON_LABEL[m.reason] ?? m.reason}
                    {m.note ? ` · ${m.note}` : ""}
                  </span>
                </span>
                <span className="flex-shrink-0 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                  {new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(m.created_at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
        Opname = masukkan hasil hitung fisik; sistem menghitung selisihnya otomatis.
      </p>
    </div>
  );
}
