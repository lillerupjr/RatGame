import type { StampOverlay } from "../../map/compile/kenneyMap";
import type {
  RuntimeStructureTriangleCache,
  RuntimeStructureTrianglePiece,
  RuntimeStructureTriangleRect,
} from "./runtimeStructureTriangles";
import { resolveRuntimeStructureBandProgressionIndex } from "./runtimeStructureTriangles";
import {
  buildStructureShadowCacheEntry,
  STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
  type StructureShadowProjectedEdge,
  type StructureShadowPoint,
  type StructureShadowProjectedQuad,
  type StructureShadowProjectedTriangle,
  type StructureShadowRoofScan,
} from "./structureShadowV1";

export type StructureHybridShadowProjectedTriangle = {
  stableId: number;
  bandIndex: number;
  sourceTriangle: StructureShadowProjectedTriangle;
  srcTriangle: StructureShadowProjectedTriangle;
  projectedTriangle: StructureShadowProjectedTriangle;
};

export type StructureHybridShadowSliceStrip = {
  bandIndex: number;
  sourceBaseEdge: StructureShadowProjectedEdge;
  projectedTopEdge: StructureShadowProjectedEdge;
  projectedStepEdges: StructureShadowProjectedEdge[];
};

export type StructureHybridShadowSlicePerimeterSegment = {
  sliceIndex: number;
  bandIndex: number;
  baseSegment: StructureShadowProjectedEdge;
  topSegment: StructureShadowProjectedEdge;
};

export type StructureShadowHybridCacheEntry = {
  structureInstanceId: string;
  geometrySignature: string;
  sunStepKey: string;
  sunForward: { x: number; y: number; z: number };
  sideSemantic: "LEFT_SOUTH" | "RIGHT_EAST" | "NONE";
  sourceTriangleCount: number;
  castHeightPx: number;
  roofScan: StructureShadowRoofScan;
  casterTriangleCount: number;
  topCasterTriangleCount: number;
  sideCasterTriangleCount: number;
  casterTriangles: StructureShadowProjectedTriangle[];
  slicePerimeterSegments: StructureHybridShadowSlicePerimeterSegment[];
  projectedTopCapTriangles: StructureShadowProjectedTriangle[];
  sliceShadowStrips: StructureHybridShadowSliceStrip[];
  projectedTriangles: StructureShadowProjectedTriangle[];
  projectedMappings: StructureHybridShadowProjectedTriangle[];
  projectedBounds: RuntimeStructureTriangleRect | null;
};

export type BuildStructureShadowHybridCacheEntryInput = {
  overlay: StampOverlay;
  triangleCache: RuntimeStructureTriangleCache;
  geometrySignature: string;
  tileWorld: number;
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => StructureShadowPoint;
  sunForward: { x: number; y: number; z: number };
  sunProjectionDirection: { x: number; y: number };
  sunStepKey: string;
  roofScanStepPx?: number;
};

export type StructureShadowHybridContextKeyInput = {
  mapId: string;
  enabled: boolean;
  sunStepKey: string;
  roofScanStepPx: number;
};

function clampToPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

function clonePoint(point: StructureShadowPoint): StructureShadowPoint {
  return { x: point.x, y: point.y };
}

function pointInTriangle(
  p: StructureShadowPoint,
  a: StructureShadowPoint,
  b: StructureShadowPoint,
  c: StructureShadowPoint,
): boolean {
  const ab = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const bc = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const ca = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const hasNeg = ab < 0 || bc < 0 || ca < 0;
  const hasPos = ab > 0 || bc > 0 || ca > 0;
  return !(hasNeg && hasPos);
}

function isPointInsideQuad(
  quad: StructureShadowProjectedQuad,
  x: number,
  y: number,
): boolean {
  const p = { x, y };
  return pointInTriangle(p, quad[0], quad[1], quad[2]) || pointInTriangle(p, quad[0], quad[2], quad[3]);
}

