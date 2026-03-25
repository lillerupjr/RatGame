import type { StampOverlay } from "../../../map/compile/kenneyMap";
import { STRUCTURE_TRIANGLE_HEIGHT_STEP_PX } from "../../../structures/monolithicBuildingSemanticPrepass";
import {
  resolveRuntimeStructureTriangleCacheMaxSideHeight,
  resolveMonolithicFootprintTileBoundsForOverlay,
  resolveRuntimeStructureBandProgressionIndex,
  type RuntimeStructureTriangleCache,
  type RuntimeStructureTrianglePiece,
  type RuntimeStructureTriangleSemanticClass,
  type RuntimeStructureTriangleSemanticFace,
  type RuntimeStructureTriangleSemanticRole,
} from "../../../structures/monolithicStructureGeometry";

type ScreenPt = { x: number; y: number };
type ProjectedQuad = [ScreenPt, ScreenPt, ScreenPt, ScreenPt];

type FootprintSupportLevel = {
  level: number;
  quad: ProjectedQuad;
  anySupport: boolean;
  allSupported: boolean;
};

type RuntimeStructureTriangleSemanticContext = {
  activeRoofQuad: ProjectedQuad | null;
  leftSouthMaxProgression: number;
  rightEastMinProgression: number;
  progressionByOwnerTile: Map<string, { min: number; max: number }>;
};

export type RuntimeStructureTriangleSemanticInfo = {
  semantic: RuntimeStructureTriangleSemanticClass;
  semanticFace: RuntimeStructureTriangleSemanticFace;
  semanticRole: RuntimeStructureTriangleSemanticRole;
};

function pointInTriangle(
  p: ScreenPt,
  a: ScreenPt,
  b: ScreenPt,
  c: ScreenPt,
): boolean {
  const ab = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const bc = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const ca = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const hasNeg = ab < 0 || bc < 0 || ca < 0;
  const hasPos = ab > 0 || bc > 0 || ca > 0;
  return !(hasNeg && hasPos);
}

function isPointInsideQuad(
  quad: ProjectedQuad,
  x: number,
  y: number,
): boolean {
  const p = { x, y };
  return pointInTriangle(p, quad[0], quad[1], quad[2]) || pointInTriangle(p, quad[0], quad[2], quad[3]);
}

