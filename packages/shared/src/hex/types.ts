export type Resource = "Wood" | "Brick" | "Wheat" | "Stone";

export interface AxialCoordinate {
  readonly q: number;
  readonly r: number;
}

export interface WaterHex extends AxialCoordinate {
  readonly kind: "water";
}

export interface TerritoryHex extends AxialCoordinate {
  readonly kind: "territory";
  readonly resource: Resource;
  /** Dice-roll total (2-12) that makes this hex produce. */
  readonly number: number;
}

export type Hex = WaterHex | TerritoryHex;

export interface Board {
  readonly seed: number;
  readonly radius: number;
  readonly hexes: readonly Hex[];
}

export function isTerritoryHex(hex: Hex): hex is TerritoryHex {
  return hex.kind === "territory";
}

export function isWaterHex(hex: Hex): hex is WaterHex {
  return hex.kind === "water";
}
