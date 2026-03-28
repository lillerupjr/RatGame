import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as kenneyMap from "../../../../game/map/compile/kenneyMap";
import * as renderSprites from "../../../../engine/render/sprites/renderSprites";
import * as dynamicAtlasSources from "../../../../game/systems/presentation/dynamicAtlasSources";
import { SharedWorldAtlasStore } from "../../../../game/systems/presentation/sharedWorldAtlasStore";
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
      return makeCanvas("shared-atlas-page", 0, 0);
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as any).document;
});

describe("SharedWorldAtlasStore", () => {
  it("packs structure sprites and dynamic images into one shared page set", () => {
    const structureImage = makeImage("structure", 64, 48);
    const propImage = makeImage("prop", 32, 64);
    const dropImage = makeImage("drop", 16, 16);
    const enemyImage = makeImage("enemy", 32, 32);

    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([
      { id: "s1", layerRole: "STRUCTURE", spriteId: "structures/a" },
      { id: "p1", kind: "PROP", spriteId: "props/lights/street_lamp_e" },
    ] as any);
    vi.spyOn(renderSprites, "getTileSpriteById").mockImplementation((spriteId: string) => {
      if (spriteId === "structures/a") return { ready: true, img: structureImage } as any;
      if (spriteId === "props/lights/street_lamp_e") return { ready: true, img: propImage } as any;
      return null as any;
    });
    vi.spyOn(dynamicAtlasSources, "collectDynamicAtlasSources").mockReturnValue({
      readySources: [
        { sourceKey: "directFrame:currency/coin_1", image: dropImage, kind: "directFrame" },
        { sourceKey: "spritePackFrame:enemy/chaser/south_0", image: enemyImage, kind: "spritePackFrame" },
      ],
      pendingSourceKeys: new Set(),
      fallbackSourceKeys: new Set(),
    });

    const store = new SharedWorldAtlasStore();
    store.sync({
      compiledMap: { id: "map_a" } as any,
      paletteVariantKey: "pal_a",
    });

    const structureFrame = store.getSpriteFrame("structures/a");
    const propFrame = store.getSpriteFrame("props/lights/street_lamp_e");
    const dropFrame = store.getFrameForImage(dropImage);
    const enemyFrame = store.getFrameForImage(enemyImage);

    expect(structureFrame).not.toBeNull();
    expect(propFrame).not.toBeNull();
    expect(dropFrame).not.toBeNull();
    expect(enemyFrame).not.toBeNull();
    expect(structureFrame?.image).toBe(propFrame?.image);
    expect(structureFrame?.image).toBe(dropFrame?.image);
    expect(structureFrame?.image).toBe(enemyFrame?.image);
    expect(isStableTextureSource(structureFrame?.image)).toBe(true);
    expect(store.getDebugCacheMetrics()).toMatchObject({
      entryCount: 4,
      contextKey: "map:map_a||palv:pal_a",
      generation: 1,
    });
  });

  it("keeps atlas identity stable across same-source syncs and replaces it when sources change", () => {
    const structureImage = makeImage("structure-a", 64, 48);
    const dynamicImageA = makeImage("dynamic-a", 32, 32);
    const dynamicImageB = makeImage("dynamic-b", 32, 32);

    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([
      { id: "s1", layerRole: "STRUCTURE", spriteId: "structures/a" },
    ] as any);
    vi.spyOn(renderSprites, "getTileSpriteById").mockReturnValue({
      ready: true,
      img: structureImage,
    } as any);
    const collectSpy = vi.spyOn(dynamicAtlasSources, "collectDynamicAtlasSources");
    collectSpy
      .mockReturnValueOnce({
        readySources: [{ sourceKey: "directFrame:drop", image: dynamicImageA, kind: "directFrame" }],
        pendingSourceKeys: new Set(),
        fallbackSourceKeys: new Set(),
      })
      .mockReturnValueOnce({
        readySources: [{ sourceKey: "directFrame:drop", image: dynamicImageA, kind: "directFrame" }],
        pendingSourceKeys: new Set(),
        fallbackSourceKeys: new Set(),
      })
      .mockReturnValueOnce({
        readySources: [{ sourceKey: "directFrame:drop", image: dynamicImageB, kind: "directFrame" }],
        pendingSourceKeys: new Set(),
        fallbackSourceKeys: new Set(),
      })
      .mockReturnValueOnce({
        readySources: [{ sourceKey: "directFrame:drop", image: dynamicImageB, kind: "directFrame" }],
        pendingSourceKeys: new Set(),
        fallbackSourceKeys: new Set(),
      });

    const store = new SharedWorldAtlasStore();
    store.sync({ compiledMap: { id: "map_a" } as any, paletteVariantKey: "pal_a" });
    const first = store.getFrameForImage(dynamicImageA);

    store.sync({ compiledMap: { id: "map_a" } as any, paletteVariantKey: "pal_a" });
    const second = store.getFrameForImage(dynamicImageA);

    store.sync({ compiledMap: { id: "map_a" } as any, paletteVariantKey: "pal_a" });
    const third = store.getFrameForImage(dynamicImageB);

    store.sync({ compiledMap: { id: "map_b" } as any, paletteVariantKey: "pal_a" });
    const fourth = store.getFrameForImage(dynamicImageB);

    expect(first?.image).toBe(second?.image);
    expect(third?.image).not.toBe(first?.image);
    expect(fourth?.image).not.toBe(third?.image);
  });
});
