/**
 * Dice rolls are deliberately *not* drawn from the board's seeded RNG
 * (`../hex/rng.ts`): the MVP explicitly excludes replay-from-seed (see the
 * project proposal's "Features excluded from the MVP"), so there's no
 * requirement that a turn's rolls be reproducible - only that they're fair.
 * `rng` defaults to `Math.random` but is injectable so tests can be
 * deterministic without needing a full seeded generator.
 */
export type DiceRoll = readonly [number, number];

export function rollTwoDice(rng: () => number = Math.random): DiceRoll {
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
}

export function diceTotal(roll: DiceRoll): number {
  return roll[0] + roll[1];
}
