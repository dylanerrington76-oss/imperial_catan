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
