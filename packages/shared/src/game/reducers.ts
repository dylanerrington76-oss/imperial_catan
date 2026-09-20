import { hexId as computeHexId, isTerritoryHex } from "../hex/index.js";
import type {
  AcceptTradeAction,
  AdvancePhaseAction,
  AttackAction,
  BuildCityAction,
  BuildPortAction,
  BuildSettlementAction,
  CancelTradeAction,
  MobilizeUnitAction,
  MoveUnitAction,
  PlaceStartingSettlementAndPortAction,
  PlaceStartingSoldierAction,
  ProposeTradeAction,
  RollDiceAction,
  TradeWithPortAction,
  TradeWithSupplyAction,
} from "./actions.js";
import { BUILDING_COSTS, CITY_VICTORY_POINTS, PORT_VICTORY_POINTS, SETTLEMENT_VICTORY_POINTS, STARTING_SOLDIER_COUNT, WINNING_VICTORY_POINTS } from "./costs.js";
import { diceTotal, rollTwoDice } from "./dice.js";
import { countUnits, getHexState, giveResources, occupyingPlayerId, payResources, updateHexState, updatePlayer } from "./queries.js";
import type { GameState, PlayerId, ResourceHand, SetupState } from "./types.js";

function notImplemented(fn: string, args: Record<string, unknown>): never {
  throw new Error(`${fn} is not implemented yet (called with ${JSON.stringify(args)})`);
}

/** Sets `stage: "ended"` the moment anyone reaches the winning VP total (rulebook OBJECTIVE). Call after any VP-granting reducer. */
function checkForWinner(state: GameState): GameState {
  const winner = state.players.find((player) => player.victoryPoints >= WINNING_VICTORY_POINTS);
  return winner ? { ...state, stage: "ended", winnerId: winner.id } : state;
}

/* ------------------------------------------------------------------------ */
/* SETUP                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Step 3's snake draft: forward through `turnOrder`, then reverse, then
 * forward again, etc. The player who goes last in one direction goes first
 * again in the next (this is what makes it a *snake*, not just alternating
 * order) - see the rulebook's "starting with the last player" language.
 */
function advanceSetupSoldierTurn(setup: SetupState, turnOrder: readonly PlayerId[], justPlacedBy: PlayerId): SetupState {
  const order = setup.placingInReverseOrder ? [...turnOrder].reverse() : turnOrder;
  const index = order.indexOf(justPlacedBy);
  if (index === order.length - 1) {
    return { ...setup, activePlayerId: justPlacedBy, placingInReverseOrder: !setup.placingInReverseOrder };
  }
  return { ...setup, activePlayerId: order[index + 1] };
}

export function applyPlaceStartingSoldier(state: GameState, action: PlaceStartingSoldierAction): GameState {
  const { playerId, hexId } = action;

  let next = updateHexState(state, hexId, (hexState) => ({
    ...hexState,
    units: [...hexState.units, { id: crypto.randomUUID(), type: "Soldier", ownerId: playerId, hexId, health: 100, hasActedThisTurn: false }],
  }));
  next = updatePlayer(next, playerId, (player) => ({
    ...player,
    remainingPieces: { ...player.remainingPieces, soldiers: player.remainingPieces.soldiers - 1 },
  }));

  const setup = next.setup;
  if (!setup) throw new Error("applyPlaceStartingSoldier called outside of Setup");

  const everyoneAtFive = next.players.every((player) => countUnits(next, player.id, "Soldier") >= STARTING_SOLDIER_COUNT);
  if (everyoneAtFive) {
    return { ...next, setup: { step: "settlements-and-ports", activePlayerId: next.turnOrder[0], placingInReverseOrder: false } };
  }
  return { ...next, setup: advanceSetupSoldierTurn(setup, next.turnOrder, playerId) };
}

/**
 * ASSUMPTION / open question: this requires the claimed hex to be coastal
 * (see `canPlaceStartingSettlementAndPort`), since the port half of Step 4's
 * combined placement is subject to BUILD Item 3's water-adjacency rule.
 * Because the generated board's land mass isn't a thin ring, a player whose
 * Step 3 soldiers all land on interior (non-coastal) hexes could have no
 * legal Step 4 move at all - worth resolving (e.g. relaxing the port's
 * placement, guaranteeing coastal land in `generateBoard`, or letting the
 * settlement and port go on different claimed hexes) before this ships.
 */
