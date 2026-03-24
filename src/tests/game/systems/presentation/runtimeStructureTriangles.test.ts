import { describe, expect, it } from "vitest";
import { worldToScreen } from "../../../../engine/math/iso";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import {
  buildRuntimeStructureTriangleContextKey,
  buildRuntimeStructureTriangleGeometrySignature,
  buildRuntimeTrianglesFromMonolithicGeometry,
  deriveParentTileRenderFields,
  groupRuntimeStructureTrianglesBySliceParent,
  rectIntersects,
  resolveTriangleBaseReferencePoint,
  resolveRuntimeSliceBandDiagonal,
  resolveRuntimeStructureBandProgressionIndex,
  RuntimeStructureTriangleCacheStore,
  triangulateRuntimeSliceBandQuad,
  type MonolithicStructureGeometry,
  type RuntimeStructureTriangleCache,
} from "../../../../game/structures/monolithicStructureGeometry";

describe("monolithicStructureGeometry helpers", () => {
  const makeLocalTriangleAtTile = (tx: number, ty: number) => {
    const base = worldToScreen(
      (tx + 0.5) * KENNEY_TILE_WORLD,
      (ty + 0.5) * KENNEY_TILE_WORLD,
    );
    return {
      a: { x: base.x - 6, y: base.y - 18, side: "L" as const },
      b: { x: base.x + 6, y: base.y - 18, side: "R" as const },
      c: { x: base.x, y: base.y, side: "L" as const },
    };
  };

  const makeGeometry = (input: {
    n: number;
    m: number;
    sliceEntries: Array<{
      index: number;
      bandIndex: number;
      parentFootprintProgression: number;
      parentFootprintOffsetTx: number;
      parentFootprintOffsetTy: number;
      triangles: Array<ReturnType<typeof makeLocalTriangleAtTile>>;
    }>;
  }): MonolithicStructureGeometry => ({
    skinId: "test-skin",
    spriteId: "test-sprite",
    semanticKey: "test-semantic",
    flipX: false,
    source: "computed",
    heightUnits: 1,
    n: input.n,
    m: input.m,
    anchorSpriteLocal: { x: 0, y: 0 },
    bboxSpriteLocal: { x: 0, y: 0, w: 1, h: 1 },
    anchorResult: {
      anchorPx: { x: 0, y: 0 },
      occupiedBoundsPx: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      southProfile: [],
      plateauSegments: [],
    } as any,
    occupiedBoundsPx: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    workRectSpriteLocal: { x: 0, y: 0, w: 1, h: 1 },
    workAnchorLocal: { x: 0, y: 0 },
    slices: input.sliceEntries.map(() => ({ x: 0, width: 64, height: 128 })),
    sliceEntries: input.sliceEntries.map((entry) => ({
      index: entry.index,
      bandIndex: entry.bandIndex,
      parentFootprintProgression: entry.parentFootprintProgression,
      parentFootprintOffsetTx: entry.parentFootprintOffsetTx,
      parentFootprintOffsetTy: entry.parentFootprintOffsetTy,
      slice: { x: 0, width: 64, height: 128 },
      edgePoints: [],
      stripPoints: [],
      triangles: entry.triangles,
      culledTriangles: [],
    })),
    footprintCandidatesSpriteLocal: [],
    footprintLeftCount: input.n,
    footprintRightCount: input.m,
  });

  it("builds deterministic context and geometry signatures", () => {
    const contextA = buildRuntimeStructureTriangleContextKey({ mapId: "downtown" });
    const contextB = buildRuntimeStructureTriangleContextKey({ mapId: "downtown" });
    const contextC = buildRuntimeStructureTriangleContextKey({ mapId: "uptown" });

    expect(contextA).toBe("map:downtown");
    expect(contextB).toBe(contextA);
    expect(contextC).not.toBe(contextA);

    const signatureA = buildRuntimeStructureTriangleGeometrySignature({
      structureInstanceId: "struct_1",
      spriteId: "structures/buildings/test",
      seTx: 10,
      seTy: 10,
      footprintW: 3,
      footprintH: 2,
      flipX: false,
      scale: 1,
      baseDx: 100,
      baseDy: 120,
      spriteWidth: 320,
      spriteHeight: 384,
      sliceOffsetX: 0,
      sliceOffsetY: 0,
      baseZ: 0,
    });
    const signatureB = buildRuntimeStructureTriangleGeometrySignature({
      structureInstanceId: "struct_1",
      spriteId: "structures/buildings/test",
      seTx: 10,
      seTy: 10,
      footprintW: 3,
      footprintH: 2,
      flipX: false,
      scale: 1,
      baseDx: 100,
      baseDy: 120,
      spriteWidth: 320,
      spriteHeight: 384,
      sliceOffsetX: 0,
      sliceOffsetY: 0,
      baseZ: 0,
    });
    const signatureC = buildRuntimeStructureTriangleGeometrySignature({
      structureInstanceId: "struct_1",
      spriteId: "structures/buildings/test",
      seTx: 10,
      seTy: 10,
      footprintW: 3,
      footprintH: 2,
      flipX: false,
      scale: 1,
      baseDx: 101,
      baseDy: 120,
      spriteWidth: 320,
      spriteHeight: 384,
      sliceOffsetX: 0,
      sliceOffsetY: 0,
      baseZ: 0,
    });

    expect(signatureB).toBe(signatureA);
    expect(signatureC).not.toBe(signatureA);
  });

  it("invalidates cache on context change and geometry-signature mismatch", () => {
    const store = new RuntimeStructureTriangleCacheStore();

    expect(store.resetIfContextChanged("map:downtown")).toBe(true);
    expect(store.resetIfContextChanged("map:downtown")).toBe(false);

    const cache: RuntimeStructureTriangleCache = {
      structureInstanceId: "struct_1",
      spriteId: "structures/buildings/test",
      triangles: [],
      parentTileGroups: [],
      geometrySignature: "sig:a",
      monolithic: null,
    };
    store.set(cache);

    expect(store.get("struct_1", "sig:a")).toBeTruthy();
    expect(store.get("struct_1", "sig:b")).toBeUndefined();

    expect(store.resetIfContextChanged("map:uptown")).toBe(true);
    expect(store.get("struct_1", "sig:a")).toBeUndefined();
  });

  it("keeps diagonal selection and quad triangulation deterministic", () => {
    const quad = {
      lowerA: { x: 0, y: 10 },
      lowerB: { x: 10, y: 10 },
      upperA: { x: 0, y: 0 },
      upperB: { x: 10, y: 0 },
    };

    expect(resolveRuntimeSliceBandDiagonal(0, 0)).toBe("A_to_Bprime");
    expect(resolveRuntimeSliceBandDiagonal(1, 0)).toBe("B_to_Aprime");

    const triA = triangulateRuntimeSliceBandQuad(quad, 0, 0);
    const triB = triangulateRuntimeSliceBandQuad(quad, 1, 0);

    expect(triA.diagonal).toBe("A_to_Bprime");
    expect(triA.tri0).toEqual([quad.lowerB, quad.lowerA, quad.upperB]);
    expect(triA.tri1).toEqual([quad.lowerA, quad.upperB, quad.upperA]);

    expect(triB.diagonal).toBe("B_to_Aprime");
    expect(triB.tri0).toEqual([quad.lowerA, quad.lowerB, quad.upperA]);
    expect(triB.tri1).toEqual([quad.lowerB, quad.upperA, quad.upperB]);
  });

  it("retains parent-tile helpers used by structure drawables/admission", () => {
    expect(resolveRuntimeStructureBandProgressionIndex(0, 3, 2)).toBe(-1);
    expect(resolveRuntimeStructureBandProgressionIndex(6, 3, 2)).toBe(5);
    expect(resolveRuntimeStructureBandProgressionIndex(3, 3, 2)).toBe(2);

    expect(deriveParentTileRenderFields(18, 7)).toEqual({ slice: 25, within: 18 });

    expect(rectIntersects(
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 9, y: 9, w: 10, h: 10 },
    )).toBe(true);
    expect(rectIntersects(
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 10, y: 10, w: 10, h: 10 },
    )).toBe(false);
  });

  it("derives deterministic triangle base reference points from bottom geometry", () => {
    const singularBottom = resolveTriangleBaseReferencePoint(
      { x: 10, y: 5 },
      { x: 20, y: 5 },
      { x: 16, y: 30 },
    );
    expect(singularBottom).toEqual({ x: 16, y: 30 });

    const flatBottomEdge = resolveTriangleBaseReferencePoint(
      { x: 10, y: 30 },
      { x: 20, y: 30 },
      { x: 16, y: 5 },
    );
    expect(flatBottomEdge).toEqual({ x: 15, y: 30 });
  });

  it("inherits one parent tile per slice while preserving each triangle's actual tile", () => {
    const geometry = makeGeometry({
      n: 1,
      m: 4,
      sliceEntries: [
        {
          index: 0,
          bandIndex: 5,
          parentFootprintProgression: 4,
          parentFootprintOffsetTx: 0,
          parentFootprintOffsetTy: 0,
          triangles: [
            makeLocalTriangleAtTile(15, 8),
            makeLocalTriangleAtTile(15, 10),
          ],
        },
      ],
    });

    const triangles = buildRuntimeTrianglesFromMonolithicGeometry(
      {
        id: "slice-owner",
        seTx: 15,
        seTy: 10,
        z: 0,
        spriteId: "test-sprite",
        layerRole: "STRUCTURE",
      } as any,
      { dx: 0, dy: 0, dw: 256, dh: 256, flipX: false, scale: 1 },
      geometry,
    );

    expect(triangles.map((tri) => [tri.parentTx, tri.parentTy])).toEqual([[15, 7], [15, 7]]);
    expect(triangles.map((tri) => [tri.ownerTx, tri.ownerTy])).toEqual([[15, 7], [15, 7]]);
    expect(triangles.map((tri) => [tri.triangleTx, tri.triangleTy])).toEqual([[15, 8], [15, 10]]);
    expect(triangles.map((tri) => [tri.cameraTx, tri.cameraTy])).toEqual([[15, 8], [15, 10]]);
    expect(triangles.map((tri) => [tri.admissionTx, tri.admissionTy])).toEqual([[15, 8], [15, 10]]);

    const groups = groupRuntimeStructureTrianglesBySliceParent("slice-owner", triangles);
    expect(groups).toHaveLength(1);
    expect(groups[0].parentTx).toBe(15);
    expect(groups[0].parentTy).toBe(7);
    expect(groups[0].bandIndex).toBe(5);
    expect(groups[0].sliceIndex).toBe(0);
    expect(groups[0].triangles).toHaveLength(2);
    expect(groups[0].feetSortY).toBeCloseTo(
      worldToScreen((15.5) * KENNEY_TILE_WORLD, (7.5) * KENNEY_TILE_WORLD).y,
      6,
    );
  });

  it("keeps overflow-clamped endpoint slices distinct even when they share a parent tile", () => {
    const geometry = makeGeometry({
      n: 4,
      m: 4,
      sliceEntries: [
        {
          index: 0,
          bandIndex: 0,
          parentFootprintProgression: 0,
          parentFootprintOffsetTx: 0,
          parentFootprintOffsetTy: 3,
          triangles: [makeLocalTriangleAtTile(10, 13)],
        },
        {
          index: 1,
          bandIndex: 1,
          parentFootprintProgression: 0,
          parentFootprintOffsetTx: 0,
          parentFootprintOffsetTy: 3,
          triangles: [makeLocalTriangleAtTile(10, 13)],
        },
      ],
    });

    const triangles = buildRuntimeTrianglesFromMonolithicGeometry(
      {
        id: "slice-overflow",
        seTx: 13,
        seTy: 13,
        z: 0,
        spriteId: "test-sprite",
        layerRole: "STRUCTURE",
      } as any,
      { dx: 0, dy: 0, dw: 256, dh: 256, flipX: false, scale: 1 },
      geometry,
    );
    const groups = groupRuntimeStructureTrianglesBySliceParent("slice-overflow", triangles);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => [group.parentTx, group.parentTy])).toEqual([[10, 13], [10, 13]]);
    expect(groups.map((group) => group.bandIndex)).toEqual([0, 1]);
    expect(new Set(groups.map((group) => group.stableId)).size).toBe(2);
  });
});
