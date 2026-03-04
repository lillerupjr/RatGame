import { describe, expect, test } from "vitest";
import { applyCardToWorld, removeCardFromWorld } from "../../../game/combat_mods/rewards/cardApply";

function stubWorld(): any {
  return {
    baseMoveSpeed: 100,
    basePickupRadius: 32,
    pSpeed: 100,
    pickupRadius: 32,
    maxArmor: 50,
    currentArmor: 0,
    momentumMax: 20,
    momentumValue: 0,
    dmgMult: 1,
    fireRateMult: 1,
    areaMult: 1,
    durationMult: 1,
    critChanceBonus: 0,
    items: [],
    relics: [],
    cards: [],
    playerHpMax: 100,
    basePlayerHpMax: 100,
    playerHp: 100,
  };
}

describe("cardApply", () => {
  test("applying card adds to world.cards", () => {
    const world = stubWorld();
    applyCardToWorld(world, "CARD_DAMAGE_FLAT_1");
    expect(world.cards).toEqual(["CARD_DAMAGE_FLAT_1"]);
  });

  test("stacking works with duplicates", () => {
    const world = stubWorld();
    applyCardToWorld(world, "CARD_DAMAGE_FLAT_1");
    applyCardToWorld(world, "CARD_DAMAGE_FLAT_1");
    expect(world.cards).toEqual(["CARD_DAMAGE_FLAT_1", "CARD_DAMAGE_FLAT_1"]);
  });

  test("life card increases both max and current HP", () => {
    const world = stubWorld();
    world.playerHp = 80;
    applyCardToWorld(world, "CARD_LIFE_1");
    expect(world.playerHpMax).toBe(125);
    expect(world.playerHp).toBe(105); // 80 + 25
  });

  test("removing one life card recomputes and clamps current HP", () => {
    const world = stubWorld();
    applyCardToWorld(world, "CARD_LIFE_3");
    expect(world.playerHpMax).toBe(175);
    expect(world.playerHp).toBe(175);

    const removed = removeCardFromWorld(world, "CARD_LIFE_3");
    expect(removed).toBe(true);
    expect(world.playerHpMax).toBe(100);
    expect(world.playerHp).toBe(100);
  });
});
