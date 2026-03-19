import type { StampOverlay } from "../../map/compile/kenneyMap";
import type {
  RuntimeStructureTriangleCache,
  RuntimeStructureTrianglePiece,
  RuntimeStructureTriangleRect,
} from "./runtimeStructureTriangles";

export type StructureShadowPoint = {
  x: number;
  y: number;
};

export type StructureShadowProjectedTriangle = [
  StructureShadowPoint,
  StructureShadowPoint,
  StructureShadowPoint
];

export type StructureShadowProjectedEdge = [
  StructureShadowPoint,
  StructureShadowPoint
];

export type StructureShadowProjectedQuad = [
  StructureShadowPoint,
  StructureShadowPoint,
  StructureShadowPoint,
  StructureShadowPoint
];

export type StructureShadowFootprintSupportCell = {
  col: number;
  row: number;
  quad: StructureShadowProjectedQuad;
  supported: boolean;
};

export type StructureShadowFootprintSupportLevel = {
  level: number;
  liftYPx: number;
  quad: StructureShadowProjectedQuad;
  cells: StructureShadowFootprintSupportCell[];
  supportedCells: number;
  totalCells: number;
  anySupport: boolean;
  allSupported: boolean;
};

export type StructureShadowRoofScan = {
  levels: StructureShadowFootprintSupportLevel[];
  highestValidLevel: number;
  activeLevel: StructureShadowFootprintSupportLevel | null;
};

export type StructureShadowCacheEntry = {
  structureInstanceId: string;
  geometrySignature: string;
  sunStepKey: string;
  sunForward: { x: number; y: number; z: number };
  sourceTriangleCount: number;
  roofCasterTriangleStableIds: number[];
  roofCasterTriangles: RuntimeStructureTrianglePiece[];
  roofBoundaryEdges: StructureShadowProjectedEdge[];
  footprintBoundaryEdges: StructureShadowProjectedEdge[];
  projectedBoundaryEdges: StructureShadowProjectedEdge[];
  connectorTriangles: StructureShadowProjectedTriangle[];
  projectedTriangles: StructureShadowProjectedTriangle[];
  shadowTriangles: StructureShadowProjectedTriangle[];
  projectedBounds: RuntimeStructureTriangleRect | null;
  roofScan: StructureShadowRoofScan;
};

