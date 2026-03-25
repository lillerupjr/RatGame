import { describe, expect, it } from "vitest";
import type { RuntimeStructureTrianglePiece } from "../../../../game/structures/monolithicStructureGeometry";
import { buildStructureV6SemanticTriangles } from "../../../../game/systems/presentation/structureShadows/structureShadowV6Semantics";

function makeTriangle(stableId: number, bandIndex: number): RuntimeStructureTrianglePiece {
  const a = { x: stableId * 10, y: 0 };
  const b = { x: stableId * 10 + 4, y: 0 };
  const c = { x: stableId * 10 + 2, y: 6 };
  return {
    structureInstanceId: "structure",
    stableId,
    sliceIndex: stableId,
    bandIndex,
    points: [a, b, c],
    srcPoints: [a, b, c],
    basePoint: { x: stableId * 10 + 2, y: 6 },
    feetSortY: 6,
    ownerTx: 0,
    ownerTy: 0,
    admissionTx: 0,
    admissionTy: 0,
    parentTx: 0,
    parentTy: 0,
    triangleTx: 0,
    triangleTy: 0,
    cameraTx: 0,
    cameraTy: 0,
    semanticSide: "UNCLASSIFIED",
    semanticFace: "UP",
    semanticRole: "STRUCTURAL",
    height: 0,
    heightFromParentLevel: 0,
    heightFromParentPx: 0,
    localBounds: { x: stableId * 10, y: 0, w: 4, h: 6 },
    srcRectLocal: { x: stableId * 10, y: 0, w: 4, h: 6 },
    dstRectLocal: { x: stableId * 10, y: 0, w: 4, h: 6 },
  };
}

describe("structureShadowV6Semantics", () => {
  it("uses the roof-aware semantic map instead of recomputing TOP from maxBandIndex", () => {
    const triangles = [
      makeTriangle(1, 0),
      makeTriangle(2, 99),
      makeTriangle(3, 2),
    ];
    const semanticByStableId = new Map([
      [1, "TOP" as const],
      [2, "RIGHT_EAST" as const],
      [3, "CONFLICT" as const],
    ]);

    const semanticTriangles = buildStructureV6SemanticTriangles(triangles, semanticByStableId);

    expect(semanticTriangles).toEqual([
      expect.objectContaining({ stableId: 1, semanticBucket: "TOP" }),
      expect.objectContaining({ stableId: 2, semanticBucket: "EAST_WEST" }),
      expect.objectContaining({ stableId: 3, semanticBucket: "EAST_WEST" }),
      expect.objectContaining({ stableId: 3, semanticBucket: "SOUTH_NORTH" }),
    ]);
  });
});
