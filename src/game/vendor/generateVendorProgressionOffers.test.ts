import { describe, expect, test } from "vitest";
import { createInitialRingProgressionState } from "../progression/rings/ringState";
import { generateVendorProgressionOffers } from "./generateVendorProgressionOffers";
import { tryPurchaseVendorOffer } from "./vendorPurchase";

function stubWorld(seed = 1): any {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  return {
    rng: { next },
    progression: createInitialRingProgressionState(),
    run: { runGold: 1000 },
    basePlayerHpMax: 100,
    playerHpMax: 100,
    playerHp: 100,
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
  };
}

describe("vendor progression offers", () => {
  test("generates typed progression offers and can purchase them", () => {
    const world = stubWorld();
    const offers = generateVendorProgressionOffers(world, 5);
    world.vendor = { offers };

    expect(offers).toHaveLength(5);
    expect(offers.every((offer) => typeof offer.option.id === "string")).toBe(true);
    expect(offers.some((offer) => offer.option.family === "RING")).toBe(true);
    expect(offers.some((offer) => offer.option.family === "RING_MODIFIER_TOKEN")).toBe(true);

    const ringIndex = offers.findIndex((offer) => offer.option.family === "RING");
    expect(ringIndex).toBeGreaterThanOrEqual(0);
    expect(tryPurchaseVendorOffer(world, ringIndex)).toBe(true);
    expect(Object.keys(world.progression.ringsByInstanceId)).toHaveLength(1);

    const tokenIndex = offers.findIndex((offer) => offer.option.family === "RING_MODIFIER_TOKEN" && !offer.isSold);
    expect(tokenIndex).toBeGreaterThanOrEqual(0);
    expect(tryPurchaseVendorOffer(world, tokenIndex)).toBe(true);
    expect(world.progression.storedModifierTokens.LEVEL_UP + world.progression.storedModifierTokens.INCREASED_EFFECT_20).toBe(1);
  });
});
