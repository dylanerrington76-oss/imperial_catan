import { randomUUID } from "node:crypto";
import {
  applyAction,
  canJoinLobby,
  canStartGame,
  createInitialGameState,
  determineTurnOrder,
  IllegalActionError,
  type ClientToServerEvents,
  type GameState,
  type LobbyPlayer,
  type LobbyState,
  type ServerToClientEvents,
  type SocketData,
} from "@monorepo/shared";
import type { Server, Socket } from "socket.io";

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

function describeError(error: unknown): string {
  if (error instanceof IllegalActionError) return "That action isn't legal right now.";
  if (error instanceof Error) return error.message;
  return "Unknown server error.";
}

/**
 * Registers every event handler for the game session. There's exactly one
 * lobby and one game per server process - the project scope is "one game
 * session at a time (no matchmaking or concurrent games)" - so this holds
 * plain module-local mutable state rather than a room/game registry.
 *
 * The server is the sole source of truth (FR2): every mutation goes
 * through `applyAction`, and the resulting `GameState` is what gets
 * broadcast. Nothing here computes game logic itself.
 */
export function registerGameServer(io: GameServer): void {
  let lobby: LobbyState = { players: [], started: false };
  let game: GameState | null = null;

  const broadcastLobby = () => io.emit("lobbyUpdate", lobby);
  const broadcastGameState = () => {
    if (game) io.emit("gameStateUpdate", game);
  };

  io.on("connection", (socket: GameSocket) => {
    // Bring a freshly-connected client (or one that just refreshed the
    // page) up to date immediately. This isn't reconnect-and-resume - the
    // socket gets a new connection and no player identity - just a
    // reasonable default so the screen isn't blank.
    socket.emit("lobbyUpdate", lobby);
    if (game) socket.emit("gameStateUpdate", game);

    socket.on("joinLobby", ({ name, color }, ack) => {
      if (!canJoinLobby(lobby, color)) {
        ack({ ok: false, reason: lobby.started ? "The game has already started." : "That color is taken, or the lobby is full." });
        return;
      }

      const player: LobbyPlayer = { id: randomUUID(), name, color, isHost: lobby.players.length === 0 };
      lobby = { ...lobby, players: [...lobby.players, player] };
      socket.data.playerId = player.id;

      ack({ ok: true, playerId: player.id });
      broadcastLobby();
    });

    socket.on("startGame", (ack) => {
      const playerId = socket.data.playerId;
      if (!playerId || !canStartGame(lobby, playerId)) {
        ack({ ok: false, reason: "Only the host can start, and only once exactly four players have joined." });
        return;
      }

      const turnOrder = determineTurnOrder(lobby.players.map((player) => player.id));
      // A fresh random seed per session (rather than a host-chosen one):
      // FR1 only requires board generation be a reproducible function of
      // *some* seed, not that players can pick or replay one - replay-from-seed
      // is explicitly excluded from the MVP.
      const seed = Date.now();
      game = createInitialGameState(
        randomUUID(),
        seed,
        lobby.players.map((player) => ({ id: player.id, name: player.name, color: player.color })),
        turnOrder,
      );
      lobby = { ...lobby, started: true };

      ack({ ok: true });
      broadcastLobby();
      io.emit("gameStarted", game);
    });

    socket.on("submitAction", (action, ack) => {
      if (!game) {
        ack({ ok: false, reason: "No game in progress." });
        return;
      }

      // Never trust action.playerId at face value - only allow a socket to
      // act as the player it actually joined the lobby as, so one client
      // can't submit actions impersonating another (FR2 / the "a modified
      // client cannot cheat" privacy-and-security requirement).
      if (socket.data.playerId !== action.playerId) {
        ack({ ok: false, reason: "You may only submit actions as yourself." });
        return;
      }

      try {
        game = applyAction(game, action);
      } catch (error) {
        // Rejected without mutating `game` - only this client hears about
        // it (Story 7), everyone else's view is untouched.
        ack({ ok: false, reason: describeError(error) });
        return;
      }

      ack({ ok: true });
      broadcastGameState();
    });

    socket.on("disconnect", () => {
      // Reconnect-and-resume is explicitly out of MVP scope; the only
      // requirement is that a drop doesn't take the server down. Pre-game,
      // free up the seat and color; mid-game, the session just carries on
      // without that socket, same as if a browser tab were closed.
      if (!game && socket.data.playerId) {
        lobby = { ...lobby, players: lobby.players.filter((player) => player.id !== socket.data.playerId) };
        broadcastLobby();
      }
    });
  });
}
