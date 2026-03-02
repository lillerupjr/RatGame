import { describe, expect, test } from "vitest";
import { CARD_POOL_V1 } from "./cardPool";

describe("card tags", () => {
  test("every card has at least one tag", () => {
    for (const c of CARD_POOL_V1) {
      expect(Array.isArray(c.tags)).toBe(true);
      expect(c.tags.length).toBeGreaterThan(0);
    }
  });
});
