import type { Resource } from "../hex/index.js";
import { isTerritoryHex } from "../hex/index.js";
import { BUILDING_COSTS, STARTING_SOLDIER_COUNT } from "./costs.js";
import { countUnits, getHexByHexId, getHexState, getPlayer, hasResources, isCoastalHex, isOccupiedBy } from "./queries.js";
import type { GameState, HexId, PlayerId, Trade, TradeOffer, UnitId, UnitType } from "./types.js";

/**
 * `canMobilizeUnit`, `canMoveUnit`, and `canAttack` below are the only
 * validators still deliberately unimplemented: rulebook MOBILIZE, MOVEMENT,
 * and ATTACKING are Milestone 2 (combat) work, out of scope for the
 * Milestone 1 non-combat core loop this file otherwise implements. They
 * throw rather than guess, same as before.
 */
function notImplemented(fn: string, args: Record<string, unknown>): never {
  throw new Error(`${fn} is not implemented yet (called with ${JSON.stringify(args)})`);
}

/* ------------------------------------------------------------------------ */
/* SETUP - rulebook SET UP, Steps 3-4 (Step 5 is automatic, see reducers.ts) */
/* ------------------------------------------------------------------------ */

/** Step 3: a soldier may only go on an empty territory hex, in snake-draft turn order, up to 5 per player. */
export function canPlaceStartingSoldier(state: GameState, playerId: PlayerId, hexId: HexId): boolean {
  if (state.stage !== "setup" || state.setup?.step !== "soldiers") return false;
  if (state.setup.activePlayerId !== playerId) return false;

  const hex = getHexByHexId(state.board, hexId);
  if (!hex || !isTerritoryHex(hex)) return false;

  const hexState = getHexState(state, hexId);
  if (hexState && (hexState.units.length > 0 || hexState.buildings.length > 0)) return false;

  return countUnits(state, playerId, "Soldier") < STARTING_SOLDIER_COUNT;
}

/**
 * Step 4: the settlement + port go together on a territory the player
 * already claimed with a soldier. Also requires water access, since the
 * port half of the pair is subject to the same rule as any other port
 * (BUILD Item 3) - see the ASSUMPTION note on `applyPlaceStartingSettlementAndPort`
 * in `./reducers.js` for a real risk this creates.
 */
export function canPlaceStartingSettlementAndPort(state: GameState, playerId: PlayerId, hexId: HexId): boolean {
  if (state.stage !== "setup" || state.setup?.step !== "settlements-and-ports") return false;
  if (state.setup.activePlayerId !== playerId) return false;

  const hex = getHexByHexId(state.board, hexId);
  if (!hex || !isTerritoryHex(hex)) return false;
  if (!isOccupiedBy(state, playerId, hexId)) return false;
  if (!isCoastalHex(state.board, hexId)) return false;

  const hexState = getHexState(state, hexId);
  if (hexState?.buildings.length) return false;

  const player = getPlayer(state, playerId);
  return player.remainingPieces.settlements > 0 && player.remainingPieces.ports > 0;
}

/* ------------------------------------------------------------------------ */
/* PRODUCTION - rulebook PRODUCTION PHASE                                    */
/* ------------------------------------------------------------------------ */

/** Roll dice once per turn, only during your own Production phase. */
export function canRollDice(state: GameState, playerId: PlayerId): boolean {
  return state.stage === "playing" && state.phase === "production" && state.currentPlayerId === playerId && state.diceRoll === null;
}

/* ------------------------------------------------------------------------ */
/* BUILD - rulebook BUILD, Items 1-3                                         */
/* ------------------------------------------------------------------------ */

/** 2 Wheat + 1 Wood, on a hex the player occupies, and only if a settlement piece remains. */
export function canBuildSettlement(state: GameState, playerId: PlayerId, hexId: HexId): boolean {
  if (state.stage !== "playing" || state.phase !== "action" || state.currentPlayerId !== playerId) return false;

  const hex = getHexByHexId(state.board, hexId);
  if (!hex || !isTerritoryHex(hex)) return false;
  if (!isOccupiedBy(state, playerId, hexId)) return false;

  const hexState = getHexState(state, hexId);
  if (hexState?.buildings.some((building) => building.type === "Settlement" || building.type === "City")) return false;

  const player = getPlayer(state, playerId);
  if (player.remainingPieces.settlements <= 0) return false;
  return hasResources(player.resources, BUILDING_COSTS.Settlement);
}

/** 3 Wheat + 2 Wood; replaces the player's own settlement already on `hexId`. */
export function canBuildCity(state: GameState, playerId: PlayerId, hexId: HexId): boolean {
  if (state.stage !== "playing" || state.phase !== "action" || state.currentPlayerId !== playerId) return false;

  const hexState = getHexState(state, hexId);
  const settlement = hexState?.buildings.find((building) => building.type === "Settlement");
  if (!settlement || settlement.ownerId !== playerId) return false;

  const player = getPlayer(state, playerId);
  if (player.remainingPieces.cities <= 0) return false;
  return hasResources(player.resources, BUILDING_COSTS.City);
}

