import { describe, expect, test } from "vitest";
import { STARTER_CARDS_V1 } from "./starterCards";
import { STAT_KEYS } from "../../stats/statKeys";

const ALL_KEYS = new Set(Object.values(STAT_KEYS));

describe("STARTER_CARDS_V1 invariants", () => {
  test("starter cards contain no 'more' mods", () => {
    for (const c of STARTER_CARDS_V1) {
      for (const m of c.mods) {
        expect(m.op).not.toBe("more");
      }
    }
  });

  test("all starter card stat keys are declared in STAT_KEYS", () => {
    for (const c of STARTER_CARDS_V1) {
      for (const m of c.mods) {
        expect(ALL_KEYS.has(m.key)).toBe(true);
      }
    }
  });

  test("rarity is 1..4", () => {
    for (const c of STARTER_CARDS_V1) {
      expect([1, 2, 3, 4]).toContain(c.rarity);
    }
  });

  test("powerTier is limited to 1..4 for starter cards", () => {
    for (const c of STARTER_CARDS_V1) {
      expect([1, 2, 3, 4]).toContain(c.powerTier);
    }
  });

  test("card ids are unique", () => {
    const seen = new Set<string>();
    for (const c of STARTER_CARDS_V1) {
      expect(seen.has(c.id)).toBe(false);
      seen.add(c.id);
    }
  });
});
