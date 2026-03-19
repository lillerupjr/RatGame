import {
  triangulateRuntimeSliceBandQuad,
  type RuntimeSliceBandDiagonal,
  type RuntimeStructureTriangleRect,
} from "./runtimeStructureTriangles";
import type { StructureShadowPoint } from "./structureShadowV1";

export type Point = StructureShadowPoint;

export type SliceCorrespondence = {
  sliceIndex: number;
  baseSegment: { a: Point; b: Point };
  topSegment: { a: Point; b: Point };
};

export type SliceStrip = {
  sliceIndex: number;
  baseA: Point;
  baseB: Point;
  topA: Point;
  topB: Point;
};

export type SliceLayerEdge = {
  sliceIndex: number;
  layerIndex: number;
  a: Point;
  b: Point;
  heightPx: number;
};

export type SliceLayerBand = {
  sliceIndex: number;
  bandIndex: number;
  lowerA: Point;
  lowerB: Point;
  upperA: Point;
  upperB: Point;
};

export type SliceBandTrianglePair = {
  sliceIndex: number;
  bandIndex: number;
  tri0: [Point, Point, Point];
  tri1: [Point, Point, Point];
  diagonal: RuntimeSliceBandDiagonal;
};

export type DestinationShadowTriangle = {
  sliceIndex: number;
  bandIndex: number;
  triangleIndex: 0 | 1;
  points: [Point, Point, Point];
};

export type SliceStripMidpointDiagnostic = {
  sliceIndex: number;
  baseMidpoint: Point;
  topMidpoint: Point;
  delta: Point;
};

export type StructureShadowV4CacheEntry = {
  structureInstanceId: string;
  geometrySignature: string;
  sunStepKey: string;
  castHeightPx: number;
  roofHeightPx: number;
  sunDirection: { x: number; y: number };
  correspondences: SliceCorrespondence[];
  sliceStrips: SliceStrip[];
  layerHeightsPx: number[];
  layerEdges: SliceLayerEdge[];
  layerBands: SliceLayerBand[];
  destinationBandTriangles: SliceBandTrianglePair[];
  destinationTriangles: DestinationShadowTriangle[];
  midpointDiagnostics: SliceStripMidpointDiagnostic[];
  deltaReference: Point | null;
  isDeltaConstant: boolean;
  projectedBounds: RuntimeStructureTriangleRect | null;
};

export type BuildStructureShadowV4CacheEntryInput = {
  structureInstanceId: string;
  geometrySignature: string;
  sunStepKey: string;
  castHeightPx: number;
  sunDirection: { x: number; y: number };
  sliceCorrespondence: readonly SliceCorrespondence[];
  sliceOwnerParity?: ReadonlyMap<number, 0 | 1>;
};

export type StructureShadowV4ContextKeyInput = {
  mapId: string;
  enabled: boolean;
  sunStepKey: string;
};

export const SHADOW_LAYER_STEP_PX = 64;

function clonePoint(p: Point): Point {
  return { x: p.x, y: p.y };
}

function cloneTriangle(tri: readonly [Point, Point, Point]): [Point, Point, Point] {
  return [
    clonePoint(tri[0]),
    clonePoint(tri[1]),
    clonePoint(tri[2]),
  ];
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
  };
}

function buildLayerHeights(roofHeightPx: number): number[] {
  if (roofHeightPx <= 0) return [0];
  const heights: number[] = [0];
  for (let h = SHADOW_LAYER_STEP_PX; h < roofHeightPx; h += SHADOW_LAYER_STEP_PX) {
    heights.push(h);
  }
  if (heights[heights.length - 1] !== roofHeightPx) heights.push(roofHeightPx);
  return heights;
}

function buildSliceLayerEdges(
  strip: SliceStrip,
  layerHeightsPx: readonly number[],
  roofHeightPx: number,
): SliceLayerEdge[] {
  const out: SliceLayerEdge[] = [];
  for (let li = 0; li < layerHeightsPx.length; li++) {
    const h = layerHeightsPx[li];
    const t = roofHeightPx > 0 ? (h / roofHeightPx) : 0;
    out.push({
      sliceIndex: strip.sliceIndex,
      layerIndex: li,
      a: lerpPoint(strip.baseA, strip.topA, t),
      b: lerpPoint(strip.baseB, strip.topB, t),
      heightPx: h,
    });
  }
  return out;
}

function buildSliceLayerBands(edges: readonly SliceLayerEdge[]): SliceLayerBand[] {
  const out: SliceLayerBand[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const lower = edges[i];
    const upper = edges[i + 1];
    out.push({
      sliceIndex: lower.sliceIndex,
      bandIndex: i,
      lowerA: clonePoint(lower.a),
      lowerB: clonePoint(lower.b),
      upperA: clonePoint(upper.a),
      upperB: clonePoint(upper.b),
    });
  }
  return out;
}

function triangulateLayerBands(
  layerBands: readonly SliceLayerBand[],
  sliceOwnerParity?: ReadonlyMap<number, 0 | 1>,
): { pairs: SliceBandTrianglePair[]; triangles: DestinationShadowTriangle[] } {
  const pairs: SliceBandTrianglePair[] = [];
  const triangles: DestinationShadowTriangle[] = [];
  for (let i = 0; i < layerBands.length; i++) {
    const band = layerBands[i];
    const ownerParity = sliceOwnerParity?.get(band.sliceIndex) ?? 0;
    const triangulated = triangulateRuntimeSliceBandQuad(
      {
        lowerA: band.lowerA,
        lowerB: band.lowerB,
        upperA: band.upperA,
        upperB: band.upperB,
      },
      ownerParity,
      band.bandIndex,
    );
    const tri0 = cloneTriangle(triangulated.tri0);
    const tri1 = cloneTriangle(triangulated.tri1);
    pairs.push({
      sliceIndex: band.sliceIndex,
      bandIndex: band.bandIndex,
      tri0,
      tri1,
      diagonal: triangulated.diagonal,
    });
    triangles.push(
      {
        sliceIndex: band.sliceIndex,
        bandIndex: band.bandIndex,
        triangleIndex: 0,
        points: cloneTriangle(tri0),
      },
      {
        sliceIndex: band.sliceIndex,
        bandIndex: band.bandIndex,
        triangleIndex: 1,
        points: cloneTriangle(tri1),
      },
    );
  }
  return { pairs, triangles };
}

