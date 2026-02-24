import { describe, expect, test } from "vitest";
import { RNG } from "../../../game/util/rng";
import { generateCardRewardOptions } from "../../../game/combat_mods/rewards/cardRewardGenerator";

describe("cardRewardGenerator", () => {
  test("deterministic output for same seed", () => {
    const rng1 = new RNG(12345);
    const rng2 = new RNG(12345);

    const a = generateCardRewardOptions(() => rng1.next(), 3);
    const b = generateCardRewardOptions(() => rng2.next(), 3);

    expect(a).toEqual(b);
  });

  test("no duplicates in reward options", () => {
    const rng = new RNG(42);
    const out = generateCardRewardOptions(() => rng.next(), 5);
    expect(new Set(out).size).toBe(out.length);
  });
});
