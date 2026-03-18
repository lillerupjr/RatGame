import type { StampOverlay } from "../../map/compile/kenneyMap";
import type {
  RuntimeStructureTriangleCache,
  RuntimeStructureTrianglePiece,
  RuntimeStructureTriangleRect,
} from "./runtimeStructureTriangles";
import {
  STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
  type StructureShadowPoint,
  type StructureShadowProjectedEdge,
  type StructureShadowProjectedQuad,
  type StructureShadowProjectedTriangle,
  type StructureShadowRoofScan,
} from "./structureShadowV1";

export type StructureShadowAlphaMap = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type StructureShadowV2CacheEntry = {
  structureInstanceId: string;
  geometrySignature: string;
  sunStepKey: string;
  sunForward: { x: number; y: number; z: number };
  sourceTriangleCount: number;
  castHeightPx: number;
  sourceBoundaryLoops: StructureShadowPoint[][];
  sourceBoundaryEdges: StructureShadowProjectedEdge[];
  projectedBoundaryLoops: StructureShadowPoint[][];
  projectedBoundaryEdges: StructureShadowProjectedEdge[];
  connectorTriangles: StructureShadowProjectedTriangle[];
  projectedCapTriangles: StructureShadowProjectedTriangle[];
  shadowTriangles: StructureShadowProjectedTriangle[];
  projectedBounds: RuntimeStructureTriangleRect | null;
  roofScan: StructureShadowRoofScan;
};

export type BuildStructureShadowV2CacheEntryInput = {
  overlay: StampOverlay;
  triangleCache: RuntimeStructureTriangleCache;
  geometrySignature: string;
  tileWorld: number;
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => StructureShadowPoint;
  sunForward: { x: number; y: number; z: number };
  sunProjectionDirection: { x: number; y: number };
  sunStepKey: string;
  drawDx: number;
  drawDy: number;
  drawScale: number;
  sourceImage?: CanvasImageSource;
  sourceAlphaMap?: StructureShadowAlphaMap;
  roofScanStepPx?: number;
  alphaThreshold?: number;
  silhouetteSampleStep?: number;
  maxLoopPoints?: number;
};

export type StructureShadowV2ContextKeyInput = {
  mapId: string;
  enabled: boolean;
  sunStepKey: string;
  roofScanStepPx: number;
  alphaThreshold: number;
  silhouetteSampleStep: number;
  maxLoopPoints: number;
};

type StructureShadowFootprintSupportCell = {
  col: number;
  row: number;
  quad: StructureShadowProjectedQuad;
  supported: boolean;
};

type StructureShadowFootprintSupportLevel = {
  level: number;
  liftYPx: number;
  quad: StructureShadowProjectedQuad;
  cells: StructureShadowFootprintSupportCell[];
  supportedCells: number;
  totalCells: number;
  anySupport: boolean;
  allSupported: boolean;
};

type StructureShadowBoundaryEdge = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
};

const ROOF_SCAN_STEP_DEFAULT = STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX;
export const STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD = 1;
export const STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP = 8;
export const STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS = 72;
const READBACK_CTX_OPTIONS: CanvasRenderingContext2DSettings = { willReadFrequently: true };

let structureShadowV2ReadbackCanvas: HTMLCanvasElement | null = null;
let structureShadowV2ReadbackCtx: CanvasRenderingContext2D | null = null;
const structureShadowV2AlphaMapCache = new WeakMap<object, StructureShadowAlphaMap | null>();

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
  const safeStepPx = clampToPositiveInt(stepPx, ROOF_SCAN_STEP_DEFAULT);
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

