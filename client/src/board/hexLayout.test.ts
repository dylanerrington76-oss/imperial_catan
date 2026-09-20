import { describe, expect, it } from "vitest";
import { axialToPixel, boardBounds, hexCorners } from "./hexLayout.js";

describe("axialToPixel", () => {
  it("places the origin hex at the pixel origin", () => {
    expect(axialToPixel({ q: 0, r: 0 }, 10)).toEqual({ x: 0, y: 0 });
  });

  it("moves purely horizontally along the q axis", () => {
    const point = axialToPixel({ q: 2, r: 0 }, 10);
    expect(point.x).toBeCloseTo(30);
  });
});

describe("hexCorners", () => {
  it("returns 6 points each exactly `size` from the center", () => {
    const center = { x: 100, y: 50 };
    const corners = hexCorners(center, 20);
    expect(corners).toHaveLength(6);
    for (const corner of corners) {
      const distance = Math.hypot(corner.x - center.x, corner.y - center.y);
      expect(distance).toBeCloseTo(20);
    }
  });
});

describe("boardBounds", () => {
  it("covers a single hex, padded by one and a half hex-widths", () => {
    const bounds = boardBounds([{ q: 0, r: 0 }], 10);
    expect(bounds.width).toBeCloseTo(30);
    expect(bounds.height).toBeCloseTo(30);
    expect(bounds.minX).toBeCloseTo(-15);
    expect(bounds.minY).toBeCloseTo(-15);
  });
});
