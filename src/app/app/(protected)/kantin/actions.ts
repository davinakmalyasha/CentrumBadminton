"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/proxy/client";
import { rateLimit } from "@/lib/ratelimit";

export type KantinActionState = { error: string | null; ok?: boolean; info?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");
  return { supabase, user };
}

async function isOwner(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.rpc("is_owner");
  return data === true;
}

async function requireOwner() {
  const { supabase, user } = await requireUser();
  if (!(await isOwner(supabase))) throw new Error("FORBIDDEN");
  return { supabase, user };
}

/**
 * Turn a backend failure into Indonesian.
 *
 * This matched the OLD Supabase-RPC error vocabulary (`OUT_OF_STOCK:`,
 * `BAD_QTY`, `SALE_NOT_FOUND`, …). The Go proxy answers in lowercase
 * sentences instead — `out of stock: NAME`, `bad qty`, `sale not found`,
 * `product not found: <uuid>` — so nine of the ten branches were dead and
 * raw English, including a raw UUID, reached the UI.
 *
 * Matched case-insensitively on the lowercase forms the handlers actually
 * emit, in the order they can apply.
 */
function friendlyError(msg: string): string {
  const m = msg.toLowerCase();

  // Order matters: "insufficient stock or product not found" contains both
  // an insufficient-stock phrase and a not-found phrase.
  if (m.includes("insufficient stock")) {
    return "Stok tidak cukup untuk transaksi ini. Perbarui stok atau kurangi jumlah.";
  }
  if (m.includes("out of stock")) {
    const name = msg.split(":").slice(1).join(":").trim();
    return name ? `Stok ${name} habis.` : "Stok habis untuk salah satu item.";
  }
  if (m.includes("not tracked") || m.includes("track_stock")) {
    return "Pelacakan stok belum aktif untuk produk itu.";
  }
  if (m.includes("product not found")) {
    // Never echo the UUID — it is noise for the operator and leaks an id.
    return "Ada produk yang sudah tidak tersedia — muat ulang halaman.";
  }
  if (m.includes("sale not found")) {
    return "Penjualan sudah dihapus atau tidak ditemukan.";
  }
  if (m.includes("empty cart") || m.includes("cart is empty")) {
    return "Keranjang kosong.";
  }
  if (m.includes("bad qty") || m.includes("qty")) return "Jumlah tidak valid.";
  if (m.includes("bad reason") || m.includes("reason")) return "Alasan tidak valid.";
  if (m.includes("non-zero")) return "Tidak ada perubahan stok.";
  if (m.includes("count must be")) return "Hasil hitung fisik tidak boleh negatif.";
  if (m.includes("invalid json")) return "Permintaan tidak terbaca — muat ulang halaman.";
  if (m.includes("invalid limit")) return "Jumlah data terlalu besar.";
  if (m.includes("forbidden")) {
    return "Hanya owner yang bisa mengubah data kantin.";
  }
  if (m.includes("slot already booked")) return "Slot bentrok — sudah ada booking di jam tersebut.";
  if (m === "internal" || m.includes("status 500")) {
    return "Server sedang bermasalah. Coba lagi sebentar.";
  }
  if (m.includes("status 401") || m.includes("status 403")) {
    return "Sesi habis — silakan login ulang.";
  }
  // Unknown: still don't dump a raw identifier at the user.
  const cleaned = msg.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "…").slice(0, 120);
  return `Gagal memproses: ${cleaned}`;
}

/* ------------------------------------------------------------------ */
/* POS: record a sale via atomic RPC                                   */
/* ------------------------------------------------------------------ */

export async function recordSale(
  _prev: KantinActionState,
  formData: FormData
): Promise<KantinActionState> {
  const { user } = await requireUser();

  if (!rateLimit(`ksale:${user.id}`, 60, 60_000).ok) {
    return { error: "Terlalu banyak transaksi — coba lagi sebentar." };
  }

  let items: Array<{ product_id: string; qty: number }>;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Keranjang tidak valid." };
  }
  if (!Array.isArray(items) || items.length === 0)
    return { error: "Keranjang kosong." };
  if (items.length > 40) return { error: "Terlalu banyak item." };
  for (const it of items) {
    if (!it?.product_id || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99)
      return { error: "Item tidak valid." };
  }

  const method = String(formData.get("method") ?? "cash") === "qris" ? "qris" : "cash";
  const customerName = String(formData.get("customer_name") ?? "").trim().slice(0, 80);
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  const bookingId = String(formData.get("booking_id") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_kantin_sale", {
    p_sale: { method, customer_name: customerName, note, booking_id: bookingId },
    p_items: items,
  });

  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/app/kantin");
  revalidatePath("/app/kantin/riwayat");
  revalidatePath("/app");
  revalidatePath("/app/laporan");
  const total = (data as { total?: number })?.total ?? 0;
  return { error: null, ok: true, info: String(total) };
}

/* ------------------------------------------------------------------ */
/* Owner: product CRUD                                                 */
/* ------------------------------------------------------------------ */

