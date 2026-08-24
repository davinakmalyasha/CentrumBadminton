"use client";

import { useActionState, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import {
  deleteProduct,
  toggleProductActive,
  upsertProduct,
  type KantinActionState,
} from "@/app/app/(protected)/kantin/actions";
import { KANTIN_CATEGORIES, categoryLabel } from "@/lib/kantin";
import { formatIDR } from "@/lib/availability";

const initial: KantinActionState = { error: null };

const field =
  "w-full rounded-xl border border-sky-brand-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-sky-brand-400 focus:outline-none";
const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-navy-700/60";

export function NewProductForm() {
  const [state, formAction, pending] = useActionState(upsertProduct, initial);
  const [track, setTrack] = useState(false);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-dashed border-sky-brand-400/60 bg-sky-brand-400/5 p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="npname" className={label}>
            Nama produk
          </label>
          <input id="npname" name="name" required placeholder="cth. Es Jeruk" className={field} />
        </div>
        <div>
          <label htmlFor="npcat" className={label}>
            Kategori
          </label>
          <select id="npcat" name="category" className={field} defaultValue="minuman">
            {KANTIN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="npprice" className={label}>
            Harga jual
          </label>
          <input id="npprice" name="price" inputMode="numeric" required placeholder="5000" className={field} />
        </div>
        <div>
          <label htmlFor="npcost" className={label}>
            Harga modal (untuk laba)
          </label>
          <input id="npcost" name="cost_price" inputMode="numeric" placeholder="2000" className={field} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-navy-700">
        <input
          type="checkbox"
          name="track_stock"
          value="1"
          checked={track}
          onChange={(e) => setTrack(e.target.checked)}
          className="h-4 w-4 accent-sky-brand-500"
        />
        Lacak stok (kurangi otomatis saat terjual)
      </label>
      {track && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="npstock" className={label}>
              Stok awal
            </label>
            <input id="npstock" name="stock" inputMode="numeric" placeholder="24" className={field} />
          </div>
          <div>
            <label htmlFor="npthr" className={label}>
              Batas stok menipis
            </label>
            <input id="npthr" name="threshold" inputMode="numeric" defaultValue={5} className={field} />
          </div>
        </div>
      )}
      {state.error && <p className="text-xs font-semibold text-red-500">{state.error}</p>}
      {state.ok && <p className="text-xs font-semibold text-emerald-600">Produk ditambahkan</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-navy-800 py-2 text-xs font-black text-white transition hover:bg-navy-700 disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Tambah Produk"}
      </button>
    </form>
  );
}

export function EditProductRow({
  product,
}: {
  product: {
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
}) {
  const [editState, editAction, editPending] = useActionState(upsertProduct, initial);
  const [toggleState, toggleAction, togglePending] = useActionState(toggleProductActive, initial);
  const [delState, delAction, delPending] = useActionState(deleteProduct, initial);
  const [open, setOpen] = useState(false);

  const err = editState.error || toggleState.error || delState.error;

  return (
    <li className="rounded-xl bg-ice-100 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-bold text-navy-900">
            {product.name}
            {!product.is_active && (
              <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-[9px] font-bold uppercase text-neutral-500">
                nonaktif
              </span>
            )}
          </p>
          <p className="text-[11px] font-semibold text-navy-700/50">
            {formatIDR(product.price)} · modal {formatIDR(product.cost_price)} ·{" "}
            {categoryLabel(product.category)}
            {product.track_stock ? ` · stok ${product.stock}` : ""}
          </p>
        </button>
        <form action={toggleAction}>
          <input type="hidden" name="product_id" value={product.id} />
          <input type="hidden" name="active" value={String(!product.is_active)} />
          <button
            type="submit"
            disabled={togglePending}
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${
              product.is_active
                ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                : "border-neutral-300 bg-neutral-100 text-neutral-500"
            }`}
          >
            {product.is_active ? "Aktif" : "Nonaktif"}
          </button>
        </form>
        <form action={delAction}>
          <input type="hidden" name="product_id" value={product.id} />
          <button
            type="submit"
            disabled={delPending}
            title="Hapus produk (riwayat penjualan tetap tersimpan)"
            className="rounded-lg border border-red-200 bg-white p-2 text-red-500 transition hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>

      {open && (
        <form action={editAction} className="mt-3 space-y-2 border-t border-sky-brand-200 pt-3">
          <input type="hidden" name="product_id" value={product.id} />
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 sm:col-span-1">
              <label className={label} htmlFor={`ep-name-${product.id}`}>
                Nama
              </label>
              <input
                id={`ep-name-${product.id}`}
                name="name"
                defaultValue={product.name}
                required
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor={`ep-cat-${product.id}`}>
                Kategori
              </label>
              <select
                id={`ep-cat-${product.id}`}
                name="category"
                defaultValue={product.category}
                className={field}
              >
                {[...new Set([product.category, ...KANTIN_CATEGORIES])].map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor={`ep-price-${product.id}`}>
                Harga jual
              </label>
              <input
                id={`ep-price-${product.id}`}
                name="price"
                inputMode="numeric"
                defaultValue={String(product.price)}
                required
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor={`ep-cost-${product.id}`}>
                Harga modal
              </label>
              <input
                id={`ep-cost-${product.id}`}
                name="cost_price"
                inputMode="numeric"
                defaultValue={String(product.cost_price)}
                className={field}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-navy-700">
            <input
              type="checkbox"
              name="track_stock"
              value="1"
              defaultChecked={product.track_stock}
              className="h-4 w-4 accent-sky-brand-500"
            />
            Lacak stok
          </label>
          <div>
            <label className={label} htmlFor={`ep-thr-${product.id}`}>
              Batas stok menipis
            </label>
            <input
              id={`ep-thr-${product.id}`}
              name="threshold"
              inputMode="numeric"
              defaultValue={String(product.low_stock_threshold)}
              className={field}
            />
          </div>
          {editState.error && <p className="text-xs font-semibold text-red-500">{editState.error}</p>}
          {editState.ok && <p className="text-xs font-semibold text-emerald-600">Tersimpan</p>}
          <button
            type="submit"
            disabled={editPending}
            className="inline-flex items-center gap-1 rounded-xl bg-navy-800 px-4 py-2 text-xs font-black text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            {editPending ? "Menyimpan…" : (
              <>
                <Check className="h-3.5 w-3.5" /> Simpan
              </>
            )}
          </button>
        </form>
      )}

      {err && <p className="mt-1 text-[10px] font-semibold text-red-500">{err}</p>}
    </li>
  );
}
