import { screenToWorld } from "../../../engine/math/iso";

export type RuntimeStructureTrianglePoint = {
  x: number;
  y: number;
};

export type RuntimeStructureTriangleRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type RuntimeStructureTrianglePiece = {
  structureInstanceId: string;
  stableId: number;
  points: [RuntimeStructureTrianglePoint, RuntimeStructureTrianglePoint, RuntimeStructureTrianglePoint];
  srcPoints: [RuntimeStructureTrianglePoint, RuntimeStructureTrianglePoint, RuntimeStructureTrianglePoint];
  parentTx: number;
  parentTy: number;
  cameraTx: number;
  cameraTy: number;
  bandIndex: number;
  localBounds: RuntimeStructureTriangleRect;
  srcRectLocal: RuntimeStructureTriangleRect;
  dstRectLocal: RuntimeStructureTriangleRect;
};

export type RuntimeStructureParentTileGroup = {
  structureInstanceId: string;
  parentTx: number;
  parentTy: number;
  triangles: RuntimeStructureTrianglePiece[];
  localBounds: RuntimeStructureTriangleRect;
  stableId: number;
};

export type RuntimeStructureTriangleCache = {
  structureInstanceId: string;
  spriteId: string;
  triangles: RuntimeStructureTrianglePiece[];
  parentTileGroups: RuntimeStructureParentTileGroup[];
  geometrySignature: string;
};

export type RuntimeStructureTriangleAlphaMap = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type RuntimeStructureTriangleBuildStats = {
  beforeCull: number;
  afterCull: number;
};

export type RuntimeStructureTriangleBuildInput = {
  structureInstanceId: string;
  bandIndex: number;
  progressionIndex: number;
  parentTx: number;
  parentTy: number;
  srcRect: RuntimeStructureTriangleRect;
  dstRect: RuntimeStructureTriangleRect;
  tileWorld: number;
  alphaMap?: RuntimeStructureTriangleAlphaMap | null;
  alphaThreshold?: number;
  cameraTileFromCentroid?: (x: number, y: number) => { tx: number; ty: number };
  ladderStepPx?: number;
  ladderStaggerPx?: number;
  parityFlip?: boolean;
};

export type RuntimeStructureTriangleBuildResult = {
  pieces: RuntimeStructureTrianglePiece[];
  stats: RuntimeStructureTriangleBuildStats;
};

export type RuntimeStructureTriangleContextKeyInput = {
  mapId: string;
  enabled: boolean;
};

export type RuntimeSliceBandDiagonal = "A_to_Bprime" | "B_to_Aprime";

export type RuntimeSliceBandQuad<TPoint extends RuntimeStructureTrianglePoint = RuntimeStructureTrianglePoint> = {
  lowerA: TPoint;
  lowerB: TPoint;
  upperA: TPoint;
  upperB: TPoint;
};

export type RuntimeSliceBandTriangles<TPoint extends RuntimeStructureTrianglePoint = RuntimeStructureTrianglePoint> = {
  diagonal: RuntimeSliceBandDiagonal;
  tri0: [TPoint, TPoint, TPoint];
  tri1: [TPoint, TPoint, TPoint];
};

export type RuntimeStructureTriangleGeometrySignatureInput = {
  structureInstanceId: string;
  spriteId: string;
  seTx: number;
  seTy: number;
  footprintW: number;
  footprintH: number;
  flipX: boolean;
  scale: number;
  baseDx: number;
  baseDy: number;
  spriteWidth: number;
  spriteHeight: number;
  sliceOffsetX: number;
  sliceOffsetY: number;
  sliceOriginX?: number;
  baseZ: number;
};

export const STRUCTURE_TRI_LADDER_STEP_PX = 64;
export const STRUCTURE_TRI_LADDER_STAGGER_PX = 32;
export const STRUCTURE_TRI_ALPHA_THRESHOLD = 1;

