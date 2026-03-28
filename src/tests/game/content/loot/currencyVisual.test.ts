import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  currencyTierForValue,
  getCurrencyAtlasFrame,
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

beforeEach(() => {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error(`Unexpected element request: ${tag}`);
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          imageSmoothingEnabled: false,
          drawImage: () => {},
        }),
      };
    },
  };
});

afterEach(() => {
  delete (globalThis as any).document;
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

  test("returns atlas-backed frames that share one image across currency tiers", () => {
    const lowValueFrame = getCurrencyAtlasFrame(1, 0);
    const highValueFrame = getCurrencyAtlasFrame(8, 0);

    expect(lowValueFrame).not.toBeNull();
    expect(highValueFrame).not.toBeNull();
    expect(lowValueFrame?.image).toBe(highValueFrame?.image);
    expect(lowValueFrame?.sw).toBe(16);
    expect(lowValueFrame?.sh).toBe(16);
    expect(highValueFrame?.sw).toBe(16);
    expect(highValueFrame?.sh).toBe(16);
    expect(`${lowValueFrame?.sx},${lowValueFrame?.sy}`).not.toBe(`${highValueFrame?.sx},${highValueFrame?.sy}`);
  });
});
