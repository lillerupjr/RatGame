import { describe, expect, test } from "vitest";
import { currencyTierForValue } from "../../../../game/content/loot/currencyVisual";

describe("currencyTierForValue", () => {
  test("maps coin values 1..3 to coin tiers", () => {
    expect(currencyTierForValue(1)).toEqual({ dir: "coins", n: 1, frameCount: 5, fps: 10 });
    expect(currencyTierForValue(2)).toEqual({ dir: "coins", n: 2, frameCount: 5, fps: 10 });
    expect(currencyTierForValue(3)).toEqual({ dir: "coins", n: 3, frameCount: 5, fps: 10 });
  });

  test("maps values 4..7 to gem tiers 1..4", () => {
    expect(currencyTierForValue(4)).toEqual({ dir: "gems", n: 1, frameCount: 4, fps: 10 });
    expect(currencyTierForValue(5)).toEqual({ dir: "gems", n: 2, frameCount: 4, fps: 10 });
    expect(currencyTierForValue(6)).toEqual({ dir: "gems", n: 3, frameCount: 4, fps: 10 });
    expect(currencyTierForValue(7)).toEqual({ dir: "gems", n: 4, frameCount: 4, fps: 10 });
  });

  test("maps value 8 and above to gem tier 5", () => {
    expect(currencyTierForValue(8)).toEqual({ dir: "gems", n: 5, frameCount: 4, fps: 10 });
    expect(currencyTierForValue(999)).toEqual({ dir: "gems", n: 5, frameCount: 4, fps: 10 });
  });
});
