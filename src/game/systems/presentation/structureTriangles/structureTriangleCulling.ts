import {
  type StructureSliceDebugAlphaMap,
  type StructureSliceDebugPoint,
  type StructureSliceDebugRect,
} from "./structureTriangleTypes";

export function pointInTriangle(
  p: StructureSliceDebugPoint,
  a: StructureSliceDebugPoint,
  b: StructureSliceDebugPoint,
  c: StructureSliceDebugPoint,
): boolean {
  const ab = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const bc = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const ca = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const hasNeg = ab < 0 || bc < 0 || ca < 0;
  const hasPos = ab > 0 || bc > 0 || ca > 0;
  return !(hasNeg && hasPos);
}

export function mapDebugPointFromDstToSrc(
  p: StructureSliceDebugPoint,
  dstRect: StructureSliceDebugRect,
  srcRect: StructureSliceDebugRect,
): StructureSliceDebugPoint {
  const nx = dstRect.w !== 0 ? (p.x - dstRect.x) / dstRect.w : 0;
  const ny = dstRect.h !== 0 ? (p.y - dstRect.y) / dstRect.h : 0;
  return {
    x: srcRect.x + nx * srcRect.w,
    y: srcRect.y + ny * srcRect.h,
  };
}

export function triangleHasVisibleSpritePixels(
  triA: StructureSliceDebugPoint,
  triB: StructureSliceDebugPoint,
  triC: StructureSliceDebugPoint,
  dstRect: StructureSliceDebugRect,
  srcRect: StructureSliceDebugRect,
  alphaMap: StructureSliceDebugAlphaMap,
  alphaThreshold: number = 1,
): boolean {
  if (!(srcRect.w > 0) || !(srcRect.h > 0)) return false;
  const a = mapDebugPointFromDstToSrc(triA, dstRect, srcRect);
  const b = mapDebugPointFromDstToSrc(triB, dstRect, srcRect);
  const c = mapDebugPointFromDstToSrc(triC, dstRect, srcRect);

  const srcMinX = Math.max(
    0,
    Math.floor(Math.max(srcRect.x, Math.min(a.x, b.x, c.x))),
  );
  const srcMaxX = Math.min(
    alphaMap.width - 1,
    Math.ceil(Math.min(srcRect.x + srcRect.w, Math.max(a.x, b.x, c.x))) - 1,
  );
  const srcMinY = Math.max(
    0,
    Math.floor(Math.max(srcRect.y, Math.min(a.y, b.y, c.y))),
  );
  const srcMaxY = Math.min(
    alphaMap.height - 1,
    Math.ceil(Math.min(srcRect.y + srcRect.h, Math.max(a.y, b.y, c.y))) - 1,
  );
  if (srcMinX > srcMaxX || srcMinY > srcMaxY) return false;

  for (let sy = srcMinY; sy <= srcMaxY; sy++) {
    for (let sx = srcMinX; sx <= srcMaxX; sx++) {
      const alphaIdx = ((sy * alphaMap.width + sx) << 2) + 3;
      if ((alphaMap.data[alphaIdx] | 0) < alphaThreshold) continue;
      if (pointInTriangle({ x: sx + 0.5, y: sy + 0.5 }, a, b, c)) return true;
    }
  }
  return false;
}
