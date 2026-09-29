import { createClient } from "@/lib/proxy/client";
import { ShoppingBasket } from "lucide-react";
import KantinPos, { type PosBooking, type PosProduct } from "@/components/app/kantin/KantinPos";

export const metadata = { title: "Kantin · Centrum Manager" };

export default async function KantinPage() {
  const supabase = await createClient();

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  const [productsRes, bookingsRes] = await Promise.all([
    supabase
      .from("kantin_products")
      .select("id,name,category,price,track_stock,stock")
      .eq("is_active", true)
      .order("category")
      .order("name"),
    supabase
      .from("bookings")
      .select("id,customer_name,start_time,courts(name)")
      .eq("booking_date", today)
      .neq("status", "cancelled")
      .order("start_time"),
  ]);

  const products = (productsRes.data ?? []) as PosProduct[];
  const bookings = (bookingsRes.data ?? []) as unknown as Array<{
    id: string;
    customer_name: string;
    start_time: string;
    courts: { name: string } | null;
  }>;

  const bookingOptions: PosBooking[] = bookings.map((b) => ({
    id: b.id,
    label: `${b.customer_name} · ${b.start_time.slice(0, 5)} · ${b.courts?.name ?? ""}`,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-zinc-50">
          <ShoppingBasket className="h-5 w-5" strokeWidth={1.75} /> Kasir Kantin
        </h1>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Ketuk produk untuk masuk keranjang — total dihitung otomatis dari harga tersimpan.
        </p>
      </div>

      <KantinPos products={products} bookings={bookingOptions} />
    </div>
  );
}
