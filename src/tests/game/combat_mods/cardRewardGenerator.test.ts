import { describe, expect, test } from "vitest";
import { RNG } from "../../../game/util/rng";
import { generateCardRewardOptions } from "../../../game/combat_mods/rewards/cardRewardGenerator";
import { getCardById } from "../../../game/combat_mods/content/cards/cardPool";

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

  test("HOBO reward options exclude physical-tagged cards", () => {
    const rng = new RNG(7);
    for (let i = 0; i < 200; i++) {
      const out = generateCardRewardOptions(() => rng.next(), 3, "HOBO");
      for (const id of out) {
        const card = getCardById(id);
        expect(card).toBeTruthy();
        if (!card) continue;
        expect(card.tags.includes("physical")).toBe(false);
      }
    }
  });

  test("JOEY reward options exclude fires/hit/projectile/crit-tagged cards", () => {
    const rng = new RNG(8);
    for (let i = 0; i < 200; i++) {
      const out = generateCardRewardOptions(() => rng.next(), 3, "JOEY");
      for (const id of out) {
        const card = getCardById(id);
        expect(card).toBeTruthy();
        if (!card) continue;
        expect(card.tags.includes("fires")).toBe(false);
        expect(card.tags.includes("hit")).toBe(false);
        expect(card.tags.includes("projectile")).toBe(false);
        expect(card.tags.includes("crit")).toBe(false);
      }
    }
  });
});