/** 1 Wheat + 1 Stone + 1 Brick + 2 Wood; only on an occupied territory hex connected to water. */
export function canBuildPort(state: GameState, playerId: PlayerId, hexId: HexId): boolean {
  if (state.stage !== "playing" || state.phase !== "action" || state.currentPlayerId !== playerId) return false;

  const hex = getHexByHexId(state.board, hexId);
  if (!hex || !isTerritoryHex(hex)) return false;
  if (!isOccupiedBy(state, playerId, hexId)) return false;
  if (!isCoastalHex(state.board, hexId)) return false;

  const hexState = getHexState(state, hexId);
  if (hexState?.buildings.some((building) => building.type === "Port")) return false;

  const player = getPlayer(state, playerId);
  if (player.remainingPieces.ports <= 0) return false;
  return hasResources(player.resources, BUILDING_COSTS.Port);
}

/* ------------------------------------------------------------------------ */
/* MOBILIZE - rulebook MOBILIZE, Items 1-5 (Milestone 2: combat)             */
/* ------------------------------------------------------------------------ */

export function canMobilizeUnit(state: GameState, playerId: PlayerId, hexId: HexId, unitType: UnitType): boolean {
  return notImplemented("canMobilizeUnit", { playerId, hexId, unitType, phase: state.phase });
}

/* ------------------------------------------------------------------------ */
/* TRADE - rulebook TRADE, Types 1-2, and the port's 3:1 exchange            */
/* ------------------------------------------------------------------------ */

function tradeOffersOverlappingResource(offer: TradeOffer): boolean {
  const wantKeys = Object.keys(offer.want);
  return Object.keys(offer.give).some((resource) => wantKeys.includes(resource));
}

/** Type 1: proposing a player-to-player trade. Rejects e.g. "3 Wood for 1 Wood". */
export function canProposeTrade(state: GameState, playerId: PlayerId, offer: TradeOffer): boolean {
  if (state.stage !== "playing" || state.phase !== "action" || state.currentPlayerId !== playerId) return false;
  if (state.pendingTrade) return false;
  if (tradeOffersOverlappingResource(offer)) return false;

  return hasResources(getPlayer(state, playerId).resources, offer.give);
}

/** Whether `playerId` may accept the given in-flight negotiation's live offer. */
export function canAcceptTrade(state: GameState, playerId: PlayerId, trade: Trade): boolean {
  if (!state.pendingTrade || state.pendingTrade.id !== trade.id) return false;
  if (trade.status !== "proposed") return false;
  if (playerId === trade.proposerId) return false;

  const offer = trade.offers[trade.offers.length - 1];
  if (!offer) return false;

  const proposer = getPlayer(state, trade.proposerId);
  const acceptor = getPlayer(state, playerId);
  return hasResources(proposer.resources, offer.give) && hasResources(acceptor.resources, offer.want);
}

/** Type 2: general 4:1 trade with the supply. */
export function canTradeWithSupply(state: GameState, playerId: PlayerId, give: Resource, want: Resource): boolean {
  if (state.stage !== "playing" || state.phase !== "action" || state.currentPlayerId !== playerId) return false;
  if (give === want) return false;
  return getPlayer(state, playerId).resources[give] >= 4;
}

/** Port 3:1 exchange; once per turn, only through a port the player owns. */
export function canTradeWithPort(state: GameState, playerId: PlayerId, portHexId: HexId, give: Resource, want: Resource): boolean {
  if (state.stage !== "playing" || state.phase !== "action" || state.currentPlayerId !== playerId) return false;
  if (give === want) return false;
  if (state.portsUsedThisTurn.includes(portHexId)) return false;

  const port = getHexState(state, portHexId)?.buildings.find((building) => building.type === "Port");
  if (!port || port.ownerId !== playerId) return false;

  return getPlayer(state, playerId).resources[give] >= 3;
}

/* ------------------------------------------------------------------------ */
/* MOVEMENT & ATTACKING (Milestone 2: combat)                                */
/* ------------------------------------------------------------------------ */

export function canMoveUnit(state: GameState, playerId: PlayerId, unitId: UnitId, toHexId: HexId): boolean {
  return notImplemented("canMoveUnit", { playerId, unitId, toHexId, phase: state.phase });
}

export function canAttack(state: GameState, playerId: PlayerId, attackerUnitId: UnitId, targetHexId: HexId): boolean {
  return notImplemented("canAttack", { playerId, attackerUnitId, targetHexId, phase: state.phase });
}

/* ------------------------------------------------------------------------ */
/* TURN FLOW                                                                 */
/* ------------------------------------------------------------------------ */

/** Action -> Movement -> next player's Production. Only the current player may advance their own turn. */
export function canAdvancePhase(state: GameState, playerId: PlayerId): boolean {
  if (state.stage !== "playing" || state.currentPlayerId !== playerId) return false;
  return state.phase === "action" || state.phase === "movement";
}
