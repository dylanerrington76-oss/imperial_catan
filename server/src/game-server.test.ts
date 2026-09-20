import type { AddressInfo } from "node:net";
import type {
  ClientToServerEvents,
  GameState,
  JoinLobbyResult,
  ServerToClientEvents,
  StartGameResult,
  SubmitActionResult,
} from "@monorepo/shared";
import { isTerritoryHex } from "@monorepo/shared";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, type App } from "./index.js";

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const COLORS = ["Red", "Blue", "White", "Orange"] as const;

describe("game server", () => {
  let app: App;
  let port: number;
  const openSockets: TestSocket[] = [];

  beforeEach(async () => {
    app = createApp();
    await new Promise<void>((resolve) => app.httpServer.listen(0, resolve));
    port = (app.httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const socket of openSockets.splice(0)) socket.close();
    await app.close();
  });

  function connect(): Promise<TestSocket> {
    return new Promise((resolve) => {
      const socket: TestSocket = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
      openSockets.push(socket);
      socket.once("connect", () => resolve(socket));
    });
  }

  /** Connects all four players and joins them to the lobby, returning the sockets and their assigned playerIds. */
  async function joinFourPlayers(): Promise<{ sockets: TestSocket[]; playerIds: string[] }> {
    const sockets = await Promise.all([0, 1, 2, 3].map(() => connect()));
    const playerIds = await Promise.all(
      sockets.map(
        (socket, i) =>
          new Promise<string>((resolve, reject) => {
            socket.emit("joinLobby", { name: `Player ${i}`, color: COLORS[i] }, (result: JoinLobbyResult) => {
              if (!result.ok) return reject(new Error(result.reason));
              resolve(result.playerId);
            });
          }),
      ),
    );
    return { sockets, playerIds };
  }

  it("joins four players, lets the host start, and broadcasts gameStarted to everyone", async () => {
    const { sockets } = await joinFourPlayers();

    const gameStartedPromises = sockets.slice(1).map(
      (socket) => new Promise((resolve) => socket.once("gameStarted", resolve)),
    );

    const startResult = await new Promise<StartGameResult>((resolve) => sockets[0].emit("startGame", resolve));
    expect(startResult).toEqual({ ok: true });

    const received = await Promise.all(gameStartedPromises);
    for (const state of received as { stage: string; board: { hexes: unknown[] } }[]) {
      expect(state.stage).toBe("setup");
      expect(state.board.hexes).toHaveLength(217);
    }
  });

  it("rejects startGame from a non-host", async () => {
    const { sockets } = await joinFourPlayers();
    const result = await new Promise<StartGameResult>((resolve) => sockets[1].emit("startGame", resolve));
    expect(result.ok).toBe(false);
  });

  it("rejects joining with a color that's already taken", async () => {
    const first = await connect();
    await new Promise((resolve) => first.emit("joinLobby", { name: "Alice", color: "Red" }, resolve));

    const second = await connect();
    const result = await new Promise<JoinLobbyResult>((resolve) => second.emit("joinLobby", { name: "Bob", color: "Red" }, resolve));
    expect(result).toEqual({ ok: false, reason: expect.any(String) });
  });

  it("applies a legal action and broadcasts the updated state to every client", async () => {
    const { sockets, playerIds } = await joinFourPlayers();
    const gameStarted = await new Promise<GameState>((resolve) => {
      sockets[1].once("gameStarted", resolve);
      sockets[0].emit("startGame", () => {});
    });

    // Turn order is randomized at start (Step 2's dice roll), so find
    // whichever player is actually up first rather than assuming the host.
    const activePlayerId = gameStarted.setup!.activePlayerId;
    const activeSocket = sockets[playerIds.indexOf(activePlayerId)];
    const territoryHex = gameStarted.board.hexes.find((hex) => isTerritoryHex(hex))!;
    const hexId = `${territoryHex.q},${territoryHex.r}`;

    const updatePromise = new Promise((resolve) => sockets[2].once("gameStateUpdate", resolve));
    const result = await new Promise<SubmitActionResult>((resolve) =>
      activeSocket.emit("submitAction", { type: "PlaceStartingSoldier", playerId: activePlayerId, hexId }, resolve),
    );

    expect(result).toEqual({ ok: true });
    const updated = (await updatePromise) as { hexes: Record<string, { units: unknown[] }> };
    expect(updated.hexes[hexId].units).toHaveLength(1);
  });

  it("rejects an action submitted under someone else's playerId, without changing state", async () => {
    const { sockets, playerIds } = await joinFourPlayers();
    await new Promise((resolve) => {
      sockets[1].once("gameStarted", resolve);
      sockets[0].emit("startGame", () => {});
    });

    let sawBroadcast = false;
    sockets[2].once("gameStateUpdate", () => {
      sawBroadcast = true;
    });

    // Player 1's socket claims to be acting as player 0.
    const result = await new Promise<SubmitActionResult>((resolve) =>
      sockets[1].emit("submitAction", { type: "PlaceStartingSoldier", playerId: playerIds[0], hexId: "0,0" }, resolve),
    );

    expect(result.ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sawBroadcast).toBe(false);
  });

  it("rejects an illegal action (out-of-turn) via ack, without a broadcast", async () => {
    const { sockets, playerIds } = await joinFourPlayers();
    const gameStarted = await new Promise<GameState>((resolve) => {
      sockets[1].once("gameStarted", resolve);
      sockets[0].emit("startGame", () => {});
    });

    // Pick a player who is deterministically *not* up first, regardless of
    // how the Step 2 dice roll ordered everyone.
    const activePlayerId = gameStarted.setup!.activePlayerId;
    const outOfTurnIndex = playerIds.findIndex((id) => id !== activePlayerId);
    const outOfTurnPlayerId = playerIds[outOfTurnIndex];
    const outOfTurnSocket = sockets[outOfTurnIndex];

    let sawBroadcast = false;
    sockets[2].once("gameStateUpdate", () => {
      sawBroadcast = true;
    });

    const result = await new Promise<SubmitActionResult>((resolve) =>
      outOfTurnSocket.emit("submitAction", { type: "PlaceStartingSoldier", playerId: outOfTurnPlayerId, hexId: "0,0" }, resolve),
    );

    expect(result.ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sawBroadcast).toBe(false);
  });

  it("rejects submitAction when no game has started yet", async () => {
    const { sockets, playerIds } = await joinFourPlayers();
    const result = await new Promise<SubmitActionResult>((resolve) =>
      sockets[0].emit("submitAction", { type: "PlaceStartingSoldier", playerId: playerIds[0], hexId: "0,0" }, resolve),
    );
    expect(result).toEqual({ ok: false, reason: "No game in progress." });
  });
});
