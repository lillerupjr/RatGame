import { describe, expect, test } from "vitest";
import { RNG } from "../../../game/util/rng";
import { generateCardRewardOptions } from "../../../game/combat_mods/rewards/cardRewardGenerator";
import { getCardById } from "../../../game/combat_mods/content/cards/cardPool";
import { CARD_TIER_WEIGHTS } from "../../../game/combat_mods/rewards/cardTierWeights";

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

  test("distribution follows configured tier weights", () => {
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
    const t3Rate = totals.t3 / totalPicks;

    const w1 = CARD_TIER_WEIGHTS[1];
    const w2 = CARD_TIER_WEIGHTS[2];
    const w3 = CARD_TIER_WEIGHTS[3];
    const sum = Math.max(1, w1 + w2 + w3);
    const e1 = w1 / sum;
    const e2 = w2 / sum;
    const e3 = w3 / sum;
    const tol = 0.10;

    expect(Math.abs(t1Rate - e1)).toBeLessThanOrEqual(tol);
    expect(Math.abs(t2Rate - e2)).toBeLessThanOrEqual(tol);
    expect(Math.abs(t3Rate - e3)).toBeLessThanOrEqual(tol);
  });

  test("deterministic output remains stable when character filter is applied", () => {
    const rng1 = new RNG(3001);
    const rng2 = new RNG(3001);
    const a = generateCardRewardOptions(() => rng1.next(), 3, "HOBO");
    const b = generateCardRewardOptions(() => rng2.next(), 3, "HOBO");
    expect(a).toEqual(b);
  });
});
