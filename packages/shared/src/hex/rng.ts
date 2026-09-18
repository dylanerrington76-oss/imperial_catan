/**
 * A small, dependency-free, seedable PRNG (mulberry32).
 *
 * `Math.random()` cannot be seeded, so it can never give the "same seed
 * produces the same board" reproducibility this game requires. This
 * generator trades cryptographic quality for speed and, most importantly,
 * determinism.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher-Yates shuffle. Does not mutate the input array. */
export function seededShuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}
