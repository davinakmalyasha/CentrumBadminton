import { requireOwnerPage } from "@/lib/guard";
import { ShoppingBasket } from "lucide-react";
import { EditProductRow, NewProductForm } from "@/components/app/kantin/ProductForms";

export const metadata = { title: "Kantin · Produk · Centrum Manager" };

type PRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost_price: number;
  track_stock: boolean;
  stock: number | null;
  low_stock_threshold: number;
  is_active: boolean;
};

export default async function KantinProdukPage() {
  const supabase = await requireOwnerPage();
  const { data } = await supabase
    .from("kantin_products")
    .select("id,name,category,price,cost_price,track_stock,stock,low_stock_threshold,is_active")
    .order("category")
    .order("name");

  const products = (data ?? []) as PRow[];

  // group by category preserving order
  const grouped = new Map<string, PRow[]>();
  for (const p of products) {
    const list = grouped.get(p.category) ?? [];
    list.push(p);
    grouped.set(p.category, list);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black text-navy-900">
          <ShoppingBasket className="h-5 w-5" strokeWidth={1.75} /> Produk Kantin
        </h1>
        <p className="text-xs font-semibold text-navy-700/60">
          {products.length} produk · ketuk nama untuk mengubah harga/modal/stok
        </p>
      </div>

      <NewProductForm />

      <ul className="space-y-2">
        {[...grouped.entries()].map(([cat, list]) => (
          <li key={cat}>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-navy-700/40">
              {cat}
            </p>
            <ul className="space-y-2">
              {list.map((p) => (
                <EditProductRow key={p.id} product={p} />
              ))}
            </ul>
          </li>
        ))}
        {products.length === 0 && (
          <li className="rounded-2xl border border-dashed border-sky-brand-300 bg-white p-8 text-center text-sm text-navy-700/50">
            Belum ada produk — tambah di form atas.
          </li>
        )}
      </ul>
    </div>
  );
}
