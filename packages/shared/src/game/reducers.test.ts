import { describe, expect, it } from "vitest";
import { hexId, isTerritoryHex } from "../hex/index.js";
import { isCoastalHex, updateHexState, updatePlayer } from "./queries.js";
import {
  applyAcceptTrade,
  applyAdvancePhase,
  applyBuildCity,
  applyBuildPort,
  applyBuildSettlement,
  applyPlaceStartingSettlementAndPort,
  applyPlaceStartingSoldier,
  applyProposeTrade,
  applyRollDice,
} from "./reducers.js";
import { createInitialGameState, type PlayerSetup } from "./state.js";
import type { GameState, PlayerId } from "./types.js";

const PLAYERS: readonly PlayerSetup[] = [
  { id: "p1", name: "Alice", color: "Red" },
  { id: "p2", name: "Bob", color: "Blue" },
];

function totalResources(state: GameState, playerId: PlayerId): number {
  const player = state.players.find((p) => p.id === playerId)!;
  return Object.values(player.resources).reduce((a, b) => a + b, 0);
}

describe("Setup: soldiers snake draft -> settlements/ports -> Step 5 -> playing", () => {
  it("plays out the full non-combat setup for two players", () => {
    let state = createInitialGameState("game-1", 42, PLAYERS, ["p1", "p2"]);

    const territoryHexes = state.board.hexes.filter(isTerritoryHex);
    const coastal = territoryHexes.filter((hex) => isCoastalHex(state.board, hexId(hex)));
    // Sanity check for the test's own setup, not the production code: with
    // 55 territory hexes against 162 water hexes we expect plenty of coastal
    // land, but this would fail loudly (rather than silently picking bad
    // hexes) if a future board-generation change ever made land fully landlocked.
    expect(coastal.length).toBeGreaterThanOrEqual(2);

    const rest = territoryHexes.filter((hex) => hex !== coastal[0] && hex !== coastal[1]).slice(0, 8);
    // Position 0 and 1 are deliberately coastal: per the snake-draft sequence
    // below, position 0 is Alice's first soldier and position 1 is Bob's,
    // guaranteeing each has at least one valid Step 4 hex.
    const ids = [coastal[0], coastal[1], ...rest].map(hexId);

    // Rulebook Step 3: forward P1,P2, then reverse P2,P1, repeating until
    // both have 5 soldiers - the player who goes last in one leg goes first
    // again in the next.
    const placementOrder: PlayerId[] = ["p1", "p2", "p2", "p1", "p1", "p2", "p2", "p1", "p1", "p2"];

    placementOrder.forEach((playerId, i) => {
      expect(state.setup?.activePlayerId).toBe(playerId);
      state = applyPlaceStartingSoldier(state, { type: "PlaceStartingSoldier", playerId, hexId: ids[i] });
    });

    expect(state.setup).toEqual({ step: "settlements-and-ports", activePlayerId: "p1", placingInReverseOrder: false });

    // Step 4: Alice then Bob, each on a hex they claimed with a soldier.
    state = applyPlaceStartingSettlementAndPort(state, { type: "PlaceStartingSettlementAndPort", playerId: "p1", hexId: ids[0] });
    expect(state.setup?.activePlayerId).toBe("p2");
    const alice = state.players.find((p) => p.id === "p1")!;
    expect(alice.victoryPoints).toBe(2); // 1 for the settlement + 1 for the port
    expect(alice.remainingPieces.settlements).toBe(7);
    expect(alice.remainingPieces.ports).toBe(3);

    state = applyPlaceStartingSettlementAndPort(state, { type: "PlaceStartingSettlementAndPort", playerId: "p2", hexId: ids[1] });

    // Step 5 + kickoff happened automatically as part of that last placement.
    expect(state.setup).toBeNull();
    expect(state.stage).toBe("playing");
    expect(state.phase).toBe("production");
    expect(state.currentPlayerId).toBe("p1");
    expect(state.turnNumber).toBe(1);

    // Each player occupies exactly 5 territory hexes (their 5 soldiers), so
    // Step 5 should have granted exactly 5 resource cards each.
    expect(totalResources(state, "p1")).toBe(5);
    expect(totalResources(state, "p2")).toBe(5);
  });
});

