import type { AxialCoordinate } from "@monorepo/shared";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Flat-top hex size (center to corner), matching classic Catan's tile orientation. */
export const HEX_SIZE = 34;

/** Standard flat-top axial-to-pixel projection (see redblobgames.com/grids/hexagons). */
export function axialToPixel(coordinate: AxialCoordinate, size: number = HEX_SIZE): Point {
  const x = size * (1.5 * coordinate.q);
  const y = size * ((Math.sqrt(3) / 2) * coordinate.q + Math.sqrt(3) * coordinate.r);
  return { x, y };
}

/** The 6 corner points of a flat-top hex centered at `center`, in drawing order. */
export function hexCorners(center: Point, size: number = HEX_SIZE): Point[] {
  const corners: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    corners.push({ x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) });
  }
  return corners;
}

export interface BoardBounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

/** The pixel bounding box of every hex center in `coordinates`, padded by one hex so edge tiles aren't clipped. */
export function boardBounds(coordinates: readonly AxialCoordinate[], size: number = HEX_SIZE): BoardBounds {
  const centers = coordinates.map((coordinate) => axialToPixel(coordinate, size));
  const pad = size * 1.5;
  const minX = Math.min(...centers.map((point) => point.x)) - pad;
  const maxX = Math.max(...centers.map((point) => point.x)) + pad;
  const minY = Math.min(...centers.map((point) => point.y)) - pad;
  const maxY = Math.max(...centers.map((point) => point.y)) + pad;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}
