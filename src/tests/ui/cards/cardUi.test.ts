import { describe, expect, test } from "vitest";
import { tierClass } from "../../../ui/cards/cardUi";

describe("cardUi tierClass", () => {
  test("maps tiers 1..4 to expected classes", () => {
    expect(tierClass(1)).toBe("tier-1");
    expect(tierClass(2)).toBe("tier-2");
    expect(tierClass(3)).toBe("tier-3");
    expect(tierClass(4)).toBe("tier-4");
  });

  test("falls back safely for unknown values", () => {
    expect(tierClass(null)).toBe("tier-1");
    expect(tierClass(undefined)).toBe("tier-1");
    expect(tierClass(5)).toBe("tier-4");
  });
});
