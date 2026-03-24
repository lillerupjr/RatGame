import { describe, expect, it } from "vitest";
import type { StampOverlay } from "../../../../game/map/compile/kenneyMap";
import {
  buildStructureShadowV2CacheEntry,
  type StructureShadowAlphaMap,
} from "../../../../game/systems/presentation/structureShadowV2AlphaSilhouette";
import type {
  RuntimeStructureTriangleCache,
  RuntimeStructureTrianglePiece,
} from "../../../../game/structures/monolithicStructureGeometry";

function makeTriangle(
  stableId: number,
  points: [x: number, y: number][],
): RuntimeStructureTrianglePiece {
  const [a, b, c] = points;
  const minX = Math.min(a[0], b[0], c[0]);
  const maxX = Math.max(a[0], b[0], c[0]);
  const minY = Math.min(a[1], b[1], c[1]);
  const maxY = Math.max(a[1], b[1], c[1]);
  const p0 = { x: a[0], y: a[1] };
  const p1 = { x: b[0], y: b[1] };
  const p2 = { x: c[0], y: c[1] };
  const basePoint = [p0, p1, p2].sort((lhs, rhs) => rhs.y - lhs.y || rhs.x - lhs.x)[0];
  return {
    structureInstanceId: "building-1",
    stableId,
    points: [p0, p1, p2],
    srcPoints: [p0, p1, p2],
    basePoint,
    feetSortY: basePoint.y,
    ownerTx: 0,
    ownerTy: 0,
    admissionTx: 0,
    admissionTy: 0,
    parentTx: 0,
    parentTy: 0,
    cameraTx: 0,
    cameraTy: 0,
    bandIndex: 0,
    localBounds: {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    },
    srcRectLocal: {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    },
    dstRectLocal: {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    },
  };
}

describe("structureShadowV2AlphaSilhouette", () => {
  it("builds silhouette cap + connectors from sprite alpha boundaries", () => {
    const a: [number, number] = [0, 0];
    const b: [number, number] = [10, 0];
    const c: [number, number] = [10, 10];
    const d: [number, number] = [0, 10];
    const tri0 = makeTriangle(1, [a, b, c]);
    const tri1 = makeTriangle(2, [a, c, d]);
    const triangleCache: RuntimeStructureTriangleCache = {
      structureInstanceId: "building-1",
      spriteId: "building/test",
      triangles: [tri0, tri1],
      parentTileGroups: [],
      geometrySignature: "geom:1",
    };
    const overlay: StampOverlay = {
      id: "building-1",
      tx: 0,
      ty: 0,
      w: 1,
      h: 1,
      seTx: 0,
      seTy: 0,
      z: 0,
      spriteId: "building/test",
      layerRole: "STRUCTURE",
    };
    const alphaMap: StructureShadowAlphaMap = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        0, 0, 0, 255, 0, 0, 0, 255,
        0, 0, 0, 255, 0, 0, 0, 255,
      ]),
    };
    const result = buildStructureShadowV2CacheEntry({
      overlay,
      triangleCache,
      geometrySignature: "geom:1",
      tileWorld: 100,
      toScreenAtZ: (worldX, worldY, _zVisual) => ({ x: worldX, y: worldY }),
      sunForward: { x: 0, y: 1, z: -1 },
      sunProjectionDirection: { x: 1, y: 0 },
      sunStepKey: "sun:unit",
      drawDx: 0,
      drawDy: 0,
      drawScale: 1,
      sourceAlphaMap: alphaMap,
    });

    expect(result.castHeightPx).toBeGreaterThan(0);
    expect(result.sourceBoundaryLoops.length).toBe(1);
    expect(result.sourceBoundaryLoops[0].length).toBe(4);
    expect(result.sourceBoundaryEdges.length).toBe(4);
    expect(result.projectedBoundaryEdges.length).toBe(4);
    expect(result.projectedCapTriangles.length).toBe(2);
    expect(result.connectorTriangles.length).toBe(8);
    expect(result.shadowTriangles.length).toBe(10);
    expect(result.projectedBounds).not.toBeNull();

    const castHeightPx = result.castHeightPx;
    for (let i = 0; i < result.sourceBoundaryEdges.length; i++) {
      const [sourceA, sourceB] = result.sourceBoundaryEdges[i];
      const [projectedA, projectedB] = result.projectedBoundaryEdges[i];
      expect(projectedA.x - sourceA.x).toBeCloseTo(castHeightPx, 5);
      expect(projectedA.y - sourceA.y).toBeCloseTo(0, 5);
      expect(projectedB.x - sourceB.x).toBeCloseTo(castHeightPx, 5);
      expect(projectedB.y - sourceB.y).toBeCloseTo(0, 5);
      const connector0 = result.connectorTriangles[i * 2];
      const connector1 = result.connectorTriangles[i * 2 + 1];
      expect(connector0).toEqual([sourceA, sourceB, projectedB]);
      expect(connector1).toEqual([sourceA, projectedB, projectedA]);
    }
  });
});
