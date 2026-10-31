import { describe, expect, it } from "vitest";
import { drawerSections } from "../src/components/app/AppNav";

function hrefs(isOwner: boolean): string[] {
  return drawerSections(isOwner).flatMap((s) => s.items.map((i) => i.href));
}

describe("drawerSections", () => {
  it("hides owner-only primary items from pegawai", () => {
    expect(hrefs(false)).not.toContain("/app/series");
    expect(hrefs(false)).toContain("/app/kantin");
  });

  it("shows the Member entry to the owner", () => {
    expect(hrefs(true)).toContain("/app/series");
  });

  it("no longer lists pengeluaran as its own menu item", () => {
    expect(hrefs(true)).not.toContain("/app/pengeluaran");
    expect(hrefs(false)).not.toContain("/app/pengeluaran");
  });

  it("keeps pegawai away from the owner tier", () => {
    const pegawai = hrefs(false);
    expect(pegawai).not.toContain("/app/laporan");
    expect(pegawai).not.toContain("/app/blokir");
    expect(pegawai).toContain("/app/pengaturan");
  });
});