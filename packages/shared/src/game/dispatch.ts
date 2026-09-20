import type { Action } from "./actions.js";
import {
  applyAcceptTrade,
  applyAdvancePhase,
  applyAttack,
  applyBuildCity,
  applyBuildPort,
  applyBuildSettlement,
  applyCancelTrade,
  applyMobilizeUnit,
  applyMoveUnit,
  applyPlaceStartingSettlementAndPort,
  applyPlaceStartingSoldier,
  applyProposeTrade,
  applyRollDice,
  applyTradeWithPort,
  applyTradeWithSupply,
} from "./reducers.js";
import type { GameState } from "./types.js";
import {
  canAcceptTrade,
  canAdvancePhase,
  canAttack,
  canBuildCity,
  canBuildPort,
  canBuildSettlement,
  canMobilizeUnit,
  canMoveUnit,
  canPlaceStartingSettlementAndPort,
  canPlaceStartingSoldier,
  canProposeTrade,
  canRollDice,
  canTradeWithPort,
  canTradeWithSupply,
} from "./validators.js";

export class IllegalActionError extends Error {
  constructor(public readonly action: Action) {
    super(`Illegal action: ${JSON.stringify(action)}`);
    this.name = "IllegalActionError";
  }
}

/**
 * The single entry point server and client should call: checks `action`
 * against its matching `canX` validator and, only if legal, runs its
 * `applyX` reducer. Throws `IllegalActionError` instead of silently
 * no-opping, so a bug that lets an illegal action through fails loudly.
 * Actions whose validator/reducer pair isn't implemented yet (mobilize,
 * move, attack - see `./validators.js`) simply throw that pair's own
 * "not implemented" error, same as calling them directly would.
 */
export function applyAction(state: GameState, action: Action, deps: { rng?: () => number } = {}): GameState {
  switch (action.type) {
    case "PlaceStartingSoldier":
      if (!canPlaceStartingSoldier(state, action.playerId, action.hexId)) throw new IllegalActionError(action);
      return applyPlaceStartingSoldier(state, action);

    case "PlaceStartingSettlementAndPort":
      if (!canPlaceStartingSettlementAndPort(state, action.playerId, action.hexId)) throw new IllegalActionError(action);
      return applyPlaceStartingSettlementAndPort(state, action);

    case "RollDice":
      if (!canRollDice(state, action.playerId)) throw new IllegalActionError(action);
      return applyRollDice(state, action, deps);

    case "BuildSettlement":
      if (!canBuildSettlement(state, action.playerId, action.hexId)) throw new IllegalActionError(action);
      return applyBuildSettlement(state, action);

    case "BuildCity":
      if (!canBuildCity(state, action.playerId, action.hexId)) throw new IllegalActionError(action);
      return applyBuildCity(state, action);

    case "BuildPort":
      if (!canBuildPort(state, action.playerId, action.hexId)) throw new IllegalActionError(action);
      return applyBuildPort(state, action);

    case "MobilizeUnit":
      if (!canMobilizeUnit(state, action.playerId, action.hexId, action.unitType)) throw new IllegalActionError(action);
      return applyMobilizeUnit(state, action);

    case "ProposeTrade":
      if (!canProposeTrade(state, action.playerId, action.offer)) throw new IllegalActionError(action);
      return applyProposeTrade(state, action);

    case "AcceptTrade": {
      const trade = state.pendingTrade;
      if (!trade || trade.id !== action.tradeId || !canAcceptTrade(state, action.playerId, trade)) {
        throw new IllegalActionError(action);
      }
      return applyAcceptTrade(state, action);
    }

    case "CancelTrade":
      if (!state.pendingTrade || state.pendingTrade.id !== action.tradeId || state.pendingTrade.proposerId !== action.playerId) {
        throw new IllegalActionError(action);
      }
      return applyCancelTrade(state, action);

    case "TradeWithSupply":
      if (!canTradeWithSupply(state, action.playerId, action.give, action.want)) throw new IllegalActionError(action);
      return applyTradeWithSupply(state, action);

    case "TradeWithPort":
      if (!canTradeWithPort(state, action.playerId, action.portHexId, action.give, action.want)) throw new IllegalActionError(action);
      return applyTradeWithPort(state, action);

    case "MoveUnit":
      if (!canMoveUnit(state, action.playerId, action.unitId, action.toHexId)) throw new IllegalActionError(action);
      return applyMoveUnit(state, action);

    case "Attack":
      if (!canAttack(state, action.playerId, action.attackerUnitId, action.targetHexId)) throw new IllegalActionError(action);
      return applyAttack(state, action);

    case "AdvancePhase":
      if (!canAdvancePhase(state, action.playerId)) throw new IllegalActionError(action);
      return applyAdvancePhase(state, action);
  }
}
