import { describe, expect, it } from "vitest";
import {
  addMonths,
  daysInMonth,
  monthEndExclusive,
  monthKey,
  monthStart,
} from "../src/lib/months";

describe("monthKey", () => {
  it("slices YYYY-MM from ISO date", () => {
    expect(monthKey("2026-08-24")).toBe("2026-08");
  });
});

describe("monthStart", () => {
  it("returns first day", () => {
    expect(monthStart("2026-08")).toBe("2026-08-01");
  });
});

describe("monthEndExclusive", () => {
  it("returns first day of next month for 31-day month", () => {
    expect(monthEndExclusive("2026-08")).toBe("2026-09-01");
  });
  it("handles February non-leap year", () => {
    expect(monthEndExclusive("2026-02")).toBe("2026-03-01");
  });
  it("handles February leap year", () => {
    expect(monthEndExclusive("2028-02")).toBe("2028-03-01");
  });
  it("wraps year boundary", () => {
    expect(monthEndExclusive("2026-12")).toBe("2027-01-01");
  });
});

describe("daysInMonth", () => {
  it("counts 31 for August", () => {
    expect(daysInMonth("2026-08")).toBe(31);
  });
  it("counts 28 for non-leap February", () => {
    expect(daysInMonth("2026-02")).toBe(28);
  });
  it("counts 29 for leap February", () => {
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("addMonths", () => {
  it("advances within year", () => {
    expect(addMonths("2026-08", 1)).toBe("2026-09");
  });
  it("wraps year forward", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
  it("wraps year backward", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
  it("handles multi-month jumps", () => {
    expect(addMonths("2026-08", -7)).toBe("2026-01");
    expect(addMonths("2026-08", 5)).toBe("2027-01");
  });
});