function resolveProjectionDirection(vector: { x: number; y: number }): { x: number; y: number } {
  const x = Number(vector.x);
  const y = Number(vector.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 1 };
  return { x, y };
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

function getSourceAlphaMap(sourceImage: CanvasImageSource | undefined): StructureShadowAlphaMap | null {
  if (!(sourceImage instanceof HTMLImageElement || sourceImage instanceof HTMLCanvasElement)) return null;
  const key = sourceImage as object;
  if (structureShadowV2AlphaMapCache.has(key)) {
    return structureShadowV2AlphaMapCache.get(key) ?? null;
  }
  const width = sourceImage instanceof HTMLImageElement
    ? (sourceImage.naturalWidth || sourceImage.width || 0)
    : sourceImage.width;
  const height = sourceImage instanceof HTMLImageElement
    ? (sourceImage.naturalHeight || sourceImage.height || 0)
    : sourceImage.height;
  if (width <= 0 || height <= 0) {
    structureShadowV2AlphaMapCache.set(key, null);
    return null;
  }
  const canvas = structureShadowV2ReadbackCanvas ?? document.createElement("canvas");
  structureShadowV2ReadbackCanvas = canvas;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const readbackCtx = structureShadowV2ReadbackCtx ?? canvas.getContext("2d", READBACK_CTX_OPTIONS);
  structureShadowV2ReadbackCtx = readbackCtx;
  if (!readbackCtx) {
    structureShadowV2AlphaMapCache.set(key, null);
    return null;
  }
  try {
    readbackCtx.setTransform(1, 0, 0, 1, 0, 0);
    readbackCtx.clearRect(0, 0, width, height);
    readbackCtx.drawImage(sourceImage, 0, 0, width, height);
    const imageData = readbackCtx.getImageData(0, 0, width, height);
    const resolved: StructureShadowAlphaMap = {
      width,
      height,
      data: imageData.data,
    };
    structureShadowV2AlphaMapCache.set(key, resolved);
    return resolved;
  } catch {
    structureShadowV2AlphaMapCache.set(key, null);
    return null;
  }
}

function isOpaquePixel(alphaMap: StructureShadowAlphaMap, x: number, y: number, alphaThreshold: number): boolean {
  if (x < 0 || y < 0 || x >= alphaMap.width || y >= alphaMap.height) return false;
  const alphaIdx = ((y * alphaMap.width + x) << 2) + 3;
  return (alphaMap.data[alphaIdx] | 0) >= alphaThreshold;
}

function isOpaqueCell(
  occupancy: Uint8Array,
  widthCells: number,
  heightCells: number,
  x: number,
  y: number,
): boolean {
  if (x < 0 || y < 0 || x >= widthCells || y >= heightCells) return false;
  return occupancy[y * widthCells + x] === 1;
}

function buildAlphaOccupancyGrid(
  alphaMap: StructureShadowAlphaMap,
  alphaThreshold: number,
  sampleStep: number,
): { widthCells: number; heightCells: number; occupancy: Uint8Array } {
  const safeStep = clampToPositiveInt(sampleStep, STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP);
  const widthCells = Math.max(1, Math.ceil(alphaMap.width / safeStep));
  const heightCells = Math.max(1, Math.ceil(alphaMap.height / safeStep));
  const occupancy = new Uint8Array(widthCells * heightCells);
  for (let cy = 0; cy < heightCells; cy++) {
    const py0 = cy * safeStep;
    const py1 = Math.min(alphaMap.height, py0 + safeStep);
    for (let cx = 0; cx < widthCells; cx++) {
      const px0 = cx * safeStep;
      const px1 = Math.min(alphaMap.width, px0 + safeStep);
      let opaque = false;
      for (let py = py0; py < py1 && !opaque; py++) {
        for (let px = px0; px < px1; px++) {
          if (!isOpaquePixel(alphaMap, px, py, alphaThreshold)) continue;
          opaque = true;
          break;
        }
      }
      occupancy[cy * widthCells + cx] = opaque ? 1 : 0;
    }
  }
  return { widthCells, heightCells, occupancy };
}

function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

function edgeDirectionIndex(edge: StructureShadowBoundaryEdge): 0 | 1 | 2 | 3 {
  const dx = edge.bx - edge.ax;
  const dy = edge.by - edge.ay;
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
}

function pickEdgeTransitionScore(cwDelta: number): number {
  if (cwDelta === 0) return 0;
  if (cwDelta === 1) return 1;
  if (cwDelta === 3) return 2;
  return 3;
}

function selectNextBoundaryEdgeIndex(
  edges: readonly StructureShadowBoundaryEdge[],
  previousEdge: StructureShadowBoundaryEdge,
  candidateIndices: readonly number[],
): number {
  if (candidateIndices.length <= 1) return candidateIndices[0] ?? -1;
  const previousDir = edgeDirectionIndex(previousEdge);
  let bestIndex = candidateIndices[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < candidateIndices.length; i++) {
    const candidateIndex = candidateIndices[i];
    const candidateDir = edgeDirectionIndex(edges[candidateIndex]);
    const cwDelta = (candidateDir - previousDir + 4) % 4;
    const score = pickEdgeTransitionScore(cwDelta);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = candidateIndex;
    } else if (score === bestScore && candidateIndex < bestIndex) {
      bestIndex = candidateIndex;
    }
  }
  return bestIndex;
}