export async function upsertProduct(
  _prev: KantinActionState,
  formData: FormData
): Promise<KantinActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const id = String(formData.get("product_id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const category = String(formData.get("category") ?? "lainnya").trim().slice(0, 30) || "lainnya";
  const price = Number(String(formData.get("price") ?? "").replace(/\D/g, "").slice(0, 9));
  const costPrice = Number(String(formData.get("cost_price") ?? "").replace(/\D/g, "").slice(0, 9) || "0");
  const trackStock = String(formData.get("track_stock") ?? "") === "1";
  const stock = Number(String(formData.get("stock") ?? "0").replace(/\D/g, "").slice(0, 6) || "0");
  const threshold = Number(String(formData.get("threshold") ?? "5").replace(/\D/g, "").slice(0, 4) || "5");

  if (!name) return { error: "Nama produk wajib diisi." };
  if (!Number.isFinite(price) || price <= 0) return { error: "Harga jual harus lebih dari 0." };
  if (!Number.isFinite(costPrice) || costPrice < 0) return { error: "Harga modal tidak valid." };

  if (id) {
    // Update: stock is managed via Stok page, don't overwrite it here
    const { error } = await supabase
      .from("kantin_products")
      .update({ name, category, price, cost_price: costPrice, track_stock: trackStock, low_stock_threshold: threshold })
      .eq("id", id);
    if (error) return { error: `Gagal simpan: ${error.message}` };
  } else {
    const { error } = await supabase.from("kantin_products").insert({
      name,
      category,
      price,
      cost_price: costPrice,
      track_stock: trackStock,
      stock: trackStock ? stock : 0,
      low_stock_threshold: threshold,
    });
    if (error) return { error: `Gagal tambah: ${error.message}` };
  }

  revalidatePath("/app/kantin");
  revalidatePath("/app/kantin/produk");
  revalidatePath("/app/kantin/stok");
  return { error: null, ok: true };
}

export async function toggleProductActive(
  _prev: KantinActionState,
  formData: FormData
): Promise<KantinActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const id = String(formData.get("product_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  const { error } = await supabase
    .from("kantin_products")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { error: `Gagal: ${error.message}` };

  revalidatePath("/app/kantin");
  revalidatePath("/app/kantin/produk");
  return { error: null, ok: true };
}

export async function deleteProduct(
  _prev: KantinActionState,
  formData: FormData
): Promise<KantinActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const id = String(formData.get("product_id") ?? "");
  const { error } = await supabase.from("kantin_products").delete().eq("id", id);
  if (error) return { error: `Gagal hapus: ${error.message}` };

  revalidatePath("/app/kantin");
  revalidatePath("/app/kantin/produk");
  return { error: null, ok: true };
}

/* ------------------------------------------------------------------ */
/* Owner: stock adjustments (atomic RPC + audit row)                   */
/* ------------------------------------------------------------------ */

export async function adjustStock(
  _prev: KantinActionState,
  formData: FormData
): Promise<KantinActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const productId = String(formData.get("product_id") ?? "");
  const reasonRaw = String(formData.get("reason") ?? "");
  const qty = Number(String(formData.get("qty") ?? "").replace(/\D/g, "").slice(0, 6));
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  const reason = ["restock", "waste", "correction"].includes(reasonRaw) ? reasonRaw : "";
  if (!productId) return { error: "Produk tidak valid." };
  if (!reason) return { error: "Alasan tidak valid." };
  if (!Number.isFinite(qty) || qty < 1)
    return { error: "Jumlah harus lebih dari 0." };

  // Atomic in SQL: row lock → compute → update + movement insert.
  // Replaces the previous read-modify-write that lost updates under
  // concurrency and could swallow movement-insert failures.
  const { data: newStock, error } = await supabase.rpc("adjust_kantin_stock", {
    p_product_id: productId,
    p_delta: qty,
    p_reason: reason,
    p_note: note,
  });

  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/app/kantin/stok");
  revalidatePath("/app/kantin");
  return { error: null, ok: true, info: String(newStock ?? "") };
}

/* ------------------------------------------------------------------ */
/* Owner: void a sale (atomic: restore stock + mark voided via RPC)     */
/* ------------------------------------------------------------------ */

export async function voidSale(
  _prev: KantinActionState,
  formData: FormData
): Promise<KantinActionState> {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    return { error: "Hanya owner." };
  }
  const { supabase } = ctx;

  const saleId = String(formData.get("sale_id") ?? "");
  if (!saleId) return { error: "Penjualan tidak valid." };

  // One atomic call: locks the sale, refuses if it is already voided,
  // restores tracked stock, writes void movements, then marks the sale
  // voided. Fixes double-void races and silent restore failures of the
  // previous per-item loop.
  //
  // The sale is not deleted. It is marked: a sale is money, and a voided
  // one still has to be readable as history. Revenue queries exclude
  // voided rows; the history list shows them struck through.
  const { error } = await supabase.rpc("void_kantin_sale", {
    p_sale_id: saleId,
  });

  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/app/kantin/riwayat");
  revalidatePath("/app/kantin");
  revalidatePath("/app/laporan");
  return { error: null, ok: true };
}
