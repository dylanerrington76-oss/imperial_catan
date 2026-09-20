import type { Board, Resource } from "../hex/index.js";

/**
 * ID types
 * --------
 * All plain strings at runtime. Aliasing them makes call sites and the
 * types below self-documenting (and easier to swap for branded types later)
 * without adding any real overhead.
 */
export type PlayerId = string;
export type UnitId = string;
export type TradeId = string;

/**
 * Stable key for a hex, produced by `hexId()` in `../hex/coordinates.js`
 * (`"q,r"`, e.g. `"3,-2"`). Deliberately separate from the `Hex` union in
 * `../hex/types.js`: `Hex` is the immutable board geometry generated once
 * from the game's seed, while `HexId` is how the *mutable* per-hex state
 * below (`HexState`) is keyed and referenced from `GameState`.
 */
export type HexId = string;

export const PLAYER_COLORS = ["Red", "Blue", "White", "Orange"] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export type BuildingType = "Settlement" | "City" | "Port";

export type UnitType = "Soldier" | "Cavalry" | "ArtilleryCannon" | "Ship" | "Destroyer";

/** A player's hand: how many cards of each resource they're holding. */
export type ResourceHand = Record<Resource, number>;

export type GameStage = "setup" | "playing" | "ended";

/** Rulebook TURN OVERVIEW: every turn runs these three phases in order. */
export type TurnPhase = "production" | "action" | "movement";

export type SetupStep = "soldiers" | "settlements-and-ports" | "starting-resources";

/**
 * Tracks progress through rulebook Steps 3-5 (placing starting soldiers,
 * then settlements/ports, then drawing starting resources) before the
 * normal turn cycle begins. `GameState.setup` is non-null only while
 * `stage === "setup"`.
 */
export interface SetupState {
  readonly step: SetupStep;
  readonly activePlayerId: PlayerId;
  /**
   * Step 3 places soldiers in a snake draft: forward through turn order for
   * everyone's first soldier, then reverse, repeating until everyone has 5.
   * True while a reverse leg is in progress.
   */
  readonly placingInReverseOrder: boolean;
}

export interface PlacedUnit {
  readonly id: UnitId;
  readonly type: UnitType;
  readonly ownerId: PlayerId;
  readonly hexId: HexId;
  readonly health: number;
  /** Ship only: the army unit it's currently ferrying, if any. */
  readonly carryingUnitId?: UnitId;
  /** Whether this unit has already moved/attacked/been mobilized this turn. */
  readonly hasActedThisTurn: boolean;
}

export interface PlacedBuilding {
  readonly type: BuildingType;
  readonly ownerId: PlayerId;
  readonly hexId: HexId;
}

/**
 * Mutable, in-game view of a single hex: what's currently on it. Keyed by
 * `HexId` in `GameState.hexes` and layered over the immutable geometry in
 * `GameState.board`, so moving a unit or building a settlement never
 * requires touching the seed-derived board layout itself.
 */
export interface HexState {
  readonly hexId: HexId;
  /**
   * Units on this hex. Rulebook MOVEMENT PHASE: a hex may hold one military
   * unit (a ship carrying an army unit still counts as one), so outside of
   * that ship+cargo pairing this holds at most one entry.
   */
  readonly units: readonly PlacedUnit[];
  /**
   * Buildings here, if any. Only meaningful on territory hexes. Holds at
   * most one Settlement-or-City (they replace each other) plus, separately,
   * at most one Port - rulebook Step 4 places a settlement *and* a port on
   * the same hex together, so a Port isn't just a stand-in for the
   * settlement/city slot the way it might first look.
   */
  readonly buildings: readonly PlacedBuilding[];
}

/** How many of each piece a player still has left to place. */
export interface PieceInventory {
  readonly settlements: number;
  readonly cities: number;
  readonly ports: number;
  readonly soldiers: number;
  readonly cavalry: number;
  readonly artilleryCannons: number;
  /** Rulebook states no cap for ships, unlike every other piece; `null` = no limit. */
  readonly ships: number | null;
  readonly destroyers: number;
}

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: PlayerColor;
  readonly resources: ResourceHand;
  readonly victoryPoints: number;
  readonly remainingPieces: PieceInventory;
  readonly hasLargestArmy: boolean;
  readonly hasLargestNavy: boolean;
  readonly hasClaimedOdysseyBonus: boolean;
  /** Rulebook: "If a player occupies no territories they are eliminated from the game." */
  readonly eliminated: boolean;
}

/**
 * One side of a trade negotiation: resources offered vs. resources wanted.
 * Both are partial since a trade need not touch every resource type.
 */
export interface TradeOffer {
  readonly give: Partial<ResourceHand>;
  readonly want: Partial<ResourceHand>;
}

export type TradeStatus = "proposed" | "countered" | "accepted" | "rejected" | "cancelled";

/**
 * A player-to-player trade negotiation in progress during the Action phase
 * (rulebook TRADE, Type 1). Bank trades and port exchanges (Type 2, and the
 * port's 3:1 exchange) are instant single-step actions and aren't modeled
 * as a `Trade` - see `canTradeWithSupply` / `canTradeWithPort`.
 */
export interface Trade {
  readonly id: TradeId;
  /** Only the proposer may finalize or cancel the negotiation. */
  readonly proposerId: PlayerId;
  /** Every offer/counteroffer made, oldest first; the last entry is the live one. */
  readonly offers: readonly TradeOffer[];
  /** Who made `offers[offers.length - 1]`. */
  readonly lastOfferedById: PlayerId;
  readonly status: TradeStatus;
  /** Other players who have accepted the live offer; the proposer picks one to finalize with. */
  readonly acceptedBy: readonly PlayerId[];
}

export interface GameState {
  readonly gameId: string;
  /** Immutable seeded board geometry (217 hexes: 55 territory + 162 water). */
  readonly board: Board;
  /** Mutable per-hex occupancy, keyed by `HexId` (see `hexId()` in `../hex/coordinates.js`). */
  readonly hexes: Readonly<Record<HexId, HexState>>;
  readonly players: readonly Player[];
  /** Fixed clockwise seating order, set once at setup. */
  readonly turnOrder: readonly PlayerId[];
  readonly stage: GameStage;
  /** Non-null only while `stage === "setup"`. */
  readonly setup: SetupState | null;
  readonly currentPlayerId: PlayerId;
  /** Meaningful once `stage === "playing"`. */
  readonly phase: TurnPhase;
  readonly turnNumber: number;
  /** Epoch ms when the current turn began. Rulebook: "Each turn has a 2 minute time limit." */
  readonly turnStartedAt: number;
  readonly turnTimeLimitMs: number;
  /** This turn's Production-phase roll, once rolled; `null` before then. */
  readonly diceRoll: readonly [number, number] | null;
  /** Ports already exchanged through this turn (rulebook: "Once per turn, each port allows..."); cleared when the turn ends. */
  readonly portsUsedThisTurn: readonly HexId[];
  /** At most one player-to-player negotiation in flight at a time. */
  readonly pendingTrade: Trade | null;
  readonly largestArmyOwnerId: PlayerId | null;
  readonly largestNavyOwnerId: PlayerId | null;
  /** One-time bonus (rulebook Odyssey Bonus); true once anyone has claimed it. */
  readonly odysseyBonusClaimed: boolean;
  /** Set the moment a player reaches 15 VP (rulebook OBJECTIVE / FR6). */
  readonly winnerId: PlayerId | null;
}
