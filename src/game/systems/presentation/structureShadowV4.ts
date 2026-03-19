import {
  triangulateRuntimeSliceBandQuad,
  type RuntimeStructureTrianglePiece,
  type RuntimeSliceBandDiagonal,
  type RuntimeStructureTriangleRect,
} from "./runtimeStructureTriangles";
import type {
  StructureShadowPoint,
  StructureShadowProjectedTriangle,
} from "./structureShadowV1";

export type Point = StructureShadowPoint;

export type SliceCorrespondence = {
  sliceIndex: number;
  sourceBandIndex?: number;
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

export type SourceBandTriangle = {
  structureInstanceId: string;
  sliceIndex: number;
  sourceBandIndex: number;
  bandIndex: number;
  sourceTriangleStableId: number | string;
  sourceTriangleIndexWithinBand: number;
  sourceTrianglePoints: [Point, Point, Point];
  sourceSrcPoints?: [Point, Point, Point];
};

export type DestinationBandTriangle = {
  sliceIndex: number;
  bandIndex: number;
  destinationTriangleIndex: 0 | 1;
  destinationTrianglePoints: [Point, Point, Point];
};

export type ShadowTriangleCorrespondence = {
  structureInstanceId: string;
  sliceIndex: number;
  bandIndex: number;
  sourceTriangleStableId: number | string;
  sourceTriangleIndexWithinBand: number;
  destinationTriangleIndex: 0 | 1;
  destinationTrianglePoints: [Point, Point, Point];
  sourceTrianglePoints: [Point, Point, Point];
  sourceSrcPoints?: [Point, Point, Point];
};

export type ShadowTriangleCorrespondenceMismatch = {
  structureInstanceId: string;
  sliceIndex: number;
  bandIndex: number;
  sourceTriangleCount: number;
  destinationTriangleCount: number;
  reason: "COUNT_MISMATCH";
};

export type ShadowTriangleCorrespondenceGroup = {
  structureInstanceId: string;
  sliceIndex: number;
  bandIndex: number;
  sourceTriangles: SourceBandTriangle[];
  destinationTriangles: DestinationBandTriangle[];
  correspondences: ShadowTriangleCorrespondence[];
  mismatch: ShadowTriangleCorrespondenceMismatch | null;
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
  topCapTriangles: StructureShadowProjectedTriangle[];
  sourceBandTriangles: SourceBandTriangle[];
  destinationBandEntries: DestinationBandTriangle[];
  triangleCorrespondence: ShadowTriangleCorrespondence[];
  triangleCorrespondenceGroups: ShadowTriangleCorrespondenceGroup[];
  triangleCorrespondenceMismatches: ShadowTriangleCorrespondenceMismatch[];
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
  topCapTriangles?: readonly StructureShadowProjectedTriangle[];
  sourceTriangles?: readonly RuntimeStructureTrianglePiece[];
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

function buildSliceOrderIndex(correspondences: readonly SliceCorrespondence[]): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 0; i < correspondences.length; i++) {
    const sliceIndex = correspondences[i].sliceIndex | 0;
    if (!out.has(sliceIndex)) out.set(sliceIndex, i);
  }
  return out;
}

function sliceBandKey(sliceIndex: number, bandIndex: number): string {
  return `${sliceIndex}:${bandIndex}`;
}

function sortSliceBandKeys(
  keys: readonly string[],
  sliceOrder: ReadonlyMap<number, number>,
): string[] {
  const toPair = (key: string): { sliceIndex: number; bandIndex: number } => {
    const sep = key.indexOf(":");
    const sliceIndex = sep >= 0 ? Number(key.slice(0, sep)) : 0;
    const bandIndex = sep >= 0 ? Number(key.slice(sep + 1)) : 0;
    return {
      sliceIndex: Number.isFinite(sliceIndex) ? sliceIndex : 0,
      bandIndex: Number.isFinite(bandIndex) ? bandIndex : 0,
    };
  };
  return keys.slice().sort((a, b) => {
    const pa = toPair(a);
    const pb = toPair(b);
    const sa = sliceOrder.get(pa.sliceIndex) ?? Number.MAX_SAFE_INTEGER;
    const sb = sliceOrder.get(pb.sliceIndex) ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    if (pa.sliceIndex !== pb.sliceIndex) return pa.sliceIndex - pb.sliceIndex;
    return pa.bandIndex - pb.bandIndex;
  });
}

