import { describe, expect, it } from "vitest";
import { groupRuntimeStructureTrianglePiecesByParentTile } from "../../../../game/systems/presentation/structureTriangles/structureTriangleGrouping";
import { type RuntimeStructureTrianglePiece } from "../../../../game/systems/presentation/structureTriangles/structureTriangleTypes";

function makePiece(
  parentTx: number,
  parentTy: number,
  points: RuntimeStructureTrianglePiece["points"],
): RuntimeStructureTrianglePiece {
  const minX = Math.min(points[0].x, points[1].x, points[2].x);
  const minY = Math.min(points[0].y, points[1].y, points[2].y);
  const maxX = Math.max(points[0].x, points[1].x, points[2].x);
  const maxY = Math.max(points[0].y, points[1].y, points[2].y);
  return {
    points,
    parentTx,
    parentTy,
    bandIndex: 1,
    structureInstanceId: "s",
    stableId: 1,
    bounds: { minX, minY, maxX, maxY },
  };
}

describe("structureTriangleGrouping", () => {
  it("groups by parent tile and unions bounds", () => {
    const pieces: RuntimeStructureTrianglePiece[] = [
      makePiece(10, 10, [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }]),
      makePiece(10, 10, [{ x: 6, y: 6 }, { x: 14, y: 6 }, { x: 6, y: 14 }]),
      makePiece(11, 10, [{ x: 20, y: 3 }, { x: 28, y: 3 }, { x: 20, y: 11 }]),
    ];

    const grouped = groupRuntimeStructureTrianglePiecesByParentTile(pieces);

    expect(grouped).toHaveLength(2);
    const first = grouped.find((g) => g.parentTx === 10 && g.parentTy === 10);
    expect(first).toBeTruthy();
    expect(first!.triangles).toHaveLength(2);
    expect(first!.bounds).toEqual({ x: 0, y: 0, w: 14, h: 14 });
  });

  it("sorts groups deterministically by parentTy then parentTx", () => {
    const pieces: RuntimeStructureTrianglePiece[] = [
      makePiece(12, 9, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]),
      makePiece(9, 8, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]),
      makePiece(7, 8, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]),
    ];

    const grouped = groupRuntimeStructureTrianglePiecesByParentTile(pieces);
    const order = grouped.map((g) => `${g.parentTy},${g.parentTx}`);

    expect(order).toEqual(["8,7", "8,9", "9,12"]);
  });
});
