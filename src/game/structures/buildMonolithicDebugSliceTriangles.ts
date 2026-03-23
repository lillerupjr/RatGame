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

const LADDER_STEP_PX = 64;
const LADDER_STAGGER_PX = 32;

function positiveMod(n: number, m: number): number {
  const mm = Math.max(1, m | 0);
  const r = n % mm;
  return r < 0 ? r + mm : r;
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
  sliceIndex: number,
): MonolithicSliceEdgePoint[] {
  const x0 = slice.x;
  const x1 = slice.x + slice.width;
  const y0 = 0;
  const y1 = slice.height;
  if (!(x1 > x0) || !(y1 > y0)) return [];

  const step = LADDER_STEP_PX;
  const stagger = LADDER_STAGGER_PX;
  const rightPhase = (sliceIndex & 1) === 0 ? 0 : stagger;
  const leftPhase = positiveMod(rightPhase - stagger, step);

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
  sliceIndex: number,
): MonolithicSliceGeometry {
  const edgePoints = buildMonolithicSliceEdgePoints(slice, sliceIndex);
  const stripPoints = buildMonolithicSliceZigZagStrip(edgePoints);
  const triangles = emitMonolithicSliceTriangles(stripPoints);
  return {
    edgePoints,
    stripPoints,
    triangles,
  };
}