function buildSourceBandTriangles(
  structureInstanceId: string,
  correspondences: readonly SliceCorrespondence[],
  sourceTriangles: readonly RuntimeStructureTrianglePiece[] | undefined,
): SourceBandTriangle[] {
  if (!sourceTriangles || sourceTriangles.length <= 0) return [];
  const byRuntimeBand = new Map<number, RuntimeStructureTrianglePiece[]>();
  for (let i = 0; i < sourceTriangles.length; i++) {
    const tri = sourceTriangles[i];
    const runtimeBandIndex = tri.bandIndex | 0;
    let bucket = byRuntimeBand.get(runtimeBandIndex);
    if (!bucket) {
      bucket = [];
      byRuntimeBand.set(runtimeBandIndex, bucket);
    }
    bucket.push(tri);
  }

  const out: SourceBandTriangle[] = [];
  for (let ci = 0; ci < correspondences.length; ci++) {
    const corr = correspondences[ci];
    const sourceBandIndex = Number.isFinite(corr.sourceBandIndex as number)
      ? (corr.sourceBandIndex as number)
      : (corr.sliceIndex + 1);
    const sourceBandTriangles = byRuntimeBand.get(sourceBandIndex) ?? [];
    for (let ti = 0; ti < sourceBandTriangles.length; ti++) {
      const sourceTri = sourceBandTriangles[ti];
      const bandIndex = Math.floor(ti / 2);
      const sourceTriangleIndexWithinBand = ti % 2;
      out.push({
        structureInstanceId,
        sliceIndex: corr.sliceIndex,
        sourceBandIndex,
        bandIndex,
        sourceTriangleStableId: sourceTri.stableId,
        sourceTriangleIndexWithinBand,
        sourceTrianglePoints: cloneTriangle(sourceTri.points),
        sourceSrcPoints: cloneTriangle(sourceTri.srcPoints),
      });
    }
  }
  return out;
}

function buildDestinationBandEntries(
  destinationTriangles: readonly DestinationShadowTriangle[],
): DestinationBandTriangle[] {
  const out: DestinationBandTriangle[] = [];
  for (let i = 0; i < destinationTriangles.length; i++) {
    const tri = destinationTriangles[i];
    out.push({
      sliceIndex: tri.sliceIndex,
      bandIndex: tri.bandIndex,
      destinationTriangleIndex: tri.triangleIndex,
      destinationTrianglePoints: cloneTriangle(tri.points),
    });
  }
  return out;
}

