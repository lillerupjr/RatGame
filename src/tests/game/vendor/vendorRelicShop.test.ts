import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { generateVendorRelicOffers } from "../../../game/vendor/generateVendorRelics";
import { createVendorState } from "../../../game/vendor/vendorState";
import { tryPurchaseVendorRelic } from "../../../game/vendor/vendorPurchase";

describe("vendor relic shop", () => {
  test("deterministic stock and stable on reopen", () => {
    const w1 = createWorld({ seed: 1001, stage: stageDocks });
    const w2 = createWorld({ seed: 1001, stage: stageDocks });

    const offers1 = generateVendorRelicOffers(w1, 5, 500);
    const offers2 = generateVendorRelicOffers(w2, 5, 500);
    expect(offers1.map((o) => o.relicId)).toEqual(offers2.map((o) => o.relicId));

    w1.vendor = createVendorState([], offers1);
    const firstSnapshot = w1.vendor.relicOffers.map((o) => o.relicId);
    const reopenSnapshot = w1.vendor.relicOffers.map((o) => o.relicId);
    expect(reopenSnapshot).toEqual(firstSnapshot);
  });

  test("purchase success: costs 500, grants relic, marks sold", () => {
    const w = createWorld({ seed: 1002, stage: stageDocks });
    w.run.runGold = 500;
    const offers = generateVendorRelicOffers(w, 5, 500);
    w.vendor = createVendorState([], offers);

    const picked = w.vendor.relicOffers[0].relicId;
    const ok = tryPurchaseVendorRelic(w, 0);
    expect(ok).toBe(true);
    expect(w.run.runGold).toBe(0);
    expect(w.relics).toContain(picked);
    expect(w.vendor.relicOffers[0].isSold).toBe(true);
  });

  test("purchase fails if insufficient gold", () => {
    const w = createWorld({ seed: 1003, stage: stageDocks });
    w.run.runGold = 499;
    const offers = generateVendorRelicOffers(w, 5, 500);
    w.vendor = createVendorState([], offers);
    const beforeRelics = [...w.relics];
    const beforeSold = w.vendor.relicOffers[0].isSold;

    const ok = tryPurchaseVendorRelic(w, 0);
    expect(ok).toBe(false);
    expect(w.run.runGold).toBe(499);
    expect(w.relics).toEqual(beforeRelics);
    expect(w.vendor.relicOffers[0].isSold).toBe(beforeSold);
  });

  test("generated offers are unique", () => {
    const w = createWorld({ seed: 1004, stage: stageDocks });
    const offers = generateVendorRelicOffers(w, 5, 500);
    const ids = offers.map((o) => o.relicId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("excludes already-owned relics", () => {
    const w = createWorld({ seed: 1005, stage: stageDocks });
    w.relics = ["PASS_MOVE_SPEED_20"];
    const offers = generateVendorRelicOffers(w, 5, 500);
    expect(offers.some((o) => o.relicId === "PASS_MOVE_SPEED_20")).toBe(false);
  });
});
