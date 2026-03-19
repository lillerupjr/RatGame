import { screenToWorld } from "../../../../engine/math/iso";
import { type StructureSliceDebugPoint } from "./structureTriangleTypes";

export function positiveMod(n: number, m: number): number {
  const mm = Math.max(1, m);
  const r = n % mm;
  return r < 0 ? r + mm : r;
}

export function resolveTriangleCentroidOwnerTile(
  triA: StructureSliceDebugPoint,
  triB: StructureSliceDebugPoint,
  triC: StructureSliceDebugPoint,
  tileWorld: number,
): { tx: number; ty: number; cx: number; cy: number } {
  const cx = (triA.x + triB.x + triC.x) / 3;
  const cy = (triA.y + triB.y + triC.y) / 3;
  const world = screenToWorld(cx, cy);
  const safeTileWorld = Math.max(1, tileWorld);
  return {
    tx: Math.floor(world.x / safeTileWorld),
    ty: Math.floor(world.y / safeTileWorld),
    cx,
    cy,
  };
}

export function hashStructureTriangleStableId(
  structureInstanceId: string,
  bandIndex: number,
  triangleOrdinal: number,
): number {
  let hash = 2166136261;
  for (let i = 0; i < structureInstanceId.length; i++) {
    hash ^= structureInstanceId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= bandIndex | 0;
  hash = Math.imul(hash, 16777619);
  hash ^= triangleOrdinal | 0;
  hash = Math.imul(hash, 16777619);
  return hash >>> 0;
}