function buildTriangleCorrespondence(
  structureInstanceId: string,
  correspondences: readonly SliceCorrespondence[],
  sourceBandTriangles: readonly SourceBandTriangle[],
  destinationBandEntries: readonly DestinationBandTriangle[],
): {
  groups: ShadowTriangleCorrespondenceGroup[];
  correspondences: ShadowTriangleCorrespondence[];
  mismatches: ShadowTriangleCorrespondenceMismatch[];
} {
  const sourceBySliceBand = new Map<string, SourceBandTriangle[]>();
  const destinationBySliceBand = new Map<string, DestinationBandTriangle[]>();
  const sliceOrder = buildSliceOrderIndex(correspondences);

  for (let i = 0; i < sourceBandTriangles.length; i++) {
    const source = sourceBandTriangles[i];
    const key = sliceBandKey(source.sliceIndex, source.bandIndex);
    let bucket = sourceBySliceBand.get(key);
    if (!bucket) {
      bucket = [];
      sourceBySliceBand.set(key, bucket);
    }
    bucket.push(source);
  }
  for (let i = 0; i < destinationBandEntries.length; i++) {
    const destination = destinationBandEntries[i];
    const key = sliceBandKey(destination.sliceIndex, destination.bandIndex);
    let bucket = destinationBySliceBand.get(key);
    if (!bucket) {
      bucket = [];
      destinationBySliceBand.set(key, bucket);
    }
    bucket.push(destination);
  }

  const allKeysSet = new Set<string>();
  sourceBySliceBand.forEach((_value, key) => allKeysSet.add(key));
  destinationBySliceBand.forEach((_value, key) => allKeysSet.add(key));
  const allKeys = sortSliceBandKeys(Array.from(allKeysSet), sliceOrder);

  const groups: ShadowTriangleCorrespondenceGroup[] = [];
  const corresponded: ShadowTriangleCorrespondence[] = [];
  const mismatches: ShadowTriangleCorrespondenceMismatch[] = [];
  for (let i = 0; i < allKeys.length; i++) {
    const key = allKeys[i];
    const sep = key.indexOf(":");
    const sliceIndex = sep >= 0 ? Number(key.slice(0, sep)) : 0;
    const bandIndex = sep >= 0 ? Number(key.slice(sep + 1)) : 0;
    const sourceGroup = (sourceBySliceBand.get(key) ?? []).slice().sort((a, b) => (
      a.sourceTriangleIndexWithinBand - b.sourceTriangleIndexWithinBand
    ));
    const destinationGroup = (destinationBySliceBand.get(key) ?? []).slice().sort((a, b) => (
      a.destinationTriangleIndex - b.destinationTriangleIndex
    ));

    let mismatch: ShadowTriangleCorrespondenceMismatch | null = null;
    if (sourceGroup.length !== destinationGroup.length) {
      mismatch = {
        structureInstanceId,
        sliceIndex,
        bandIndex,
        sourceTriangleCount: sourceGroup.length,
        destinationTriangleCount: destinationGroup.length,
        reason: "COUNT_MISMATCH",
      };
      mismatches.push(mismatch);
    }

    const groupCorrespondence: ShadowTriangleCorrespondence[] = [];
    if (!mismatch) {
      for (let ti = 0; ti < sourceGroup.length; ti++) {
        const source = sourceGroup[ti];
        const destination = destinationGroup[ti];
        const mapped: ShadowTriangleCorrespondence = {
          structureInstanceId,
          sliceIndex,
          bandIndex,
          sourceTriangleStableId: source.sourceTriangleStableId,
          sourceTriangleIndexWithinBand: source.sourceTriangleIndexWithinBand,
          destinationTriangleIndex: destination.destinationTriangleIndex,
          destinationTrianglePoints: cloneTriangle(destination.destinationTrianglePoints),
          sourceTrianglePoints: cloneTriangle(source.sourceTrianglePoints),
          sourceSrcPoints: source.sourceSrcPoints ? cloneTriangle(source.sourceSrcPoints) : undefined,
        };
        groupCorrespondence.push(mapped);
        corresponded.push(mapped);
      }
    }

    groups.push({
      structureInstanceId,
      sliceIndex,
      bandIndex,
      sourceTriangles: sourceGroup.map((item) => ({
        ...item,
        sourceTrianglePoints: cloneTriangle(item.sourceTrianglePoints),
        sourceSrcPoints: item.sourceSrcPoints ? cloneTriangle(item.sourceSrcPoints) : undefined,
      })),
      destinationTriangles: destinationGroup.map((item) => ({
        ...item,
        destinationTrianglePoints: cloneTriangle(item.destinationTrianglePoints),
      })),
      correspondences: groupCorrespondence,
      mismatch,
    });
  }

  return {
    groups,
    correspondences: corresponded,
    mismatches,
  };
}

function buildBoundsFromGeometry(
  strips: readonly SliceStrip[],
  topCapTriangles: readonly StructureShadowProjectedTriangle[],
): RuntimeStructureTriangleRect | null {
  if (strips.length <= 0 && topCapTriangles.length <= 0) return null;
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
  for (let i = 0; i < topCapTriangles.length; i++) {
    const tri = topCapTriangles[i];
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
    sourceBandIndex: corr.sourceBandIndex,
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
  const sourceBandTriangles = buildSourceBandTriangles(
    input.structureInstanceId,
    correspondences,
    input.sourceTriangles,
  );
  const destinationBandEntries = buildDestinationBandEntries(triangulation.triangles);
  const triangleCorrespondence = buildTriangleCorrespondence(
    input.structureInstanceId,
    correspondences,
    sourceBandTriangles,
    destinationBandEntries,
  );
  const topCapTriangles = (input.topCapTriangles ?? []).map((tri) => cloneTriangle(tri));

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
    topCapTriangles,
    sourceBandTriangles,
    destinationBandEntries,
    triangleCorrespondence: triangleCorrespondence.correspondences,
    triangleCorrespondenceGroups: triangleCorrespondence.groups,
    triangleCorrespondenceMismatches: triangleCorrespondence.mismatches,
    midpointDiagnostics,
    deltaReference: deltaCheck.reference,
    isDeltaConstant: deltaCheck.constant,
    projectedBounds: buildBoundsFromGeometry(sliceStrips, topCapTriangles),
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
