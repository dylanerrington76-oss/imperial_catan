import { describe, expect, it } from "vitest";
import { applyAction, IllegalActionError } from "./dispatch.js";
import { createInitialGameState } from "./state.js";
import type { GameState } from "./types.js";

describe("applyAction", () => {
  it("routes a legal action to its reducer", () => {
    let state: GameState = {
      ...createInitialGameState("g", 3, [{ id: "p1", name: "Alice", color: "Red" }, { id: "p2", name: "Bob", color: "Blue" }], ["p1", "p2"]),
      setup: null,
      stage: "playing",
      phase: "production",
    };

    state = applyAction(state, { type: "RollDice", playerId: "p1" }, { rng: () => 0 });

    expect(state.diceRoll).toEqual([1, 1]);
    expect(state.phase).toBe("action");
  });

  it("throws IllegalActionError instead of mutating state when the action is illegal", () => {
    const state = { ...createInitialGameState("g", 3, [{ id: "p1", name: "Alice", color: "Red" }, { id: "p2", name: "Bob", color: "Blue" }], ["p1", "p2"]), setup: null, stage: "playing" as const, phase: "production" as const };

    // p2 isn't the current player, so p2 rolling dice is illegal.
    expect(() => applyAction(state, { type: "RollDice", playerId: "p2" })).toThrow(IllegalActionError);
  });

  it("surfaces a stubbed action's own not-implemented error rather than IllegalActionError", () => {
    const state = { ...createInitialGameState("g", 3, [{ id: "p1", name: "Alice", color: "Red" }, { id: "p2", name: "Bob", color: "Blue" }], ["p1", "p2"]), setup: null, stage: "playing" as const, phase: "action" as const };

    expect(() => applyAction(state, { type: "MobilizeUnit", playerId: "p1", hexId: "0,0", unitType: "Soldier" })).toThrow(/not implemented yet/);
  });
});
