import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildXlsx, xlsxSafe } from "@/lib/xlsx";

describe("xlsxSafe", () => {
  it("prefixes formula-like strings with an apostrophe", () => {
    expect(xlsxSafe("=1+1")).toBe("'=1+1");
    expect(xlsxSafe("+62811")).toBe("'+62811");
    expect(xlsxSafe("@handle")).toBe("'@handle");
    expect(xlsxSafe("-5")).toBe("'-5");
  });

  it("leaves ordinary text and an existing apostrophe alone", () => {
    expect(xlsxSafe("Budi")).toBe("Budi");
    expect(xlsxSafe("'=already text")).toBe("'=already text");
  });
});

describe("buildXlsx", () => {
  it("returns a non-empty ZIP container (xlsx)", async () => {
    const bytes = await buildXlsx(
      ["Nama", "Nominal"],
      [
        ["=1+1", 1000],
        ["Budi", 25000],
      ],
      "Laporan",
      16
    );

    expect(bytes.byteLength).toBeGreaterThan(500);
    // Every xlsx is a ZIP archive beginning with "PK".
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it("stores formula-like text as literal text, not a formula", async () => {
    const bytes = await buildXlsx(
      ["Nama", "Nominal"],
      [["=1+1", 1000]],
      "Laporan",
      16
    );
    const files = unzipSync(bytes);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    const shared = strFromU8(files["xl/sharedStrings.xml"]);

    expect(sheet).not.toContain("<f>");
    expect(shared).toContain("'=1+1");
  });
});
