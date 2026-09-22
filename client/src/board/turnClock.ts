/**
 * Rulebook TURN OVERVIEW: "Each turn has a 2 minute time limit." This is
 * display-only - nothing in the shared rules engine currently enforces the
 * limit by force-ending a turn (see `packages/shared/src/game/reducers.ts`,
 * `applyAdvancePhase`), so a slow turn simply shows a timer that reaches
 * 0:00 and stays there rather than the server intervening.
 */
export function remainingTurnMs(turnStartedAt: number, turnTimeLimitMs: number, now: number): number {
  return Math.max(0, turnTimeLimitMs - (now - turnStartedAt));
}

/** `125000` -> `"2:05"`. Always two digits of seconds, unpadded minutes. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