describe("applyRollDice", () => {
  function withSoldierOn(state: GameState, playerId: PlayerId, id: string): GameState {
    return updateHexState(state, id, (hexState) => ({
      ...hexState,
      units: [...hexState.units, { id: "test-soldier", type: "Soldier", ownerId: playerId, hexId: id, health: 100, hasActedThisTurn: false }],
    }));
  }

  function rngForTotal(total: number): () => number {
    const d1 = Math.min(6, Math.max(1, total - 1));
    const d2 = total - d1;
    const faceRng = (face: number) => (face - 1) / 6 + 0.001;
    let call = 0;
    return () => (call++ === 0 ? faceRng(d1) : faceRng(d2));
  }

  it("grants 1 resource card for a soldier-occupied producing hex", () => {
    let state = createInitialGameState("game-1", 7, PLAYERS, ["p1", "p2"]);
    const target = state.board.hexes.find(isTerritoryHex)!;
    const id = hexId(target);
    state = withSoldierOn(state, "p1", id);
    state = { ...state, setup: null, stage: "playing", phase: "production", currentPlayerId: "p1" };

    const next = applyRollDice(state, { type: "RollDice", playerId: "p1" }, { rng: rngForTotal(target.number) });

    expect(next.diceRoll).toEqual(expect.any(Array));
    expect(next.phase).toBe("action");
    expect(next.players.find((p) => p.id === "p1")!.resources[target.resource]).toBe(1);
  });

  it("grants 2 resource cards when the occupying player has a city there", () => {
    let state = createInitialGameState("game-1", 7, PLAYERS, ["p1", "p2"]);
    const target = state.board.hexes.find(isTerritoryHex)!;
    const id = hexId(target);
    state = withSoldierOn(state, "p1", id);
    state = updateHexState(state, id, (hexState) => ({
      ...hexState,
      buildings: [...hexState.buildings, { type: "City", ownerId: "p1", hexId: id }],
    }));
    state = { ...state, setup: null, stage: "playing", phase: "production", currentPlayerId: "p1" };

    const next = applyRollDice(state, { type: "RollDice", playerId: "p1" }, { rng: rngForTotal(target.number) });

    expect(next.players.find((p) => p.id === "p1")!.resources[target.resource]).toBe(2);
  });
});

describe("Build reducers", () => {
  function playingStateWithFullHand(playerId: PlayerId, hexIdToOccupy: string): GameState {
    let state = createInitialGameState("game-1", 3, PLAYERS, ["p1", "p2"]);
    state = updateHexState(state, hexIdToOccupy, (hexState) => ({
      ...hexState,
      units: [...hexState.units, { id: "test-soldier", type: "Soldier", ownerId: playerId, hexId: hexIdToOccupy, health: 100, hasActedThisTurn: false }],
    }));
    state = updatePlayer(state, playerId, (player) => ({ ...player, resources: { Wood: 10, Brick: 10, Wheat: 10, Stone: 10 } }));
    return { ...state, setup: null, stage: "playing", phase: "action", currentPlayerId: playerId };
  }

  it("applyBuildSettlement pays cost, grants 1 VP, and consumes a piece", () => {
    const territoryHex = createInitialGameState("g", 3, PLAYERS, ["p1", "p2"]).board.hexes.find(isTerritoryHex)!;
    const id = hexId(territoryHex);
    const state = playingStateWithFullHand("p1", id);

    const next = applyBuildSettlement(state, { type: "BuildSettlement", playerId: "p1", hexId: id });

    const player = next.players.find((p) => p.id === "p1")!;
    expect(player.victoryPoints).toBe(1);
    expect(player.resources).toMatchObject({ Wheat: 8, Wood: 9 });
    expect(player.remainingPieces.settlements).toBe(7);
    expect(next.hexes[id].buildings).toContainEqual({ type: "Settlement", ownerId: "p1", hexId: id });
  });

  it("applyBuildCity replaces the settlement, nets +1 VP, and returns the settlement piece to supply", () => {
    const territoryHex = createInitialGameState("g", 3, PLAYERS, ["p1", "p2"]).board.hexes.find(isTerritoryHex)!;
    const id = hexId(territoryHex);
    let state = playingStateWithFullHand("p1", id);
    state = applyBuildSettlement(state, { type: "BuildSettlement", playerId: "p1", hexId: id });
    state = updatePlayer(state, "p1", (player) => ({ ...player, resources: { Wood: 10, Brick: 10, Wheat: 10, Stone: 10 } }));

    const next = applyBuildCity(state, { type: "BuildCity", playerId: "p1", hexId: id });

    const player = next.players.find((p) => p.id === "p1")!;
    expect(player.victoryPoints).toBe(2); // was 1 for the settlement, now 2 for the city
    expect(player.remainingPieces.settlements).toBe(8); // returned to supply
    expect(player.remainingPieces.cities).toBe(4);
    expect(next.hexes[id].buildings).toContainEqual({ type: "City", ownerId: "p1", hexId: id });
    expect(next.hexes[id].buildings.some((b) => b.type === "Settlement")).toBe(false);
  });

  it("applyBuildPort grants 1 VP and marks the port used-nowhere-yet", () => {
    const board = createInitialGameState("g", 3, PLAYERS, ["p1", "p2"]).board;
    const coastalHex = board.hexes.find((hex) => isTerritoryHex(hex) && isCoastalHex(board, hexId(hex)))!;
    const id = hexId(coastalHex);
    const state = playingStateWithFullHand("p1", id);

    const next = applyBuildPort(state, { type: "BuildPort", playerId: "p1", hexId: id });

    const player = next.players.find((p) => p.id === "p1")!;
    expect(player.victoryPoints).toBe(1);
    expect(player.remainingPieces.ports).toBe(3);
    expect(next.hexes[id].buildings).toContainEqual({ type: "Port", ownerId: "p1", hexId: id });
    expect(next.portsUsedThisTurn).toEqual([]);
  });
});

