/** Pure kantin helpers — unit-testable, no server dependencies */

export interface CartLine {
  product_id: string;
  qty: number;
  price?: number;
}

export interface PricedLine {
  product_id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
}

export const KANTIN_CATEGORIES = ["minuman", "makanan", "snack", "lainnya"] as const;
export type KantinCategory = (typeof KANTIN_CATEGORIES)[number];

export function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    minuman: "Minuman",
    makanan: "Makanan",
    snack: "Snack",
    lainnya: "Lainnya",
  };
  return map[cat] ?? cat;
}

/** Cart total from client-side product prices (display only — server recomputes) */
export function cartTotal(
  lines: CartLine[],
  priceById: Record<string, number>
): number {
  return lines.reduce((sum, l) => sum + (priceById[l.product_id] ?? 0) * l.qty, 0);
}

/** COGS from priced snapshot lines (server data shape) */
export function linesCOGS(lines: Array<{ qty: number; unit_cost: number }>): number {
  return lines.reduce((sum, l) => sum + l.unit_cost * l.qty, 0);
}

/** Gross profit = revenue - COGS */
export function grossProfit(
  lines: Array<{ qty: number; unit_price: number; unit_cost: number }>
): { revenue: number; cogs: number; profit: number } {
  const revenue = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const cogs = linesCOGS(lines);
  return { revenue, cogs, profit: revenue - cogs };
}

/** Products at/below their low-stock threshold (only tracked stock) */
export function lowStockProducts(
  products: Array<{
    name: string;
    track_stock: boolean;
    stock: number;
    low_stock_threshold: number;
  }>
): string[] {
  return products
    .filter((p) => p.track_stock && p.stock <= p.low_stock_threshold)
    .map((p) => p.name);
}