function q(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0;
  const safeStep = Math.max(1e-6, Math.abs(step));
  return Math.round(value / safeStep) * safeStep;
}

function positiveMod(n: number, m: number): number {
  const mm = Math.max(1, m | 0);
  const r = n % mm;
  return r < 0 ? r + mm : r;
}

function hashString32(s: string): number {
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function triangleStableId(structureInstanceId: string, bandIndex: number, triangleOrdinal: number): number {
  return hashString32(`${structureInstanceId}:${bandIndex}:${triangleOrdinal}`);
}

function groupStableId(structureInstanceId: string, parentTx: number, parentTy: number): number {
  return hashString32(`${structureInstanceId}:group:${parentTx}:${parentTy}`);
}

function pointInTriangle(
  p: RuntimeStructureTrianglePoint,
  a: RuntimeStructureTrianglePoint,
  b: RuntimeStructureTrianglePoint,
  c: RuntimeStructureTrianglePoint,
): boolean {
  const ab = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const bc = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const ca = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const hasNeg = ab < 0 || bc < 0 || ca < 0;
  const hasPos = ab > 0 || bc > 0 || ca > 0;
  return !(hasNeg && hasPos);
}

function mapPointFromDstToSrc(
  p: RuntimeStructureTrianglePoint,
  dstRect: RuntimeStructureTriangleRect,
  srcRect: RuntimeStructureTriangleRect,
): RuntimeStructureTrianglePoint {
  const nx = dstRect.w !== 0 ? (p.x - dstRect.x) / dstRect.w : 0;
  const ny = dstRect.h !== 0 ? (p.y - dstRect.y) / dstRect.h : 0;
  return {
    x: srcRect.x + nx * srcRect.w,
    y: srcRect.y + ny * srcRect.h,
  };
}

export function buildRuntimeStructureTriangleContextKey(
  input: RuntimeStructureTriangleContextKeyInput,
): string {
  return `map:${input.mapId}||enabled:${input.enabled ? 1 : 0}`;
}

export function buildRuntimeStructureTriangleGeometrySignature(
  input: RuntimeStructureTriangleGeometrySignatureInput,
): string {
  return [
    `id:${input.structureInstanceId}`,
    `sprite:${input.spriteId}`,
    `se:${input.seTx},${input.seTy}`,
    `fp:${input.footprintW}x${input.footprintH}`,
    `flip:${input.flipX ? 1 : 0}`,
    `scale:${q(input.scale, 0.001)}`,
    `dx:${q(input.baseDx, 0.001)}`,
    `dy:${q(input.baseDy, 0.001)}`,
    `dim:${input.spriteWidth}x${input.spriteHeight}`,
    `sliceOfs:${q(input.sliceOffsetX, 0.001)},${q(input.sliceOffsetY, 0.001)}`,
    `sliceOrigin:${q(input.sliceOriginX ?? 0, 0.001)}`,
    `z:${q(input.baseZ, 0.001)}`,
  ].join("||");
}

export function resolveRuntimeStructureBandProgressionIndex(
  bandIndex: number,
  footprintW: number,
  footprintH: number,
): number {
  const tileW = Math.max(1, footprintW | 0);
  const tileH = Math.max(1, footprintH | 0);
  const coreCount = tileW + tileH;
  if (bandIndex === 0) return -1;
  if (bandIndex === coreCount + 1) return coreCount;
  return bandIndex - 1;
}

// Mirrors main slice ladder parity behavior: per-slice owner parity and vertical band parity
// jointly decide which diagonal should be used for a quad-like band split.
export function resolveRuntimeSliceBandDiagonal(
  ownerParity: number,
  bandIndex: number,
): RuntimeSliceBandDiagonal {
  const parity = ((ownerParity | 0) + (bandIndex | 0)) & 1;
  return parity === 0 ? "A_to_Bprime" : "B_to_Aprime";
}

// Mirrors the triangle ordering emitted by the main zig-zag slice triangulation.
// Keep this shared so alternate consumers (like shadow V4) stay topology-compatible.
export function triangulateRuntimeSliceBandQuad<TPoint extends RuntimeStructureTrianglePoint>(
  quad: RuntimeSliceBandQuad<TPoint>,
  ownerParity: number,
  bandIndex: number,
): RuntimeSliceBandTriangles<TPoint> {
  const diagonal = resolveRuntimeSliceBandDiagonal(ownerParity, bandIndex);
  if (diagonal === "A_to_Bprime") {
    return {
      diagonal,
      tri0: [quad.lowerB, quad.lowerA, quad.upperB],
      tri1: [quad.lowerA, quad.upperB, quad.upperA],
    };
  }
  return {
    diagonal,
    tri0: [quad.lowerA, quad.lowerB, quad.upperA],
    tri1: [quad.lowerB, quad.upperA, quad.upperB],
  };
}

export function buildStructureTriangleCandidatesForBand(
  rect: RuntimeStructureTriangleRect,
  progressionIndex: number,
  ladderStepPx: number = STRUCTURE_TRI_LADDER_STEP_PX,
  ladderStaggerPx: number = STRUCTURE_TRI_LADDER_STAGGER_PX,
  ownerParity: 0 | 1 = 0,
  parityFlip: boolean = false,
): Array<[
  RuntimeStructureTrianglePoint,
  RuntimeStructureTrianglePoint,
  RuntimeStructureTrianglePoint
]> {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.w;
  const y1 = rect.y + rect.h;
  if (!(x1 > x0) || !(y1 > y0)) return [];

  const ladderStep = Math.max(1, ladderStepPx | 0);
  const ladderStagger = Math.max(1, Math.min(ladderStep - 1, ladderStaggerPx | 0));
  const parityBias = parityFlip ? 1 : 0;
  void progressionIndex;
  const parityPhase = ((ownerParity + parityBias) & 1) * ladderStagger;
  const rightPhase = positiveMod(parityPhase, ladderStep);
  const leftPhase = positiveMod(rightPhase - ladderStagger, ladderStep);

  const zigZagPoints: Array<{ x: number; y: number; side: "L" | "R" }> = [];
  const collectLadder = (x: number, phase: number, side: "L" | "R") => {
    let first = y1 - positiveMod(y1 - phase, ladderStep);
    if (first < y1) first += ladderStep;
    for (let y = first; y >= y0 - ladderStep; y -= ladderStep) {
      zigZagPoints.push({ x, y, side });
    }
  };
  collectLadder(x1, rightPhase, "R");
  collectLadder(x0, leftPhase, "L");
  zigZagPoints.sort((a, b) => {
    if (a.y !== b.y) return b.y - a.y;
    if (a.side === b.side) return 0;
    return a.side === "R" ? -1 : 1;
  });

  const out: Array<[
    RuntimeStructureTrianglePoint,
    RuntimeStructureTrianglePoint,
    RuntimeStructureTrianglePoint
  ]> = [];
  for (let i = 0; i + 2 < zigZagPoints.length; i++) {
    const a = zigZagPoints[i];
    const b = zigZagPoints[i + 1];
    const c = zigZagPoints[i + 2];
    const minX = Math.min(a.x, b.x, c.x);
    const maxX = Math.max(a.x, b.x, c.x);
    const minY = Math.min(a.y, b.y, c.y);
    const maxY = Math.max(a.y, b.y, c.y);
    if (maxX <= x0 || minX >= x1 || maxY <= y0 || minY >= y1) continue;
    out.push([
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
      { x: c.x, y: c.y },
    ]);
  }
  return out;
}

export function triangleHasVisibleSpritePixels(
  triA: RuntimeStructureTrianglePoint,
  triB: RuntimeStructureTrianglePoint,
  triC: RuntimeStructureTrianglePoint,
  dstRect: RuntimeStructureTriangleRect,
  srcRect: RuntimeStructureTriangleRect,
  alphaMap: RuntimeStructureTriangleAlphaMap,
  alphaThreshold: number = STRUCTURE_TRI_ALPHA_THRESHOLD,
): boolean {
  if (!(srcRect.w > 0) || !(srcRect.h > 0)) return false;
  const a = mapPointFromDstToSrc(triA, dstRect, srcRect);
  const b = mapPointFromDstToSrc(triB, dstRect, srcRect);
  const c = mapPointFromDstToSrc(triC, dstRect, srcRect);

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

function defaultCameraTileFromCentroid(cx: number, cy: number, tileWorld: number): { tx: number; ty: number } {
  const world = screenToWorld(cx, cy);
  const safeTileWorld = Math.max(1, tileWorld);
  return {
    tx: Math.floor(world.x / safeTileWorld),
    ty: Math.floor(world.y / safeTileWorld),
  };
}

export function buildRuntimeStructureTrianglePiecesForBand(
  input: RuntimeStructureTriangleBuildInput,
): RuntimeStructureTriangleBuildResult {
  const pieces: RuntimeStructureTrianglePiece[] = [];
  const ownerParity = ((input.parentTx + input.parentTy) & 1) as 0 | 1;
  const candidates = buildStructureTriangleCandidatesForBand(
    input.dstRect,
    input.progressionIndex,
    input.ladderStepPx,
    input.ladderStaggerPx,
    ownerParity,
    input.parityFlip,
  );
  let beforeCull = 0;
  let afterCull = 0;
  const alphaMap = input.alphaMap ?? null;
  const threshold = input.alphaThreshold ?? STRUCTURE_TRI_ALPHA_THRESHOLD;
  const cameraResolver = input.cameraTileFromCentroid
    ?? ((x: number, y: number) => defaultCameraTileFromCentroid(x, y, input.tileWorld));

  for (let i = 0; i < candidates.length; i++) {
    const [a, b, c] = candidates[i];
    beforeCull++;
    if (alphaMap && !triangleHasVisibleSpritePixels(a, b, c, input.dstRect, input.srcRect, alphaMap, threshold)) {
      continue;
    }
    const minX = Math.min(a.x, b.x, c.x);
    const maxX = Math.max(a.x, b.x, c.x);
    const minY = Math.min(a.y, b.y, c.y);
    const maxY = Math.max(a.y, b.y, c.y);
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cameraTile = cameraResolver(cx, cy);
    const srcA = mapPointFromDstToSrc(a, input.dstRect, input.srcRect);
    const srcB = mapPointFromDstToSrc(b, input.dstRect, input.srcRect);
    const srcC = mapPointFromDstToSrc(c, input.dstRect, input.srcRect);
    const triangleOrdinal = pieces.length;
    pieces.push({
      structureInstanceId: input.structureInstanceId,
      stableId: triangleStableId(input.structureInstanceId, input.bandIndex, triangleOrdinal),
      points: [a, b, c],
      srcPoints: [srcA, srcB, srcC],
      parentTx: input.parentTx,
      parentTy: input.parentTy,
      cameraTx: cameraTile.tx,
      cameraTy: cameraTile.ty,
      bandIndex: input.bandIndex,
      localBounds: {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
      },
      srcRectLocal: {
        x: input.srcRect.x,
        y: input.srcRect.y,
        w: input.srcRect.w,
        h: input.srcRect.h,
      },
      dstRectLocal: {
        x: input.dstRect.x,
        y: input.dstRect.y,
        w: input.dstRect.w,
        h: input.dstRect.h,
      },
    });
    afterCull++;
  }

  return {
    pieces,
    stats: { beforeCull, afterCull },
  };
}

export function groupRuntimeStructureTrianglesByParentTile(
  structureInstanceId: string,
  pieces: RuntimeStructureTrianglePiece[],
): RuntimeStructureParentTileGroup[] {
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
        minX: piece.localBounds.x,
        minY: piece.localBounds.y,
        maxX: piece.localBounds.x + piece.localBounds.w,
        maxY: piece.localBounds.y + piece.localBounds.h,
      };
      byParent.set(key, group);
    }
    group.triangles.push(piece);
    const pieceMaxX = piece.localBounds.x + piece.localBounds.w;
    const pieceMaxY = piece.localBounds.y + piece.localBounds.h;
    if (piece.localBounds.x < group.minX) group.minX = piece.localBounds.x;
    if (piece.localBounds.y < group.minY) group.minY = piece.localBounds.y;
    if (pieceMaxX > group.maxX) group.maxX = pieceMaxX;
    if (pieceMaxY > group.maxY) group.maxY = pieceMaxY;
  }

  const out: RuntimeStructureParentTileGroup[] = [];
  byParent.forEach((group) => {
    out.push({
      structureInstanceId,
      parentTx: group.parentTx,
      parentTy: group.parentTy,
      triangles: group.triangles,
      localBounds: {
        x: group.minX,
        y: group.minY,
        w: group.maxX - group.minX,
        h: group.maxY - group.minY,
      },
      stableId: groupStableId(structureInstanceId, group.parentTx, group.parentTy),
    });
  });

  out.sort((a, b) => {
    if (a.parentTy !== b.parentTy) return a.parentTy - b.parentTy;
    return a.parentTx - b.parentTx;
  });

  return out;
}

