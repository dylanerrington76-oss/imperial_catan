import type { Board, Hex } from "../hex/index.js";
import { areAdjacent, hexId, isWaterHex } from "../hex/index.js";
import type { GameState, HexId, HexState, Player, PlayerId, ResourceHand, UnitType } from "./types.js";

export function getPlayer(state: GameState, playerId: PlayerId): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player id: ${playerId}`);
  return player;
}

export function getHexByHexId(board: Board, id: HexId): Hex | undefined {
  return board.hexes.find((hex) => hexId(hex) === id);
}

export function getHexState(state: GameState, id: HexId): HexState | undefined {
  return state.hexes[id];
}

/** Whether `playerId` has a unit or building on `id` (rulebook's "occupy"). */
export function isOccupiedBy(state: GameState, playerId: PlayerId, id: HexId): boolean {
  const hexState = state.hexes[id];
  if (!hexState) return false;
  return hexState.units.some((unit) => unit.ownerId === playerId) || hexState.buildings.some((building) => building.ownerId === playerId);
}

/** Rulebook COLLECT RESOURCES: "Only one player can occupy a hex at a time." */
export function occupyingPlayerId(state: GameState, id: HexId): PlayerId | null {
  const hexState = state.hexes[id];
  if (!hexState) return null;
  return hexState.units[0]?.ownerId ?? hexState.buildings[0]?.ownerId ?? null;
}

export function countUnits(state: GameState, playerId: PlayerId, unitType: UnitType): number {
  let count = 0;
  for (const hexState of Object.values(state.hexes)) {
    for (const unit of hexState.units) {
      if (unit.ownerId === playerId && unit.type === unitType) count++;
    }
  }
  return count;
}

export function hasResources(hand: ResourceHand, cost: Partial<ResourceHand>): boolean {
  return (Object.entries(cost) as [keyof ResourceHand, number][]).every(([resource, amount]) => hand[resource] >= amount);
}

/** Returns a new hand with `cost` subtracted. Does not check for sufficiency - call `hasResources` first. */
export function payResources(hand: ResourceHand, cost: Partial<ResourceHand>): ResourceHand {
  const next = { ...hand };
  for (const [resource, amount] of Object.entries(cost) as [keyof ResourceHand, number][]) {
    next[resource] -= amount;
  }
  return next;
}

export function giveResources(hand: ResourceHand, gains: Partial<ResourceHand>): ResourceHand {
  const next = { ...hand };
  for (const [resource, amount] of Object.entries(gains) as [keyof ResourceHand, number][]) {
    next[resource] += amount;
  }
  return next;
}

/** Rulebook BUILD Item 3: "Ports can only be built on a territory connected to water." */
export function isCoastalHex(board: Board, id: HexId): boolean {
  const hex = getHexByHexId(board, id);
  if (!hex) return false;
  return board.hexes.some((other) => isWaterHex(other) && areAdjacent(hex, other));
}

export function updatePlayer(state: GameState, playerId: PlayerId, updater: (player: Player) => Player): GameState {
  return { ...state, players: state.players.map((player) => (player.id === playerId ? updater(player) : player)) };
}

export function updateHexState(state: GameState, id: HexId, updater: (hexState: HexState) => HexState): GameState {
  const current = state.hexes[id] ?? { hexId: id, units: [], buildings: [] };
  return { ...state, hexes: { ...state.hexes, [id]: updater(current) } };
}
