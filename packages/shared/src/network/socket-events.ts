import type { Action, GameState, PlayerColor, PlayerId } from "../game/index.js";
import type { LobbyState } from "./lobby.js";

export type JoinLobbyResult = { readonly ok: true; readonly playerId: PlayerId } | { readonly ok: false; readonly reason: string };
export type StartGameResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };
export type SubmitActionResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** Events the server pushes to clients. */
export interface ServerToClientEvents {
  lobbyUpdate: (lobby: LobbyState) => void;
  gameStarted: (state: GameState) => void;
  /** Broadcast after every successfully-applied action; this is the client's only source of game truth (FR2). */
  gameStateUpdate: (state: GameState) => void;
}

/**
 * Events a client sends. Every one carries an acknowledgement callback so
 * the sender gets a direct, targeted result (join succeeded/failed, action
 * legal/illegal) - see Story 7's acceptance criteria: a rejected action
 * must reach only the submitting client, without affecting anyone else.
 */
export interface ClientToServerEvents {
  joinLobby: (payload: { name: string; color: PlayerColor }, ack: (result: JoinLobbyResult) => void) => void;
  startGame: (ack: (result: StartGameResult) => void) => void;
  /**
   * `action.playerId` is what the client *believes* its own id is; the
   * server never trusts it at face value and instead checks it against the
   * `playerId` that socket actually joined the lobby as (see
   * `../../../server/src/game-server.ts`), so one client can't submit
   * actions impersonating another.
   */
  submitAction: (action: Action, ack: (result: SubmitActionResult) => void) => void;
}

/** Per-connection data Socket.io attaches once a socket has joined the lobby. */
export interface SocketData {
  playerId?: PlayerId;
}
