import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DynamicAtlasStore } from "../../../../game/systems/presentation/dynamicAtlasStore";
import * as dynamicAtlasSources from "../../../../game/systems/presentation/dynamicAtlasSources";
import { isStableTextureSource } from "../../../../game/systems/presentation/stableTextureSource";

function makeImage(label: string, width: number, height: number): HTMLImageElement {
  return {
    width,
    height,
    naturalWidth: width,
    naturalHeight: height,
    getAttribute: (name: string) => (name === "data-label" ? label : null),
  } as unknown as HTMLImageElement;
}

function makeCanvas(label: string, width: number, height: number): HTMLCanvasElement {
  return {
    width,
    height,
    getAttribute: (name: string) => (name === "data-label" ? label : null),
    getContext: () => ({
      imageSmoothingEnabled: false,
      drawImage: vi.fn(),
    }),
  } as unknown as HTMLCanvasElement;
}

beforeEach(() => {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error(`Unexpected element request: ${tag}`);
      return makeCanvas("atlas-page", 0, 0);
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as any).document;
});

describe("DynamicAtlasStore", () => {
  it("keeps atlas identity stable across same-source syncs and replaces it on source/context change", () => {
    const imageA = makeImage("a", 32, 32);
    const imageB = makeImage("b", 32, 32);
    const collectSpy = vi.spyOn(dynamicAtlasSources, "collectDynamicAtlasSources");
    collectSpy
      .mockReturnValueOnce({
        readySources: [{ sourceKey: "directFrame:a", image: imageA, kind: "directFrame" }],
        pendingSourceKeys: new Set(),
        fallbackSourceKeys: new Set(),
      })
      .mockReturnValueOnce({
        readySources: [{ sourceKey: "directFrame:a", image: imageA, kind: "directFrame" }],
        pendingSourceKeys: new Set(),
        fallbackSourceKeys: new Set(),
      })
      .mockReturnValueOnce({
        readySources: [{ sourceKey: "directFrame:a", image: imageB, kind: "directFrame" }],
        pendingSourceKeys: new Set(),
        fallbackSourceKeys: new Set(),
      })
      .mockReturnValueOnce({
        readySources: [{ sourceKey: "directFrame:a", image: imageB, kind: "directFrame" }],
        pendingSourceKeys: new Set(),
        fallbackSourceKeys: new Set(),
      });

    const store = new DynamicAtlasStore();
    store.sync({ paletteVariantKey: "pal_a" });
    const first = store.getFrameForImage(imageA);
    store.sync({ paletteVariantKey: "pal_a" });
    const second = store.getFrameForImage(imageA);
    store.sync({ paletteVariantKey: "pal_a" });
    const third = store.getFrameForImage(imageB);
    store.sync({ paletteVariantKey: "pal_b" });
    const fourth = store.getFrameForImage(imageB);

    expect(first?.image).toBe(second?.image);
    expect(third?.image).not.toBe(first?.image);
    expect(fourth?.image).not.toBe(third?.image);
    expect(isStableTextureSource(first?.image)).toBe(true);
  });

  it("rebuilds when pending dynamic sources become ready", () => {
    const imageA = makeImage("ready", 24, 24);
    const collectSpy = vi.spyOn(dynamicAtlasSources, "collectDynamicAtlasSources");
    collectSpy
      .mockReturnValueOnce({
        readySources: [],
        pendingSourceKeys: new Set(["directFrame:pending"]),
        fallbackSourceKeys: new Set(),
      })
      .mockReturnValueOnce({
        readySources: [{ sourceKey: "directFrame:pending", image: imageA, kind: "directFrame" }],
        pendingSourceKeys: new Set(),
        fallbackSourceKeys: new Set(),
      });

    const store = new DynamicAtlasStore();
    store.sync({ paletteVariantKey: "pal_a" });
    expect(store.getFrameForImage(imageA)).toBeNull();

    const generationBeforeRetry = store.generation;
    store.sync({ paletteVariantKey: "pal_a" });

    expect(store.getFrameForImage(imageA)).not.toBeNull();
    expect(store.generation).toBeGreaterThan(generationBeforeRetry);
    expect(store.getDebugCacheMetrics().notes).toContain("pending:0");
  });
});