function cloneTriangle(
  triangle: readonly [StructureShadowPoint, StructureShadowPoint, StructureShadowPoint],
): StructureShadowProjectedTriangle {
  const [a, b, c] = triangle;
  return [clonePoint(a), clonePoint(b), clonePoint(c)];
}

function cloneEdge(edge: readonly [StructureShadowPoint, StructureShadowPoint]): StructureShadowProjectedEdge {
  return [clonePoint(edge[0]), clonePoint(edge[1])];
}

function lerpPoint(a: StructureShadowPoint, b: StructureShadowPoint, t: number): StructureShadowPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function buildPerimeterSegmentsForSliceOrder(
  quad: StructureShadowProjectedQuad,
  footprintW: number,
  footprintH: number,
): StructureShadowProjectedEdge[] {
  const safeW = Math.max(1, footprintW | 0);
  const safeH = Math.max(1, footprintH | 0);
  const ne = quad[1];
  const se = quad[2];
  const sw = quad[3];
  const out: StructureShadowProjectedEdge[] = [];
  // Runtime ownership order uses an open perimeter walk: SW -> SE (W segments), then SE -> NE (H segments).
  for (let i = 0; i < safeW; i++) {
    const t0 = i / safeW;
    const t1 = (i + 1) / safeW;
    out.push([
      lerpPoint(sw, se, t0),
      lerpPoint(sw, se, t1),
    ]);
  }
  for (let i = 0; i < safeH; i++) {
    const t0 = i / safeH;
    const t1 = (i + 1) / safeH;
    out.push([
      lerpPoint(se, ne, t0),
      lerpPoint(se, ne, t1),
    ]);
  }
  return out;
}

function buildSlicePerimeterCorrespondence(
  baseFootprintQuad: StructureShadowProjectedQuad,
  topQuad: StructureShadowProjectedQuad,
  footprintW: number,
  footprintH: number,
): StructureHybridShadowSlicePerimeterSegment[] {
  const baseSegments = buildPerimeterSegmentsForSliceOrder(baseFootprintQuad, footprintW, footprintH);
  const topSegments = buildPerimeterSegmentsForSliceOrder(topQuad, footprintW, footprintH);
  const count = Math.min(baseSegments.length, topSegments.length);
  const out: StructureHybridShadowSlicePerimeterSegment[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      sliceIndex: i,
      bandIndex: i + 1,
      baseSegment: cloneEdge(baseSegments[i]),
      topSegment: cloneEdge(topSegments[i]),
    });
  }
  return out;
}

