import { createClient } from "@/lib/proxy/client";
import { DataUnavailable, EmptyState, firstError } from "@/components/app/EmptyState";
import { ShoppingBasket } from "lucide-react";
import KantinPos, { type PosBooking, type PosProduct } from "@/components/app/kantin/KantinPos";
import KantinSubnav from "@/components/app/kantin/KantinSubnav";

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
  const readError = firstError(productsRes, bookingsRes);

  const bookingOptions: PosBooking[] = bookings.map((b) => ({
    id: b.id,
    label: `${b.customer_name} · ${b.start_time.slice(0, 5)} · ${b.courts?.name ?? ""}`,
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Ketuk produk untuk masuk keranjang — total dihitung otomatis dari harga tersimpan.
        </p>
      </div>

      <KantinSubnav active="/app/kantin" />

      {readError ? (
        <DataUnavailable detail={readError} />
      ) : products.length === 0 ? (
        /* The POS empty state used to say "owner bisa menambah produk di menu
           Kantin Produk" — a menu that did not exist anywhere. KANTIN_NAV was
           defined in AppNav but never imported, so /app/kantin/produk and
           /app/kantin/riwayat had no inbound link at all and /stok was
           reachable only by accident, via the dashboard's low-stock banner.
           Those pages are now in the sidebar (KantinSubnav) and linked here. */
        <EmptyState
          title="Katalog masih kosong"
          body="Tambah produk beserta harga dan modalnya dulu, lalu kasir bisa dipakai. Stok dan riwayat penjualan ada di tab di atas."
          action={{ href: "/app/kantin/produk", label: "Tambah produk" }}
        />
      ) : (
        <KantinPos products={products} bookings={bookingOptions} />
      )}
    </div>
  );
}
