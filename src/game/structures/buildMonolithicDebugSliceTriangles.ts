import type { StructureSliceBand } from "./getStructureSlices";

export type MonolithicSliceEdgeSide = "L" | "R";

export type MonolithicSliceEdgePoint = {
  x: number;
  y: number;
  side: MonolithicSliceEdgeSide;
};

export type MonolithicSliceTriangle = {
  a: MonolithicSliceEdgePoint;
  b: MonolithicSliceEdgePoint;
  c: MonolithicSliceEdgePoint;
};

export type MonolithicSliceGeometry = {
  edgePoints: MonolithicSliceEdgePoint[];
  stripPoints: MonolithicSliceEdgePoint[];
  triangles: MonolithicSliceTriangle[];
};

export type MonolithicTriangleCullSample = {
  triangle: MonolithicSliceTriangle;
  visiblePixelCount: number;
  kept: boolean;
};

export type MonolithicSliceAlphaMap = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type MonolithicSliceCullRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const LADDER_STEP_PX = 64;
const LADDER_STAGGER_PX = 32;
const TRI_CULL_ALPHA_THRESHOLD = 1;
const TRI_CULL_MIN_VISIBLE_PIXELS = 32;

function positiveMod(n: number, m: number): number {
  const mm = Math.max(1, m | 0);
  const r = n % mm;
  return r < 0 ? r + mm : r;
}

function pointInTriangle(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  const ab = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const bc = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const ca = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const hasNeg = ab < 0 || bc < 0 || ca < 0;
  const hasPos = ab > 0 || bc > 0 || ca > 0;
  return !(hasNeg && hasPos);
}

function buildEdgeLadderPointsAtX(input: {
  x: number;
  y0: number;
  y1: number;
  phase: number;
  side: MonolithicSliceEdgeSide;
  step: number;
}): MonolithicSliceEdgePoint[] {
  const out: MonolithicSliceEdgePoint[] = [];
  let first = input.y1 - positiveMod(input.y1 - input.phase, input.step);
  if (first < input.y1) first += input.step;
  for (let y = first; y >= input.y0 - input.step; y -= input.step) {
    out.push({
      x: input.x,
      y,
      side: input.side,
    });
  }
  return out;
}

export function buildMonolithicSliceEdgePoints(
  slice: StructureSliceBand,
  anchor: { x: number; y: number },
): MonolithicSliceEdgePoint[] {
  const x0 = slice.x;
  const x1 = slice.x + slice.width;
  const y0 = 0;
  const y1 = slice.height;
  if (!(x1 > x0) || !(y1 > y0)) return [];

  const step = LADDER_STEP_PX;
  const stagger = LADDER_STAGGER_PX;
  const anchorPhase = positiveMod(anchor.y, step);
  const edgeBandOffset = (edgeX: number): number => Math.round((edgeX - anchor.x) / step);
  const phaseAtEdge = (edgeX: number): number => positiveMod(anchorPhase + edgeBandOffset(edgeX) * stagger, step);
  const leftPhase = phaseAtEdge(x0);
  const rightPhase = phaseAtEdge(x1);

  const right = buildEdgeLadderPointsAtX({
    x: x1,
    y0,
    y1,
    phase: rightPhase,
    side: "R",
    step,
  });
  const left = buildEdgeLadderPointsAtX({
    x: x0,
    y0,
    y1,
    phase: leftPhase,
    side: "L",
    step,
  });
  return [...right, ...left];
}

export function buildMonolithicSliceZigZagStrip(
  points: readonly MonolithicSliceEdgePoint[],
): MonolithicSliceEdgePoint[] {
  const out = points.slice();
  out.sort((a, b) => {
    if (a.y !== b.y) return b.y - a.y;
    if (a.side === b.side) return 0;
    return a.side === "R" ? -1 : 1;
  });
  return out;
}

export function emitMonolithicSliceTriangles(
  strip: readonly MonolithicSliceEdgePoint[],
): MonolithicSliceTriangle[] {
  const out: MonolithicSliceTriangle[] = [];
  for (let i = 0; i + 2 < strip.length; i++) {
    out.push({
      a: strip[i],
      b: strip[i + 1],
      c: strip[i + 2],
    });
  }
  return out;
}

