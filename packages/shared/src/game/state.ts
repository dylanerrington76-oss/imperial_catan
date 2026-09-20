import { generateBoard, hexId } from "../hex/index.js";
import { STARTING_PIECE_COUNTS, TURN_TIME_LIMIT_MS } from "./costs.js";
import { rollTwoDice } from "./dice.js";
import type { GameState, HexState, PlayerColor, PlayerId } from "./types.js";

export interface PlayerSetup {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: PlayerColor;
}

/**
 * Rulebook SET UP Step 2: each player rolls 2 dice; the highest total seats
 * first. The rulebook doesn't specify a tie-break (e.g. a re-roll), so ties
 * keep their original relative order - a documented simplification.
 */
export function determineTurnOrder(playerIds: readonly PlayerId[], rng: () => number = Math.random): PlayerId[] {
  return playerIds
    .map((id, index) => ({ id, index, total: rollTwoDice(rng).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total || a.index - b.index)
    .map((entry) => entry.id);
}

/**
 * Builds a fresh `GameState` at the very start of SET UP Step 3 (starting
 * soldier placement), given a board seed and the seating order from
 * `determineTurnOrder`. Resource hands start empty - Step 5's starting
 * resources are granted automatically once Step 4 completes, inside
 * `applyPlaceStartingSettlementAndPort` (see `./reducers.js`).
 */
export function createInitialGameState(
  gameId: string,
  seed: number,
  players: readonly PlayerSetup[],
  turnOrder: readonly PlayerId[],
): GameState {
  if (players.length < 2 || players.length > 4) {
    throw new Error(`Imperial Catan supports 2-4 players, got ${players.length}.`);
  }
  if (turnOrder.length !== players.length || new Set(turnOrder).size !== players.length) {
    throw new Error("turnOrder must contain each player's id exactly once.");
  }
  for (const id of turnOrder) {
    if (!players.some((player) => player.id === id)) {
      throw new Error(`turnOrder references unknown player id: ${id}`);
    }
  }

  const board = generateBoard(seed);
  const hexes: Record<string, HexState> = {};
  for (const hex of board.hexes) {
    const id = hexId(hex);
    hexes[id] = { hexId: id, units: [], buildings: [] };
  }

  return {
    gameId,
    board,
    hexes,
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      resources: { Wood: 0, Brick: 0, Wheat: 0, Stone: 0 },
      victoryPoints: 0,
      remainingPieces: { ...STARTING_PIECE_COUNTS },
      hasLargestArmy: false,
      hasLargestNavy: false,
      hasClaimedOdysseyBonus: false,
      eliminated: false,
    })),
    turnOrder: [...turnOrder],
    stage: "setup",
    setup: { step: "soldiers", activePlayerId: turnOrder[0], placingInReverseOrder: false },
    currentPlayerId: turnOrder[0],
    phase: "production",
    turnNumber: 0,
    turnStartedAt: Date.now(),
    turnTimeLimitMs: TURN_TIME_LIMIT_MS,
    diceRoll: null,
    portsUsedThisTurn: [],
    pendingTrade: null,
    largestArmyOwnerId: null,
    largestNavyOwnerId: null,
    odysseyBonusClaimed: false,
    winnerId: null,
  };
}
