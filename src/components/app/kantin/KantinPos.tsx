"use client";

import { useActionState, useMemo, useState } from "react";
import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { recordSale, type KantinActionState } from "@/app/app/(protected)/kantin/actions";
import { cartTotal, categoryLabel } from "@/lib/kantin";
import { formatIDR } from "@/lib/availability";

export interface PosProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  track_stock: boolean;
  stock: number;
}

export interface PosBooking {
  id: string;
  label: string;
}

const initial: KantinActionState = { error: null };

export default function KantinPos({
  products,
  bookings,
}: {
  products: PosProduct[];
  bookings: PosBooking[];
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<string>("all");
  const [method, setMethod] = useState<"cash" | "qris">("cash");
  const [details, setDetails] = useState(false);

  // A recorded sale must start a fresh transaction: leaving items in the
  // cart invited duplicate "Catat" taps (double sale + double stock hit).
  // Clearing inside the action (not an effect) guarantees it runs on every
  // successful submit.
  const [state, formAction, pending] = useActionState(
    async (prev: KantinActionState, formData: FormData) => {
      const res = await recordSale(prev, formData);
      if (!res.error) setCart({});
      return res;
    },
    initial
  );

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))],
    [products]
  );
  const visible =
    category === "all" ? products : products.filter((p) => p.category === category);

  const priceById = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.price])),
    [products]
  );
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
    .filter((l) => l.product);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = cartTotal(
    lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
    priceById
  );

  function add(p: PosProduct) {
    if (p.track_stock && p.stock <= 0) return;
    setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] ?? 0) + 1, 99) }));
  }
  function sub(id: string) {
    setCart((c) => {
      const next = (c[id] ?? 0) - 1;
      const copy = { ...c };
      if (next <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  const soldOut = (p: PosProduct) => p.track_stock && p.stock <= 0;

  return (
    <div className="space-y-4 pb-40">
      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`manager-tap flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            category === "all"
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          }`}
        >
          Semua
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`manager-tap flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              category === c
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Katalog kosong — owner bisa menambah produk di menu Kantin Produk.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((p) => {
            const inCart = cart[p.id] ?? 0;
            const out = soldOut(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                disabled={out}
                className={`manager-tap relative rounded-2xl border p-3 text-left transition ${
                  out
                    ? "border-neutral-200 bg-neutral-50 opacity-60"
                    : inCart > 0
                      ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                      : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-500"
                }`}
              >
                <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{p.name}</p>
                <p className="mt-0.5 text-sm font-black text-zinc-600 dark:text-zinc-300">
                  {formatIDR(p.price)}
                </p>
                {p.track_stock && (
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      out
                        ? "bg-red-100 text-red-500"
                        : p.stock <= 5
                          ? "bg-amber-100 text-amber-700"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {out ? "Habis" : `Stok ${p.stock}`}
                  </span>
                )}
                {inCart > 0 && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-black text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {inCart}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Success banner */}
      {state.ok && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          Penjualan tercatat: {formatIDR(Number(state.info ?? 0))}
        </div>
      )}
      {state.error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
          {state.error}
        </div>
      )}

      {/* Sticky cart bar */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <form
            action={formAction}
            className="mx-auto max-w-3xl rounded-2xl border border-zinc-900/10 bg-zinc-900 p-3 shadow-2xl shadow-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <input type="hidden" name="method" value={method} />
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(lines.map((l) => ({ product_id: l.product.id, qty: l.qty })))}
            />

            {/* Cart lines */}
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {lines.map((l) => (
                <div key={l.product.id} className="flex items-center gap-2 text-xs text-white">
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.product.name}</span>
                  <span className="font-bold text-zinc-300 dark:text-zinc-300">
                    {formatIDR(l.product.price * l.qty)}
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => sub(l.product.id)}
                      className="manager-tap flex h-6 w-6 items-center justify-center rounded-md bg-white/10"
                      aria-label={`Kurangi ${l.product.name}`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center font-black">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => add(l.product)}
                      className="manager-tap flex h-6 w-6 items-center justify-center rounded-md bg-white/10"
                      aria-label={`Tambah ${l.product.name}`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => sub(l.product.id)}
                      aria-label={`Hapus ${l.product.name}`}
                      className="manager-tap ml-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              ))}
            </div>

            {/* Optional details */}
            <button
              type="button"
              onClick={() => setDetails((d) => !d)}
              className="manager-tap mt-2 text-[10px] font-bold uppercase tracking-wide text-zinc-300 dark:text-zinc-300"
            >
              {details ? "− Sembunyikan detail" : "+ Nama pembeli / catatan / booking (opsional)"}
            </button>
            {details && (
              <div className="mt-2 space-y-1.5">
                <input
                  name="customer_name"
                  placeholder="Nama pembeli (opsional)"
                  className="w-full rounded-lg border border-white/10 bg-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none"
                />
                <input
                  name="note"
                  placeholder="Catatan (opsional)"
                  className="w-full rounded-lg border border-white/10 bg-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none"
                />
                {bookings.length > 0 && (
                  <select
                    name="booking_id"
                    className="w-full rounded-lg border border-white/10 bg-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="" className="text-zinc-900">
                      Kaitkan ke booking hari ini (opsional)
                    </option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id} className="text-zinc-900">
                        {b.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Total + actions */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-300 dark:text-zinc-300">
                  <ShoppingBasket className="mr-1 inline h-3 w-3" />
                  {count} item
                </p>
                <p className="text-lg font-black leading-tight text-white">{formatIDR(total)}</p>
              </div>
              <button
                type="button"
                onClick={() => setMethod(method === "cash" ? "qris" : "cash")}
                aria-pressed={method === "qris"}
                className={`manager-tap rounded-xl border px-3 py-2.5 text-xs font-black transition ${
                  method === "cash" ? "border-zinc-100 bg-zinc-100 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-emerald-400 bg-emerald-500 text-white"
                }`}
              >
                {method === "cash" ? "Cash" : "QRIS"}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="manager-tap min-h-[44px] rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-black text-zinc-900 transition hover:bg-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {pending ? "Menyimpan…" : "Catat"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
