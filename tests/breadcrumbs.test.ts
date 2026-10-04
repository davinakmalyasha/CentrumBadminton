import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { resolveTrail } from "../src/components/app/Breadcrumbs";

describe("resolveTrail", () => {
  it("returns null on Beranda itself", () => {
    expect(resolveTrail("/app")).toBeNull();
  });

  it("returns null on paths no menu item owns", () => {
    expect(resolveTrail("/app/login")).toBeNull();
    expect(resolveTrail("/app/nope/deep")).toBeNull();
  });

  it("maps top-level pages to Beranda + label", () => {
    expect(resolveTrail("/app/jadwal")).toEqual([
      { label: "Beranda", href: "/app" },
      { label: "Jadwal" },
    ]);
    expect(resolveTrail("/app/booking/baru")).toEqual([
      { label: "Beranda", href: "/app" },
      { label: "Tambah Booking" },
    ]);
  });

  it("never names Beranda twice on deep pages", () => {
    const crumbs = resolveTrail("/app/booking/baru")!;
    expect(crumbs.filter((c) => c.label === "Beranda")).toHaveLength(1);
  });

  it("inserts the hub parent for nested pages", () => {
    expect(resolveTrail("/app/kantin/stok")).toEqual([
      { label: "Beranda", href: "/app" },
      { label: "Kantin", href: "/app/kantin" },
      { label: "Stok" },
    ]);
    expect(resolveTrail("/app/laporan/riwayat")).toEqual([
      { label: "Beranda", href: "/app" },
      { label: "Laporan", href: "/app/laporan" },
      { label: "Riwayat Booking" },
    ]);
  });

  it("prefers the longest match", () => {
    expect(resolveTrail("/app/laporan/kantin")).toEqual([
      { label: "Beranda", href: "/app" },
      { label: "Laporan", href: "/app/laporan" },
      { label: "Kantin" },
    ]);
  });
});
