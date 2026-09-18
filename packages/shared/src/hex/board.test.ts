import { describe, expect, it } from "vitest";
import {
  NUMBER_TOKEN_COUNTS,
  TERRITORY_HEX_COUNT,
  TOTAL_HEX_COUNT,
  WATER_HEX_COUNT,
  generateBoard,
  reduceHighProbabilityAdjacency,
} from "./board.js";
import { areAdjacent } from "./coordinates.js";
import { isTerritoryHex, isWaterHex } from "./types.js";
import type { AxialCoordinate } from "./types.js";

describe("generateBoard", () => {
  it("produces exactly 55 territory hexes and 162 water hexes (217 total)", () => {
    const board = generateBoard(42);
    expect(board.hexes).toHaveLength(TOTAL_HEX_COUNT);
    expect(board.hexes.filter(isTerritoryHex)).toHaveLength(TERRITORY_HEX_COUNT);
    expect(board.hexes.filter(isWaterHex)).toHaveLength(WATER_HEX_COUNT);
  });

  it("is fully deterministic for a given seed", () => {
    const first = generateBoard(1234);
    const second = generateBoard(1234);
    expect(second).toEqual(first);
  });

  it("has no duplicate hex coordinates", () => {
    const board = generateBoard(7);
    const keys = new Set(board.hexes.map((hex) => `${hex.q},${hex.r}`));
    expect(keys.size).toBe(board.hexes.length);
  });

  it("assigns every territory hex a valid resource and a number in [2, 12]", () => {
    const board = generateBoard(99);
    for (const hex of board.hexes.filter(isTerritoryHex)) {
      expect(["Wood", "Brick", "Wheat", "Stone"]).toContain(hex.resource);
      expect(hex.number).toBeGreaterThanOrEqual(2);
      expect(hex.number).toBeLessThanOrEqual(12);
    }
  });

  it("matches the configured number-token distribution exactly", () => {
    const board = generateBoard(2026);
    const counts = new Map<number, number>();
    for (const hex of board.hexes.filter(isTerritoryHex)) {
      counts.set(hex.number, (counts.get(hex.number) ?? 0) + 1);
    }
    for (const [value, expectedCount] of NUMBER_TOKEN_COUNTS) {
      expect(counts.get(value) ?? 0).toBe(expectedCount);
    }
  });

  it("keeps resource counts as even as a 55/4 split allows (14/14/14/13)", () => {
    const board = generateBoard(555);
    const counts = new Map<string, number>();
    for (const hex of board.hexes.filter(isTerritoryHex)) {
      counts.set(hex.resource, (counts.get(hex.resource) ?? 0) + 1);
    }
    expect([...counts.values()].sort((a, b) => a - b)).toEqual([13, 14, 14, 14]);
  });

  it("produces a different layout for a different seed", () => {
    const a = generateBoard(1);
    const b = generateBoard(2);
    expect(a).not.toEqual(b);
  });

  it("handles the seed=0 edge case (a valid seed, not 'no seed')", () => {
    expect(() => generateBoard(0)).not.toThrow();
  });
});

describe("reduceHighProbabilityAdjacency", () => {
  it("swaps a clashing pair of 6/8 tokens with a non-adjacent, non-hot tile", () => {
    // Three tiles in a row: 0-1 are adjacent, 1-2 are adjacent, 0-2 are not.
    const coords: AxialCoordinate[] = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: -1 }, // not adjacent to (0,0); adjacent to (1,0)
    ];
    // Tile 0 and tile 1 clash (both "hot"); tile 2 is a safe swap target.
    const numbers = [6, 8, 4];

    const result = reduceHighProbabilityAdjacency(coords, numbers);

    // The clash between index 0 and 1 must be resolved.
    const hotIndices = result.map((n, i) => ({ n, i })).filter(({ n }) => n === 6 || n === 8);
    for (let i = 0; i < hotIndices.length; i++) {
      for (let j = i + 1; j < hotIndices.length; j++) {
        expect(areAdjacent(coords[hotIndices[i].i], coords[hotIndices[j].i])).toBe(false);
      }
    }
    // The same multiset of numbers must still be present (a swap, not a rewrite).
    expect(result.slice().sort()).toEqual(numbers.slice().sort());
  });

  it("leaves an already-clash-free arrangement unchanged", () => {
    const coords: AxialCoordinate[] = [
      { q: 0, r: 0 },
      { q: 5, r: 0 },
      { q: 10, r: 0 },
    ];
    const numbers = [6, 8, 5];
    expect(reduceHighProbabilityAdjacency(coords, numbers)).toEqual(numbers);
  });
});

describe("generateBoard (6/8 adjacency, best effort)", () => {
  it("eliminates all adjacent 6/8 pairs for a representative sample of seeds", () => {
    // The balancing pass is best-effort, not a formal guarantee, so this
    // checks a sample of seeds rather than asserting it for every seed.
    for (const seed of [1, 2, 99, 555, 1234, 2026, 987654]) {
      const board = generateBoard(seed);
      const hot = board.hexes.filter(isTerritoryHex).filter((hex) => hex.number === 6 || hex.number === 8);
      let clashes = 0;
      for (let i = 0; i < hot.length; i++) {
        for (let j = i + 1; j < hot.length; j++) {
          if (areAdjacent(hot[i], hot[j])) clashes++;
        }
      }
      expect(clashes).toBe(0);
    }
  });
});