function simplifyCollinearLoop(points: readonly StructureShadowPoint[]): StructureShadowPoint[] {
  const n = points.length;
  if (n <= 3) return points.map((point) => clonePoint(point));
  const out: StructureShadowPoint[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const sameVertical = prev.x === curr.x && curr.x === next.x;
    const sameHorizontal = prev.y === curr.y && curr.y === next.y;
    if (sameVertical || sameHorizontal) continue;
    out.push(clonePoint(curr));
  }
  return out.length >= 3 ? out : points.map((point) => clonePoint(point));
}

function simplifyLoopPointCount(
  points: readonly StructureShadowPoint[],
  maxPoints: number,
): StructureShadowPoint[] {
  const safeMaxPoints = Math.max(3, maxPoints | 0);
  if (points.length <= safeMaxPoints) return points.map((point) => clonePoint(point));
  const out: StructureShadowPoint[] = [];
  const stride = points.length / safeMaxPoints;
  for (let i = 0; i < safeMaxPoints; i++) {
    const index = Math.min(points.length - 1, Math.floor(i * stride));
    const next = points[index];
    const prev = out[out.length - 1];
    if (prev && prev.x === next.x && prev.y === next.y) continue;
    out.push(clonePoint(next));
  }
  if (out.length < 3) return points.map((point) => clonePoint(point));
  return out;
}