export function applyPlaceStartingSettlementAndPort(state: GameState, action: PlaceStartingSettlementAndPortAction): GameState {
  const { playerId, hexId } = action;

  let next = updateHexState(state, hexId, (hexState) => ({
    ...hexState,
    buildings: [...hexState.buildings, { type: "Settlement", ownerId: playerId, hexId }, { type: "Port", ownerId: playerId, hexId }],
  }));
  next = updatePlayer(next, playerId, (player) => ({
    ...player,
    victoryPoints: player.victoryPoints + SETTLEMENT_VICTORY_POINTS + PORT_VICTORY_POINTS,
    remainingPieces: { ...player.remainingPieces, settlements: player.remainingPieces.settlements - 1, ports: player.remainingPieces.ports - 1 },
  }));

  const setup = next.setup;
  if (!setup) throw new Error("applyPlaceStartingSettlementAndPort called outside of Setup");

  const currentIndex = next.turnOrder.indexOf(playerId);
  if (currentIndex < next.turnOrder.length - 1) {
    return { ...next, setup: { ...setup, activePlayerId: next.turnOrder[currentIndex + 1] } };
  }

  // Step 5: everyone has placed - grant starting resources for every
  // territory each player occupies, then start the normal turn cycle.
  next = { ...next, setup: null, stage: "playing", turnNumber: 1, turnStartedAt: Date.now() };
  for (const hex of next.board.hexes) {
    if (!isTerritoryHex(hex)) continue;
    const occupant = occupyingPlayerId(next, computeHexId(hex));
    if (!occupant) continue;
    next = updatePlayer(next, occupant, (player) => ({
      ...player,
      resources: giveResources(player.resources, { [hex.resource]: 1 } as Partial<ResourceHand>),
    }));
  }
  return { ...next, currentPlayerId: next.turnOrder[0], phase: "production" };
}

/* ------------------------------------------------------------------------ */
/* PRODUCTION                                                                */
/* ------------------------------------------------------------------------ */

export function applyRollDice(state: GameState, _action: RollDiceAction, deps: { rng?: () => number } = {}): GameState {
  const roll = rollTwoDice(deps.rng ?? Math.random);
  const total = diceTotal(roll);

  let next: GameState = { ...state, diceRoll: roll, phase: "action" };

  for (const hex of next.board.hexes) {
    if (!isTerritoryHex(hex) || hex.number !== total) continue;
    const id = computeHexId(hex);
    const occupant = occupyingPlayerId(next, id);
    if (!occupant) continue;

    const hasCity = getHexState(next, id)?.buildings.some((building) => building.type === "City" && building.ownerId === occupant) ?? false;
    next = updatePlayer(next, occupant, (player) => ({
      ...player,
      resources: giveResources(player.resources, { [hex.resource]: hasCity ? 2 : 1 } as Partial<ResourceHand>),
    }));
  }

  return next;
}

/* ------------------------------------------------------------------------ */
/* BUILD                                                                     */
/* ------------------------------------------------------------------------ */

export function applyBuildSettlement(state: GameState, action: BuildSettlementAction): GameState {
  const { playerId, hexId } = action;
  let next = updatePlayer(state, playerId, (player) => ({
    ...player,
    resources: payResources(player.resources, BUILDING_COSTS.Settlement),
    victoryPoints: player.victoryPoints + SETTLEMENT_VICTORY_POINTS,
    remainingPieces: { ...player.remainingPieces, settlements: player.remainingPieces.settlements - 1 },
  }));
  next = updateHexState(next, hexId, (hexState) => ({
    ...hexState,
    buildings: [...hexState.buildings, { type: "Settlement", ownerId: playerId, hexId }],
  }));
  return checkForWinner(next);
}

export function applyBuildCity(state: GameState, action: BuildCityAction): GameState {
  const { playerId, hexId } = action;
  let next = updatePlayer(state, playerId, (player) => ({
    ...player,
    resources: payResources(player.resources, BUILDING_COSTS.City),
    // Net +1 VP: the settlement's 1 VP is replaced by the city's 2 VP.
    victoryPoints: player.victoryPoints - SETTLEMENT_VICTORY_POINTS + CITY_VICTORY_POINTS,
    remainingPieces: {
      ...player.remainingPieces,
      // The settlement piece returns to supply, per "you must first upgrade
      // one to a city" (rulebook BUILD Item 1) implying it frees up a piece.
      settlements: player.remainingPieces.settlements + 1,
      cities: player.remainingPieces.cities - 1,
    },
  }));
  next = updateHexState(next, hexId, (hexState) => ({
    ...hexState,
    buildings: hexState.buildings.map((building) =>
      building.type === "Settlement" && building.ownerId === playerId ? { type: "City", ownerId: playerId, hexId } : building,
    ),
  }));
  return checkForWinner(next);
}

