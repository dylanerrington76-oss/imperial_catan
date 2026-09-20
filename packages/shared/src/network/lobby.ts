import type { PlayerColor, PlayerId } from "../game/index.js";

/**
 * Project scope boundary: "exactly one host and three joining clients per
 * game session" / "no support for fewer or more than four players." This
 * is an MVP scoping choice, not a rules-engine limit - `createInitialGameState`
 * in `../game/state.js` still accepts 2-4 players for whenever that scope
 * boundary is lifted.
 */
export const REQUIRED_PLAYER_COUNT = 4;

export interface LobbyPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: PlayerColor;
  /** The first player to join; only the host may start the game. */
  readonly isHost: boolean;
}

export interface LobbyState {
  readonly players: readonly LobbyPlayer[];
  readonly started: boolean;
}

/** A color already taken by another lobby player, a full lobby, or a started game all block joining. */
export function canJoinLobby(lobby: LobbyState, color: PlayerColor): boolean {
  if (lobby.started) return false;
  if (lobby.players.length >= REQUIRED_PLAYER_COUNT) return false;
  return !lobby.players.some((player) => player.color === color);
}

/** Only the host, only once, and only once exactly `REQUIRED_PLAYER_COUNT` players have joined. */
export function canStartGame(lobby: LobbyState, requestingPlayerId: PlayerId): boolean {
  if (lobby.started) return false;
  if (lobby.players.length !== REQUIRED_PLAYER_COUNT) return false;
  return lobby.players.find((player) => player.id === requestingPlayerId)?.isHost ?? false;
}
