import { describe, expect, test } from "vitest";
import { getEligibleCardPool } from "../../../game/combat_mods/rewards/cardPool";

describe("card tiering", () => {
  test("all cards are within tiers 1..4", () => {
    for (const card of getEligibleCardPool()) {
      expect([1, 2, 3, 4]).toContain(card.powerTier);
    }
  });

  test("tier 4 includes top-end mechanics upgrades", () => {
    const tier4 = getEligibleCardPool()
      .filter((card) => card.powerTier === 4)
      .map((card) => card.id);
    expect(tier4).toContain("CARD_PIERCE_2");
    expect(tier4).toContain("CARD_PROJECTILE_2");
  });
});
