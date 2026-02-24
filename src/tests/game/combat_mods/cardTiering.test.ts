import { describe, expect, test } from "vitest";
import { getAllCards } from "../../../game/combat_mods/content/cards/cardPool";

describe("card tiering", () => {
  test("all cards are within tiers 1..3", () => {
    for (const card of getAllCards()) {
      expect([1, 2, 3]).toContain(card.powerTier);
    }
  });

  test("tier 3 cards are exactly mechanics cards", () => {
    const tier3 = getAllCards()
      .filter((card) => card.powerTier === 3)
      .map((card) => card.id)
      .sort();
    expect(tier3).toEqual(["CARD_PIERCE_1", "CARD_PROJECTILE_1"]);
  });
});
