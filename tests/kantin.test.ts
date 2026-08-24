import { describe, expect, it } from "vitest";
import {
  cartTotal,
  categoryLabel,
  grossProfit,
  linesCOGS,
  lowStockProducts,
} from "../src/lib/kantin";

describe("cartTotal", () => {
  it("sums qty × price", () => {
    expect(
      cartTotal(
        [
          { product_id: "a", qty: 2 },
          { product_id: "b", qty: 1 },
        ],
        { a: 5000, b: 8000 }
      )
    ).toBe(18000);
  });
  it("ignores unknown products", () => {
    expect(cartTotal([{ product_id: "x", qty: 3 }], {})).toBe(0);
  });
  it("empty cart = 0", () => {
    expect(cartTotal([], { a: 1 })).toBe(0);
  });
});

describe("linesCOGS", () => {
  it("sums qty × unit_cost", () => {
    expect(
      linesCOGS([
        { qty: 2, unit_cost: 2000 },
        { qty: 1, unit_cost: 3500 },
      ])
    ).toBe(7500);
  });
});

describe("grossProfit", () => {
  it("revenue − cogs", () => {
    const r = grossProfit([{ qty: 2, unit_price: 5000, unit_cost: 2000 }]);
    expect(r).toEqual({ revenue: 10000, cogs: 4000, profit: 6000 });
  });
  it("zero margin → zero profit", () => {
    const r = grossProfit([{ qty: 1, unit_price: 5000, unit_cost: 5000 }]);
    expect(r.profit).toBe(0);
  });
});

describe("lowStockProducts", () => {
  it("flags tracked products at/below threshold", () => {
    expect(
      lowStockProducts([
        { name: "Es Teh", track_stock: true, stock: 2, low_stock_threshold: 5 },
        { name: "Biskuit", track_stock: false, stock: 0, low_stock_threshold: 5 },
        { name: "Kopi", track_stock: true, stock: 10, low_stock_threshold: 5 },
        { name: "Roti", track_stock: true, stock: 5, low_stock_threshold: 5 },
      ])
    ).toEqual(["Es Teh", "Roti"]);
  });
  it("empty input", () => {
    expect(lowStockProducts([])).toEqual([]);
  });
});

describe("categoryLabel", () => {
  it("maps known categories", () => {
    expect(categoryLabel("minuman")).toBe("Minuman");
    expect(categoryLabel("makanan")).toBe("Makanan");
  });
  it("passes through unknown", () => {
    expect(categoryLabel("rokok")).toBe("rokok");
  });
});