function polygonSignedArea(points: readonly StructureShadowPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

function collectAlphaBoundaryEdges(
  alphaMap: StructureShadowAlphaMap,
  alphaThreshold: number,
  sampleStep: number,
): StructureShadowBoundaryEdge[] {
  const safeStep = clampToPositiveInt(sampleStep, STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP);
  const grid = buildAlphaOccupancyGrid(alphaMap, alphaThreshold, safeStep);
  const { widthCells, heightCells, occupancy } = grid;
  const out: StructureShadowBoundaryEdge[] = [];
  for (let y = 0; y < heightCells; y++) {
    for (let x = 0; x < widthCells; x++) {
      if (!isOpaqueCell(occupancy, widthCells, heightCells, x, y)) continue;
      const x0 = x * safeStep;
      const y0 = y * safeStep;
      const x1 = Math.min(alphaMap.width, x0 + safeStep);
      const y1 = Math.min(alphaMap.height, y0 + safeStep);
      if (!isOpaqueCell(occupancy, widthCells, heightCells, x, y - 1)) {
        out.push({ ax: x0, ay: y0, bx: x1, by: y0 });
      }
      if (!isOpaqueCell(occupancy, widthCells, heightCells, x + 1, y)) {
        out.push({ ax: x1, ay: y0, bx: x1, by: y1 });
      }
      if (!isOpaqueCell(occupancy, widthCells, heightCells, x, y + 1)) {
        out.push({ ax: x1, ay: y1, bx: x0, by: y1 });
      }
      if (!isOpaqueCell(occupancy, widthCells, heightCells, x - 1, y)) {
        out.push({ ax: x0, ay: y1, bx: x0, by: y0 });
      }
    }
  }
  return out;
}

function traceBoundaryLoopsFromEdges(edges: readonly StructureShadowBoundaryEdge[]): StructureShadowPoint[][] {
  if (edges.length <= 0) return [];
  const outgoing = new Map<string, number[]>();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const key = pointKey(edge.ax, edge.ay);
    const bucket = outgoing.get(key);
    if (bucket) bucket.push(i);
    else outgoing.set(key, [i]);
  }
  const visited = new Uint8Array(edges.length);
  const loops: StructureShadowPoint[][] = [];

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
    if (visited[edgeIndex]) continue;
    const start = edges[edgeIndex];
    const startKey = pointKey(start.ax, start.ay);
    let currentEdgeIndex = edgeIndex;
    const loopPoints: StructureShadowPoint[] = [];
    let completed = false;
    const guardMax = edges.length + 4;
    for (let guard = 0; guard < guardMax; guard++) {
      if (currentEdgeIndex < 0 || currentEdgeIndex >= edges.length) break;
      if (visited[currentEdgeIndex]) break;
      const edge = edges[currentEdgeIndex];
      visited[currentEdgeIndex] = 1;
      if (loopPoints.length === 0) loopPoints.push({ x: edge.ax, y: edge.ay });
      loopPoints.push({ x: edge.bx, y: edge.by });
      const endKey = pointKey(edge.bx, edge.by);
      if (endKey === startKey) {
        completed = true;
        break;
      }
      const nextCandidates = (outgoing.get(endKey) ?? []).filter((index) => !visited[index]);
      if (nextCandidates.length <= 0) break;
      currentEdgeIndex = selectNextBoundaryEdgeIndex(edges, edge, nextCandidates);
    }
    if (!completed || loopPoints.length < 4) continue;
    const first = loopPoints[0];
    const last = loopPoints[loopPoints.length - 1];
    if (first.x === last.x && first.y === last.y) {
      loopPoints.pop();
    }
    const simplified = simplifyCollinearLoop(loopPoints);
    if (simplified.length < 3) continue;
    loops.push(simplified);
  }

  return loops;
}

export function extractAlphaSilhouetteOuterBoundaryLoops(
  alphaMap: StructureShadowAlphaMap,
  alphaThreshold: number = STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
  sampleStep: number = STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
  maxLoopPoints: number = STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
): StructureShadowPoint[][] {
  const threshold = clampToPositiveInt(alphaThreshold, STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD);
  const safeStep = clampToPositiveInt(sampleStep, STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP);
  const boundaryEdges = collectAlphaBoundaryEdges(alphaMap, threshold, safeStep);
  const loops = traceBoundaryLoopsFromEdges(boundaryEdges);
  const outerLoops = loops.filter((loop) => polygonSignedArea(loop) > 0.5)
    .map((loop) => simplifyLoopPointCount(loop, maxLoopPoints));
  outerLoops.sort((a, b) => Math.abs(polygonSignedArea(b)) - Math.abs(polygonSignedArea(a)));
  if (outerLoops.length <= 0) return outerLoops;
  // V2 POC prioritizes one robust outer boundary for performance and stability.
  return [outerLoops[0]];
}

function mapLoopToScreen(
  loop: readonly StructureShadowPoint[],
  dx: number,
  dy: number,
  scale: number,
): StructureShadowPoint[] {
  const out: StructureShadowPoint[] = new Array(loop.length);
  for (let i = 0; i < loop.length; i++) {
    const point = loop[i];
    out[i] = {
      x: dx + point.x * scale,
      y: dy + point.y * scale,
    };
  }
  return out;
}

function buildBoundaryEdgesFromLoops(
  loops: readonly StructureShadowPoint[][],
): StructureShadowProjectedEdge[] {
  const edges: StructureShadowProjectedEdge[] = [];
  for (let li = 0; li < loops.length; li++) {
    const loop = loops[li];
    if (loop.length < 2) continue;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      edges.push([clonePoint(a), clonePoint(b)]);
    }
  }
  return edges;
}

