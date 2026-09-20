import { describe, expect, it } from "vitest";
import { isTerritoryHex, isWaterHex } from "../hex/index.js";
import { STARTING_PIECE_COUNTS } from "./costs.js";
import { createInitialGameState, determineTurnOrder, type PlayerSetup } from "./state.js";

const PLAYERS: readonly PlayerSetup[] = [
  { id: "p1", name: "Alice", color: "Red" },
  { id: "p2", name: "Bob", color: "Blue" },
  { id: "p3", name: "Carol", color: "White" },
];

describe("determineTurnOrder", () => {
  it("seats the highest roller first", () => {
    // Rolls (as [d1, d2] totals): p1 -> 2, p2 -> 12, p3 -> 7.
    const rolls = [0, 0, 5.9, 5.9, 0.5, 0.5];
    let call = 0;
    const rng = () => rolls[call++];

    expect(determineTurnOrder(["p1", "p2", "p3"], rng)).toEqual(["p2", "p3", "p1"]);
  });

  it("breaks ties by original order, since the rulebook doesn't specify a tie-break", () => {
    const rng = () => 0.5; // every player rolls the same total
    expect(determineTurnOrder(["p1", "p2", "p3"], rng)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("createInitialGameState", () => {
  it("builds a 217-hex board and seats players at the start of Setup Step 3", () => {
    const state = createInitialGameState("game-1", 42, PLAYERS, ["p2", "p1", "p3"]);

    expect(state.board.hexes).toHaveLength(217);
    expect(state.board.hexes.filter(isTerritoryHex)).toHaveLength(55);
    expect(state.board.hexes.filter(isWaterHex)).toHaveLength(162);
    expect(Object.keys(state.hexes)).toHaveLength(217);

    expect(state.stage).toBe("setup");
    expect(state.setup).toEqual({ step: "soldiers", activePlayerId: "p2", placingInReverseOrder: false });
    expect(state.turnOrder).toEqual(["p2", "p1", "p3"]);
    expect(state.currentPlayerId).toBe("p2");
    expect(state.winnerId).toBeNull();
  });

  it("starts every player with an empty hand and full piece inventory", () => {
    const state = createInitialGameState("game-1", 42, PLAYERS, ["p1", "p2", "p3"]);
    for (const player of state.players) {
      expect(player.resources).toEqual({ Wood: 0, Brick: 0, Wheat: 0, Stone: 0 });
      expect(player.victoryPoints).toBe(0);
      expect(player.remainingPieces).toEqual(STARTING_PIECE_COUNTS);
    }
  });

  it("rejects a player count outside 2-4", () => {
    expect(() => createInitialGameState("g", 1, [PLAYERS[0]], ["p1"])).toThrow(/2-4 players/);
  });

  it("rejects a turnOrder that isn't a permutation of the given players", () => {
    expect(() => createInitialGameState("g", 1, PLAYERS.slice(0, 2), ["p1", "p1"])).toThrow();
    expect(() => createInitialGameState("g", 1, PLAYERS.slice(0, 2), ["p1", "p404"])).toThrow();
  });
});
