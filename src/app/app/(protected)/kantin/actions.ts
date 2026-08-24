"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

function friendlyError(msg: string): string {
  if (msg.startsWith("OUT_OF_STOCK:")) return `Stok habis: ${msg.split(":").slice(1).join(":")}`;
  if (msg.includes("PRODUCT_NOT_FOUND")) return "Ada produk yang sudah tidak tersedia — muat ulang halaman.";
  if (msg.includes("EMPTY_CART")) return "Keranjang kosong.";
  if (msg.includes("BAD_QTY")) return "Jumlah tidak valid.";
  if (msg.includes("FORBIDDEN")) return "Hanya staf yang bisa mencatat penjualan.";
  return `Gagal mencatat penjualan: ${msg.slice(0, 120)}`;
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
/* Owner: stock adjustments                                            */
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
  const { supabase, user } = ctx;

  const productId = String(formData.get("product_id") ?? "");
  const reasonRaw = String(formData.get("reason") ?? "");
  const qty = Number(String(formData.get("qty") ?? "").replace(/\D/g, "").slice(0, 6));
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  const reason = ["restock", "waste", "correction"].includes(reasonRaw) ? reasonRaw : "";
  if (!productId) return { error: "Produk tidak valid." };
  if (!reason) return { error: "Alasan tidak valid." };
  if (!Number.isFinite(qty) || qty < 1) return { error: "Jumlah harus lebih dari 0." };

  // reason → delta sign: restock +, waste -, correction = absolute set
  const { data: product } = await supabase
    .from("kantin_products")
    .select("stock, track_stock, name")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { error: "Produk tidak ditemukan." };
  if (!product.track_stock) return { error: "Pelacakan stok belum aktif untuk produk ini." };

  let delta: number;
  let newStock: number;
  if (reason === "restock") {
    delta = qty;
    newStock = product.stock + qty;
  } else if (reason === "waste") {
    delta = -qty;
    newStock = product.stock - qty;
  } else {
    // correction: qty = physical count → delta = counted - current
    delta = qty - product.stock;
    newStock = qty;
  }
  if (newStock < 0) return { error: `Stok tidak bisa minus (sekarang ${product.stock}).` };
  if (delta === 0) return { error: "Tidak ada perubahan stok." };

  const { error } = await supabase.from("kantin_products").update({ stock: newStock }).eq("id", productId);
  if (error) return { error: `Gagal update stok: ${error.message}` };

  await supabase.from("kantin_stock_movements").insert({
    product_id: productId,
    delta,
    reason,
    note,
    created_by: user.id,
  });

  revalidatePath("/app/kantin/stok");
  revalidatePath("/app/kantin");
  return { error: null, ok: true };
}

/* ------------------------------------------------------------------ */
/* Owner: void a sale (restores tracked stock)                         */
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
  const { supabase, user } = ctx;

  const saleId = String(formData.get("sale_id") ?? "");
  if (!saleId) return { error: "Penjualan tidak valid." };

  const { data: items } = await supabase
    .from("kantin_sale_items")
    .select("product_id, qty")
    .eq("sale_id", saleId);

  const { error } = await supabase.from("kantin_sales").delete().eq("id", saleId);
  if (error) return { error: `Gagal batal: ${error.message}` };

  // Restore tracked stock + write void movements (best-effort)
  for (const it of items ?? []) {
    const pid = (it as { product_id: string | null }).product_id;
    const qty = (it as { qty: number }).qty;
    if (!pid) continue;
    const { data: p } = await supabase
      .from("kantin_products")
      .select("track_stock, stock")
      .eq("id", pid)
      .maybeSingle();
    if (!p?.track_stock) continue;
    await supabase
      .from("kantin_products")
      .update({ stock: p.stock + qty })
      .eq("id", pid);
    await supabase.from("kantin_stock_movements").insert({
      product_id: pid,
      delta: qty,
      reason: "void",
      created_by: user.id,
    });
  }

  revalidatePath("/app/kantin/riwayat");
  revalidatePath("/app/kantin");
  revalidatePath("/app/laporan");
  return { error: null, ok: true };
}