function triangulateLoopEarClipping(
  points: readonly StructureShadowPoint[],
): StructureShadowProjectedTriangle[] {
  const n = points.length;
  if (n < 3) return [];
  const signedArea = polygonSignedArea(points);
  if (Math.abs(signedArea) <= 1e-6) return [];
  const orientationSign = signedArea > 0 ? 1 : -1;
  const vertexIndices = new Array<number>(n);
  for (let i = 0; i < n; i++) vertexIndices[i] = i;
  const triangles: StructureShadowProjectedTriangle[] = [];
  const pointInTriangleInclusive = (
    p: StructureShadowPoint,
    a: StructureShadowPoint,
    b: StructureShadowPoint,
    c: StructureShadowPoint,
  ): boolean => pointInTriangle(p, a, b, c);
  const guardMax = n * n;
  for (let guard = 0; guard < guardMax && vertexIndices.length > 3; guard++) {
    let earFound = false;
    for (let ii = 0; ii < vertexIndices.length; ii++) {
      const prevIndex = vertexIndices[(ii - 1 + vertexIndices.length) % vertexIndices.length];
      const currIndex = vertexIndices[ii];
      const nextIndex = vertexIndices[(ii + 1) % vertexIndices.length];
      const a = points[prevIndex];
      const b = points[currIndex];
      const c = points[nextIndex];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross * orientationSign <= 1e-6) continue;
      let containsOtherVertex = false;
      for (let jj = 0; jj < vertexIndices.length; jj++) {
        const testIndex = vertexIndices[jj];
        if (testIndex === prevIndex || testIndex === currIndex || testIndex === nextIndex) continue;
        if (pointInTriangleInclusive(points[testIndex], a, b, c)) {
          containsOtherVertex = true;
          break;
        }
      }
      if (containsOtherVertex) continue;
      triangles.push([clonePoint(a), clonePoint(b), clonePoint(c)]);
      vertexIndices.splice(ii, 1);
      earFound = true;
      break;
    }
    if (!earFound) break;
  }
  if (vertexIndices.length === 3) {
    const a = points[vertexIndices[0]];
    const b = points[vertexIndices[1]];
    const c = points[vertexIndices[2]];
    triangles.push([clonePoint(a), clonePoint(b), clonePoint(c)]);
  }
  return triangles;
}

function triangulateBoundaryLoops(
  loops: readonly StructureShadowPoint[][],
): StructureShadowProjectedTriangle[] {
  const triangles: StructureShadowProjectedTriangle[] = [];
  for (let i = 0; i < loops.length; i++) {
    const loop = loops[i];
    if (loop.length < 3) continue;
    const loopTriangles = triangulateLoopEarClipping(loop);
    if (loopTriangles.length > 0) triangles.push(...loopTriangles);
  }
  return triangles;
}

function buildConnectorTrianglesForLoops(
  sourceLoops: readonly StructureShadowPoint[][],
  projectedLoops: readonly StructureShadowPoint[][],
): StructureShadowProjectedTriangle[] {
  const triangles: StructureShadowProjectedTriangle[] = [];
  const loopCount = Math.min(sourceLoops.length, projectedLoops.length);
  for (let li = 0; li < loopCount; li++) {
    const sourceLoop = sourceLoops[li];
    const projectedLoop = projectedLoops[li];
    const edgeCount = Math.min(sourceLoop.length, projectedLoop.length);
    if (edgeCount < 2) continue;
    for (let i = 0; i < edgeCount; i++) {
      const next = (i + 1) % edgeCount;
      const a = sourceLoop[i];
      const b = sourceLoop[next];
      const aProjected = projectedLoop[i];
      const bProjected = projectedLoop[next];
      triangles.push(
        [clonePoint(a), clonePoint(b), clonePoint(bProjected)],
        [clonePoint(a), clonePoint(bProjected), clonePoint(aProjected)],
      );
    }
  }
  return triangles;
}

