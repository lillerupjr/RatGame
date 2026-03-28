import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as kenneyMap from "../../../../game/map/compile/kenneyMap";
import * as renderSprites from "../../../../engine/render/sprites/renderSprites";
import { StructureSpriteAtlasStore } from "../../../../game/systems/presentation/structureSpriteAtlas";
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

beforeEach(() => {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error(`Unexpected element request: ${tag}`);
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          imageSmoothingEnabled: false,
          drawImage: vi.fn(),
        }),
      };
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as any).document;
});

describe("StructureSpriteAtlasStore", () => {
  it("builds a shared atlas for ready structure sprites in one context", () => {
    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([
      { id: "s1", layerRole: "STRUCTURE", spriteId: "structures/a" },
      { id: "s2", layerRole: "STRUCTURE", spriteId: "structures/b" },
      { id: "floor", layerRole: "FLOOR", spriteId: "tiles/floor/1" },
    ] as any);
    vi.spyOn(renderSprites, "getTileSpriteById").mockImplementation((spriteId: string) => {
      if (spriteId === "structures/a") return { ready: true, img: makeImage("a", 64, 48) } as any;
      if (spriteId === "structures/b") return { ready: true, img: makeImage("b", 96, 80) } as any;
      return null as any;
    });

    const store = new StructureSpriteAtlasStore();
    store.sync({
      compiledMap: { id: "map_a", originTx: 0, originTy: 0, width: 8, height: 8 } as any,
      paletteVariantKey: "db32@@sw:0@@dk:0",
    });

    const a = store.getAtlasFrame("structures/a");
    const b = store.getAtlasFrame("structures/b");

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.image).toBe(b?.image);
    expect(isStableTextureSource(a?.image)).toBe(true);
    expect(`${a?.sx},${a?.sy}`).not.toBe(`${b?.sx},${b?.sy}`);
    expect(store.getDebugCacheMetrics()).toMatchObject({
      entryCount: 2,
      contextKey: "map:map_a||palv:db32@@sw:0@@dk:0",
      generation: 1,
    });
  });

  it("keeps a 64px safe border between neighboring atlas buildings", () => {
    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([
      { id: "s1", layerRole: "STRUCTURE", spriteId: "structures/a" },
      { id: "s2", layerRole: "STRUCTURE", spriteId: "structures/b" },
    ] as any);
    vi.spyOn(renderSprites, "getTileSpriteById").mockImplementation((spriteId: string) => {
      if (spriteId === "structures/a") return { ready: true, img: makeImage("a", 64, 48) } as any;
      if (spriteId === "structures/b") return { ready: true, img: makeImage("b", 96, 80) } as any;
      return null as any;
    });

    const store = new StructureSpriteAtlasStore();
    store.sync({
      compiledMap: { id: "map_a", originTx: 0, originTy: 0, width: 8, height: 8 } as any,
      paletteVariantKey: "pal_a",
    });

    const a = store.getAtlasFrame("structures/a");
    const b = store.getAtlasFrame("structures/b");

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect((b?.sx ?? 0) - ((a?.sx ?? 0) + (a?.sw ?? 0))).toBeGreaterThanOrEqual(128);
  });

  it("rebuilds atlas identity on context change", () => {
    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([
      { id: "s1", layerRole: "STRUCTURE", spriteId: "structures/a" },
    ] as any);
    vi.spyOn(renderSprites, "getTileSpriteById").mockReturnValue({
      ready: true,
      img: makeImage("a", 64, 48),
    } as any);

    const store = new StructureSpriteAtlasStore();
    store.sync({
      compiledMap: { id: "map_a", originTx: 0, originTy: 0, width: 8, height: 8 } as any,
      paletteVariantKey: "pal_a",
    });
    const first = store.getAtlasFrame("structures/a");
    const firstGeneration = store.generation;

    store.sync({
      compiledMap: { id: "map_b", originTx: 0, originTy: 0, width: 8, height: 8 } as any,
      paletteVariantKey: "pal_a",
    });
    const second = store.getAtlasFrame("structures/a");

    expect(second).not.toBeNull();
    expect(second?.image).not.toBe(first?.image);
    expect(store.generation).toBeGreaterThan(firstGeneration);
  });

  it("keeps pending and failed sprites on fallback and retries when pending becomes ready", () => {
    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([
      { id: "s1", layerRole: "STRUCTURE", spriteId: "structures/a" },
      { id: "s2", layerRole: "STRUCTURE", spriteId: "structures/b" },
      { id: "s3", layerRole: "STRUCTURE", spriteId: "structures/c" },
    ] as any);
    const getTileSpriteById = vi.spyOn(renderSprites, "getTileSpriteById");
    getTileSpriteById.mockImplementation((spriteId: string) => {
      if (spriteId === "structures/a") return { ready: true, img: makeImage("a", 64, 48) } as any;
      if (spriteId === "structures/b") return { ready: false, failed: false, unsupported: false } as any;
      if (spriteId === "structures/c") return { ready: false, failed: true, unsupported: false } as any;
      return null as any;
    });

    const store = new StructureSpriteAtlasStore();
    store.sync({
      compiledMap: { id: "map_a", originTx: 0, originTy: 0, width: 8, height: 8 } as any,
      paletteVariantKey: "pal_a",
    });

    expect(store.getAtlasFrame("structures/a")).not.toBeNull();
    expect(store.getAtlasFrame("structures/b")).toBeNull();
    expect(store.getAtlasFrame("structures/c")).toBeNull();
    expect(store.getDebugCacheMetrics().notes).toContain("pending:1 fallback:1");

    const generationBeforeRetry = store.generation;
    getTileSpriteById.mockImplementation((spriteId: string) => {
      if (spriteId === "structures/a") return { ready: true, img: makeImage("a", 64, 48) } as any;
      if (spriteId === "structures/b") return { ready: true, img: makeImage("b", 80, 56) } as any;
      if (spriteId === "structures/c") return { ready: false, failed: true, unsupported: false } as any;
      return null as any;
    });

    store.sync({
      compiledMap: { id: "map_a", originTx: 0, originTy: 0, width: 8, height: 8 } as any,
      paletteVariantKey: "pal_a",
    });

    expect(store.getAtlasFrame("structures/b")).not.toBeNull();
    expect(store.generation).toBeGreaterThan(generationBeforeRetry);
    expect(store.getDebugCacheMetrics().notes).toContain("pending:0 fallback:1");
  });
});