export type BuildStructureShadowCacheEntryInput = {
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

export type StructureShadowContextKeyInput = {
  mapId: string;
  enabled: boolean;
  sunStepKey: string;
  roofScanStepPx: number;
};

export const STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX = 64;
const STRUCTURE_SHADOW_EDGE_KEY_PRECISION = 1000;

function clampToPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
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

function lerpPoint(a: StructureShadowPoint, b: StructureShadowPoint, t: number): StructureShadowPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function sampleQuadPoint(quad: StructureShadowProjectedQuad, u: number, v: number): StructureShadowPoint {
  const top = lerpPoint(quad[0], quad[1], u);
  const bottom = lerpPoint(quad[3], quad[2], u);
  return lerpPoint(top, bottom, v);
}

function liftProjectedFootprintQuad(
  quad: StructureShadowProjectedQuad,
  liftYPx: number,
): StructureShadowProjectedQuad {
  return [
    { x: quad[0].x, y: quad[0].y - liftYPx },
    { x: quad[1].x, y: quad[1].y - liftYPx },
    { x: quad[2].x, y: quad[2].y - liftYPx },
    { x: quad[3].x, y: quad[3].y - liftYPx },
  ];
}

function resolveProjectionDirection(vector: { x: number; y: number }): { x: number; y: number } {
  const x = Number(vector.x);
  const y = Number(vector.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 1 };
  return { x, y };
}

function clonePoint(point: StructureShadowPoint): StructureShadowPoint {
  return {
    x: point.x,
    y: point.y,
  };
}

function buildPointKey(point: StructureShadowPoint): string {
  const qx = Math.round(point.x * STRUCTURE_SHADOW_EDGE_KEY_PRECISION);
  const qy = Math.round(point.y * STRUCTURE_SHADOW_EDGE_KEY_PRECISION);
  return `${qx},${qy}`;
}

function buildUndirectedEdgeKey(aKey: string, bKey: string): string {
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function extractRoofBoundaryEdges(
  roofCasterTriangles: readonly RuntimeStructureTrianglePiece[],
): StructureShadowProjectedEdge[] {
  type BoundaryAccumulator = {
    count: number;
    edge: StructureShadowProjectedEdge;
  };
  const edgeMap = new Map<string, BoundaryAccumulator>();
  for (let ti = 0; ti < roofCasterTriangles.length; ti++) {
    const tri = roofCasterTriangles[ti];
    const points = tri.points;
    for (let ei = 0; ei < 3; ei++) {
      const a = points[ei];
      const b = points[(ei + 1) % 3];
      const aKey = buildPointKey(a);
      const bKey = buildPointKey(b);
      if (aKey === bKey) continue;
      const key = buildUndirectedEdgeKey(aKey, bKey);
      const existing = edgeMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        edgeMap.set(key, {
          count: 1,
          edge: [clonePoint(a), clonePoint(b)],
        });
      }
    }
  }

  const boundaryEdges: StructureShadowProjectedEdge[] = [];
  edgeMap.forEach((entry) => {
    if (entry.count !== 1) return;
    boundaryEdges.push(entry.edge);
  });
  return boundaryEdges;
}

function buildFootprintSupportLevel(
  quad: StructureShadowProjectedQuad,
  cols: number,
  rows: number,
  triangleCentroids: StructureShadowPoint[],
  level: number,
  liftYPx: number,
): StructureShadowFootprintSupportLevel {
  const safeCols = Math.max(1, cols | 0);
  const safeRows = Math.max(1, rows | 0);
  const cells: StructureShadowFootprintSupportCell[] = [];
  let supportedCells = 0;
  for (let row = 0; row < safeRows; row++) {
    const v0 = row / safeRows;
    const v1 = (row + 1) / safeRows;
    for (let col = 0; col < safeCols; col++) {
      const u0 = col / safeCols;
      const u1 = (col + 1) / safeCols;
      const cellQuad: StructureShadowProjectedQuad = [
        sampleQuadPoint(quad, u0, v0),
        sampleQuadPoint(quad, u1, v0),
        sampleQuadPoint(quad, u1, v1),
        sampleQuadPoint(quad, u0, v1),
      ];
      let supported = false;
      for (let ti = 0; ti < triangleCentroids.length; ti++) {
        const centroid = triangleCentroids[ti];
        if (!isPointInsideQuad(cellQuad, centroid.x, centroid.y)) continue;
        supported = true;
        break;
      }
      if (supported) supportedCells++;
      cells.push({
        col,
        row,
        quad: cellQuad,
        supported,
      });
    }
  }
  const totalCells = safeCols * safeRows;
  return {
    level,
    liftYPx,
    quad,
    cells,
    supportedCells,
    totalCells,
    anySupport: supportedCells > 0,
    allSupported: supportedCells === totalCells,
  };
}

function scanLiftedFootprintSupportLevels(
  baseQuad: StructureShadowProjectedQuad,
  cols: number,
  rows: number,
  triangleCentroids: StructureShadowPoint[],
  stepPx: number,
): StructureShadowRoofScan {
  const safeStepPx = clampToPositiveInt(stepPx, STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX);
  const levels: StructureShadowFootprintSupportLevel[] = [];
  let highestValidLevel = -1;
  const baseMaxY = Math.max(baseQuad[0].y, baseQuad[1].y, baseQuad[2].y, baseQuad[3].y);
  let minCentroidY = Number.POSITIVE_INFINITY;
  for (let i = 0; i < triangleCentroids.length; i++) {
    minCentroidY = Math.min(minCentroidY, triangleCentroids[i].y);
  }
  const maxLevels = Number.isFinite(minCentroidY)
    ? Math.max(1, Math.ceil((baseMaxY - minCentroidY) / safeStepPx) + 2)
    : 1;

  for (let level = 0; level < maxLevels; level++) {
    const liftYPx = level * safeStepPx;
    const liftedQuad = liftProjectedFootprintQuad(baseQuad, liftYPx);
    const levelResult = buildFootprintSupportLevel(
      liftedQuad,
      cols,
      rows,
      triangleCentroids,
      level,
      liftYPx,
    );
    levels.push(levelResult);
    if (levelResult.allSupported) highestValidLevel = level;
    if (!levelResult.allSupported || !levelResult.anySupport) break;
  }

  const activeIndex = highestValidLevel >= 0 ? highestValidLevel : 0;
  const activeLevel = levels[Math.min(activeIndex, levels.length - 1)] ?? null;
  return {
    levels,
    highestValidLevel,
    activeLevel,
  };
}

function buildProjectedBounds(
  triangles: StructureShadowProjectedTriangle[],
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

function buildProjectedStructureFootprintQuad(
  overlay: StampOverlay,
  tileWorld: number,
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => StructureShadowPoint,
): StructureShadowProjectedQuad {
  const zVisual = overlay.z + (overlay.zVisualOffsetUnits ?? 0);
  const minWorldX = overlay.tx * tileWorld;
  const minWorldY = overlay.ty * tileWorld;
  const maxWorldX = (overlay.tx + overlay.w) * tileWorld;
  const maxWorldY = (overlay.ty + overlay.h) * tileWorld;
  const nw = toScreenAtZ(minWorldX, minWorldY, zVisual);
  const ne = toScreenAtZ(maxWorldX, minWorldY, zVisual);
  const se = toScreenAtZ(maxWorldX, maxWorldY, zVisual);
  const sw = toScreenAtZ(minWorldX, maxWorldY, zVisual);
  return [nw, ne, se, sw];
}

export function buildStructureShadowCacheEntry(
  input: BuildStructureShadowCacheEntryInput,
): StructureShadowCacheEntry {
  const footprintCols = Math.max(1, input.overlay.w | 0);
  const footprintRows = Math.max(1, input.overlay.h | 0);
  const roofScanStepPx = clampToPositiveInt(
    input.roofScanStepPx ?? STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
    STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
  );
  const baseFootprintQuad = buildProjectedStructureFootprintQuad(
    input.overlay,
    input.tileWorld,
    input.toScreenAtZ,
  );
  const triangleCentroids: Array<{ tri: RuntimeStructureTrianglePiece; centroid: StructureShadowPoint }> = [];
  for (let i = 0; i < input.triangleCache.triangles.length; i++) {
    const tri = input.triangleCache.triangles[i];
    const [a, b, c] = tri.points;
    triangleCentroids.push({
      tri,
      centroid: {
        x: (a.x + b.x + c.x) / 3,
        y: (a.y + b.y + c.y) / 3,
      },
    });
  }

  const roofScan = scanLiftedFootprintSupportLevels(
    baseFootprintQuad,
    footprintCols,
    footprintRows,
    triangleCentroids.map((entry) => entry.centroid),
    roofScanStepPx,
  );
  const activeLevel = roofScan.activeLevel;
  const roofCasterTriangles: RuntimeStructureTrianglePiece[] = [];
  if (activeLevel) {
    for (let i = 0; i < triangleCentroids.length; i++) {
      const entry = triangleCentroids[i];
      if (!isPointInsideQuad(activeLevel.quad, entry.centroid.x, entry.centroid.y)) continue;
      roofCasterTriangles.push(entry.tri);
    }
  }

  const castHeightPx = Math.max(0, activeLevel?.liftYPx ?? 0);
  const projectionDirection = resolveProjectionDirection(input.sunProjectionDirection);
  const castOffsetX = projectionDirection.x * castHeightPx;
  const castOffsetY = projectionDirection.y * castHeightPx;

  const projectedTriangles: StructureShadowProjectedTriangle[] = [];
  for (let i = 0; i < roofCasterTriangles.length; i++) {
    const tri = roofCasterTriangles[i];
    const [a, b, c] = tri.points;
    projectedTriangles.push([
      { x: a.x + castOffsetX, y: a.y + castHeightPx + castOffsetY },
      { x: b.x + castOffsetX, y: b.y + castHeightPx + castOffsetY },
      { x: c.x + castOffsetX, y: c.y + castHeightPx + castOffsetY },
    ]);
  }

  const roofBoundaryEdges = extractRoofBoundaryEdges(roofCasterTriangles);
  const footprintBoundaryEdges: StructureShadowProjectedEdge[] = [];
  const projectedBoundaryEdges: StructureShadowProjectedEdge[] = [];
  const connectorTriangles: StructureShadowProjectedTriangle[] = [];
  for (let i = 0; i < roofBoundaryEdges.length; i++) {
    const [a, b] = roofBoundaryEdges[i];
    const aFootprint: StructureShadowPoint = {
      x: a.x,
      y: a.y + castHeightPx,
    };
    const bFootprint: StructureShadowPoint = {
      x: b.x,
      y: b.y + castHeightPx,
    };
    const aProjected: StructureShadowPoint = {
      x: aFootprint.x + castOffsetX,
      y: aFootprint.y + castOffsetY,
    };
    const bProjected: StructureShadowPoint = {
      x: bFootprint.x + castOffsetX,
      y: bFootprint.y + castOffsetY,
    };
    footprintBoundaryEdges.push([aFootprint, bFootprint]);
    projectedBoundaryEdges.push([aProjected, bProjected]);
    connectorTriangles.push(
      [clonePoint(aFootprint), clonePoint(bFootprint), clonePoint(bProjected)],
      [clonePoint(aFootprint), clonePoint(bProjected), clonePoint(aProjected)],
    );
  }
  const shadowTriangles = projectedTriangles.concat(connectorTriangles);

  return {
    structureInstanceId: input.overlay.id,
    geometrySignature: input.geometrySignature,
    sunStepKey: input.sunStepKey,
    sunForward: {
      x: input.sunForward.x,
      y: input.sunForward.y,
      z: input.sunForward.z,
    },
    sourceTriangleCount: input.triangleCache.triangles.length,
    roofCasterTriangleStableIds: roofCasterTriangles.map((tri) => tri.stableId),
    roofCasterTriangles,
    roofBoundaryEdges,
    footprintBoundaryEdges,
    projectedBoundaryEdges,
    connectorTriangles,
    projectedTriangles,
    shadowTriangles,
    projectedBounds: buildProjectedBounds(shadowTriangles),
    roofScan,
  };
}

export function buildStructureShadowContextKey(
  input: StructureShadowContextKeyInput,
): string {
  return [
    `map:${input.mapId}`,
    `enabled:${input.enabled ? 1 : 0}`,
    `sun:${input.sunStepKey}`,
    `scanStep:${clampToPositiveInt(input.roofScanStepPx, STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX)}`,
  ].join("||");
}

export class StructureShadowCacheStore {
  private contextKey = "";
  private readonly entries = new Map<string, StructureShadowCacheEntry>();

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
  ): StructureShadowCacheEntry | undefined {
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

  set(entry: StructureShadowCacheEntry): void {
    this.entries.set(entry.structureInstanceId, entry);
  }

  values(): StructureShadowCacheEntry[] {
    return Array.from(this.entries.values());
  }
}
