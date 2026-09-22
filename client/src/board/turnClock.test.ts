import { describe, expect, it } from "vitest";
import { formatClock, remainingTurnMs } from "./turnClock.js";

describe("remainingTurnMs", () => {
  it("counts down from the limit as time passes", () => {
    expect(remainingTurnMs(1000, 120_000, 1000)).toBe(120_000);
    expect(remainingTurnMs(1000, 120_000, 31_000)).toBe(90_000);
  });

  it("never goes negative once the limit has elapsed", () => {
    expect(remainingTurnMs(0, 120_000, 999_999)).toBe(0);
  });
});

describe("formatClock", () => {
  it("formats whole minutes", () => {
    expect(formatClock(120_000)).toBe("2:00");
  });

  it("pads seconds under 10", () => {
    expect(formatClock(65_000)).toBe("1:05");
  });

  it("rounds up partial seconds so the display never shows 0:00 early", () => {
    expect(formatClock(500)).toBe("0:01");
  });

  it("formats zero as 0:00", () => {
    expect(formatClock(0)).toBe("0:00");
  });
});