function lerpScreenPt(a: ScreenPt, b: ScreenPt, t: number): ScreenPt {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function sampleProjectedQuadPoint(quad: ProjectedQuad, u: number, v: number): ScreenPt {
  const top = lerpScreenPt(quad[0], quad[1], u);
  const bottom = lerpScreenPt(quad[3], quad[2], u);
  return lerpScreenPt(top, bottom, v);
}

function liftProjectedFootprintQuad(quad: ProjectedQuad, liftYPx: number): ProjectedQuad {
  return [
    { x: quad[0].x, y: quad[0].y - liftYPx },
    { x: quad[1].x, y: quad[1].y - liftYPx },
    { x: quad[2].x, y: quad[2].y - liftYPx },
    { x: quad[3].x, y: quad[3].y - liftYPx },
  ];
}

function buildFootprintSupportLevel(
  quad: ProjectedQuad,
  cols: number,
  rows: number,
  triangleCentroids: readonly ScreenPt[],
  level: number,
): FootprintSupportLevel {
  let supportedCells = 0;
  for (let row = 0; row < rows; row++) {
    const v0 = row / rows;
    const v1 = (row + 1) / rows;
    for (let col = 0; col < cols; col++) {
      const u0 = col / cols;
      const u1 = (col + 1) / cols;
      const cellQuad: ProjectedQuad = [
        sampleProjectedQuadPoint(quad, u0, v0),
        sampleProjectedQuadPoint(quad, u1, v0),
        sampleProjectedQuadPoint(quad, u1, v1),
        sampleProjectedQuadPoint(quad, u0, v1),
      ];
      let supported = false;
      for (let ti = 0; ti < triangleCentroids.length; ti++) {
        const centroid = triangleCentroids[ti];
        if (!isPointInsideQuad(cellQuad, centroid.x, centroid.y)) continue;
        supported = true;
        break;
      }
      if (supported) supportedCells++;
    }
  }
  const totalCells = cols * rows;
  return {
    level,
    quad,
    anySupport: supportedCells > 0,
    allSupported: supportedCells === totalCells,
  };
}

function scanLiftedFootprintSupportLevels(
  baseQuad: ProjectedQuad,
  cols: number,
  rows: number,
  triangleCentroids: readonly ScreenPt[],
): { levels: FootprintSupportLevel[]; highestValidLevel: number } {
  const levels: FootprintSupportLevel[] = [];
  let highestValidLevel = -1;
  const baseMaxY = Math.max(baseQuad[0].y, baseQuad[1].y, baseQuad[2].y, baseQuad[3].y);
  let minCentroidY = Number.POSITIVE_INFINITY;
  for (let i = 0; i < triangleCentroids.length; i++) {
    minCentroidY = Math.min(minCentroidY, triangleCentroids[i].y);
  }
  const maxLevels = Number.isFinite(minCentroidY)
    ? Math.max(1, Math.ceil((baseMaxY - minCentroidY) / STRUCTURE_TRIANGLE_HEIGHT_STEP_PX) + 2)
    : 1;
  for (let level = 0; level < maxLevels; level++) {
    const liftedQuad = liftProjectedFootprintQuad(baseQuad, level * STRUCTURE_TRIANGLE_HEIGHT_STEP_PX);
    const levelResult = buildFootprintSupportLevel(
      liftedQuad,
      cols,
      rows,
      triangleCentroids,
      level,
    );
    levels.push(levelResult);
    if (levelResult.allSupported) highestValidLevel = level;
    if (!levelResult.allSupported || !levelResult.anySupport) break;
  }
  return { levels, highestValidLevel };
}

function buildProjectedStructureFootprintQuad(
  overlay: Pick<StampOverlay, "seTx" | "seTy" | "z" | "zVisualOffsetUnits" | "w" | "h">,
  tileWorld: number,
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => ScreenPt,
): ProjectedQuad {
  const zVisual = overlay.z + (overlay.zVisualOffsetUnits ?? 0);
  const bounds = resolveMonolithicFootprintTileBoundsForOverlay(overlay as StampOverlay);
  const minWorldX = bounds.minTx * tileWorld;
  const minWorldY = bounds.minTy * tileWorld;
  const maxWorldX = (bounds.maxTx + 1) * tileWorld;
  const maxWorldY = (bounds.maxTy + 1) * tileWorld;
  return [
    toScreenAtZ(minWorldX, minWorldY, zVisual),
    toScreenAtZ(maxWorldX, minWorldY, zVisual),
    toScreenAtZ(maxWorldX, maxWorldY, zVisual),
    toScreenAtZ(minWorldX, maxWorldY, zVisual),
  ];
}

function resolveTriangleCentroid(triangle: RuntimeStructureTrianglePiece): ScreenPt {
  const [a, b, c] = triangle.points;
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
  };
}

export function resolveRuntimeStructureSemanticRoofQuad(input: {
  overlay: Pick<StampOverlay, "seTx" | "seTy" | "z" | "zVisualOffsetUnits" | "w" | "h">;
  triangleCache: Pick<RuntimeStructureTriangleCache, "triangles">;
  tileWorld: number;
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => ScreenPt;
}): ProjectedQuad | null {
  if (input.triangleCache.triangles.length <= 0) return null;
  const bounds = resolveMonolithicFootprintTileBoundsForOverlay(input.overlay as StampOverlay);
  const footprintW = Math.max(1, bounds.maxTx - bounds.minTx + 1);
  const footprintH = Math.max(1, bounds.maxTy - bounds.minTy + 1);
  const baseQuad = buildProjectedStructureFootprintQuad(input.overlay, input.tileWorld, input.toScreenAtZ);
  const triangleCentroids = input.triangleCache.triangles.map(resolveTriangleCentroid);
  const supportScan = scanLiftedFootprintSupportLevels(
    baseQuad,
    footprintW,
    footprintH,
    triangleCentroids,
  );
  const activeLevelIndex = supportScan.highestValidLevel >= 0 ? supportScan.highestValidLevel : 0;
  return supportScan.levels[Math.min(activeLevelIndex, supportScan.levels.length - 1)]?.quad ?? null;
}