export function buildRuntimeStructureTriangleCache(
  structureInstanceId: string,
  spriteId: string,
  geometrySignature: string,
  pieces: RuntimeStructureTrianglePiece[],
): RuntimeStructureTriangleCache {
  return {
    structureInstanceId,
    spriteId,
    triangles: pieces,
    parentTileGroups: groupRuntimeStructureTrianglesByParentTile(structureInstanceId, pieces),
    geometrySignature,
  };
}

export function rectIntersects(
  a: RuntimeStructureTriangleRect,
  b: RuntimeStructureTriangleRect,
): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export function deriveParentTileRenderFields(
  parentTx: number,
  parentTy: number,
): { slice: number; within: number } {
  return {
    slice: parentTx + parentTy,
    within: parentTx,
  };
}

export class RuntimeStructureTriangleCacheStore {
  private contextKey = "";
  private readonly entries = new Map<string, RuntimeStructureTriangleCache>();
  private readonly fallbackStructures = new Set<string>();

  resetIfContextChanged(nextContextKey: string): boolean {
    if (nextContextKey === this.contextKey) return false;
    this.contextKey = nextContextKey;
    this.entries.clear();
    this.fallbackStructures.clear();
    return true;
  }

  clear(): void {
    this.entries.clear();
    this.fallbackStructures.clear();
  }

  getContextKey(): string {
    return this.contextKey;
  }

  get(structureInstanceId: string, expectedGeometrySignature?: string): RuntimeStructureTriangleCache | undefined {
    const cached = this.entries.get(structureInstanceId);
    if (!cached) return undefined;
    if (expectedGeometrySignature && cached.geometrySignature !== expectedGeometrySignature) {
      this.entries.delete(structureInstanceId);
      return undefined;
    }
    return cached;
  }

  set(entry: RuntimeStructureTriangleCache): void {
    this.entries.set(entry.structureInstanceId, entry);
    this.fallbackStructures.delete(entry.structureInstanceId);
  }

  has(structureInstanceId: string, expectedGeometrySignature?: string): boolean {
    return !!this.get(structureInstanceId, expectedGeometrySignature);
  }

  markFallback(structureInstanceId: string): void {
    this.fallbackStructures.add(structureInstanceId);
  }

  clearFallback(structureInstanceId: string): void {
    this.fallbackStructures.delete(structureInstanceId);
  }

  isFallback(structureInstanceId: string): boolean {
    return this.fallbackStructures.has(structureInstanceId);
  }

  values(): RuntimeStructureTriangleCache[] {
    return Array.from(this.entries.values());
  }
}
