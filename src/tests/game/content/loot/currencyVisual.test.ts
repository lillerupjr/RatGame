import { afterEach, describe, expect, test, vi } from "vitest";
import {
  currencyTierForValue,
  getCurrencyFrame,
  getCurrencyFrameForDarknessPercent,
  listCurrencyDynamicAtlasSpriteIds,
} from "../../../../game/content/loot/currencyVisual";

const rawSpriteCache = new Map<string, any>();
const litSpriteCache = new Map<string, any>();

vi.mock("../../../../engine/render/sprites/renderSprites", () => ({
  getSpriteById: vi.fn((spriteId: string) => {
    if (!rawSpriteCache.has(spriteId)) {
      rawSpriteCache.set(spriteId, {
        ready: true,
        img: {
          width: 16,
          height: 16,
          spriteId,
        },
      });
    }
    return rawSpriteCache.get(spriteId);
  }),
  getSpriteByIdForDarknessPercent: vi.fn((spriteId: string, darknessPercent: number) => {
    const key = `${spriteId}@dark:${darknessPercent}`;
    if (!litSpriteCache.has(key)) {
      litSpriteCache.set(key, {
        ready: true,
        img: {
          width: 16,
          height: 16,
          spriteId: key,
        },
      });
    }
    return litSpriteCache.get(key);
  }),
}));

afterEach(() => {
  rawSpriteCache.clear();
  litSpriteCache.clear();
});

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

  test("returns direct raw frames for live pickup rendering", () => {
    const lowValueFrame = getCurrencyFrame(1, 0);
    const highValueFrame = getCurrencyFrame(8, 0);

    expect(lowValueFrame.ready).toBe(true);
    expect(highValueFrame.ready).toBe(true);
    expect((lowValueFrame.img as any).spriteId).toContain("loot/currency/coins/1/");
    expect((highValueFrame.img as any).spriteId).toContain("loot/currency/gems/5/");
  });

  test("returns darkness-aware direct frames for lit pickup rendering", () => {
    const litFrame = getCurrencyFrameForDarknessPercent(6, 0, 50);

    expect(litFrame.ready).toBe(true);
    expect((litFrame.img as any).spriteId).toContain("@dark:50");
  });

  test("lists every pickup frame for dynamic atlas inventory collection", () => {
    const ids = listCurrencyDynamicAtlasSpriteIds();

    expect(ids).toHaveLength(35);
    expect(ids[0]).toContain("loot/currency/coins/1/");
    expect(ids[ids.length - 1]).toContain("loot/currency/gems/5/");
  });
});