export function buildRuntimeStructureTriangleSemanticContext(input: {
  overlay: Pick<StampOverlay, "seTx" | "seTy" | "z" | "zVisualOffsetUnits" | "w" | "h">;
  triangleCache: Pick<RuntimeStructureTriangleCache, "triangles" | "parentTileGroups">;
  tileWorld: number;
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => ScreenPt;
}): RuntimeStructureTriangleSemanticContext {
  const bounds = resolveMonolithicFootprintTileBoundsForOverlay(input.overlay as StampOverlay);
  const footprintW = Math.max(1, bounds.maxTx - bounds.minTx + 1);
  const footprintH = Math.max(1, bounds.maxTy - bounds.minTy + 1);
  const progressionByOwnerTile = new Map<string, { min: number; max: number }>();
  const bandOwners = input.triangleCache.parentTileGroups.length > 0
    ? input.triangleCache.parentTileGroups.map((group) => ({
      bandIndex: group.bandIndex,
      parentTx: group.parentTx,
      parentTy: group.parentTy,
    }))
    : input.triangleCache.triangles.map((triangle) => ({
      bandIndex: triangle.bandIndex,
      parentTx: triangle.parentTx,
      parentTy: triangle.parentTy,
    }));
  for (let i = 0; i < bandOwners.length; i++) {
    const owner = bandOwners[i];
    const ownerKey = `${owner.parentTx},${owner.parentTy}`;
    const progression = resolveRuntimeStructureBandProgressionIndex(owner.bandIndex, footprintW, footprintH);
    const existing = progressionByOwnerTile.get(ownerKey);
    if (!existing) {
      progressionByOwnerTile.set(ownerKey, { min: progression, max: progression });
      continue;
    }
    if (progression < existing.min) existing.min = progression;
    if (progression > existing.max) existing.max = progression;
  }
  return {
    activeRoofQuad: resolveRuntimeStructureSemanticRoofQuad(input),
    leftSouthMaxProgression: footprintW - 1,
    rightEastMinProgression: footprintW,
    progressionByOwnerTile,
  };
}

export function classifyRuntimeStructureTriangleSemantic(
  triangle: RuntimeStructureTrianglePiece,
  context: RuntimeStructureTriangleSemanticContext,
): RuntimeStructureTriangleSemanticClass {
  const centroid = resolveTriangleCentroid(triangle);
  const isTop = !!context.activeRoofQuad
    && isPointInsideQuad(context.activeRoofQuad, centroid.x, centroid.y);
  if (isTop) return "TOP";
  if (triangle.semanticSide !== undefined) return triangle.semanticSide;
  const ownerKey = `${triangle.parentTx},${triangle.parentTy}`;
  const ownerRange = context.progressionByOwnerTile.get(ownerKey);
  const leftCandidate = !!ownerRange && ownerRange.min <= context.leftSouthMaxProgression;
  const rightCandidate = !!ownerRange && ownerRange.max >= context.rightEastMinProgression;
  if (leftCandidate && rightCandidate) return "CONFLICT";
  if (leftCandidate) return "LEFT_SOUTH";
  if (rightCandidate) return "RIGHT_EAST";
  return "UNCLASSIFIED";
}

export function buildRuntimeStructureTriangleSemanticMap(input: {
  overlay: Pick<StampOverlay, "seTx" | "seTy" | "z" | "zVisualOffsetUnits" | "w" | "h">;
  triangleCache: Pick<RuntimeStructureTriangleCache, "triangles" | "parentTileGroups">;
  tileWorld: number;
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => ScreenPt;
  triangles?: readonly RuntimeStructureTrianglePiece[];
}): Map<number, RuntimeStructureTriangleSemanticClass> {
  const infoByStableId = buildRuntimeStructureTriangleSemanticInfoMap(input);
  const byStableId = new Map<number, RuntimeStructureTriangleSemanticClass>();
  for (const [stableId, info] of infoByStableId) byStableId.set(stableId, info.semantic);
  return byStableId;
}

