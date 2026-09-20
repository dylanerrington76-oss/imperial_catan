import type { BuildingType, PieceInventory, ResourceHand, UnitType } from "./types.js";

export const BUILDING_COSTS: Readonly<Record<BuildingType, Partial<ResourceHand>>> = {
  Settlement: { Wheat: 2, Wood: 1 },
  City: { Wheat: 3, Wood: 2 },
  Port: { Wheat: 1, Stone: 1, Brick: 1, Wood: 2 },
};

export const UNIT_COSTS: Readonly<Record<UnitType, Partial<ResourceHand>>> = {
  Soldier: { Wheat: 1 },
  Cavalry: { Wood: 1, Stone: 1 },
  ArtilleryCannon: { Stone: 1, Brick: 1, Wood: 1 },
  Ship: { Wood: 1 },
  Destroyer: { Wood: 2, Stone: 2, Brick: 1 },
};

export const STARTING_PIECE_COUNTS: PieceInventory = {
  settlements: 8,
  cities: 5,
  ports: 4,
  soldiers: 30,
  cavalry: 20,
  artilleryCannons: 10,
  // Rulebook states a cap for every other piece but not ships; `null` = no limit.
  ships: null,
  destroyers: 10,
};

/**
 * Rulebook OBJECTIVE lists Settlement/City/Largest Army/Largest Navy VP
 * values but not Port; BUILD Item 3 separately states "Ports are worth 1
 * VP." Treated as authoritative here (it's the more specific statement),
 * but worth confirming with the team since the summary table omits it.
 */
export const SETTLEMENT_VICTORY_POINTS = 1;
export const CITY_VICTORY_POINTS = 2;
export const PORT_VICTORY_POINTS = 1;
export const LARGEST_ARMY_VICTORY_POINTS = 2;
export const LARGEST_NAVY_VICTORY_POINTS = 2;
export const ODYSSEY_BONUS_VICTORY_POINTS = 3;

export const WINNING_VICTORY_POINTS = 15;
export const STARTING_SOLDIER_COUNT = 5;
export const TURN_TIME_LIMIT_MS = 2 * 60 * 1000;
export const ARTILLERY_CANNONS_FOR_LARGEST_ARMY = 3;
export const DESTROYERS_FOR_LARGEST_NAVY = 3;
export const BANK_TRADE_RATE = 4;
export const PORT_TRADE_RATE = 3;
