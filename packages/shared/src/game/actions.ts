import type { Resource } from "../hex/index.js";
import type { HexId, PlayerId, TradeId, TradeOffer, UnitId, UnitType } from "./types.js";

export interface PlaceStartingSoldierAction {
  readonly type: "PlaceStartingSoldier";
  readonly playerId: PlayerId;
  readonly hexId: HexId;
}

export interface PlaceStartingSettlementAndPortAction {
  readonly type: "PlaceStartingSettlementAndPort";
  readonly playerId: PlayerId;
  readonly hexId: HexId;
}

export interface RollDiceAction {
  readonly type: "RollDice";
  readonly playerId: PlayerId;
}

export interface BuildSettlementAction {
  readonly type: "BuildSettlement";
  readonly playerId: PlayerId;
  readonly hexId: HexId;
}

export interface BuildCityAction {
  readonly type: "BuildCity";
  readonly playerId: PlayerId;
  readonly hexId: HexId;
}

export interface BuildPortAction {
  readonly type: "BuildPort";
  readonly playerId: PlayerId;
  readonly hexId: HexId;
}

export interface MobilizeUnitAction {
  readonly type: "MobilizeUnit";
  readonly playerId: PlayerId;
  readonly hexId: HexId;
  readonly unitType: UnitType;
}

export interface ProposeTradeAction {
  readonly type: "ProposeTrade";
  readonly playerId: PlayerId;
  readonly offer: TradeOffer;
}

export interface AcceptTradeAction {
  readonly type: "AcceptTrade";
  readonly playerId: PlayerId;
  readonly tradeId: TradeId;
}

export interface CancelTradeAction {
  readonly type: "CancelTrade";
  readonly playerId: PlayerId;
  readonly tradeId: TradeId;
}

export interface TradeWithSupplyAction {
  readonly type: "TradeWithSupply";
  readonly playerId: PlayerId;
  readonly give: Resource;
  readonly want: Resource;
}

export interface TradeWithPortAction {
  readonly type: "TradeWithPort";
  readonly playerId: PlayerId;
  readonly portHexId: HexId;
  readonly give: Resource;
  readonly want: Resource;
}

export interface MoveUnitAction {
  readonly type: "MoveUnit";
  readonly playerId: PlayerId;
  readonly unitId: UnitId;
  readonly toHexId: HexId;
}

export interface AttackAction {
  readonly type: "Attack";
  readonly playerId: PlayerId;
  readonly attackerUnitId: UnitId;
  readonly targetHexId: HexId;
}

export interface AdvancePhaseAction {
  readonly type: "AdvancePhase";
  readonly playerId: PlayerId;
}

/**
 * One variant per validator in `./validators.js`. `applyAction` in
 * `./dispatch.js` is the single place that maps an `Action` to its
 * `canX`/`applyX` pair, so this union is the whole vocabulary server and
 * client need to agree on to talk about a turn.
 */
export type Action =
  | PlaceStartingSoldierAction
  | PlaceStartingSettlementAndPortAction
  | RollDiceAction
  | BuildSettlementAction
  | BuildCityAction
  | BuildPortAction
  | MobilizeUnitAction
  | ProposeTradeAction
  | AcceptTradeAction
  | CancelTradeAction
  | TradeWithSupplyAction
  | TradeWithPortAction
  | MoveUnitAction
  | AttackAction
  | AdvancePhaseAction;