function resolveRuntimeStructureTriangleSemanticFace(
  semantic: RuntimeStructureTriangleSemanticClass,
): RuntimeStructureTriangleSemanticFace {
  if (semantic === "TOP") return "UP";
  if (semantic === "RIGHT_EAST") return "EAST";
  if (semantic === "LEFT_SOUTH" || semantic === "CONFLICT") return "SOUTH";
  return "UP";
}

export function buildRuntimeStructureTriangleSemanticInfoMap(input: {
  overlay: Pick<StampOverlay, "seTx" | "seTy" | "z" | "zVisualOffsetUnits" | "w" | "h">;
  triangleCache: Pick<RuntimeStructureTriangleCache, "triangles" | "parentTileGroups">;
  tileWorld: number;
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => ScreenPt;
  triangles?: readonly RuntimeStructureTrianglePiece[];
}): Map<number, RuntimeStructureTriangleSemanticInfo> {
  const context = buildRuntimeStructureTriangleSemanticContext(input);
  const triangles = input.triangles ?? input.triangleCache.triangles;
  const semanticByStableId = new Map<number, RuntimeStructureTriangleSemanticClass>();
  for (let i = 0; i < triangles.length; i++) {
    const triangle = triangles[i];
    semanticByStableId.set(
      triangle.stableId,
      classifyRuntimeStructureTriangleSemantic(triangle, context),
    );
  }
  const bySlice = new Map<number, RuntimeStructureTrianglePiece[]>();
  for (let i = 0; i < triangles.length; i++) {
    const triangle = triangles[i];
    const slice = bySlice.get(triangle.sliceIndex);
    if (slice) slice.push(triangle);
    else bySlice.set(triangle.sliceIndex, [triangle]);
  }
  const byStableId = new Map<number, RuntimeStructureTriangleSemanticInfo>();
  for (const sliceTriangles of bySlice.values()) {
    sliceTriangles.sort((a, b) => {
      const centroidA = resolveTriangleCentroid(a);
      const centroidB = resolveTriangleCentroid(b);
      if (centroidB.y !== centroidA.y) return centroidB.y - centroidA.y;
      return a.stableId - b.stableId;
    });
    let encounteredRoof = false;
    for (let i = 0; i < sliceTriangles.length; i++) {
      const triangle = sliceTriangles[i];
      const semantic = semanticByStableId.get(triangle.stableId) ?? "UNCLASSIFIED";
      const semanticFace = resolveRuntimeStructureTriangleSemanticFace(semantic);
      if (semanticFace === "UP") encounteredRoof = true;
      byStableId.set(triangle.stableId, {
        semantic,
        semanticFace,
        semanticRole: semanticFace === "UP"
          ? "STRUCTURAL"
          : encounteredRoof
            ? "OVERHANG"
            : "STRUCTURAL",
      });
    }
  }
  return byStableId;
}

export function applyRuntimeStructureTriangleSemanticInfoMap(
  triangleCache: Pick<RuntimeStructureTriangleCache, "triangles" | "maxSideHeightLevel" | "maxSideHeightPx">,
  semanticInfoByStableId: ReadonlyMap<number, RuntimeStructureTriangleSemanticInfo>,
): void {
  for (let i = 0; i < triangleCache.triangles.length; i++) {
    const triangle = triangleCache.triangles[i];
    const semanticInfo = semanticInfoByStableId.get(triangle.stableId);
    if (!semanticInfo) continue;
    triangle.semanticFace = semanticInfo.semanticFace;
    triangle.semanticRole = semanticInfo.semanticRole;
    triangle.height = triangle.heightFromParentLevel;
  }
  const structuralMaxSideHeight = resolveRuntimeStructureTriangleCacheMaxSideHeight(triangleCache.triangles);
  triangleCache.maxSideHeightLevel = structuralMaxSideHeight.level;
  triangleCache.maxSideHeightPx = structuralMaxSideHeight.px;
}
