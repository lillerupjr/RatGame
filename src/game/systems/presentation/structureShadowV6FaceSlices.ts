export type StructureV6SemanticBucket = "TOP" | "EAST_WEST" | "SOUTH_NORTH";

export const STRUCTURE_SHADOW_V6_DEFAULT_SLICE_COUNT = 8;
export const STRUCTURE_SHADOW_V6_MIN_SLICE_COUNT = 1;
export const STRUCTURE_SHADOW_V6_MAX_SLICE_COUNT = 32;
export const STRUCTURE_SHADOW_V6_DEFAULT_STRUCTURE_INDEX = 0;
export const STRUCTURE_SHADOW_V6_MAX_STRUCTURE_INDEX = 127;

export type StructureV6FaceSlice = {
  index: number;
  tStart: number;
  tEnd: number;
};

export type StructureV6SliceAxis = {
  sliceDir: { x: number; y: number };
  sliceNormal: { x: number; y: number };
  minT: number;
  maxT: number;
};

const EAST_WEST_SLICE_DIR = normalize({ x: 1, y: -0.5 });
const SOUTH_NORTH_SLICE_DIR = normalize({ x: 1, y: 0.5 });

function normalize(v: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(v.x, v.y);
  if (!(len > 1e-6)) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function dot(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return a.x * b.x + a.y * b.y;
}

function perpendicular(v: { x: number; y: number }): { x: number; y: number } {
  // Clockwise perpendicular keeps baseline (larger +y) on lower t for stable baseline->top ordering.
  return { x: v.y, y: -v.x };
}

export function normalizeStructureV6SemanticBucket(value: unknown): StructureV6SemanticBucket {
  if (value === "TOP") return "TOP";
  if (value === "EAST_WEST") return "EAST_WEST";
  if (value === "SOUTH_NORTH") return "SOUTH_NORTH";
  return "EAST_WEST";
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

export function clampStructureV6SliceCount(value: unknown): number {
  return clampInt(
    value,
    STRUCTURE_SHADOW_V6_DEFAULT_SLICE_COUNT,
    STRUCTURE_SHADOW_V6_MIN_SLICE_COUNT,
    STRUCTURE_SHADOW_V6_MAX_SLICE_COUNT,
  );
}

export function clampStructureV6StructureIndex(value: unknown): number {
  return clampInt(
    value,
    STRUCTURE_SHADOW_V6_DEFAULT_STRUCTURE_INDEX,
    0,
    STRUCTURE_SHADOW_V6_MAX_STRUCTURE_INDEX,
  );
}

export function resolveStructureV6SliceDirection(
  semanticBucket: StructureV6SemanticBucket,
): { x: number; y: number } {
  if (semanticBucket === "SOUTH_NORTH") return SOUTH_NORTH_SLICE_DIR;
  // TOP falls back to EAST_WEST in this debug milestone.
  return EAST_WEST_SLICE_DIR;
}

export function buildStructureV6SliceAxis(
  faceWidth: number,
  faceHeight: number,
  semanticBucket: StructureV6SemanticBucket,
): StructureV6SliceAxis {
  const width = Math.max(1, Math.ceil(faceWidth));
  const height = Math.max(1, Math.ceil(faceHeight));
  const sliceDir = resolveStructureV6SliceDirection(semanticBucket);
  const sliceNormal = perpendicular(sliceDir);
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  let minT = Number.POSITIVE_INFINITY;
  let maxT = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < corners.length; i++) {
    const t = dot(corners[i], sliceNormal);
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }
  if (!Number.isFinite(minT) || !Number.isFinite(maxT)) {
    minT = 0;
    maxT = 1;
  }
  if (Math.abs(maxT - minT) < 1e-6) {
    maxT = minT + 1;
  }
  return {
    sliceDir,
    sliceNormal,
    minT,
    maxT,
  };
}

export function resolveStructureV6SelectedCandidateIndex(
  candidateCount: number,
  requestedIndex: number,
): number {
  const count = Math.max(0, Math.floor(candidateCount));
  if (count <= 0) return -1;
  const normalized = Number.isFinite(requestedIndex)
    ? Math.floor(requestedIndex)
    : STRUCTURE_SHADOW_V6_DEFAULT_STRUCTURE_INDEX;
  const wrapped = normalized % count;
  return wrapped < 0 ? wrapped + count : wrapped;
}

export function buildStructureV6FaceSlices(
  axis: StructureV6SliceAxis,
  requestedSliceCount: number,
): StructureV6FaceSlice[] {
  const numericSliceCount = Number(requestedSliceCount);
  const sliceCount = Number.isFinite(numericSliceCount)
    ? Math.max(1, Math.floor(numericSliceCount))
    : STRUCTURE_SHADOW_V6_DEFAULT_SLICE_COUNT;
  const minT = axis.minT;
  const maxT = axis.maxT;
  const rangeT = Math.max(1e-6, maxT - minT);

  const slices: StructureV6FaceSlice[] = [];
  for (let i = 0; i < sliceCount; i++) {
    const tStart = minT + (i / sliceCount) * rangeT;
    const tEnd = i === sliceCount - 1
      ? maxT
      : (minT + ((i + 1) / sliceCount) * rangeT);
    slices.push({
      index: i,
      tStart,
      tEnd,
    });
  }
  return slices;
}

export function resolveStructureV6SliceIndex(
  x: number,
  y: number,
  axis: StructureV6SliceAxis,
  sliceCount: number,
): number {
  const safeCount = Math.max(1, Math.floor(sliceCount));
  const t = dot({ x, y }, axis.sliceNormal);
  const rangeT = axis.maxT - axis.minT;
  if (!(rangeT > 1e-6)) return 0;
  const normalized = (t - axis.minT) / rangeT;
  const rawIndex = Math.floor(normalized * safeCount);
  if (rawIndex < 0) return 0;
  if (rawIndex >= safeCount) return safeCount - 1;
  return rawIndex;
}
