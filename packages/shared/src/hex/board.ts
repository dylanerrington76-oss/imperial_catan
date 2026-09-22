import { areAdjacent, hexagonCellCount, hexagonCoordinates } from "./coordinates.js";
import { createRng, seededShuffle, type Rng } from "./rng.js";
import { isTerritoryHex } from "./types.js";
import type { AxialCoordinate, Board, Resource, TerritoryHex, WaterHex } from "./types.js";

/**
 * NOTE ON ASSUMPTIONS
 * -------------------
 * The rulebook fixes the totals (217 hexes: 55 territory + 162 water) and
 * the value ranges (numbers 2-12, four resources), but does not specify the
 * board's shape, the resource split among the 55 tiles, or how the number
 * tokens are distributed. The choices below are reasonable, documented
 * defaults - not facts pulled from the rulebook - and are easy to swap out:
 *
 * - Shape: a hexagon of radius 8 has exactly 217 cells (3r^2+3r+1), which
 *   matches the total from the rulebook, so the board is generated as that
 *   hexagon with a 55-hex "island" carved out of it (see pickLandAndWater).
 * - Resources: split as evenly as possible across the 55 tiles (14/14/14/13)
 *   since the rulebook treats all four resources symmetrically.
 * - Numbers: this ruleset has no robber/desert, so unlike standard Catan,
 *   7 is a live production number. Token counts are proportional to true
 *   2-die roll probability (ways-to-roll out of 36: 1,2,3,4,5,6,5,4,3,2,1),
 *   rounded to sum to exactly 55 while staying symmetric around 7.
 */

/** Radius chosen so the hexagon has exactly 217 cells (3r^2 + 3r + 1). */
export const BOARD_RADIUS = 8;

export const TOTAL_HEX_COUNT = 217;
export const TERRITORY_HEX_COUNT = 55;
export const WATER_HEX_COUNT = TOTAL_HEX_COUNT - TERRITORY_HEX_COUNT;

const RESOURCES: readonly Resource[] = ["Wood", "Brick", "Wheat", "Stone"];

export const NUMBER_TOKEN_COUNTS: ReadonlyMap<number, number> = new Map([
  [2, 1],
  [3, 3],
  [4, 5],
  [5, 6],
  [6, 8],
  [7, 9],
  [8, 8],
  [9, 6],
  [10, 5],
  [11, 3],
  [12, 1],
]);

const HIGH_PROBABILITY_NUMBERS: ReadonlySet<number> = new Set([6, 8]);

function assertConsistentConstants(): void {
  const actualCellCount = hexagonCellCount(BOARD_RADIUS);
  if (actualCellCount !== TOTAL_HEX_COUNT) {
    throw new Error(`BOARD_RADIUS ${BOARD_RADIUS} yields ${actualCellCount} hexes, expected ${TOTAL_HEX_COUNT}.`);
  }

  let tokenTotal = 0;
  for (const count of NUMBER_TOKEN_COUNTS.values()) {
    tokenTotal += count;
  }
  if (tokenTotal !== TERRITORY_HEX_COUNT) {
    throw new Error(`Number token counts sum to ${tokenTotal}, expected ${TERRITORY_HEX_COUNT}.`);
  }
}

function buildResourcePool(count: number): Resource[] {
  const base = Math.floor(count / RESOURCES.length);
  const remainder = count % RESOURCES.length;
  const pool: Resource[] = [];
  RESOURCES.forEach((resource, index) => {
    const extra = index < remainder ? 1 : 0;
    for (let i = 0; i < base + extra; i++) {
      pool.push(resource);
    }
  });
  return pool;
}

function buildNumberTokenPool(): number[] {
  const pool: number[] = [];
  for (const [value, count] of NUMBER_TOKEN_COUNTS) {
    for (let i = 0; i < count; i++) {
      pool.push(value);
    }
  }
  return pool;
}

function findAdjacentHighProbabilityIndex(
  coords: readonly AxialCoordinate[],
  numbers: readonly number[],
  index: number,
  ignoreIndex: number | undefined,
): number {
  for (let other = 0; other < coords.length; other++) {
    if (other === index || other === ignoreIndex) continue;
    if (HIGH_PROBABILITY_NUMBERS.has(numbers[other]) && areAdjacent(coords[index], coords[other])) {
      return other;
    }
  }
  return -1;
}

