import type { GameState, PlayerColor, PlayerId } from "@monorepo/shared";

/**
 * Real color values for each player color. PixiJS draws to a canvas and
 * can't read CSS custom properties (see `./board/boardColors.ts` for the
 * same constraint on resource colors), so these are kept in sync with the
 * `--resource-brick` / `--color-water` / `--color-brass` tokens in
 * `./styles/tokens.css` by hand. Also used for the lobby's color swatches,
 * so the two never drift apart in one direction without the other.
 */
export const PLAYER_COLOR_HEX: Record<PlayerColor, string> = {
  Red: "#a6432e",
  Blue: "#2f5670",
  White: "#e8e2d2",
  Orange: "#c98a3b",
};

/** Looks up the color of whichever player owns `ownerId`, defaulting to White if the id is somehow unknown. */
export function colorOfPlayer(game: GameState, ownerId: PlayerId): PlayerColor {
  return game.players.find((player) => player.id === ownerId)?.color ?? "White";
}
