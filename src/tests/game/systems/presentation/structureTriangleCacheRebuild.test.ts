import { afterEach, describe, expect, it, vi } from "vitest";
import * as kenneyMap from "../../../../game/map/compile/kenneyMap";
import * as renderSprites from "../../../../engine/render/sprites/renderSprites";
import { RuntimeStructureTriangleCacheStore } from "../../../../game/systems/presentation/runtimeStructureTriangles";
import {
  classifyRuntimeStructureTriangleAsset,
  collectMapWideStructureOverlays,
  mapWideOverlayViewRect,
  rebuildRuntimeStructureTriangleCacheForMap,
  runtimeStructureTriangleGeometrySignatureForOverlay,
} from "../../../../game/systems/presentation/structureTriangles/structureTriangleCacheRebuild";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("structureTriangleCacheRebuild", () => {
  it("classifies asset readiness states", () => {
    expect(classifyRuntimeStructureTriangleAsset(null)).toBe("FAILED");

    expect(classifyRuntimeStructureTriangleAsset({
      ready: false,
      failed: false,
      unsupported: false,
    } as any)).toBe("PENDING");

    expect(classifyRuntimeStructureTriangleAsset({
      ready: true,
      failed: false,
      unsupported: false,
      img: { naturalWidth: 0, naturalHeight: 0 },
    } as any)).toBe("FAILED");

    expect(classifyRuntimeStructureTriangleAsset({
      ready: true,
      failed: false,
      unsupported: false,
      img: { naturalWidth: 64, naturalHeight: 64 },
    } as any)).toBe("READY");
  });

  it("filters map-wide overlays to STRUCTURE layer", () => {
    const compiledMap = {
      originTx: 5,
      originTy: 9,
      width: 4,
      height: 3,
    } as ReturnType<typeof kenneyMap.getActiveMap>;

    const overlaysInViewSpy = vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([
      { id: "s1", layerRole: "STRUCTURE" },
      { id: "f1", layerRole: "FLOOR" },
      { id: "s2", layerRole: "STRUCTURE" },
    ] as any);

    expect(mapWideOverlayViewRect(compiledMap)).toEqual({
      minTx: 5,
      maxTx: 8,
      minTy: 9,
      maxTy: 11,
    });

    const overlays = collectMapWideStructureOverlays(compiledMap);
    expect(overlays.map((o) => o.id)).toEqual(["s1", "s2"]);
    expect(overlaysInViewSpy).toHaveBeenCalledWith({
      minTx: 5,
      maxTx: 8,
      minTy: 9,
      maxTy: 11,
    });
  });

  it("produces deterministic geometry signatures", () => {
    const overlay = {
      id: "structure_1",
      spriteId: "structures/test",
      seTx: 10,
      seTy: 12,
      w: 3,
      h: 2,
      z: 1,
      sliceOffsetPx: { x: 0, y: 0 },
      sliceOriginPx: { x: 16 },
    } as any;

    const draw = {
      dx: 100,
      dy: 220,
      dw: 320,
      dh: 384,
      flipX: false,
      scale: 1,
    };

    const sigA = runtimeStructureTriangleGeometrySignatureForOverlay(overlay, draw);
    const sigB = runtimeStructureTriangleGeometrySignatureForOverlay(overlay, draw);
    const sigC = runtimeStructureTriangleGeometrySignatureForOverlay(overlay, { ...draw, dx: 101 });

    expect(sigB).toBe(sigA);
    expect(sigC).not.toBe(sigA);
  });

  it("marks fallback when structure assets fail during cache rebuild", () => {
    const compiledMap = {
      originTx: 0,
      originTy: 0,
      width: 2,
      height: 2,
    } as ReturnType<typeof kenneyMap.getActiveMap>;
    const structureOverlay = {
      id: "structure_fail",
      layerRole: "STRUCTURE",
      spriteId: "structures/missing",
      seTx: 0,
      seTy: 0,
      w: 1,
      h: 1,
      z: 0,
    } as any;

    vi.spyOn(kenneyMap, "overlaysInView").mockReturnValue([structureOverlay]);
    vi.spyOn(renderSprites, "getTileSpriteById").mockReturnValue(null as any);

    const cacheStore = new RuntimeStructureTriangleCacheStore();
    const result = rebuildRuntimeStructureTriangleCacheForMap(compiledMap, {
      cacheStore,
      getFlippedOverlayImage: vi.fn() as any,
    });

    expect(result).toEqual({
      pendingCount: 0,
      failedCount: 1,
      builtCount: 0,
      fallbackCount: 1,
      pendingKeys: [],
    });
    expect(cacheStore.isFallback("structure_fail")).toBe(true);
  });
});
