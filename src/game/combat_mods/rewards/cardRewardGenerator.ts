import { getAllCardIds } from "../content/cards/cardPool";

/**
 * Deterministically select N unique cards using provided RNG.
 */
export function generateCardRewardOptions(
  rng: () => number,
  count: number
): string[] {
  const pool = getAllCardIds().slice();

  // Fisher-Yates shuffle using deterministic rng
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, Math.min(count, pool.length));
}
