import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  buildSlots,
  computePrice,
  formatIDR,
  formatK,
  groupHours,
  type PricingInfo,
} from "../src/lib/availability";

const pricing: PricingInfo = {
  openHour: 7,
  closeHour: 23,
  dayEndHour: 17,
  priceDay: 40000,
  priceEvening: 50000,
};

describe("formatIDR", () => {
  it("formats Indonesian rupiah", () => {
    expect(formatIDR(150000)).toBe("Rp150.000");
    expect(formatIDR(0)).toBe("Rp0");
  });
});

describe("formatK", () => {
  it("shortens clean thousands", () => {
    expect(formatK(40000)).toBe("40rb");
    expect(formatK(50000)).toBe("50rb");
    expect(formatK(55000)).toBe("55rb");
  });
  it("falls back to full format for non-thousands", () => {
    expect(formatK(12500)).toBe("Rp12.500");
    expect(formatK(0)).toBe("Rp0");
  });
});

describe("computePrice", () => {
  it("prices day slots at day rate", () => {
    expect(computePrice(pricing, 7, 10)).toBe(120000);
  });
  it("prices evening slots at evening rate", () => {
    expect(computePrice(pricing, 19, 21)).toBe(100000);
  });
  it("splits across the day/evening boundary", () => {
    // 16:00-18:00 = 1 day hour + 1 evening hour
    expect(computePrice(pricing, 16, 18)).toBe(90000);
  });
  it("returns 0 for empty range", () => {
    expect(computePrice(pricing, 9, 9)).toBe(0);
  });
});

describe("groupHours", () => {
  it("groups consecutive hours", () => {
    expect(groupHours([7, 8, 9])).toEqual([[7, 10]]);
  });
  it("splits gaps", () => {
    expect(groupHours([7, 8, 10, 11])).toEqual([
      [7, 9],
      [10, 12],
    ]);
  });
  it("handles single hour and unsorted input", () => {
    expect(groupHours([13])).toEqual([[13, 14]]);
    expect(groupHours([9, 7, 8])).toEqual([[7, 10]]);
  });
  it("returns empty for empty input", () => {
    expect(groupHours([])).toEqual([]);
  });
});

describe("addDaysISO", () => {
  it("adds days across month boundary", () => {
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
  });
  it("adds days across year boundary", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("supports negative days", () => {
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("buildSlots", () => {
  const futureDate = addDaysISO(new Date().toISOString().slice(0, 10), 14);

  it("creates one slot per operating hour", () => {
    const slots = buildSlots(pricing, [], "court-1", futureDate, "2000-01-01");
    expect(slots).toHaveLength(16); // 07..22
    expect(slots[0].hour).toBe(7);
    expect(slots[15].hour).toBe(22);
  });

  it("marks evening slots with evening price", () => {
    const slots = buildSlots(pricing, [], "court-1", futureDate, "2000-01-01");
    const h16 = slots.find((s) => s.hour === 16)!;
    const h17 = slots.find((s) => s.hour === 17)!;
    expect(h16.price).toBe(40000);
    expect(h16.isEvening).toBe(false);
    expect(h17.price).toBe(50000);
    expect(h17.isEvening).toBe(true);
  });

  it("marks booked intervals for the right court", () => {
    const busy = [
      { court_id: "court-1", start_time: "09:00:00", end_time: "10:00:00", kind: "booked" as const },
      { court_id: null, start_time: "12:00:00", end_time: "13:00:00", kind: "blocked" as const },
    ];
    const slots = buildSlots(pricing, busy, "court-1", futureDate, "2000-01-01");
    expect(slots.find((s) => s.hour === 9)!.status).toBe("booked");
    expect(slots.find((s) => s.hour === 12)!.status).toBe("blocked");
    expect(slots.find((s) => s.hour === 10)!.status).toBe("available");
  });

  it("all-court blocks hit every court", () => {
    const busy = [
      { court_id: null, start_time: "08:00:00", end_time: "09:00:00", kind: "blocked" as const },
    ];
    const a = buildSlots(pricing, busy, "court-a", futureDate, "2000-01-01");
    const b = buildSlots(pricing, busy, "court-b", futureDate, "2000-01-01");
    expect(a.find((s) => s.hour === 8)!.status).toBe("blocked");
    expect(b.find((s) => s.hour === 8)!.status).toBe("blocked");
  });
});
