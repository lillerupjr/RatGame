import { describe, expect, it } from "vitest";
import type { RuntimeStructureTriangleCache, RuntimeStructureTrianglePiece } from "../../../../game/structures/monolithicStructureGeometry";
import {
  buildHybridTriangleSemanticMap,
  resolveHybridSemanticMaskBuckets,
} from "../../../../game/systems/presentation/structureShadowHybridTriangles";

function triangle(
  stableId: number,
  bandIndex: number,
  parentTx: number,
  parentTy: number,
  points: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
): RuntimeStructureTrianglePiece {
  const basePoint = [...points].sort((lhs, rhs) => rhs.y - lhs.y || rhs.x - lhs.x)[0];
  return {
    structureInstanceId: "v5-semantic",
    stableId,
    sliceIndex: bandIndex,
    bandIndex,
    points,
    srcPoints: points,
    basePoint,
    feetSortY: basePoint.y,
    ownerTx: parentTx,
    ownerTy: parentTy,
    admissionTx: parentTx,
    admissionTy: parentTy,
    parentTx,
    parentTy,
    triangleTx: 0,
    triangleTy: 0,
    cameraTx: 0,
    cameraTy: 0,
    localBounds: { x: 0, y: 0, w: 1, h: 1 },
    srcRectLocal: { x: 0, y: 0, w: 1, h: 1 },
    dstRectLocal: { x: 0, y: 0, w: 1, h: 1 },
  };
}

function cacheWithTriangles(triangles: RuntimeStructureTrianglePiece[]): RuntimeStructureTriangleCache {
  return {
    structureInstanceId: "v5-semantic",
    spriteId: "sprite",
    triangles,
    parentTileGroups: [],
    geometrySignature: "sig",
  };
}

describe("structureShadowV5 semantic adapter", () => {
  it("reuses hybrid semantic assignment for TOP/LEFT_SOUTH/RIGHT_EAST/CONFLICT", () => {
    const topTri = triangle(1, 1, 0, 0, [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 10, y: 20 }]);
    const leftSouthTri = triangle(2, 1, 1, 1, [{ x: 80, y: 80 }, { x: 90, y: 80 }, { x: 80, y: 90 }]);
    const rightEastTri = triangle(3, 3, 2, 2, [{ x: 120, y: 120 }, { x: 130, y: 120 }, { x: 120, y: 130 }]);
    const conflictLeftTri = triangle(4, 1, 3, 3, [{ x: 160, y: 160 }, { x: 170, y: 160 }, { x: 160, y: 170 }]);
    const conflictRightTri = triangle(5, 3, 3, 3, [{ x: 190, y: 160 }, { x: 200, y: 160 }, { x: 190, y: 170 }]);
    const triCache = cacheWithTriangles([topTri, leftSouthTri, rightEastTri, conflictLeftTri, conflictRightTri]);

    const semantics = buildHybridTriangleSemanticMap({
      overlay: { w: 2, h: 2 } as any,
      triangleCache: triCache,
      activeRoofQuad: [
        { x: 0, y: 0 },
        { x: 64, y: 0 },
        { x: 64, y: 64 },
        { x: 0, y: 64 },
      ],
    });

    expect(semantics.get(topTri.stableId)).toBe("TOP");
    expect(semantics.get(leftSouthTri.stableId)).toBe("LEFT_SOUTH");
    expect(semantics.get(rightEastTri.stableId)).toBe("RIGHT_EAST");
    expect(semantics.get(conflictLeftTri.stableId)).toBe("CONFLICT");
    expect(semantics.get(conflictRightTri.stableId)).toBe("CONFLICT");
  });

  it("maps hybrid semantics to V5 mask buckets with side fallback preserved", () => {
    expect(resolveHybridSemanticMaskBuckets("TOP")).toEqual(["TOP"]);
    expect(resolveHybridSemanticMaskBuckets("RIGHT_EAST")).toEqual(["EAST_WEST"]);
    expect(resolveHybridSemanticMaskBuckets("LEFT_SOUTH")).toEqual(["SOUTH_NORTH"]);
    expect(resolveHybridSemanticMaskBuckets("CONFLICT")).toEqual(["EAST_WEST", "SOUTH_NORTH"]);
    expect(resolveHybridSemanticMaskBuckets("UNCLASSIFIED")).toEqual(["EAST_WEST", "SOUTH_NORTH"]);
  });

  it("surfaces UNCLASSIFIED when owner progression context is missing", () => {
    const contextTri = triangle(10, 1, 0, 0, [{ x: 80, y: 80 }, { x: 90, y: 80 }, { x: 80, y: 90 }]);
    const triCache = cacheWithTriangles([contextTri]);
    const missingOwnerTri = triangle(11, 1, 9, 9, [{ x: 180, y: 180 }, { x: 190, y: 180 }, { x: 180, y: 190 }]);

    const semantics = buildHybridTriangleSemanticMap({
      overlay: { w: 2, h: 2 } as any,
      triangleCache: triCache,
      activeRoofQuad: null,
      triangles: [missingOwnerTri],
    });

    expect(semantics.get(missingOwnerTri.stableId)).toBe("UNCLASSIFIED");
  });
});
