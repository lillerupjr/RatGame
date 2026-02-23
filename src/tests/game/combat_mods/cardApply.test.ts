import { describe, expect, test } from "vitest";
import { applyCardToWorld } from "../../../game/combat_mods/rewards/cardApply";

describe("cardApply", () => {
  test("applying card adds to world.cards", () => {
    const world: any = { cards: [] };
    applyCardToWorld(world, "CARD_DAMAGE_FLAT_1");
    expect(world.cards).toEqual(["CARD_DAMAGE_FLAT_1"]);
  });

  test("stacking works with duplicates", () => {
    const world: any = { cards: [] };
    applyCardToWorld(world, "CARD_DAMAGE_FLAT_1");
    applyCardToWorld(world, "CARD_DAMAGE_FLAT_1");
    expect(world.cards).toEqual(["CARD_DAMAGE_FLAT_1", "CARD_DAMAGE_FLAT_1"]);
  });
});
