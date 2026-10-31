import { describe, expect, it } from "vitest";
import { placePanel, type AnchorRect } from "../src/lib/popover";

const DESKTOP = { maxWidth: 420, maxHeight: 560 };
const MOBILE = { maxWidth: 420, maxHeight: 560 };

function anchor(right: number, bottom = 60): AnchorRect {
  return { top: 20, left: right - 40, right, bottom };
}

describe("placePanel", () => {
  it("drops below the anchor by the gap", () => {
    const box = placePanel(anchor(1400), { width: 1440, height: 900 }, DESKTOP);
    expect(box.top).toBe(68);
  });

  it("right-aligns with the anchor instead of the viewport", () => {
    const box = placePanel(anchor(1400), { width: 1440, height: 900 }, DESKTOP);
    expect(box.left + box.width).toBe(1400);
  });

  it("stays with the anchor on a wide desktop where the header is centred", () => {
    // max-w-7xl (1280) inside a 1920 window leaves the button ~344px in.
    const box = placePanel(anchor(1576), { width: 1920, height: 1080 }, DESKTOP);
    expect(box.left).toBe(1156);
    expect(box.left + box.width).toBe(1576);
    expect(box.width).toBe(420);
  });

  it("caps desktop size and fits inside the viewport", () => {
    const box = placePanel(anchor(1400), { width: 1440, height: 900 }, DESKTOP);
    expect(box.width).toBe(420);
    expect(box.height).toBe(560);
    expect(box.top + box.height).toBeLessThanOrEqual(900 - 12);
  });

  it("goes full width minus margins on mobile", () => {
    const viewport = { width: 390, height: 780 };
    const box = placePanel(
      anchor(374),
      viewport,
      { maxWidth: viewport.width, maxHeight: viewport.height },
    );
    expect(box.left).toBe(12);
    expect(box.width).toBe(366);
    expect(box.left + box.width).toBe(viewport.width - 12);
  });

  it("fills the remaining height on mobile", () => {
    const viewport = { width: 390, height: 780 };
    const box = placePanel(
      anchor(374),
      viewport,
      { maxWidth: viewport.width, maxHeight: viewport.height },
    );
    expect(box.top + box.height).toBe(viewport.height - 12);
  });

  it("never runs off the left edge when the viewport is narrower than the panel", () => {
    const viewport = { width: 300, height: 600 };
    const box = placePanel(anchor(288), viewport, MOBILE);
    expect(box.left).toBeGreaterThanOrEqual(12);
    expect(box.left + box.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(box.width).toBeGreaterThan(0);
  });

  it("never runs off the right edge when the anchor sits at the far left", () => {
    const viewport = { width: 1440, height: 900 };
    const box = placePanel(anchor(40), viewport, DESKTOP);
    expect(box.left).toBe(12);
    expect(box.left + box.width).toBeLessThanOrEqual(viewport.width - 12);
  });

  it("falls back to minHeight on a short viewport", () => {
    const box = placePanel(anchor(1400, 60), { width: 1440, height: 320 }, DESKTOP);
    expect(box.height).toBe(280);
  });

  it("honours custom gap and margin", () => {
    const box = placePanel(anchor(1400, 60), { width: 1440, height: 900 }, {
      maxWidth: 420,
      maxHeight: 560,
      gap: 20,
      margin: 24,
    });
    expect(box.top).toBe(80);
    expect(box.left).toBe(1400 - 420);
  });
});