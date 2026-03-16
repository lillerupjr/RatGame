import { beforeEach, describe, expect, it, vi } from "vitest";

const activePaletteMock = vi.hoisted(() => ({
  buildPaletteVariantKey: vi.fn((paletteId: string, percents: { sWeightPercent: number; darknessPercent: number }) =>
    `${paletteId}@@sw:${percents.sWeightPercent}@@dk:${percents.darknessPercent}`),
  resolveActivePaletteId: vi.fn(() => "db32"),
  resolveActivePaletteSwapWeightPercents: vi.fn(() => ({ sWeightPercent: 75, darknessPercent: 50 })),
  resolveActivePaletteVariantKey: vi.fn(() => "active@@sw:75@@dk:50"),
}));

const renderSpritesMock = vi.hoisted(() => ({
  getSpriteByIdForVariantKey: vi.fn(),
  hasSpriteRecordForCacheKey: vi.fn(() => false),
  resolveSpriteCacheKeyForVariantKey: vi.fn((spriteId: string, paletteVariantKey: string) =>
    `${spriteId}@@palv:${paletteVariantKey}`),
  getSpriteCacheDebugSnapshotByKey: vi.fn(() => null),
}));

vi.mock("../../../../game/render/activePalette", () => ({
  buildPaletteVariantKey: activePaletteMock.buildPaletteVariantKey,
  resolveActivePaletteId: activePaletteMock.resolveActivePaletteId,
  resolveActivePaletteSwapWeightPercents: activePaletteMock.resolveActivePaletteSwapWeightPercents,
  resolveActivePaletteVariantKey: activePaletteMock.resolveActivePaletteVariantKey,
}));

vi.mock("../../../../engine/render/sprites/renderSprites", () => ({
  getSpriteByIdForVariantKey: renderSpritesMock.getSpriteByIdForVariantKey,
  hasSpriteRecordForCacheKey: renderSpritesMock.hasSpriteRecordForCacheKey,
  resolveSpriteCacheKeyForVariantKey: renderSpritesMock.resolveSpriteCacheKeyForVariantKey,
  getSpriteCacheDebugSnapshotByKey: renderSpritesMock.getSpriteCacheDebugSnapshotByKey,
}));

import { preloadSpritePack } from "../../../../engine/render/sprites/spriteLoader";

function makeReadyRecord() {
  const img = {
    naturalWidth: 32,
    naturalHeight: 32,
    width: 32,
    height: 32,
    complete: true,
    decode: async () => {},
  } as unknown as HTMLImageElement;
  return {
    img,
    ready: true,
    failed: false,
    unsupported: false,
  };
}

describe("spriteLoader exact variant key readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderSpritesMock.getSpriteByIdForVariantKey.mockImplementation(() => makeReadyRecord());
    renderSpritesMock.hasSpriteRecordForCacheKey.mockReturnValue(false);
    renderSpritesMock.getSpriteCacheDebugSnapshotByKey.mockReturnValue(null);
  });

  it("waits against the exact requested variant key", async () => {
    const requestedVariantKey = "cyberpunk@@sw:25@@dk:50";

    await preloadSpritePack("rat1", {
      frameCount: 1,
      paletteVariantKey: requestedVariantKey,
    });

    expect(renderSpritesMock.getSpriteByIdForVariantKey).toHaveBeenCalled();
    const usedVariantKeys = renderSpritesMock.getSpriteByIdForVariantKey.mock.calls.map((call) => call[1]);
    expect(usedVariantKeys.length).toBeGreaterThan(0);
    expect(usedVariantKeys.every((key) => key === requestedVariantKey)).toBe(true);
  });
});