export function applyBuildPort(state: GameState, action: BuildPortAction): GameState {
  const { playerId, hexId } = action;
  let next = updatePlayer(state, playerId, (player) => ({
    ...player,
    resources: payResources(player.resources, BUILDING_COSTS.Port),
    victoryPoints: player.victoryPoints + PORT_VICTORY_POINTS,
    remainingPieces: { ...player.remainingPieces, ports: player.remainingPieces.ports - 1 },
  }));
  next = updateHexState(next, hexId, (hexState) => ({
    ...hexState,
    buildings: [...hexState.buildings, { type: "Port", ownerId: playerId, hexId }],
  }));
  return checkForWinner(next);
}

/* ------------------------------------------------------------------------ */
/* MOBILIZE (Milestone 2: combat)                                            */
/* ------------------------------------------------------------------------ */

export function applyMobilizeUnit(state: GameState, action: MobilizeUnitAction): GameState {
  return notImplemented("applyMobilizeUnit", { ...action, phase: state.phase });
}

/* ------------------------------------------------------------------------ */
/* TRADE                                                                     */
/* ------------------------------------------------------------------------ */

export function applyProposeTrade(state: GameState, action: ProposeTradeAction): GameState {
  return {
    ...state,
    pendingTrade: {
      id: crypto.randomUUID(),
      proposerId: action.playerId,
      offers: [action.offer],
      lastOfferedById: action.playerId,
      status: "proposed",
      acceptedBy: [],
    },
  };
}

/**
 * SIMPLIFICATION: the rulebook lets the proposer field several counteroffers
 * before choosing one to finalize; here the first player to accept
 * immediately executes the trade and closes the negotiation. `Trade.offers`
 * and `TradeStatus` model the richer flow for whenever the team decides how
 * "pick one of several acceptors" should actually work.
 */
export function applyAcceptTrade(state: GameState, action: AcceptTradeAction): GameState {
  const trade = state.pendingTrade;
  if (!trade || trade.id !== action.tradeId) throw new Error(`No pending trade with id ${action.tradeId}`);
  const offer = trade.offers[trade.offers.length - 1];

  let next = updatePlayer(state, trade.proposerId, (player) => ({
    ...player,
    resources: giveResources(payResources(player.resources, offer.give), offer.want),
  }));
  next = updatePlayer(next, action.playerId, (player) => ({
    ...player,
    resources: giveResources(payResources(player.resources, offer.want), offer.give),
  }));
  return { ...next, pendingTrade: null };
}

export function applyCancelTrade(state: GameState, action: CancelTradeAction): GameState {
  if (!state.pendingTrade || state.pendingTrade.id !== action.tradeId) {
    throw new Error(`No pending trade with id ${action.tradeId}`);
  }
  return { ...state, pendingTrade: null };
}

export function applyTradeWithSupply(state: GameState, action: TradeWithSupplyAction): GameState {
  return updatePlayer(state, action.playerId, (player) => ({
    ...player,
    resources: giveResources(payResources(player.resources, { [action.give]: 4 } as Partial<ResourceHand>), {
      [action.want]: 1,
    } as Partial<ResourceHand>),
  }));
}

export function applyTradeWithPort(state: GameState, action: TradeWithPortAction): GameState {
  const next = updatePlayer(state, action.playerId, (player) => ({
    ...player,
    resources: giveResources(payResources(player.resources, { [action.give]: 3 } as Partial<ResourceHand>), {
      [action.want]: 1,
    } as Partial<ResourceHand>),
  }));
  return { ...next, portsUsedThisTurn: [...next.portsUsedThisTurn, action.portHexId] };
}

/* ------------------------------------------------------------------------ */
/* MOVEMENT & ATTACKING (Milestone 2: combat)                                */
/* ------------------------------------------------------------------------ */

export function applyMoveUnit(state: GameState, action: MoveUnitAction): GameState {
  return notImplemented("applyMoveUnit", { ...action, phase: state.phase });
}

export function applyAttack(state: GameState, action: AttackAction): GameState {
  return notImplemented("applyAttack", { ...action, phase: state.phase });
}

/* ------------------------------------------------------------------------ */
/* TURN FLOW                                                                 */
/* ------------------------------------------------------------------------ */

export function applyAdvancePhase(state: GameState, action: AdvancePhaseAction): GameState {
  if (state.currentPlayerId !== action.playerId) {
    throw new Error(`applyAdvancePhase called by ${action.playerId}, but it's ${state.currentPlayerId}'s turn`);
  }

  if (state.phase === "action") {
    return { ...state, phase: "movement" };
  }

  // End of Movement phase: hand the turn to the next player.
  const currentIndex = state.turnOrder.indexOf(state.currentPlayerId);
  const nextPlayerId = state.turnOrder[(currentIndex + 1) % state.turnOrder.length];
  return {
    ...state,
    currentPlayerId: nextPlayerId,
    phase: "production",
    turnNumber: state.turnNumber + 1,
    turnStartedAt: Date.now(),
    diceRoll: null,
    portsUsedThisTurn: [],
  };
}
