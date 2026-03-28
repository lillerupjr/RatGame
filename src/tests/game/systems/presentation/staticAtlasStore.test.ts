import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as kenneyMap from "../../../../game/map/compile/kenneyMap";
import * as renderSprites from "../../../../engine/render/sprites/renderSprites";
import * as presentationImageTransforms from "../../../../game/systems/presentation/presentationImageTransforms";
import * as roadMarkingRender from "../../../../game/roads/roadMarkingRender";
import { StaticAtlasStore } from "../../../../game/systems/presentation/staticAtlasStore";
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

describe("StaticAtlasStore", () => {
  it("builds one shared atlas for structures, props, and projected decals", () => {
    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([
      { id: "s1", layerRole: "STRUCTURE", spriteId: "structures/a" },
      { id: "p1", kind: "PROP", spriteId: "props/lights/street_lamp_e" },
      { id: "p2", kind: "PROP", spriteId: "light/lamp_post" },
    ] as any);
    vi.spyOn(kenneyMap, "facePieceLayers").mockReturnValue([0]);
    vi.spyOn(kenneyMap, "facePiecesInViewForLayer").mockReturnValue([
      { id: "f1", spriteId: "structures/floor_apron_a" },
    ] as any);
    vi.spyOn(kenneyMap, "occluderLayers").mockReturnValue([0]);
    vi.spyOn(kenneyMap, "occludersInViewForLayer").mockReturnValue([
      { id: "w1", spriteId: "structures/wall_a" },
    ] as any);
    vi.spyOn(renderSprites, "getTileSpriteById").mockImplementation((spriteId: string) => {
      if (spriteId === "structures/a") return { ready: true, img: makeImage("a", 64, 48) } as any;
      if (spriteId === "props/lights/street_lamp_e") return { ready: true, img: makeImage("lamp", 32, 64) } as any;
      if (spriteId === "light/lamp_post") return { ready: true, img: makeImage("lamp-post", 24, 72) } as any;
      if (spriteId === "structures/floor_apron_a") return { ready: true, img: makeImage("apron", 64, 32) } as any;
      if (spriteId === "structures/wall_a") return { ready: true, img: makeImage("wall", 32, 96) } as any;
      return null as any;
    });
    vi.spyOn(renderSprites, "getRuntimeDecalSprite").mockReturnValue({
      ready: true,
      img: makeImage("decal-src", 32, 16),
    } as any);
    vi.spyOn(roadMarkingRender, "roadMarkingDecalScale").mockReturnValue(1);
    vi.spyOn(presentationImageTransforms, "getRuntimeIsoDecalCanvas").mockReturnValue(makeCanvas("iso", 48, 24));
    vi.spyOn(presentationImageTransforms, "getDiamondFitCanvas").mockReturnValue(makeCanvas("diamond", 128, 64));

    const store = new StaticAtlasStore();
    store.sync({
      compiledMap: {
        id: "map_a",
        originTx: 0,
        originTy: 0,
        width: 8,
        height: 8,
        decals: [
          {
            id: "d0",
            tx: 1,
            ty: 2,
            zBase: 0,
            zLogical: 0,
            setId: "road_markings",
            spriteId: "runtime/decal",
            variantIndex: 0,
            semanticType: "road",
            renderAnchorY: 0.55,
            rotationQuarterTurns: 0,
          },
        ],
      } as any,
      paletteVariantKey: "db32@@sw:0@@dk:0",
    });

    const structureFrame = store.getSpriteFrame("structures/a");
    const propFrame = store.getSpriteFrame("props/lights/street_lamp_e");
    const lightPropFrame = store.getSpriteFrame("light/lamp_post");
    const faceFrame = store.getSpriteFrame("structures/floor_apron_a");
    const wallFrame = store.getSpriteFrame("structures/wall_a");
    const decalFrame = store.getProjectedDecalFrame({
      setId: "road_markings",
      variantIndex: 0,
      rotationQuarterTurns: 0,
      scale: 1,
    });

    expect(structureFrame).not.toBeNull();
    expect(propFrame).not.toBeNull();
    expect(lightPropFrame).not.toBeNull();
    expect(faceFrame).not.toBeNull();
    expect(wallFrame).not.toBeNull();
    expect(decalFrame).not.toBeNull();
    expect(structureFrame?.image).toBe(propFrame?.image);
    expect(structureFrame?.image).toBe(lightPropFrame?.image);
    expect(structureFrame?.image).toBe(faceFrame?.image);
    expect(structureFrame?.image).toBe(wallFrame?.image);
    expect(structureFrame?.image).toBe(decalFrame?.image);
    expect(isStableTextureSource(structureFrame?.image)).toBe(true);
    expect(store.getDebugCacheMetrics()).toMatchObject({
      entryCount: 6,
      contextKey: "map:map_a||palv:db32@@sw:0@@dk:0||sprites:1||decals:1",
      generation: 1,
    });
  });

  it("keeps atlas identity stable across same-context syncs and replaces it on context change", () => {
    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([
      { id: "s1", layerRole: "STRUCTURE", spriteId: "structures/a" },
    ] as any);
    vi.spyOn(kenneyMap, "facePieceLayers").mockReturnValue([]);
    vi.spyOn(kenneyMap, "facePiecesInViewForLayer").mockReturnValue([] as any);
    vi.spyOn(kenneyMap, "occluderLayers").mockReturnValue([]);
    vi.spyOn(kenneyMap, "occludersInViewForLayer").mockReturnValue([] as any);
    vi.spyOn(renderSprites, "getTileSpriteById").mockReturnValue({
      ready: true,
      img: makeImage("a", 64, 48),
    } as any);
    vi.spyOn(renderSprites, "getRuntimeDecalSprite").mockReturnValue(null as any);

    const store = new StaticAtlasStore();
    store.sync({
      compiledMap: { id: "map_a", originTx: 0, originTy: 0, width: 8, height: 8, decals: [] } as any,
      paletteVariantKey: "pal_a",
    });
    const first = store.getSpriteFrame("structures/a");

    store.sync({
      compiledMap: { id: "map_a", originTx: 0, originTy: 0, width: 8, height: 8, decals: [] } as any,
      paletteVariantKey: "pal_a",
    });
    const second = store.getSpriteFrame("structures/a");

    store.sync({
      compiledMap: { id: "map_b", originTx: 0, originTy: 0, width: 8, height: 8, decals: [] } as any,
      paletteVariantKey: "pal_a",
    });
    const third = store.getSpriteFrame("structures/a");

    expect(second?.image).toBe(first?.image);
    expect(third?.image).not.toBe(first?.image);
  });

  it("rebuilds when pending static decal sources become ready", () => {
    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([] as any);
    vi.spyOn(kenneyMap, "facePieceLayers").mockReturnValue([]);
    vi.spyOn(kenneyMap, "facePiecesInViewForLayer").mockReturnValue([] as any);
    vi.spyOn(kenneyMap, "occluderLayers").mockReturnValue([]);
    vi.spyOn(kenneyMap, "occludersInViewForLayer").mockReturnValue([] as any);
    const getRuntimeDecalSprite = vi.spyOn(renderSprites, "getRuntimeDecalSprite");
    getRuntimeDecalSprite.mockReturnValue({ ready: false, failed: false, unsupported: false } as any);
    vi.spyOn(roadMarkingRender, "roadMarkingDecalScale").mockReturnValue(1);
    vi.spyOn(presentationImageTransforms, "getRuntimeIsoDecalCanvas").mockReturnValue(makeCanvas("iso", 48, 24));
    vi.spyOn(presentationImageTransforms, "getDiamondFitCanvas").mockReturnValue(makeCanvas("diamond", 128, 64));

    const store = new StaticAtlasStore();
    const compiledMap = {
      id: "map_a",
      originTx: 0,
      originTy: 0,
      width: 8,
      height: 8,
      decals: [{
        id: "d0",
        tx: 1,
        ty: 2,
        zBase: 0,
        zLogical: 0,
        setId: "road_markings",
        spriteId: "runtime/decal",
        variantIndex: 0,
        semanticType: "road",
        renderAnchorY: 0.55,
        rotationQuarterTurns: 0,
      }],
    } as any;
    store.sync({
      compiledMap,
      paletteVariantKey: "pal_a",
    });

    expect(store.getProjectedDecalFrame({
      setId: "road_markings",
      variantIndex: 0,
      rotationQuarterTurns: 0,
      scale: 1,
    })).toBeNull();
    expect(store.getDebugCacheMetrics().notes).toContain("pending:1");

    const generationBeforeRetry = store.generation;
    getRuntimeDecalSprite.mockReturnValue({
      ready: true,
      img: makeImage("decal-src", 32, 16),
    } as any);

    store.sync({
      compiledMap,
      paletteVariantKey: "pal_a",
    });

    expect(store.getProjectedDecalFrame({
      setId: "road_markings",
      variantIndex: 0,
      rotationQuarterTurns: 0,
      scale: 1,
    })).not.toBeNull();
    expect(store.generation).toBeGreaterThan(generationBeforeRetry);
    expect(store.getDebugCacheMetrics().notes).toContain("pending:0");
  });
});
