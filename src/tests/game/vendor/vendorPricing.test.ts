import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { getVendorCardPriceG, VENDOR_RELIC_PRICE_G } from "../../../game/vendor/pricing";
import { tryPurchaseVendorCard } from "../../../game/vendor/vendorPurchase";
import { createVendorState } from "../../../game/vendor/vendorState";

describe("vendor pricing", () => {
  test("card prices scale by tier in 50g steps", () => {
    expect(getVendorCardPriceG("CARD_DAMAGE_FLAT_1")).toBe(50);
    expect(getVendorCardPriceG("CARD_DAMAGE_FLAT_2")).toBe(100);
    expect(getVendorCardPriceG("CARD_DAMAGE_FLAT_3")).toBe(150);
    expect(getVendorCardPriceG("CARD_FIRE_RATE_4")).toBe(200);
  });

  test("relic price is fixed at 300g", () => {
    expect(VENDOR_RELIC_PRICE_G).toBe(300);
  });

  test("buying a card charges its tier-scaled price", () => {
    const w = createWorld({ seed: 1401, stage: stageDocks });
    w.vendor = createVendorState(["CARD_DAMAGE_FLAT_2"], []);
    w.run.runGold = 100;

    const ok = tryPurchaseVendorCard(w, 0);
    expect(ok).toBe(true);
    expect(w.run.runGold).toBe(0);
    expect(w.vendor.purchased[0]).toBe(true);
    expect(w.cards).toContain("CARD_DAMAGE_FLAT_2");
  });

  test("card purchase fails when below tier-scaled price", () => {
    const w = createWorld({ seed: 1402, stage: stageDocks });
    w.vendor = createVendorState(["CARD_DAMAGE_FLAT_3"], []);
    w.run.runGold = 149;

    const ok = tryPurchaseVendorCard(w, 0);
    expect(ok).toBe(false);
    expect(w.run.runGold).toBe(149);
    expect(w.vendor.purchased[0]).toBe(false);
    expect(w.cards ?? []).not.toContain("CARD_DAMAGE_FLAT_3");
  });
});
