import { describe, expect, test } from "vitest";
import { generateVendorCards } from "../../../game/vendor/generateVendorCards";
import { getCardById } from "../../../game/combat_mods/content/cards/cardPool";

describe("generateVendorCards character visibility", () => {
  test("HOBO vendor cards exclude physical-tagged cards", () => {
    for (let i = 0; i < 40; i++) {
      const out = generateVendorCards(8, "HOBO");
      for (const id of out) {
        const card = getCardById(id);
        expect(card).toBeTruthy();
        if (!card) continue;
        expect(card.tags.includes("physical")).toBe(false);
      }
    }
  });

  test("JOEY vendor cards exclude fires/hit/projectile/crit-tagged cards", () => {
    for (let i = 0; i < 40; i++) {
      const out = generateVendorCards(8, "JOEY");
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
