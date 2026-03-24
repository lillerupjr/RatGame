import { describe, expect, it } from "vitest";
import {
  buildRuntimeStructureTriangleContextKey,
  buildRuntimeStructureTriangleGeometrySignature,
  deriveParentTileRenderFields,
  rectIntersects,
  resolveTriangleBaseReferencePoint,
  resolveRuntimeSliceBandDiagonal,
  resolveRuntimeStructureBandProgressionIndex,
  RuntimeStructureTriangleCacheStore,
  triangulateRuntimeSliceBandQuad,
  type RuntimeStructureTriangleCache,
} from "../../../../game/structures/monolithicStructureGeometry";

describe("monolithicStructureGeometry helpers", () => {
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
});