/**
 * Best-effort pass that swaps number tokens so 6s and 8s (the two highest
 * roll probabilities) don't sit next to each other, mirroring how physical
 * Catan boards are hand-placed. Not guaranteed to clear every clash on a
 * dense board, but converges quickly at this board's ~25% land density.
 */
export function reduceHighProbabilityAdjacency(coords: readonly AxialCoordinate[], numbers: readonly number[]): number[] {
  const result = numbers.slice();
  const maxPasses = coords.length;

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;

    for (let i = 0; i < coords.length; i++) {
      if (!HIGH_PROBABILITY_NUMBERS.has(result[i])) continue;

      const clashIndex = findAdjacentHighProbabilityIndex(coords, result, i, undefined);
      if (clashIndex === -1) continue;

      const swapWith = result.findIndex((value, candidate) => {
        if (candidate === i || candidate === clashIndex) return false;
        if (HIGH_PROBABILITY_NUMBERS.has(value)) return false;
        if (areAdjacent(coords[candidate], coords[clashIndex])) return false;
        return findAdjacentHighProbabilityIndex(coords, result, candidate, i) === -1;
      });

      if (swapWith !== -1) {
        const temp = result[i];
        result[i] = result[swapWith];
        result[swapWith] = temp;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return result;
}

function pickLandAndWater(
  allCoordinates: readonly AxialCoordinate[],
  rng: Rng,
): { land: AxialCoordinate[]; water: AxialCoordinate[] } {
  // Make a seeded copy so the original coordinate list is not modified.
  const shuffled = [...allCoordinates];

  // Fisher-Yates shuffle using the seeded RNG.
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));

    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  // The first 55 randomly selected hexes are land.
  const land = shuffled.slice(0, TERRITORY_HEX_COUNT);

  // The remaining 162 are water.
  const water = shuffled.slice(TERRITORY_HEX_COUNT);

  // Keep deterministic ordering before assigning resources/numbers.
  land.sort((a, b) => a.q - b.q || a.r - b.r);
  water.sort((a, b) => a.q - b.q || a.r - b.r);

  return { land, water };
}

/**
 * Deterministically generates the Imperial Catan board (217 hexes: 55
 * territory + 162 water) for a given numeric seed. The same seed always
 * produces the same board; different seeds produce different boards.
 */
export function generateBoard(seed: number): Board {
  assertConsistentConstants();

  const rng = createRng(seed);
  const allCoordinates = hexagonCoordinates(BOARD_RADIUS);
  const { land, water } = pickLandAndWater(allCoordinates, rng);

  const resources = seededShuffle(buildResourcePool(TERRITORY_HEX_COUNT), rng);
  const shuffledNumbers = seededShuffle(buildNumberTokenPool(), rng);
  const numbers = reduceHighProbabilityAdjacency(land, shuffledNumbers);

  const territoryHexes: TerritoryHex[] = land.map((coord, index) => ({
    kind: "territory",
    q: coord.q,
    r: coord.r,
    resource: resources[index],
    number: numbers[index],
  }));

  const waterHexes: WaterHex[] = water.map((coord) => ({
    kind: "water",
    q: coord.q,
    r: coord.r,
  }));

  return {
    seed,
    radius: BOARD_RADIUS,
    hexes: [...territoryHexes, ...waterHexes],
  };
}

export function summarizeBoard(board: Board): string {
  const territoryHexes = board.hexes.filter(isTerritoryHex);
  const waterCount = board.hexes.length - territoryHexes.length;

  const resourceCounts = new Map<Resource, number>();
  const numberCounts = new Map<number, number>();
  for (const hex of territoryHexes) {
    resourceCounts.set(hex.resource, (resourceCounts.get(hex.resource) ?? 0) + 1);
    numberCounts.set(hex.number, (numberCounts.get(hex.number) ?? 0) + 1);
  }

  const resourceSummary = RESOURCES.map((resource) => `${resource}=${resourceCounts.get(resource) ?? 0}`).join(", ");
  const numberSummary = [...numberCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => `${value}:${count}`)
    .join(" ");

  return [
    `Seed ${board.seed} (radius ${board.radius})`,
    `${territoryHexes.length} territory hexes, ${waterCount} water hexes`,
    `Resources -> ${resourceSummary}`,
    `Numbers   -> ${numberSummary}`,
  ].join("\n");
}
