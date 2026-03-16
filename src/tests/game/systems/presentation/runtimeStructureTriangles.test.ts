import { describe, expect, it } from "vitest";
import {
  buildRuntimeStructureTriangleCache,
  buildRuntimeStructureTriangleContextKey,
  buildRuntimeStructureTriangleGeometrySignature,
  buildRuntimeStructureTrianglePiecesForBand,
  buildStructureTriangleCandidatesForBand,
  deriveParentTileRenderFields,
  groupRuntimeStructureTrianglesByParentTile,
  rectIntersects,
  RuntimeStructureTriangleCacheStore,
  type RuntimeStructureTrianglePiece,
} from "../../../../game/systems/presentation/runtimeStructureTriangles";

function makeTrianglePiece(
  structureInstanceId: string,
  stableId: number,
  parentTx: number,
  parentTy: number,
  cameraTx: number,
  cameraTy: number,
  points: RuntimeStructureTrianglePiece["points"],
): RuntimeStructureTrianglePiece {
  const minX = Math.min(points[0].x, points[1].x, points[2].x);
  const minY = Math.min(points[0].y, points[1].y, points[2].y);
  const maxX = Math.max(points[0].x, points[1].x, points[2].x);
  const maxY = Math.max(points[0].y, points[1].y, points[2].y);
  return {
    structureInstanceId,
    stableId,
    points,
    srcPoints: points,
    parentTx,
    parentTy,
    cameraTx,
    cameraTy,
    bandIndex: 1,
    localBounds: {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    },
    srcRectLocal: { x: 0, y: 0, w: 64, h: 128 },
    dstRectLocal: { x: 0, y: 0, w: 64, h: 128 },
  };
}

describe("runtimeStructureTriangles", () => {
  it("generates deterministic triangle candidates", () => {
    const rect = { x: 100, y: 200, w: 64, h: 192 };
    const first = buildStructureTriangleCandidatesForBand(rect, 2);
    const second = buildStructureTriangleCandidatesForBand(rect, 2);
    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });

  it("culls empty triangles by alpha map", () => {
    const alphaMap = {
      width: 64,
      height: 128,
      data: new Uint8ClampedArray(64 * 128 * 4),
    };
    const built = buildRuntimeStructureTrianglePiecesForBand({
      structureInstanceId: "s1",
      bandIndex: 1,
      progressionIndex: 0,
      parentTx: 10,
      parentTy: 11,
      srcRect: { x: 0, y: 0, w: 64, h: 128 },
      dstRect: { x: 0, y: 0, w: 64, h: 128 },
      tileWorld: 64,
      alphaMap,
      cameraTileFromCentroid: () => ({ tx: 0, ty: 0 }),
    });

    expect(built.stats.beforeCull).toBeGreaterThan(0);
    expect(built.stats.afterCull).toBe(0);
    expect(built.pieces).toHaveLength(0);
  });

  it("assigns parent tile from input and camera tile from centroid resolver", () => {
    const built = buildRuntimeStructureTrianglePiecesForBand({
      structureInstanceId: "s2",
      bandIndex: 2,
      progressionIndex: 1,
      parentTx: 18,
      parentTy: 9,
      srcRect: { x: 0, y: 0, w: 64, h: 128 },
      dstRect: { x: 128, y: 64, w: 64, h: 128 },
      tileWorld: 64,
      cameraTileFromCentroid: (x, y) => ({ tx: Math.floor(x / 64), ty: Math.floor(y / 64) }),
    });

    expect(built.pieces.length).toBeGreaterThan(0);
    const first = built.pieces[0];
    const [a, b, c] = first.points;
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    expect(first.parentTx).toBe(18);
    expect(first.parentTy).toBe(9);
    expect(first.cameraTx).toBe(Math.floor(cx / 64));
    expect(first.cameraTy).toBe(Math.floor(cy / 64));
  });

  it("groups triangles by parent tile with union bounds", () => {
    const pieces: RuntimeStructureTrianglePiece[] = [
      makeTrianglePiece("s3", 1, 10, 11, 11, 12, [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 0, y: 16 }]),
      makeTrianglePiece("s3", 2, 10, 11, 12, 13, [{ x: 8, y: 8 }, { x: 24, y: 8 }, { x: 8, y: 24 }]),
      makeTrianglePiece("s3", 3, 11, 11, 13, 13, [{ x: 32, y: 0 }, { x: 48, y: 0 }, { x: 32, y: 16 }]),
    ];

    const groups = groupRuntimeStructureTrianglesByParentTile("s3", pieces);
    expect(groups).toHaveLength(2);
    const first = groups.find((g) => g.parentTx === 10 && g.parentTy === 11);
    expect(first).toBeTruthy();
    expect(first!.triangles).toHaveLength(2);
    expect(first!.localBounds).toEqual({ x: 0, y: 0, w: 24, h: 24 });
  });

  it("uses bounds intersection for group admission", () => {
    expect(rectIntersects(
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 9, y: 9, w: 10, h: 10 },
    )).toBe(true);
    expect(rectIntersects(
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 10, y: 10, w: 10, h: 10 },
    )).toBe(false);
  });

  it("derives parent-tile render key independent of bounds", () => {
    const keyA = deriveParentTileRenderFields(18, 7);
    const keyB = deriveParentTileRenderFields(18, 7);
    expect(keyA).toEqual({ slice: 25, within: 18 });
    expect(keyB).toEqual(keyA);
  });

  it("invalidates cache on context change and geometry signature mismatch", () => {
    const store = new RuntimeStructureTriangleCacheStore();
    const contextA = buildRuntimeStructureTriangleContextKey({ mapId: "downtown", enabled: true });
    const contextB = buildRuntimeStructureTriangleContextKey({ mapId: "uptown", enabled: true });

    expect(store.resetIfContextChanged(contextA)).toBe(true);
    expect(store.resetIfContextChanged(contextA)).toBe(false);

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
    const pieces = [
      makeTrianglePiece("struct_1", 1, 10, 10, 10, 10, [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 0, y: 32 }]),
    ];
    const cache = buildRuntimeStructureTriangleCache("struct_1", "structures/buildings/test", signatureA, pieces);
    store.set(cache);
    expect(store.get("struct_1", signatureA)).toBeTruthy();

    const signatureB = `${signatureA}::changed`;
    expect(store.get("struct_1", signatureB)).toBeUndefined();

    store.set(cache);
    expect(store.resetIfContextChanged(contextB)).toBe(true);
    expect(store.get("struct_1", signatureA)).toBeUndefined();
  });
});
