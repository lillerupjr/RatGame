import { beforeEach, describe, expect, it, vi } from "vitest";

class MockSpritePreloadError extends Error {
  kind: "UNSUPPORTED" | "FAILED" | "TIMED_OUT";

  constructor(kind: "UNSUPPORTED" | "FAILED" | "TIMED_OUT", message: string) {
    super(message);
    this.name = "SpritePreloadError";
    this.kind = kind;
  }
}

const activePaletteMock = vi.hoisted(() => ({
  buildPaletteVariantKey: vi.fn((paletteId: string, percents: { sWeightPercent: number; darknessPercent: number }) =>
    `${paletteId}@@sw:${percents.sWeightPercent}@@dk:${percents.darknessPercent}`),
  resolveActivePaletteId: vi.fn(() => "db32"),
  resolveActivePaletteSwapWeightPercents: vi.fn(() => ({ sWeightPercent: 75, darknessPercent: 50 })),
  resolveActivePaletteVariantKey: vi.fn(() => "db32@@sw:75@@dk:50"),
}));

const spriteLoaderMock = vi.hoisted(() => ({
  preloadSpritePack: vi.fn(),
  getSpriteFrame: vi.fn(),
}));

vi.mock("../../../../game/render/activePalette", () => ({
  buildPaletteVariantKey: activePaletteMock.buildPaletteVariantKey,
  resolveActivePaletteId: activePaletteMock.resolveActivePaletteId,
  resolveActivePaletteSwapWeightPercents: activePaletteMock.resolveActivePaletteSwapWeightPercents,
  resolveActivePaletteVariantKey: activePaletteMock.resolveActivePaletteVariantKey,
}));

vi.mock("../../../../engine/render/sprites/spriteLoader", () => ({
  preloadSpritePack: spriteLoaderMock.preloadSpritePack,
  getSpriteFrame: spriteLoaderMock.getSpriteFrame,
  isSpritePreloadError: (value: unknown) => value instanceof MockSpritePreloadError,
}));

import { enemySpritesReady, preloadEnemySprites } from "../../../../engine/render/sprites/enemySprites";

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("enemySprites transient timeout retry behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries a transient timeout instead of permanently poisoning readiness", async () => {
    const paletteVariantKey = "db32@@sw:75@@dk:50";
    const readyPack = {
      skin: "rat1",
      size: { w: 32, h: 32 },
      frameCount: 1,
      rotations: { S: { width: 32, height: 32 } as unknown as HTMLImageElement },
      animations: {},
    };

    spriteLoaderMock.preloadSpritePack
      .mockRejectedValueOnce(new MockSpritePreloadError("TIMED_OUT", "timed out"))
      .mockResolvedValueOnce(readyPack);

    preloadEnemySprites(["rat1"], paletteVariantKey);
    await flushAsync();

    expect(enemySpritesReady(["rat1"], paletteVariantKey)).toBe(false);
    expect(spriteLoaderMock.preloadSpritePack).toHaveBeenCalledTimes(1);

    preloadEnemySprites(["rat1"], paletteVariantKey);
    await flushAsync();

    expect(spriteLoaderMock.preloadSpritePack).toHaveBeenCalledTimes(2);
    expect(enemySpritesReady(["rat1"], paletteVariantKey)).toBe(true);
  });
});
