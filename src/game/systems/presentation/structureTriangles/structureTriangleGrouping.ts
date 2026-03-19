import {
  type RuntimeStructureTriangleParentTileGroup,
  type RuntimeStructureTrianglePiece,
} from "./structureTriangleTypes";

export function groupRuntimeStructureTrianglePiecesByParentTile(
  pieces: RuntimeStructureTrianglePiece[],
): RuntimeStructureTriangleParentTileGroup[] {
  const byParent = new Map<string, {
    parentTx: number;
    parentTy: number;
    triangles: RuntimeStructureTrianglePiece[];
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>();

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const key = `${piece.parentTx},${piece.parentTy}`;
    let group = byParent.get(key);
    if (!group) {
      group = {
        parentTx: piece.parentTx,
        parentTy: piece.parentTy,
        triangles: [],
        minX: piece.bounds.minX,
        minY: piece.bounds.minY,
        maxX: piece.bounds.maxX,
        maxY: piece.bounds.maxY,
      };
      byParent.set(key, group);
    }
    group.triangles.push(piece);
    if (piece.bounds.minX < group.minX) group.minX = piece.bounds.minX;
    if (piece.bounds.minY < group.minY) group.minY = piece.bounds.minY;
    if (piece.bounds.maxX > group.maxX) group.maxX = piece.bounds.maxX;
    if (piece.bounds.maxY > group.maxY) group.maxY = piece.bounds.maxY;
  }

  const out: RuntimeStructureTriangleParentTileGroup[] = [];
  byParent.forEach((group) => {
    out.push({
      parentTx: group.parentTx,
      parentTy: group.parentTy,
      triangles: group.triangles,
      bounds: {
        x: group.minX,
        y: group.minY,
        w: group.maxX - group.minX,
        h: group.maxY - group.minY,
      },
    });
  });

  out.sort((a, b) => {
    if (a.parentTy !== b.parentTy) return a.parentTy - b.parentTy;
    return a.parentTx - b.parentTx;
  });
  return out;
}
