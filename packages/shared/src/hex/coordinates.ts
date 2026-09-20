import type { AxialCoordinate } from "./types.js";

/** Hex distance between two axial coordinates. */
export function axialDistance(a: AxialCoordinate, b: AxialCoordinate): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr; // third cube-coordinate difference
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

export function areAdjacent(a: AxialCoordinate, b: AxialCoordinate): boolean {
  return axialDistance(a, b) === 1;
}

/**
 * All axial coordinates within `radius` steps of the origin, forming a
 * regular hexagon of hexes. Contains exactly `hexagonCellCount(radius)`
 * cells.
 */
export function hexagonCoordinates(radius: number): AxialCoordinate[] {
  const coordinates: AxialCoordinate[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      coordinates.push({ q, r });
    }
  }
  return coordinates;
}

export function hexagonCellCount(radius: number): number {
  return 3 * radius * radius + 3 * radius + 1;
}

/**
 * Stable string key for an axial coordinate, e.g. `"3,-2"`. `Hex`/`Board`
 * (see `./types.js`) are pure seeded geometry and carry no id of their own;
 * this is how the mutable, per-hex game state in `../game/types.js`
 * (`HexId`, `HexState`) is keyed and cross-referenced against them.
 */
export function hexId(coordinate: AxialCoordinate): string {
  return `${coordinate.q},${coordinate.r}`;
}