function buildProjectedBounds(
  triangles: readonly StructureShadowProjectedTriangle[],
): RuntimeStructureTriangleRect | null {
  if (triangles.length <= 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    for (let p = 0; p < tri.length; p++) {
      const point = tri[p];
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
  };
}

type HybridSliceBand = {
  bandIndex: number;
  triangles: RuntimeStructureTrianglePiece[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function buildHybridSliceBands(
  triangles: readonly RuntimeStructureTrianglePiece[],
): HybridSliceBand[] {
  const byBand = new Map<number, HybridSliceBand>();
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    const rect = tri.dstRectLocal;
    const x0 = rect.x;
    const y0 = rect.y;
    const x1 = rect.x + rect.w;
    const y1 = rect.y + rect.h;
    let band = byBand.get(tri.bandIndex);
    if (!band) {
      band = {
        bandIndex: tri.bandIndex,
        triangles: [],
        minX: x0,
        minY: y0,
        maxX: x1,
        maxY: y1,
      };
      byBand.set(tri.bandIndex, band);
    }
    band.triangles.push(tri);
    if (x0 < band.minX) band.minX = x0;
    if (y0 < band.minY) band.minY = y0;
    if (x1 > band.maxX) band.maxX = x1;
    if (y1 > band.maxY) band.maxY = y1;
  }
  const out = Array.from(byBand.values());
  out.sort((a, b) => a.bandIndex - b.bandIndex);
  for (let i = 0; i < out.length; i++) {
    out[i].triangles.sort((a, b) => a.stableId - b.stableId);
  }
  return out;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function quantizeHeightToStep(
  heightAboveBase: number,
  stepPx: number,
  maxCastHeightPx: number,
): number {
  const clampedHeight = clamp(heightAboveBase, 0, maxCastHeightPx);
  if (maxCastHeightPx <= 0) return 0;
  const q = Math.round(clampedHeight / stepPx) * stepPx;
  return clamp(q, 0, maxCastHeightPx);
}

export type HybridSemanticClass = "TOP" | "LEFT_SOUTH" | "RIGHT_EAST" | "UNCLASSIFIED" | "CONFLICT";
export type HybridSemanticMaskBucket = "TOP" | "EAST_WEST" | "SOUTH_NORTH";

type HybridSemanticContext = {
  activeRoofQuad: StructureShadowProjectedQuad | null;
  leftSouthMaxProgression: number;
  rightEastMinProgression: number;
  progressionByOwnerTile: Map<string, { min: number; max: number }>;
};

function buildHybridSemanticContext(
  overlay: StampOverlay,
  triangleCache: RuntimeStructureTriangleCache,
  activeRoofQuad: StructureShadowProjectedQuad | null,
): HybridSemanticContext {
  const footprintW = Math.max(1, overlay.w | 0);
  const footprintH = Math.max(1, overlay.h | 0);
  const leftSouthMaxProgression = footprintW - 1;
  const rightEastMinProgression = footprintW;
  const progressionByOwnerTile = new Map<string, { min: number; max: number }>();
  for (let i = 0; i < triangleCache.triangles.length; i++) {
    const tri = triangleCache.triangles[i];
    const ownerKey = `${tri.parentTx},${tri.parentTy}`;
    const progression = resolveRuntimeStructureBandProgressionIndex(tri.bandIndex, footprintW, footprintH);
    const existing = progressionByOwnerTile.get(ownerKey);
    if (!existing) {
      progressionByOwnerTile.set(ownerKey, { min: progression, max: progression });
    } else {
      if (progression < existing.min) existing.min = progression;
      if (progression > existing.max) existing.max = progression;
    }
  }
  return {
    activeRoofQuad,
    leftSouthMaxProgression,
    rightEastMinProgression,
    progressionByOwnerTile,
  };
}

function classifyHybridTriangleSemantic(
  tri: RuntimeStructureTrianglePiece,
  context: HybridSemanticContext,
): HybridSemanticClass {
  const [a, b, c] = tri.points;
  const centroid = {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
  };
  const isTop = !!context.activeRoofQuad
    && isPointInsideQuad(context.activeRoofQuad, centroid.x, centroid.y);
  if (isTop) return "TOP";
  const ownerKey = `${tri.parentTx},${tri.parentTy}`;
  const ownerRange = context.progressionByOwnerTile.get(ownerKey);
  const leftCandidate = !!ownerRange && ownerRange.min <= context.leftSouthMaxProgression;
  const rightCandidate = !!ownerRange && ownerRange.max >= context.rightEastMinProgression;
  if (leftCandidate && rightCandidate) return "CONFLICT";
  if (leftCandidate) return "LEFT_SOUTH";
  if (rightCandidate) return "RIGHT_EAST";
  return "UNCLASSIFIED";
}

const TOP_MASK_BUCKETS: readonly HybridSemanticMaskBucket[] = ["TOP"];
const EAST_WEST_MASK_BUCKETS: readonly HybridSemanticMaskBucket[] = ["EAST_WEST"];
const SOUTH_NORTH_MASK_BUCKETS: readonly HybridSemanticMaskBucket[] = ["SOUTH_NORTH"];
const BOTH_SIDE_MASK_BUCKETS: readonly HybridSemanticMaskBucket[] = ["EAST_WEST", "SOUTH_NORTH"];

export function resolveHybridSemanticMaskBuckets(
  semantic: HybridSemanticClass,
): readonly HybridSemanticMaskBucket[] {
  if (semantic === "TOP") return TOP_MASK_BUCKETS;
  if (semantic === "RIGHT_EAST") return EAST_WEST_MASK_BUCKETS;
  if (semantic === "LEFT_SOUTH") return SOUTH_NORTH_MASK_BUCKETS;
  return BOTH_SIDE_MASK_BUCKETS;
}

export type BuildHybridTriangleSemanticMapInput = {
  overlay: StampOverlay;
  triangleCache: RuntimeStructureTriangleCache;
  activeRoofQuad: StructureShadowProjectedQuad | null;
  triangles?: readonly RuntimeStructureTrianglePiece[];
};

export function buildHybridTriangleSemanticMap(
  input: BuildHybridTriangleSemanticMapInput,
): Map<number, HybridSemanticClass> {
  const context = buildHybridSemanticContext(
    input.overlay,
    input.triangleCache,
    input.activeRoofQuad,
  );
  const triangles = input.triangles ?? input.triangleCache.triangles;
  const byStableId = new Map<number, HybridSemanticClass>();
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    byStableId.set(tri.stableId, classifyHybridTriangleSemantic(tri, context));
  }
  return byStableId;
}

function resolveHybridSideSemantic(
  projection: { x: number; y: number },
): "LEFT_SOUTH" | "RIGHT_EAST" | "NONE" {
  const x = Number(projection.x);
  if (!Number.isFinite(x) || Math.abs(x) < 1e-5) return "NONE";
  // Shadow projected left means sun is from right, so include right/east wall strip.
  return x < 0 ? "RIGHT_EAST" : "LEFT_SOUTH";
}

function buildHybridCasterTriangles(
  overlay: StampOverlay,
  triangleCache: RuntimeStructureTriangleCache,
  roofScan: StructureShadowRoofScan,
  projection: { x: number; y: number },
): {
  sideSemantic: "LEFT_SOUTH" | "RIGHT_EAST" | "NONE";
  topCount: number;
  sideCount: number;
  selected: RuntimeStructureTrianglePiece[];
} {
  const sideSemantic = resolveHybridSideSemantic(projection);
  const semanticContext = buildHybridSemanticContext(
    overlay,
    triangleCache,
    roofScan.activeLevel?.quad ?? null,
  );
  const selected: RuntimeStructureTrianglePiece[] = [];
  let topCount = 0;
  let sideCount = 0;
  for (let i = 0; i < triangleCache.triangles.length; i++) {
    const tri = triangleCache.triangles[i];
    const semantic = classifyHybridTriangleSemantic(tri, semanticContext);
    if (semantic === "TOP") {
      selected.push(tri);
      topCount++;
      continue;
    }
    if (sideSemantic !== "NONE" && semantic === sideSemantic) {
      selected.push(tri);
      sideCount++;
    }
  }
  return { sideSemantic, topCount, sideCount, selected };
}

export function buildStructureShadowHybridCacheEntry(
  input: BuildStructureShadowHybridCacheEntryInput,
): StructureShadowHybridCacheEntry {
  const baseShadow = buildStructureShadowCacheEntry({
    overlay: input.overlay,
    triangleCache: input.triangleCache,
    geometrySignature: input.geometrySignature,
    tileWorld: input.tileWorld,
    toScreenAtZ: input.toScreenAtZ,
    sunForward: input.sunForward,
    sunProjectionDirection: input.sunProjectionDirection,
    sunStepKey: input.sunStepKey,
    roofScanStepPx: input.roofScanStepPx,
  });

  const castHeightPx = Math.max(0, baseShadow.roofScan.activeLevel?.liftYPx ?? 0);
  const casterSelection = buildHybridCasterTriangles(
    input.overlay,
    input.triangleCache,
    baseShadow.roofScan,
    input.sunProjectionDirection,
  );
  const footprintW = Math.max(1, input.overlay.w | 0);
  const footprintH = Math.max(1, input.overlay.h | 0);
  const baseFootprintQuad = baseShadow.roofScan.levels[0]?.quad ?? null;
  const topFaceQuad = baseShadow.roofScan.activeLevel?.quad ?? baseFootprintQuad;
  const slicePerimeterSegments = baseFootprintQuad && topFaceQuad
    ? buildSlicePerimeterCorrespondence(baseFootprintQuad, topFaceQuad, footprintW, footprintH)
    : [];
  // Isolated correspondence pass: do not reconstruct strip/triangle warp geometry in this step.
  const sliceShadowStrips: StructureHybridShadowSliceStrip[] = [];
  const projectedMappings: StructureHybridShadowProjectedTriangle[] = [];
  const projectedTriangles: StructureShadowProjectedTriangle[] = [];
  const casterTriangles: StructureShadowProjectedTriangle[] = casterSelection.selected.map((tri) => cloneTriangle(tri.points));
  const projectedTopCapTriangles = baseShadow.projectedTriangles.map((tri) => cloneTriangle(tri));
  const boundsTriangles = projectedTopCapTriangles.slice();

  return {
    structureInstanceId: input.overlay.id,
    geometrySignature: input.geometrySignature,
    sunStepKey: input.sunStepKey,
    sunForward: {
      x: input.sunForward.x,
      y: input.sunForward.y,
      z: input.sunForward.z,
    },
    sideSemantic: casterSelection.sideSemantic,
    sourceTriangleCount: input.triangleCache.triangles.length,
    castHeightPx,
    roofScan: baseShadow.roofScan,
    casterTriangleCount: casterTriangles.length,
    topCasterTriangleCount: casterSelection.topCount,
    sideCasterTriangleCount: casterSelection.sideCount,
    casterTriangles,
    slicePerimeterSegments,
    projectedTopCapTriangles,
    sliceShadowStrips,
    projectedTriangles,
    projectedMappings,
    projectedBounds: buildProjectedBounds(boundsTriangles),
  };
}

export function buildStructureShadowHybridContextKey(
  input: StructureShadowHybridContextKeyInput,
): string {
  return [
    "mode:v3HybridTriangles",
    `map:${input.mapId}`,
    `enabled:${input.enabled ? 1 : 0}`,
    `sun:${input.sunStepKey}`,
    `scanStep:${clampToPositiveInt(input.roofScanStepPx, STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX)}`,
  ].join("||");
}

export class StructureShadowHybridCacheStore {
  private contextKey = "";
  private readonly entries = new Map<string, StructureShadowHybridCacheEntry>();

  resetIfContextChanged(nextContextKey: string): boolean {
    if (nextContextKey === this.contextKey) return false;
    this.contextKey = nextContextKey;
    this.entries.clear();
    return true;
  }

  clear(): void {
    this.entries.clear();
  }

  getContextKey(): string {
    return this.contextKey;
  }

  get(
    structureInstanceId: string,
    expectedGeometrySignature?: string,
    expectedSunStepKey?: string,
  ): StructureShadowHybridCacheEntry | undefined {
    const cached = this.entries.get(structureInstanceId);
    if (!cached) return undefined;
    if (expectedGeometrySignature && cached.geometrySignature !== expectedGeometrySignature) {
      this.entries.delete(structureInstanceId);
      return undefined;
    }
    if (expectedSunStepKey && cached.sunStepKey !== expectedSunStepKey) {
      this.entries.delete(structureInstanceId);
      return undefined;
    }
    return cached;
  }

  set(entry: StructureShadowHybridCacheEntry): void {
    this.entries.set(entry.structureInstanceId, entry);
  }
}