function buildBoundsFromStrips(strips: readonly SliceStrip[]): RuntimeStructureTriangleRect | null {
  if (strips.length <= 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < strips.length; i++) {
    const strip = strips[i];
    const points = [strip.baseA, strip.baseB, strip.topA, strip.topB];
    for (let p = 0; p < points.length; p++) {
      const point = points[p];
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

function isConstantDelta(
  diagnostics: readonly SliceStripMidpointDiagnostic[],
  epsilon: number = 1e-3,
): { reference: Point | null; constant: boolean } {
  if (diagnostics.length <= 0) return { reference: null, constant: true };
  const reference = diagnostics[0].delta;
  for (let i = 1; i < diagnostics.length; i++) {
    const delta = diagnostics[i].delta;
    if (Math.abs(delta.x - reference.x) > epsilon || Math.abs(delta.y - reference.y) > epsilon) {
      return { reference: clonePoint(reference), constant: false };
    }
  }
  return { reference: clonePoint(reference), constant: true };
}

// IMPORTANT: V4 contract projection. Keep formula exactly aligned with contract text.
export function projectToGround(
  p: Point,
  sunDir: { x: number; y: number },
  castHeightPx: number,
): Point {
  return {
    x: p.x + sunDir.x * castHeightPx,
    y: p.y + castHeightPx + sunDir.y * castHeightPx,
  };
}

export function buildStructureShadowV4CacheEntry(
  input: BuildStructureShadowV4CacheEntryInput,
): StructureShadowV4CacheEntry {
  const castHeightPx = Math.max(0, input.castHeightPx);
  const roofHeightPx = castHeightPx;
  const correspondences = input.sliceCorrespondence.map((corr) => ({
    sliceIndex: corr.sliceIndex,
    baseSegment: {
      a: clonePoint(corr.baseSegment.a),
      b: clonePoint(corr.baseSegment.b),
    },
    topSegment: {
      a: clonePoint(corr.topSegment.a),
      b: clonePoint(corr.topSegment.b),
    },
  }));

  // Preserve incoming correspondence order; do not reorder by slice index.
  const sliceStrips: SliceStrip[] = correspondences.map((corr) => ({
    sliceIndex: corr.sliceIndex,
    baseA: clonePoint(corr.baseSegment.a),
    baseB: clonePoint(corr.baseSegment.b),
    topA: projectToGround(corr.topSegment.a, input.sunDirection, castHeightPx),
    topB: projectToGround(corr.topSegment.b, input.sunDirection, castHeightPx),
  }));

  const layerHeightsPx = buildLayerHeights(roofHeightPx);
  const layerEdges: SliceLayerEdge[] = [];
  const layerBands: SliceLayerBand[] = [];
  for (let si = 0; si < sliceStrips.length; si++) {
    const stripLayerEdges = buildSliceLayerEdges(sliceStrips[si], layerHeightsPx, roofHeightPx);
    layerEdges.push(...stripLayerEdges);
    layerBands.push(...buildSliceLayerBands(stripLayerEdges));
  }
  const triangulation = triangulateLayerBands(layerBands, input.sliceOwnerParity);

  const midpointDiagnostics: SliceStripMidpointDiagnostic[] = sliceStrips.map((strip) => {
    const baseMidpoint = midpoint(strip.baseA, strip.baseB);
    const topMidpoint = midpoint(strip.topA, strip.topB);
    return {
      sliceIndex: strip.sliceIndex,
      baseMidpoint,
      topMidpoint,
      delta: {
        x: topMidpoint.x - baseMidpoint.x,
        y: topMidpoint.y - baseMidpoint.y,
      },
    };
  });

  const deltaCheck = isConstantDelta(midpointDiagnostics);
  return {
    structureInstanceId: input.structureInstanceId,
    geometrySignature: input.geometrySignature,
    sunStepKey: input.sunStepKey,
    castHeightPx,
    roofHeightPx,
    sunDirection: {
      x: Number(input.sunDirection.x) || 0,
      y: Number(input.sunDirection.y) || 0,
    },
    correspondences,
    sliceStrips,
    layerHeightsPx,
    layerEdges,
    layerBands,
    destinationBandTriangles: triangulation.pairs,
    destinationTriangles: triangulation.triangles,
    midpointDiagnostics,
    deltaReference: deltaCheck.reference,
    isDeltaConstant: deltaCheck.constant,
    projectedBounds: buildBoundsFromStrips(sliceStrips),
  };
}

export function buildStructureShadowV4ContextKey(
  input: StructureShadowV4ContextKeyInput,
): string {
  return [
    "mode:v4SliceStrips",
    `map:${input.mapId}`,
    `enabled:${input.enabled ? 1 : 0}`,
    `sun:${input.sunStepKey}`,
  ].join("||");
}

export class StructureShadowV4CacheStore {
  private contextKey = "";
  private readonly entries = new Map<string, StructureShadowV4CacheEntry>();

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
  ): StructureShadowV4CacheEntry | undefined {
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

  set(entry: StructureShadowV4CacheEntry): void {
    this.entries.set(entry.structureInstanceId, entry);
  }
}
