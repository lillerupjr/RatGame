import { describe, expect, it } from "vitest";
import {
  SHADOW_LAYER_STEP_PX,
  buildStructureShadowV4CacheEntry,
  projectToGround,
  type SliceCorrespondence,
} from "../../../../game/systems/presentation/structureShadowV4";
import type { RuntimeStructureTrianglePiece } from "../../../../game/systems/presentation/runtimeStructureTriangles";

function pointEq(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.x === b.x && a.y === b.y;
}

function triHasVertices(
  tri: readonly [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
  expected: readonly [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
): boolean {
  return expected.every((p) => tri.some((q) => pointEq(p, q)));
}

function sourceTriangle(
  stableId: number,
  bandIndex: number,
  points: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
): RuntimeStructureTrianglePiece {
  return {
    structureInstanceId: "s4-src",
    stableId,
    points,
    srcPoints: points,
    parentTx: 0,
    parentTy: 0,
    cameraTx: 0,
    cameraTy: 0,
    bandIndex,
    localBounds: { x: 0, y: 0, w: 1, h: 1 },
    srcRectLocal: { x: 0, y: 0, w: 1, h: 1 },
    dstRectLocal: { x: 0, y: 0, w: 1, h: 1 },
  };
}

describe("structureShadowV4", () => {
  it("projects top points to ground using the exact V4 formula", () => {
    const p = projectToGround({ x: 10, y: 20 }, { x: 0.5, y: -0.25 }, 40);
    expect(p.x).toBe(30);
    expect(p.y).toBe(50);
  });

  it("preserves correspondence order and builds one strip per correspondence", () => {
    const correspondence: SliceCorrespondence[] = [
      {
        sliceIndex: 3,
        baseSegment: { a: { x: 100, y: 500 }, b: { x: 140, y: 500 } },
        topSegment: { a: { x: 100, y: 100 }, b: { x: 140, y: 100 } },
      },
      {
        sliceIndex: 1,
        baseSegment: { a: { x: 140, y: 500 }, b: { x: 180, y: 500 } },
        topSegment: { a: { x: 140, y: 100 }, b: { x: 180, y: 100 } },
      },
    ];

    const entry = buildStructureShadowV4CacheEntry({
      structureInstanceId: "s1",
      geometrySignature: "g1",
      sunStepKey: "sun-v1:h10",
      castHeightPx: 400,
      sunDirection: { x: 0.2, y: 0.1 },
      sliceCorrespondence: correspondence,
    });

    expect(entry.sliceStrips).toHaveLength(2);
    expect(entry.sliceStrips.map((strip) => strip.sliceIndex)).toEqual([3, 1]);
    expect(entry.sliceStrips[0].topA).toEqual({
      x: 180,
      y: 540,
    });
    expect(entry.sliceStrips[1].topB).toEqual({
      x: 260,
      y: 540,
    });
    expect(entry.isDeltaConstant).toBe(true);
    expect(entry.deltaReference).toEqual({ x: 80, y: 40 });
  });

  it("flags non-constant midpoint delta when correspondence is inconsistent", () => {
    const correspondence: SliceCorrespondence[] = [
      {
        sliceIndex: 0,
        baseSegment: { a: { x: 0, y: 100 }, b: { x: 40, y: 100 } },
        topSegment: { a: { x: 0, y: 20 }, b: { x: 40, y: 20 } },
      },
      {
        sliceIndex: 1,
        baseSegment: { a: { x: 40, y: 100 }, b: { x: 80, y: 100 } },
        topSegment: { a: { x: 40, y: 35 }, b: { x: 80, y: 35 } },
      },
    ];

    const entry = buildStructureShadowV4CacheEntry({
      structureInstanceId: "s2",
      geometrySignature: "g2",
      sunStepKey: "sun-v1:h12",
      castHeightPx: 80,
      sunDirection: { x: 0, y: 0 },
      sliceCorrespondence: correspondence,
    });

    expect(entry.sliceStrips).toHaveLength(2);
    expect(entry.isDeltaConstant).toBe(false);
    expect(entry.midpointDiagnostics[0].delta).toEqual({ x: 0, y: 0 });
    expect(entry.midpointDiagnostics[1].delta).toEqual({ x: 0, y: 15 });
  });

  it("subdivides strips into fixed 64px layers and consecutive bands up to exact roof height", () => {
    const sliceCount = 9; // representative rectangle: N + M
    const correspondence: SliceCorrespondence[] = [];
    for (let i = 0; i < sliceCount; i++) {
      const x0 = i * 40;
      const x1 = x0 + 40;
      correspondence.push({
        sliceIndex: i,
        baseSegment: { a: { x: x0, y: 500 }, b: { x: x1, y: 500 } },
        topSegment: { a: { x: x0, y: -76 }, b: { x: x1, y: -76 } },
      });
    }

    const entry = buildStructureShadowV4CacheEntry({
      structureInstanceId: "s3",
      geometrySignature: "g3",
      sunStepKey: "sun-v1:h13",
      castHeightPx: 576,
      sunDirection: { x: 0.25, y: -0.1 },
      sliceCorrespondence: correspondence,
    });

    expect(SHADOW_LAYER_STEP_PX).toBe(64);
    expect(entry.roofHeightPx).toBe(576);
    expect(entry.layerHeightsPx).toEqual([0, 64, 128, 192, 256, 320, 384, 448, 512, 576]);
    expect(entry.sliceStrips).toHaveLength(sliceCount);
    expect(entry.layerEdges).toHaveLength(sliceCount * entry.layerHeightsPx.length);
    expect(entry.layerBands).toHaveLength(sliceCount * (entry.layerHeightsPx.length - 1));
    expect(entry.destinationBandTriangles).toHaveLength(entry.layerBands.length);
    expect(entry.destinationTriangles).toHaveLength(entry.layerBands.length * 2);
    expect(entry.destinationBandTriangles.some((pair) => pair.diagonal === "A_to_Bprime")).toBe(true);
    expect(entry.destinationBandTriangles.some((pair) => pair.diagonal === "B_to_Aprime")).toBe(true);

    const selectedSlice = entry.sliceStrips[0];
    const selectedEdges = entry.layerEdges.filter((edge) => edge.sliceIndex === selectedSlice.sliceIndex);
    expect(selectedEdges[0].a).toEqual(selectedSlice.baseA);
    expect(selectedEdges[0].b).toEqual(selectedSlice.baseB);
    expect(selectedEdges[selectedEdges.length - 1].a).toEqual(selectedSlice.topA);
    expect(selectedEdges[selectedEdges.length - 1].b).toEqual(selectedSlice.topB);

    const selectedBand = entry.layerBands.find((band) => band.sliceIndex === selectedSlice.sliceIndex && band.bandIndex === 0);
    const selectedPair = entry.destinationBandTriangles.find((pair) => pair.sliceIndex === selectedSlice.sliceIndex && pair.bandIndex === 0);
    const selectedBandNext = entry.layerBands.find((band) => band.sliceIndex === selectedSlice.sliceIndex && band.bandIndex === 1);
    const selectedPairNext = entry.destinationBandTriangles.find((pair) => pair.sliceIndex === selectedSlice.sliceIndex && pair.bandIndex === 1);
    expect(selectedBand).toBeTruthy();
    expect(selectedPair).toBeTruthy();
    expect(selectedBandNext).toBeTruthy();
    expect(selectedPairNext).toBeTruthy();
    expect(selectedPair!.diagonal).toBe("A_to_Bprime");
    expect(selectedPairNext!.diagonal).toBe("B_to_Aprime");
    expect(triHasVertices(selectedPair!.tri0, [
      selectedBand!.lowerA,
      selectedBand!.lowerB,
      selectedBand!.upperB,
    ])).toBe(true);
    expect(triHasVertices(selectedPair!.tri1, [
      selectedBand!.lowerA,
      selectedBand!.upperB,
      selectedBand!.upperA,
    ])).toBe(true);

    expect(triHasVertices(selectedPairNext!.tri0, [
      selectedBandNext!.lowerA,
      selectedBandNext!.lowerB,
      selectedBandNext!.upperA,
    ])).toBe(true);
    expect(triHasVertices(selectedPairNext!.tri1, [
      selectedBandNext!.lowerB,
      selectedBandNext!.upperA,
      selectedBandNext!.upperB,
    ])).toBe(true);
  });

  it("applies runtime owner-parity to slice triangulation to keep topology aligned", () => {
    const correspondence: SliceCorrespondence[] = [{
      sliceIndex: 0,
      baseSegment: { a: { x: 0, y: 100 }, b: { x: 40, y: 100 } },
      topSegment: { a: { x: 0, y: 0 }, b: { x: 40, y: 0 } },
    }];

    const entry = buildStructureShadowV4CacheEntry({
      structureInstanceId: "s4",
      geometrySignature: "g4",
      sunStepKey: "sun-v1:h11",
      castHeightPx: 64,
      sunDirection: { x: 0, y: 0 },
      sliceCorrespondence: correspondence,
      sliceOwnerParity: new Map([[0, 1]]),
    });

    const band = entry.layerBands[0];
    const pair = entry.destinationBandTriangles[0];
    expect(pair.diagonal).toBe("B_to_Aprime");
    expect(triHasVertices(pair.tri0, [band.lowerA, band.lowerB, band.upperA])).toBe(true);
    expect(triHasVertices(pair.tri1, [band.lowerB, band.upperA, band.upperB])).toBe(true);
  });

  it("builds explicit one-to-one source/destination correspondence from slice-band topology", () => {
    const correspondence: SliceCorrespondence[] = [{
      sliceIndex: 0,
      sourceBandIndex: 1,
      baseSegment: { a: { x: 0, y: 100 }, b: { x: 40, y: 100 } },
      topSegment: { a: { x: 0, y: 0 }, b: { x: 40, y: 0 } },
    }];

    const sourceTriangles: RuntimeStructureTrianglePiece[] = [
      sourceTriangle(10, 1, [{ x: 1, y: 90 }, { x: 20, y: 90 }, { x: 20, y: 70 }]),
      sourceTriangle(11, 1, [{ x: 1, y: 90 }, { x: 20, y: 70 }, { x: 1, y: 70 }]),
      sourceTriangle(12, 1, [{ x: 1, y: 70 }, { x: 20, y: 70 }, { x: 20, y: 50 }]),
      sourceTriangle(13, 1, [{ x: 1, y: 70 }, { x: 20, y: 50 }, { x: 1, y: 50 }]),
    ];

    const entry = buildStructureShadowV4CacheEntry({
      structureInstanceId: "s4-match",
      geometrySignature: "g4-match",
      sunStepKey: "sun-v1:h13",
      castHeightPx: 128,
      sunDirection: { x: 0, y: 0 },
      sliceCorrespondence: correspondence,
      sourceTriangles,
    });

    expect(entry.sourceBandTriangles).toHaveLength(4);
    expect(entry.destinationBandEntries).toHaveLength(4);
    expect(entry.triangleCorrespondence).toHaveLength(4);
    expect(entry.triangleCorrespondenceMismatches).toHaveLength(0);
    expect(entry.triangleCorrespondenceGroups).toHaveLength(2);
    expect(entry.triangleCorrespondenceGroups[0].correspondences).toHaveLength(2);
    expect(entry.triangleCorrespondenceGroups[1].correspondences).toHaveLength(2);
    expect(entry.triangleCorrespondence[0].sourceTriangleIndexWithinBand).toBe(0);
    expect(entry.triangleCorrespondence[0].destinationTriangleIndex).toBe(0);
    expect(entry.triangleCorrespondence[1].sourceTriangleIndexWithinBand).toBe(1);
    expect(entry.triangleCorrespondence[1].destinationTriangleIndex).toBe(1);
  });

  it("surfaces mismatches explicitly when source/destination slice-band counts differ", () => {
    const correspondence: SliceCorrespondence[] = [{
      sliceIndex: 0,
      sourceBandIndex: 1,
      baseSegment: { a: { x: 0, y: 100 }, b: { x: 40, y: 100 } },
      topSegment: { a: { x: 0, y: 0 }, b: { x: 40, y: 0 } },
    }];
    const sourceTriangles: RuntimeStructureTrianglePiece[] = [
      sourceTriangle(21, 1, [{ x: 0, y: 90 }, { x: 20, y: 90 }, { x: 20, y: 70 }]),
    ];

    const entry = buildStructureShadowV4CacheEntry({
      structureInstanceId: "s4-mismatch",
      geometrySignature: "g4-mismatch",
      sunStepKey: "sun-v1:h13",
      castHeightPx: 64,
      sunDirection: { x: 0, y: 0 },
      sliceCorrespondence: correspondence,
      sourceTriangles,
    });

    expect(entry.sourceBandTriangles).toHaveLength(1);
    expect(entry.destinationBandEntries).toHaveLength(2);
    expect(entry.triangleCorrespondence).toHaveLength(0);
    expect(entry.triangleCorrespondenceMismatches).toHaveLength(1);
    expect(entry.triangleCorrespondenceMismatches[0].sourceTriangleCount).toBe(1);
    expect(entry.triangleCorrespondenceMismatches[0].destinationTriangleCount).toBe(2);
    expect(entry.triangleCorrespondenceGroups[0].mismatch).toBeTruthy();
  });

  it("retains projected top-cap triangles in V4 cache output", () => {
    const correspondence: SliceCorrespondence[] = [{
      sliceIndex: 0,
      baseSegment: { a: { x: 0, y: 100 }, b: { x: 40, y: 100 } },
      topSegment: { a: { x: 0, y: 0 }, b: { x: 40, y: 0 } },
    }];
    const topCap: Array<[{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]> = [
      [{ x: 120, y: 180 }, { x: 160, y: 180 }, { x: 140, y: 210 }],
    ];

    const entry = buildStructureShadowV4CacheEntry({
      structureInstanceId: "s4-cap",
      geometrySignature: "g4-cap",
      sunStepKey: "sun-v1:h14",
      castHeightPx: 64,
      sunDirection: { x: 0.1, y: -0.2 },
      sliceCorrespondence: correspondence,
      topCapTriangles: topCap,
    });

    expect(entry.topCapTriangles).toHaveLength(1);
    expect(entry.topCapTriangles[0]).toEqual(topCap[0]);
    expect(entry.projectedBounds).toBeTruthy();
  });
});