describe("Trade reducers", () => {
  it("applyProposeTrade then applyAcceptTrade swaps resources both ways and closes the negotiation", () => {
    let state = createInitialGameState("g", 3, PLAYERS, ["p1", "p2"]);
    state = updatePlayer(state, "p1", (player) => ({ ...player, resources: { Wood: 3, Brick: 0, Wheat: 0, Stone: 0 } }));
    state = updatePlayer(state, "p2", (player) => ({ ...player, resources: { Wood: 0, Brick: 0, Wheat: 2, Stone: 0 } }));

    state = applyProposeTrade(state, { type: "ProposeTrade", playerId: "p1", offer: { give: { Wood: 2 }, want: { Wheat: 1 } } });
    expect(state.pendingTrade?.status).toBe("proposed");

    const next = applyAcceptTrade(state, { type: "AcceptTrade", playerId: "p2", tradeId: state.pendingTrade!.id });

    expect(next.pendingTrade).toBeNull();
    expect(next.players.find((p) => p.id === "p1")!.resources).toMatchObject({ Wood: 1, Wheat: 1 });
    expect(next.players.find((p) => p.id === "p2")!.resources).toMatchObject({ Wood: 2, Wheat: 1 });
  });
});

describe("applyAdvancePhase", () => {
  it("moves Action -> Movement without changing whose turn it is", () => {
    const state = { ...createInitialGameState("g", 3, PLAYERS, ["p1", "p2"]), setup: null, stage: "playing" as const, phase: "action" as const };
    const next = applyAdvancePhase(state, { type: "AdvancePhase", playerId: "p1" });
    expect(next.phase).toBe("movement");
    expect(next.currentPlayerId).toBe("p1");
  });

  it("ends the turn from Movement: next player, Production phase, turn number incremented, per-turn state cleared", () => {
    let state = { ...createInitialGameState("g", 3, PLAYERS, ["p1", "p2"]), setup: null, stage: "playing" as const, phase: "movement" as const };
    state = { ...state, diceRoll: [3, 4], portsUsedThisTurn: ["some,hex"] };

    const next = applyAdvancePhase(state, { type: "AdvancePhase", playerId: "p1" });

    expect(next.currentPlayerId).toBe("p2");
    expect(next.phase).toBe("production");
    expect(next.turnNumber).toBe(state.turnNumber + 1);
    expect(next.diceRoll).toBeNull();
    expect(next.portsUsedThisTurn).toEqual([]);
  });
});
