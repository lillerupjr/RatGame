import { describe, expect, test } from "vitest";
import { RNG } from "../../../game/util/rng";
import { generateCardRewardOptions } from "../../../game/combat_mods/rewards/cardRewardGenerator";
import { getCardById } from "../../../game/combat_mods/content/cards/cardPool";

function runWithSeed(seed: number, count: number): string[] {
  const rng = new RNG(seed);
  return generateCardRewardOptions(() => rng.next(), count);
}

describe("cardRewardGenerator tiered", () => {
  test("same seed yields same options", () => {
    expect(runWithSeed(1337, 3)).toEqual(runWithSeed(1337, 3));
  });

  test("options contain no duplicates", () => {
    const out = runWithSeed(4242, 5);
    expect(new Set(out).size).toBe(out.length);
  });

  test("distribution follows configured 66/33/0 weights", () => {
    const rng = new RNG(2026);
    const totals = { t1: 0, t2: 0, t3: 0 };
    const trials = 10_000;
    const optionsPerTrial = 3;

    for (let i = 0; i < trials; i++) {
      const options = generateCardRewardOptions(() => rng.next(), optionsPerTrial);
      for (const id of options) {
        const card = getCardById(id);
        expect(card).toBeTruthy();
        if (!card) continue;
        if (card.powerTier === 1) totals.t1 += 1;
        else if (card.powerTier === 2) totals.t2 += 1;
        else if (card.powerTier === 3) totals.t3 += 1;
      }
    }

    const totalPicks = totals.t1 + totals.t2 + totals.t3;
    const t1Rate = totals.t1 / totalPicks;
    const t2Rate = totals.t2 / totalPicks;

    expect(t1Rate).toBeGreaterThanOrEqual(0.60);
    expect(t1Rate).toBeLessThanOrEqual(0.72);
    expect(t2Rate).toBeGreaterThanOrEqual(0.28);
    expect(t2Rate).toBeLessThanOrEqual(0.40);
    expect(totals.t3).toBe(0);
  });
});
