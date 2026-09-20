import { describe, expect, it } from "vitest";
import { generateBoard, isTerritoryHex } from "../hex/index.js";
import {
  canAcceptTrade,
  canAdvancePhase,
  canAttack,
  canBuildCity,
  canBuildSettlement,
  canMobilizeUnit,
  canMoveUnit,
  canPlaceStartingSoldier,
  canProposeTrade,
  canRollDice,
  canTradeWithPort,
} from "./validators.js";
import { createInitialGameState } from "./state.js";
import type { GameState } from "./types.js";

const PLAYERS = [
  { id: "p1", name: "Alice", color: "Red" as const },
  { id: "p2", name: "Bob", color: "Blue" as const },
];

function freshState(seed = 1): GameState {
  return createInitialGameState("game-1", seed, PLAYERS, ["p1", "p2"]);
}

describe("still-stubbed validators (Milestone 2: combat)", () => {
  it.each([
    ["canMobilizeUnit", () => canMobilizeUnit(freshState(), "p1", "0,0", "Soldier")],
    ["canMoveUnit", () => canMoveUnit(freshState(), "p1", "u1", "0,1")],
    ["canAttack", () => canAttack(freshState(), "p1", "u1", "0,1")],
  ])("%s throws until implemented", (_name, call) => {
    expect(call).toThrow(/not implemented yet/);
  });
});

describe("canPlaceStartingSoldier", () => {
  it("allows the active setup player to place on an empty territory hex", () => {
    const state = freshState();
    const territoryHex = state.board.hexes.find(isTerritoryHex);
    expect(territoryHex).toBeDefined();
    const id = `${territoryHex!.q},${territoryHex!.r}`;
    expect(canPlaceStartingSoldier(state, "p1", id)).toBe(true);
  });

  it("rejects the player who isn't up in the setup order", () => {
    const state = freshState();
    const territoryHex = state.board.hexes.find(isTerritoryHex)!;
    const id = `${territoryHex.q},${territoryHex.r}`;
    expect(canPlaceStartingSoldier(state, "p2", id)).toBe(false);
  });

  it("rejects water hexes", () => {
    const state = freshState();
    const waterHex = state.board.hexes.find((hex) => !isTerritoryHex(hex))!;
    const id = `${waterHex.q},${waterHex.r}`;
    expect(canPlaceStartingSoldier(state, "p1", id)).toBe(false);
  });
});

describe("canRollDice / canBuildSettlement / canAdvancePhase", () => {
  it("only allow the current player, in the right phase", () => {
    const state = freshState();
    // Still mid-setup: nobody may roll, build, or advance yet.
    expect(canRollDice(state, "p1")).toBe(false);
    expect(canBuildSettlement(state, "p1", "0,0")).toBe(false);
    expect(canAdvancePhase(state, "p1")).toBe(false);
  });
});

describe("trade validators reject matching-resource trades", () => {
  it("rejects an offer that gives and wants the same resource", () => {
    const state: GameState = { ...freshState(), stage: "playing", phase: "action", setup: null };
    expect(canProposeTrade(state, "p1", { give: { Wood: 3 }, want: { Wood: 1 } })).toBe(false);
  });
});

describe("canBuildCity / canAcceptTrade / canTradeWithPort return false on missing state", () => {
  it("canBuildCity is false with no settlement on the hex", () => {
    const state: GameState = { ...freshState(), stage: "playing", phase: "action", setup: null };
    expect(canBuildCity(state, "p1", "0,0")).toBe(false);
  });

  it("canAcceptTrade is false with no pending trade", () => {
    const state: GameState = { ...freshState(), stage: "playing", phase: "action", setup: null };
    expect(
      canAcceptTrade(state, "p2", {
        id: "t1",
        proposerId: "p1",
        offers: [],
        lastOfferedById: "p1",
        status: "proposed",
        acceptedBy: [],
      }),
    ).toBe(false);
  });

  it("canTradeWithPort is false when the player owns no port there", () => {
    const state: GameState = { ...freshState(), stage: "playing", phase: "action", setup: null };
    expect(canTradeWithPort(state, "p1", "0,0", "Wood", "Brick")).toBe(false);
  });
});

describe("board generation sanity check used by the tests above", () => {
  it("always has at least one territory and one water hex", () => {
    const board = generateBoard(42);
    expect(board.hexes.some(isTerritoryHex)).toBe(true);
    expect(board.hexes.some((hex) => !isTerritoryHex(hex))).toBe(true);
  });
});
