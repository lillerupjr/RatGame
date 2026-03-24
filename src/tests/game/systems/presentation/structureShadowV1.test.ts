import { describe, expect, it } from "vitest";
import type { StampOverlay } from "../../../../game/map/compile/kenneyMap";
import {
  buildStructureShadowCacheEntry,
} from "../../../../game/systems/presentation/structureShadowV1";
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

function canonicalEdgeKey(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const k0 = `${a.x},${a.y}`;
  const k1 = `${b.x},${b.y}`;
  return k0 < k1 ? `${k0}|${k1}` : `${k1}|${k0}`;
}

describe("structureShadowV1", () => {
  it("builds boundary edges and connector quads without internal edges", () => {
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
    const result = buildStructureShadowCacheEntry({
      overlay,
      triangleCache,
      geometrySignature: "geom:1",
      tileWorld: 100,
      toScreenAtZ: (worldX, worldY, _zVisual) => ({ x: worldX, y: worldY }),
      sunForward: { x: 0, y: 1, z: -1 },
      sunProjectionDirection: { x: 1, y: 0 },
      sunStepKey: "sun:unit",
    });

    expect(result.roofCasterTriangles.length).toBe(2);
    expect(result.roofBoundaryEdges.length).toBe(4);
    expect(result.footprintBoundaryEdges.length).toBe(4);
    expect(result.projectedBoundaryEdges.length).toBe(4);
    expect(result.projectedTriangles.length).toBe(2);
    expect(result.connectorTriangles.length).toBe(8);
    expect(result.shadowTriangles.length).toBe(10);
    expect(result.projectedBounds).not.toBeNull();

    const internalEdge = canonicalEdgeKey(
      { x: a[0], y: a[1] },
      { x: c[0], y: c[1] },
    );
    const boundaryEdgeKeys = result.roofBoundaryEdges.map(([e0, e1]) => canonicalEdgeKey(e0, e1));
    expect(boundaryEdgeKeys).not.toContain(internalEdge);

    const castHeightPx = result.roofScan.activeLevel?.liftYPx ?? 0;
    expect(castHeightPx).toBeGreaterThan(0);
    expect(result.connectorTriangles.length).toBe(result.roofBoundaryEdges.length * 2);
    expect(result.footprintBoundaryEdges.every(([a, b]) => a.y >= 0 && b.y >= 0)).toBe(true);
    expect(result.projectedBoundaryEdges.every(([a, b]) => a.x >= 0 && b.x >= 0)).toBe(true);
  });
});