export function buildMonolithicSliceGeometry(
  slice: StructureSliceBand,
  anchor: { x: number; y: number },
): MonolithicSliceGeometry {
  const edgePoints = buildMonolithicSliceEdgePoints(slice, anchor);
  const stripPoints = buildMonolithicSliceZigZagStrip(edgePoints);
  const triangles = emitMonolithicSliceTriangles(stripPoints);
  return {
    edgePoints,
    stripPoints,
    triangles,
  };
}

export function cullMonolithicTrianglesByAlpha(input: {
  triangles: readonly MonolithicSliceTriangle[];
  alphaMap: MonolithicSliceAlphaMap;
  workRectSpriteLocal: MonolithicSliceCullRect;
  workOffsetSpriteLocal: { x: number; y: number };
  alphaThreshold?: number;
  minVisiblePixels?: number;
}): MonolithicSliceTriangle[] {
  return cullMonolithicTrianglesByAlphaWithDiagnostics(input).keptTriangles;
}

export function cullMonolithicTrianglesByAlphaWithDiagnostics(input: {
  triangles: readonly MonolithicSliceTriangle[];
  alphaMap: MonolithicSliceAlphaMap;
  workRectSpriteLocal: MonolithicSliceCullRect;
  workOffsetSpriteLocal: { x: number; y: number };
  alphaThreshold?: number;
  minVisiblePixels?: number;
}): {
  keptTriangles: MonolithicSliceTriangle[];
  samples: MonolithicTriangleCullSample[];
  minVisiblePixels: number;
  alphaThreshold: number;
} {
  const out: MonolithicSliceTriangle[] = [];
  const samples: MonolithicTriangleCullSample[] = [];
  const threshold = input.alphaThreshold ?? TRI_CULL_ALPHA_THRESHOLD;
  const minVisiblePixels = Math.max(1, Math.floor(input.minVisiblePixels ?? TRI_CULL_MIN_VISIBLE_PIXELS));
  const clipMinX = input.workRectSpriteLocal.x;
  const clipMinY = input.workRectSpriteLocal.y;
  const clipMaxX = input.workRectSpriteLocal.x + input.workRectSpriteLocal.w;
  const clipMaxY = input.workRectSpriteLocal.y + input.workRectSpriteLocal.h;

  for (let i = 0; i < input.triangles.length; i++) {
    const tri = input.triangles[i];
    const a = {
      x: tri.a.x + input.workOffsetSpriteLocal.x,
      y: tri.a.y + input.workOffsetSpriteLocal.y,
    };
    const b = {
      x: tri.b.x + input.workOffsetSpriteLocal.x,
      y: tri.b.y + input.workOffsetSpriteLocal.y,
    };
    const c = {
      x: tri.c.x + input.workOffsetSpriteLocal.x,
      y: tri.c.y + input.workOffsetSpriteLocal.y,
    };

    const minX = Math.max(
      0,
      Math.floor(Math.max(clipMinX, Math.min(a.x, b.x, c.x))),
    );
    const maxX = Math.min(
      input.alphaMap.width - 1,
      Math.ceil(Math.min(clipMaxX, Math.max(a.x, b.x, c.x))) - 1,
    );
    const minY = Math.max(
      0,
      Math.floor(Math.max(clipMinY, Math.min(a.y, b.y, c.y))),
    );
    const maxY = Math.min(
      input.alphaMap.height - 1,
      Math.ceil(Math.min(clipMaxY, Math.max(a.y, b.y, c.y))) - 1,
    );
    if (minX > maxX || minY > maxY) continue;

    let visiblePixelCount = 0;
    for (let sy = minY; sy <= maxY && visiblePixelCount < minVisiblePixels; sy++) {
      for (let sx = minX; sx <= maxX; sx++) {
        const alphaIndex = ((sy * input.alphaMap.width + sx) << 2) + 3;
        if ((input.alphaMap.data[alphaIndex] | 0) < threshold) continue;
        const pLocal = {
          x: sx + 0.5 - input.workOffsetSpriteLocal.x,
          y: sy + 0.5 - input.workOffsetSpriteLocal.y,
        };
        if (pointInTriangle(pLocal, tri.a, tri.b, tri.c)) {
          visiblePixelCount++;
          if (visiblePixelCount >= minVisiblePixels) break;
        }
      }
    }

    const kept = visiblePixelCount >= minVisiblePixels;
    if (kept) out.push(tri);
    samples.push({
      triangle: tri,
      visiblePixelCount,
      kept,
    });
  }

  return {
    keptTriangles: out,
    samples,
    minVisiblePixels,
    alphaThreshold: threshold,
  };
}