export function buildStructureShadowV2CacheEntry(
  input: BuildStructureShadowV2CacheEntryInput,
): StructureShadowV2CacheEntry {
  const footprintCols = Math.max(1, input.overlay.w | 0);
  const footprintRows = Math.max(1, input.overlay.h | 0);
  const roofScanStepPx = clampToPositiveInt(
    input.roofScanStepPx ?? ROOF_SCAN_STEP_DEFAULT,
    ROOF_SCAN_STEP_DEFAULT,
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
  const castHeightPx = Math.max(0, roofScan.activeLevel?.liftYPx ?? 0);
  const projectionDirection = resolveProjectionDirection(input.sunProjectionDirection);
  const castOffsetX = projectionDirection.x * castHeightPx;
  const castOffsetY = projectionDirection.y * castHeightPx;

  const alphaThreshold = clampToPositiveInt(
    input.alphaThreshold ?? STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
    STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
  );
  const silhouetteSampleStep = clampToPositiveInt(
    input.silhouetteSampleStep ?? STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
    STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
  );
  const maxLoopPoints = clampToPositiveInt(
    input.maxLoopPoints ?? STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
    STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
  );
  const alphaMap = input.sourceAlphaMap ?? getSourceAlphaMap(input.sourceImage);
  const sourceBoundaryLoops = alphaMap
    ? extractAlphaSilhouetteOuterBoundaryLoops(alphaMap, alphaThreshold, silhouetteSampleStep, maxLoopPoints)
      .map((loop) => mapLoopToScreen(loop, input.drawDx, input.drawDy, input.drawScale))
    : [];
  const projectedBoundaryLoops = sourceBoundaryLoops.map((loop) => (
    loop.map((point) => ({
      x: point.x + castOffsetX,
      y: point.y + castOffsetY,
    }))
  ));
  const sourceBoundaryEdges = buildBoundaryEdgesFromLoops(sourceBoundaryLoops);
  const projectedBoundaryEdges = buildBoundaryEdgesFromLoops(projectedBoundaryLoops);
  const connectorTriangles = buildConnectorTrianglesForLoops(sourceBoundaryLoops, projectedBoundaryLoops);
  const projectedCapTriangles = triangulateBoundaryLoops(projectedBoundaryLoops);
  const shadowTriangles = projectedCapTriangles.concat(connectorTriangles);

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
    castHeightPx,
    sourceBoundaryLoops,
    sourceBoundaryEdges,
    projectedBoundaryLoops,
    projectedBoundaryEdges,
    connectorTriangles,
    projectedCapTriangles,
    shadowTriangles,
    projectedBounds: buildProjectedBounds(shadowTriangles),
    roofScan,
  };
}

export function buildStructureShadowV2ContextKey(
  input: StructureShadowV2ContextKeyInput,
): string {
  return [
    "mode:v2AlphaSilhouette",
    `map:${input.mapId}`,
    `enabled:${input.enabled ? 1 : 0}`,
    `sun:${input.sunStepKey}`,
    `scanStep:${clampToPositiveInt(input.roofScanStepPx, ROOF_SCAN_STEP_DEFAULT)}`,
    `alpha:${clampToPositiveInt(input.alphaThreshold, STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD)}`,
    `sstep:${clampToPositiveInt(input.silhouetteSampleStep, STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP)}`,
    `maxPts:${clampToPositiveInt(input.maxLoopPoints, STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS)}`,
  ].join("||");
}

export class StructureShadowV2CacheStore {
  private contextKey = "";
  private readonly entries = new Map<string, StructureShadowV2CacheEntry>();

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
  ): StructureShadowV2CacheEntry | undefined {
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

  set(entry: StructureShadowV2CacheEntry): void {
    this.entries.set(entry.structureInstanceId, entry);
  }
}
