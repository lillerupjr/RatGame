import { screenToWorld, worldToScreen, ISO_X } from "../../engine/math/iso";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { getTileSpriteById, type LoadedImg } from "../../engine/render/sprites/renderSprites";
import {
  overlaysInView,
  getActiveMap as getActiveCompiledMap,
  type StampOverlay,
  type ViewRect,
} from "../map/compile/kenneyMap";
import {
  getRequiredMonolithicBuildingSemanticGeometryForSprite,
  STRUCTURE_TRIANGLE_HEIGHT_STEP_PX,
  resolveMonolithicFootprintTopLeftFromSeAnchor,
  resolveMonolithicFootprintTileBoundsFromSeAnchor,
  type MonolithicBuildingSemanticGeometry,
  type MonolithicBuildingSemanticSliceEntry,
} from "./monolithicBuildingSemanticPrepass";

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

export type RuntimeStructureTriangleSemanticSide =
  | "LEFT_SOUTH"
  | "RIGHT_EAST"
  | "CONFLICT"
  | "UNCLASSIFIED";

export type RuntimeStructureTriangleSemanticFace = "UP" | "EAST" | "SOUTH";

export type RuntimeStructureTriangleSemanticRole = "STRUCTURAL" | "OVERHANG";

export type RuntimeStructureTriangleSemanticClass =
  | "TOP"
  | RuntimeStructureTriangleSemanticSide;

export type RuntimeStructureTriangleSemanticHeight = {
  level: number;
  px: number;
};

export type RuntimeStructureTrianglePiece = {
  structureInstanceId: string;
  stableId: number;
  sliceIndex: number;
  bandIndex: number;
  points: [RuntimeStructureTrianglePoint, RuntimeStructureTrianglePoint, RuntimeStructureTrianglePoint];
  srcPoints: [RuntimeStructureTrianglePoint, RuntimeStructureTrianglePoint, RuntimeStructureTrianglePoint];
  basePoint: RuntimeStructureTrianglePoint;
  feetSortY: number;
  ownerTx: number;
  ownerTy: number;
  admissionTx: number;
  admissionTy: number;
  parentTx: number;
  parentTy: number;
  triangleTx: number;
  triangleTy: number;
  cameraTx: number;
  cameraTy: number;
  semanticSide?: RuntimeStructureTriangleSemanticSide;
  semanticFace: RuntimeStructureTriangleSemanticFace;
  semanticRole: RuntimeStructureTriangleSemanticRole;
  height: number;
  heightFromParentLevel: number;
  heightFromParentPx: number;
  localBounds: RuntimeStructureTriangleRect;
  srcRectLocal: RuntimeStructureTriangleRect;
  dstRectLocal: RuntimeStructureTriangleRect;
};

export type RuntimeStructureParentTileGroup = {
  structureInstanceId: string;
  sliceIndex: number;
  bandIndex: number;
  parentTx: number;
  parentTy: number;
  feetSortY: number;
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
  maxSideHeightLevel: number;
  maxSideHeightPx: number;
  monolithic?: MonolithicStructureGeometry | null;
};

export type RuntimeStructureTriangleBuildResult = {
  pendingCount: number;
  failedCount: number;
  builtCount: number;
  fallbackCount: number;
  pendingKeys: string[];
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

export type RuntimeStructureTriangleContextKeyInput = {
  mapId: string;
};

export type RuntimeStructureTriangleGeometrySignatureInput = {
  structureInstanceId: string;
  spriteId: string;
  semanticKey?: string;
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

export type RuntimeStructureTriangleProjectedDraw = {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  flipX: boolean;
  scale: number;
  anchorPlacementDebugNoCamera?: RuntimeStructureAnchorPlacementDebug;
};

export type RuntimeStructureAnchorPlacementDebug = {
  mode: "computed_anchor" | "legacy_metadata";
  reservedSeCornerScreenNoCamera: RuntimeStructureTrianglePoint;
  computedAnchorScreenNoCamera?: RuntimeStructureTrianglePoint;
  anchorDerivedWorldCornerScreenNoCamera?: RuntimeStructureTrianglePoint;
  alignmentDeltaPx?: RuntimeStructureTrianglePoint;
  anchorSpriteLocal?: RuntimeStructureTrianglePoint;
};

export type RuntimeStructureTriangleAssetState = "READY" | "PENDING" | "FAILED";

export type MonolithicStructureGeometry = MonolithicBuildingSemanticGeometry & {
  anchorSpriteLocal: RuntimeStructureTrianglePoint;
  bboxSpriteLocal: RuntimeStructureTriangleRect;
  anchorResult: NonNullable<MonolithicBuildingSemanticGeometry["anchorResult"]>;
  occupiedBoundsPx: NonNullable<MonolithicBuildingSemanticGeometry["occupiedBoundsPx"]>;
  workRectSpriteLocal: RuntimeStructureTriangleRect;
  workAnchorLocal: RuntimeStructureTrianglePoint;
};

const STRUCTURE_ELEV_PX = 16;

function q(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0;
  const safeStep = Math.max(1e-6, Math.abs(step));
  return Math.round(value / safeStep) * safeStep;
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

function groupStableId(
  structureInstanceId: string,
  sliceIndex: number,
  bandIndex: number,
  parentTx: number,
  parentTy: number,
  feetSortY: number,
): number {
  return hashString32(
    `${structureInstanceId}:group:${sliceIndex}:${bandIndex}:${parentTx}:${parentTy}:${q(feetSortY, 0.001)}`,
  );
}

export function resolveTriangleBaseReferencePoint(
  a: RuntimeStructureTrianglePoint,
  b: RuntimeStructureTrianglePoint,
  c: RuntimeStructureTrianglePoint,
): RuntimeStructureTrianglePoint {
  const points = [a, b, c];
  const maxY = Math.max(a.y, b.y, c.y);
  const eps = 1e-4;
  const bottomCandidates = points.filter((p) => p.y >= maxY - eps);
  if (bottomCandidates.length <= 0) {
    return { x: a.x, y: a.y };
  }
  if (bottomCandidates.length === 1) {
    return { x: bottomCandidates[0].x, y: bottomCandidates[0].y };
  }

  // Use the midpoint of the widest bottom edge as the base-defining reference.
  let bestI = 0;
  let bestJ = 1;
  let bestDistSq = Number.NEGATIVE_INFINITY;
  let bestMidX = (bottomCandidates[0].x + bottomCandidates[1].x) * 0.5;
  let bestMidY = (bottomCandidates[0].y + bottomCandidates[1].y) * 0.5;
  for (let i = 0; i < bottomCandidates.length; i++) {
    for (let j = i + 1; j < bottomCandidates.length; j++) {
      const p0 = bottomCandidates[i];
      const p1 = bottomCandidates[j];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const distSq = dx * dx + dy * dy;
      const midX = (p0.x + p1.x) * 0.5;
      const midY = (p0.y + p1.y) * 0.5;
      if (distSq > bestDistSq + eps) {
        bestDistSq = distSq;
        bestI = i;
        bestJ = j;
        bestMidX = midX;
        bestMidY = midY;
        continue;
      }
      if (Math.abs(distSq - bestDistSq) <= eps) {
        if (midY > bestMidY + eps || (Math.abs(midY - bestMidY) <= eps && midX > bestMidX + eps)) {
          bestI = i;
          bestJ = j;
          bestMidX = midX;
          bestMidY = midY;
        }
      }
    }
  }
  const p0 = bottomCandidates[bestI];
  const p1 = bottomCandidates[bestJ];
  return {
    x: (p0.x + p1.x) * 0.5,
    y: (p0.y + p1.y) * 0.5,
  };
}

function tileForTriangleBaseReferencePoint(
  basePoint: RuntimeStructureTrianglePoint,
): { tx: number; ty: number } {
  const world = screenToWorld(basePoint.x, basePoint.y + 1e-4);
  const tileWorld = Math.max(1, KENNEY_TILE_WORLD);
  return {
    tx: Math.floor(world.x / tileWorld),
    ty: Math.floor(world.y / tileWorld),
  };
}

function localBoundsOfTriangle(
  a: RuntimeStructureTrianglePoint,
  b: RuntimeStructureTrianglePoint,
  c: RuntimeStructureTrianglePoint,
): RuntimeStructureTriangleRect {
  const minX = Math.min(a.x, b.x, c.x);
  const minY = Math.min(a.y, b.y, c.y);
  const maxX = Math.max(a.x, b.x, c.x);
  const maxY = Math.max(a.y, b.y, c.y);
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
  };
}

function resolveMonolithicSliceParentTileForOverlay(
  overlay: StampOverlay,
  geometry: MonolithicStructureGeometry,
  sliceEntry: Pick<
    MonolithicBuildingSemanticSliceEntry,
    "parentFootprintOffsetTx" | "parentFootprintOffsetTy"
  >,
): { tx: number; ty: number } {
  const topLeft = resolveMonolithicFootprintTopLeftFromSeAnchor(
    overlay.seTx,
    overlay.seTy,
    geometry.n,
    geometry.m,
  );
  return {
    tx: topLeft.tx + sliceEntry.parentFootprintOffsetTx,
    ty: topLeft.ty + sliceEntry.parentFootprintOffsetTy,
  };
}

function projectTileCenterFeetSortYNoCamera(
  tx: number,
  ty: number,
  zVisual: number,
): number {
  const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
  return worldToScreen(wx, wy).y - zVisual * STRUCTURE_ELEV_PX;
}

function monolithicSemanticLookupForOverlay(
  overlay: StampOverlay,
): { skinId: string; spriteId: string } | null {
  if (overlay.layerRole !== "STRUCTURE") return null;
  const skinId = (overlay.monolithicSemanticSkinId ?? "").trim();
  const spriteId = (overlay.monolithicSemanticSpriteId ?? overlay.spriteId ?? "").trim();
  if (!skinId || !spriteId) return null;
  return { skinId, spriteId };
}

export function resolveMonolithicStructureGeometryForOverlay(
  overlay: StampOverlay,
  input?: { flipX?: boolean; context?: string },
): MonolithicStructureGeometry | null {
  const lookup = monolithicSemanticLookupForOverlay(overlay);
  if (!lookup) return null;
  const geometry = getRequiredMonolithicBuildingSemanticGeometryForSprite(
    lookup.skinId,
    lookup.spriteId,
    input?.context ?? `overlay:${overlay.id}`,
    { flipX: !!input?.flipX },
  );
  if (
    !geometry.anchorSpriteLocal
    || !geometry.bboxSpriteLocal
    || !geometry.anchorResult
    || !geometry.occupiedBoundsPx
    || !geometry.workRectSpriteLocal
    || !geometry.workAnchorLocal
  ) {
    return null;
  }
  return geometry as MonolithicStructureGeometry;
}

export function resolveMonolithicFootprintDimensionsForOverlay(
  overlay: StampOverlay,
): { w: number; h: number; semanticKey?: string } {
  const geometry = resolveMonolithicStructureGeometryForOverlay(overlay, {
    flipX: !!overlay.flipX,
    context: `footprint-dimensions:${overlay.id}`,
  });
  if (geometry) {
    return {
      w: Math.max(1, geometry.n | 0),
      h: Math.max(1, geometry.m | 0),
      semanticKey: geometry.semanticKey,
    };
  }
  return {
    w: Math.max(1, overlay.w | 0),
    h: Math.max(1, overlay.h | 0),
  };
}

export function resolveMonolithicFootprintTileBoundsForOverlay(
  overlay: StampOverlay,
): { minTx: number; maxTx: number; minTy: number; maxTy: number } {
  const footprint = resolveMonolithicFootprintDimensionsForOverlay(overlay);
  return resolveMonolithicFootprintTileBoundsFromSeAnchor(
    overlay.seTx,
    overlay.seTy,
    footprint.w,
    footprint.h,
  );
}

export function groupRuntimeStructureTrianglesBySliceParent(
  structureInstanceId: string,
  pieces: RuntimeStructureTrianglePiece[],
  input?: { zVisual?: number },
): RuntimeStructureParentTileGroup[] {
  const byParent = new Map<string, RuntimeStructureParentTileGroup>();
  const zVisual = input?.zVisual ?? 0;
  for (let i = 0; i < pieces.length; i++) {
    const tri = pieces[i];
    const feetSortY = q(projectTileCenterFeetSortYNoCamera(tri.parentTx, tri.parentTy, zVisual), 0.001);
    const key = `${tri.sliceIndex}:${tri.bandIndex}:${tri.parentTx},${tri.parentTy}`;
    const existing = byParent.get(key);
    if (!existing) {
      byParent.set(key, {
        structureInstanceId,
        sliceIndex: tri.sliceIndex,
        bandIndex: tri.bandIndex,
        parentTx: tri.parentTx,
        parentTy: tri.parentTy,
        feetSortY,
        triangles: [tri],
        localBounds: { ...tri.localBounds },
        stableId: groupStableId(structureInstanceId, tri.sliceIndex, tri.bandIndex, tri.parentTx, tri.parentTy, feetSortY),
      });
      continue;
    }
    existing.triangles.push(tri);
    const b = existing.localBounds;
    const minX = Math.min(b.x, tri.localBounds.x);
    const minY = Math.min(b.y, tri.localBounds.y);
    const maxX = Math.max(b.x + b.w, tri.localBounds.x + tri.localBounds.w);
    const maxY = Math.max(b.y + b.h, tri.localBounds.y + tri.localBounds.h);
    existing.localBounds = {
      x: minX,
      y: minY,
      w: Math.max(0, maxX - minX),
      h: Math.max(0, maxY - minY),
    };
  }
  return Array.from(byParent.values()).sort((a, b) => (
    a.bandIndex - b.bandIndex
    || a.sliceIndex - b.sliceIndex
    || a.parentTy - b.parentTy
    || a.parentTx - b.parentTx
  ));
}

export function buildRuntimeTrianglesFromMonolithicGeometry(
  overlay: StampOverlay,
  draw: RuntimeStructureTriangleProjectedDraw,
  geometry: MonolithicStructureGeometry,
): RuntimeStructureTrianglePiece[] {
  const out: RuntimeStructureTrianglePiece[] = [];
  const scale = draw.scale ?? 1;
  for (let si = 0; si < geometry.sliceEntries.length; si++) {
    const sliceEntry = geometry.sliceEntries[si];
    const parentTile = resolveMonolithicSliceParentTileForOverlay(overlay, geometry, sliceEntry);
    for (let ti = 0; ti < sliceEntry.triangles.length; ti++) {
      const tri = sliceEntry.triangles[ti];
      const s0 = { x: tri.a.x, y: tri.a.y };
      const s1 = { x: tri.b.x, y: tri.b.y };
      const s2 = { x: tri.c.x, y: tri.c.y };
      const d0 = { x: draw.dx + s0.x * scale, y: draw.dy + s0.y * scale };
      const d1 = { x: draw.dx + s1.x * scale, y: draw.dy + s1.y * scale };
      const d2 = { x: draw.dx + s2.x * scale, y: draw.dy + s2.y * scale };
      const bounds = localBoundsOfTriangle(d0, d1, d2);
      const srcRect = localBoundsOfTriangle(s0, s1, s2);
      const basePoint = resolveTriangleBaseReferencePoint(d0, d1, d2);
      const baseTile = tileForTriangleBaseReferencePoint(basePoint);
      out.push({
        structureInstanceId: overlay.id,
        stableId: triangleStableId(overlay.id, sliceEntry.bandIndex, out.length),
        sliceIndex: sliceEntry.index,
        bandIndex: sliceEntry.bandIndex,
        points: [d0, d1, d2],
        srcPoints: [s0, s1, s2],
        basePoint,
        feetSortY: basePoint.y,
        ownerTx: parentTile.tx,
        ownerTy: parentTile.ty,
        admissionTx: baseTile.tx,
        admissionTy: baseTile.ty,
        parentTx: parentTile.tx,
        parentTy: parentTile.ty,
        triangleTx: baseTile.tx,
        triangleTy: baseTile.ty,
        cameraTx: baseTile.tx,
        cameraTy: baseTile.ty,
        semanticFace: "UP",
        semanticRole: "STRUCTURAL",
        height: 0,
        heightFromParentLevel: 0,
        heightFromParentPx: 0,
        localBounds: bounds,
        srcRectLocal: srcRect,
        dstRectLocal: bounds,
      });
    }
  }
  assignRuntimeTriangleSemanticSidesAndHeights(out, geometry.n, geometry.m);
  return out;
}

function resolveRuntimeTriangleHeightFromParentLevel(
  triangle: Pick<RuntimeStructureTrianglePiece, "cameraTx" | "cameraTy" | "parentTx" | "parentTy">,
  semanticSide: RuntimeStructureTriangleSemanticSide,
): number {
  const dx = Math.abs((triangle.cameraTx | 0) - (triangle.parentTx | 0));
  const dy = Math.abs((triangle.cameraTy | 0) - (triangle.parentTy | 0));
  if (semanticSide === "LEFT_SOUTH") return dx;
  if (semanticSide === "RIGHT_EAST") return dy;
  if (semanticSide === "CONFLICT") return Math.max(dx, dy);
  return 0;
}

function resolveRuntimeTriangleSemanticFace(
  semanticSide: RuntimeStructureTriangleSemanticSide,
): RuntimeStructureTriangleSemanticFace {
  if (semanticSide === "RIGHT_EAST") return "EAST";
  if (semanticSide === "LEFT_SOUTH" || semanticSide === "CONFLICT") return "SOUTH";
  return "UP";
}

function assignRuntimeTriangleSemanticSidesAndHeights(
  triangles: RuntimeStructureTrianglePiece[],
  footprintW: number,
  footprintH: number,
): void {
  const safeW = Math.max(1, footprintW | 0);
  const safeH = Math.max(1, footprintH | 0);
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    let semanticSide: RuntimeStructureTriangleSemanticSide = "UNCLASSIFIED";
    const progression = resolveRuntimeStructureBandProgressionIndex(tri.bandIndex, safeW, safeH);
    if (Number.isFinite(progression) && progression < safeW) {
      semanticSide = "LEFT_SOUTH";
    } else if (Number.isFinite(progression)) {
      semanticSide = "RIGHT_EAST";
    }
    tri.semanticSide = semanticSide;
    tri.semanticFace = resolveRuntimeTriangleSemanticFace(semanticSide);
    tri.semanticRole = "STRUCTURAL";
    tri.heightFromParentLevel = resolveRuntimeTriangleHeightFromParentLevel(tri, semanticSide);
    tri.height = tri.heightFromParentLevel;
    tri.heightFromParentPx = tri.heightFromParentLevel * STRUCTURE_TRIANGLE_HEIGHT_STEP_PX;
  }
}

export function resolveRuntimeStructureTriangleCacheMaxSideHeight(
  triangles: readonly Pick<
    RuntimeStructureTrianglePiece,
    "semanticFace" | "semanticRole" | "heightFromParentLevel" | "heightFromParentPx"
  >[],
): RuntimeStructureTriangleSemanticHeight {
  let level = 0;
  let px = 0;
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    if (tri.semanticRole !== "STRUCTURAL") continue;
    if (tri.semanticFace !== "EAST" && tri.semanticFace !== "SOUTH") continue;
    if (tri.heightFromParentLevel > level) level = tri.heightFromParentLevel;
    if (tri.heightFromParentPx > px) px = tri.heightFromParentPx;
  }
  return { level, px };
}

export function resolveRuntimeStructureTriangleSemanticHeight(
  triangle: Pick<RuntimeStructureTrianglePiece, "heightFromParentLevel" | "heightFromParentPx">,
  semantic: RuntimeStructureTriangleSemanticClass,
  triangleCache: Pick<RuntimeStructureTriangleCache, "maxSideHeightLevel" | "maxSideHeightPx">,
): RuntimeStructureTriangleSemanticHeight {
  const safeTriangleLevel = Number.isFinite(triangle.heightFromParentLevel) ? Math.max(0, triangle.heightFromParentLevel) : 0;
  const safeTrianglePx = Number.isFinite(triangle.heightFromParentPx) ? Math.max(0, triangle.heightFromParentPx) : 0;
  const safeCacheLevel = Number.isFinite(triangleCache.maxSideHeightLevel) ? Math.max(0, triangleCache.maxSideHeightLevel) : 0;
  const safeCachePx = Number.isFinite(triangleCache.maxSideHeightPx) ? Math.max(0, triangleCache.maxSideHeightPx) : 0;
  if (semantic === "TOP") {
    return {
      level: safeCacheLevel,
      px: safeCachePx,
    };
  }
  if (semantic === "UNCLASSIFIED") {
    return { level: 0, px: 0 };
  }
  return {
    level: safeTriangleLevel,
    px: safeTrianglePx,
  };
}

function buildRuntimeStructureTriangleCache(
  overlay: StampOverlay,
  structureInstanceId: string,
  spriteId: string,
  geometrySignature: string,
  geometry: MonolithicStructureGeometry,
  triangles: RuntimeStructureTrianglePiece[],
): RuntimeStructureTriangleCache {
  const maxSideHeight = resolveRuntimeStructureTriangleCacheMaxSideHeight(triangles);
  return {
    structureInstanceId,
    spriteId,
    geometrySignature,
    triangles,
    parentTileGroups: groupRuntimeStructureTrianglesBySliceParent(structureInstanceId, triangles, {
      zVisual: overlay.z + (overlay.zVisualOffsetUnits ?? 0),
    }),
    maxSideHeightLevel: maxSideHeight.level,
    maxSideHeightPx: maxSideHeight.px,
    monolithic: geometry,
  };
}

export function buildRuntimeStructureTriangleContextKey(
  input: RuntimeStructureTriangleContextKeyInput,
): string {
  return `map:${input.mapId}`;
}

export function buildRuntimeStructureTriangleGeometrySignature(
  input: RuntimeStructureTriangleGeometrySignatureInput,
): string {
  return [
    `id:${input.structureInstanceId}`,
    `sprite:${input.spriteId}`,
    `semantic:${input.semanticKey ?? "none"}`,
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

export function runtimeStructureTriangleGeometrySignatureForOverlay(
  overlay: StampOverlay,
  draw: RuntimeStructureTriangleProjectedDraw,
): string {
  const footprint = resolveMonolithicFootprintDimensionsForOverlay(overlay);
  return buildRuntimeStructureTriangleGeometrySignature({
    structureInstanceId: overlay.id,
    spriteId: overlay.spriteId,
    semanticKey: footprint.semanticKey,
    seTx: overlay.seTx,
    seTy: overlay.seTy,
    footprintW: footprint.w,
    footprintH: footprint.h,
    flipX: !!draw.flipX,
    scale: draw.scale,
    baseDx: draw.dx,
    baseDy: draw.dy,
    spriteWidth: draw.dw,
    spriteHeight: draw.dh,
    sliceOffsetX: overlay.sliceOffsetPx?.x ?? 0,
    sliceOffsetY: overlay.sliceOffsetPx?.y ?? 0,
    sliceOriginX: overlay.sliceOriginPx?.x,
    baseZ: overlay.z,
  });
}

export function mapWideOverlayViewRect(
  compiledMap: ReturnType<typeof getActiveCompiledMap>,
): ViewRect {
  const minTx = compiledMap.originTx;
  const minTy = compiledMap.originTy;
  const maxTx = minTx + Math.max(1, compiledMap.width) - 1;
  const maxTy = minTy + Math.max(1, compiledMap.height) - 1;
  return { minTx, maxTx, minTy, maxTy };
}

export function collectMapWideStructureOverlays(
  compiledMap: ReturnType<typeof getActiveCompiledMap>,
): StampOverlay[] {
  const allOverlays = overlaysInView(mapWideOverlayViewRect(compiledMap));
  const out: StampOverlay[] = [];
  for (let i = 0; i < allOverlays.length; i++) {
    const overlay = allOverlays[i];
    if (overlay.layerRole !== "STRUCTURE") continue;
    out.push(overlay);
  }
  return out;
}

export function buildRuntimeStructureProjectedDraw(
  overlay: StampOverlay,
  image: HTMLImageElement,
): RuntimeStructureTriangleProjectedDraw {
  return resolveRuntimeStructureOverlayPlacementNoCamera(overlay, image);
}

function buildLegacyRuntimeStructureProjectedDraw(
  overlay: StampOverlay,
  image: HTMLImageElement,
): RuntimeStructureTriangleProjectedDraw {
  const tileWorld = KENNEY_TILE_WORLD;
  const elevPx = 16;
  const scale = overlay.scale ?? 1;
  const spriteW = image.width;
  const spriteH = image.height;
  const southY = overlay.ty + overlay.h - 1;
  const anchorTx = overlay.anchorTx ?? (overlay.w >= overlay.h ? (overlay.tx + overlay.w - 1) : overlay.tx);
  const anchorTy = overlay.anchorTy ?? southY;
  const footprintW = Math.max(1, overlay.w | 0);
  const isFootprintOverlay =
    overlay.layerRole === "STRUCTURE" || ((overlay.kind ?? "ROOF") === "PROP" && (footprintW > 1 || (overlay.h | 0) > 1));
  const tileWidth = 2 * tileWorld * ISO_X;
  const halfTileW = tileWidth * 0.5;
  const footprintAnchorAdjustX = isFootprintOverlay
    ? ((overlay.h - overlay.w) * halfTileW) * 0.5
    : 0;
  const wx = (anchorTx + 0.5) * tileWorld;
  const wy = (anchorTy + 0.5) * tileWorld;
  const projected = worldToScreen(wx, wy);
  const zVisual = overlay.z + (overlay.zVisualOffsetUnits ?? 0);
  const dx = projected.x - spriteW * scale * 0.5 + (overlay.drawDxOffset ?? 0) + footprintAnchorAdjustX;
  const dy = projected.y - spriteH * scale - zVisual * elevPx - (overlay.drawDyOffset ?? 0);
  const anchorSpriteLocal = { x: spriteW * 0.5, y: spriteH };
  const computedAnchorScreenNoCamera = {
    x: dx + anchorSpriteLocal.x * scale,
    y: dy + anchorSpriteLocal.y * scale,
  };
  const reservedSeCornerScreenNoCamera = worldToScreen(
    (overlay.seTx + 1) * tileWorld,
    (overlay.seTy + 1) * tileWorld,
  );
  return {
    dx,
    dy,
    dw: spriteW,
    dh: spriteH,
    flipX: !!overlay.flipX,
    scale,
    anchorPlacementDebugNoCamera: {
      mode: "legacy_metadata",
      reservedSeCornerScreenNoCamera,
      computedAnchorScreenNoCamera,
      alignmentDeltaPx: {
        x: computedAnchorScreenNoCamera.x - reservedSeCornerScreenNoCamera.x,
        y: computedAnchorScreenNoCamera.y - reservedSeCornerScreenNoCamera.y,
      },
      anchorSpriteLocal,
    },
  };
}

export function resolveRuntimeStructureOverlayPlacementNoCamera(
  overlay: StampOverlay,
  image: HTMLImageElement,
): RuntimeStructureTriangleProjectedDraw {
  const legacy = buildLegacyRuntimeStructureProjectedDraw(overlay, image);
  if (overlay.layerRole !== "STRUCTURE") return legacy;

  const tileWorld = KENNEY_TILE_WORLD;
  const scale = overlay.scale ?? 1;
  const spriteW = image.width;
  const spriteH = image.height;
  const flipX = !!overlay.flipX;
  const geometry = resolveMonolithicStructureGeometryForOverlay(overlay, {
    flipX,
    context: `runtime-placement:${overlay.id}`,
  });
  const anchorSpriteLocal = geometry?.anchorSpriteLocal ?? null;
  if (!anchorSpriteLocal) return legacy;

  const reservedSeCornerScreenNoCamera = worldToScreen(
    (overlay.seTx + 1) * tileWorld,
    (overlay.seTy + 1) * tileWorld,
  );
  const dx = reservedSeCornerScreenNoCamera.x - anchorSpriteLocal.x * scale;
  const dy = reservedSeCornerScreenNoCamera.y - anchorSpriteLocal.y * scale;
  const computedAnchorScreenNoCamera = {
    x: dx + anchorSpriteLocal.x * scale,
    y: dy + anchorSpriteLocal.y * scale,
  };
  const anchorWorldFromComputed = screenToWorld(
    computedAnchorScreenNoCamera.x,
    computedAnchorScreenNoCamera.y,
  );
  const anchorDerivedWorldCornerScreenNoCamera = worldToScreen(
    Math.round(anchorWorldFromComputed.x / tileWorld) * tileWorld,
    Math.round(anchorWorldFromComputed.y / tileWorld) * tileWorld,
  );
  return {
    dx,
    dy,
    dw: spriteW,
    dh: spriteH,
    flipX,
    scale,
    anchorPlacementDebugNoCamera: {
      mode: "computed_anchor",
      reservedSeCornerScreenNoCamera,
      computedAnchorScreenNoCamera,
      anchorDerivedWorldCornerScreenNoCamera,
      alignmentDeltaPx: {
        x: computedAnchorScreenNoCamera.x - reservedSeCornerScreenNoCamera.x,
        y: computedAnchorScreenNoCamera.y - reservedSeCornerScreenNoCamera.y,
      },
      anchorSpriteLocal,
    },
  };
}

export function classifyRuntimeStructureTriangleAsset(
  rec: LoadedImg | null | undefined,
): RuntimeStructureTriangleAssetState {
  if (!rec) return "FAILED";
  if (rec.ready && rec.img && rec.img.naturalWidth > 0 && rec.img.naturalHeight > 0) return "READY";
  if (rec.failed || rec.unsupported) return "FAILED";
  if (rec.ready) return "FAILED";
  return "PENDING";
}

export function buildMonolithicStructureTriangleCacheForOverlay(input: {
  overlay: StampOverlay;
  image: HTMLImageElement;
  draw: RuntimeStructureTriangleProjectedDraw;
  getFlippedOverlayImage: (img: HTMLImageElement) => HTMLCanvasElement;
  alphaThreshold?: number;
  minVisiblePixels?: number;
}): { cache: RuntimeStructureTriangleCache | null; geometrySignature: string } {
  const geometrySignature = runtimeStructureTriangleGeometrySignatureForOverlay(input.overlay, input.draw);
  const geometry = resolveMonolithicStructureGeometryForOverlay(input.overlay, {
    flipX: !!input.draw.flipX,
    context: `triangle-cache:${input.overlay.id}`,
  });
  if (!geometry?.anchorSpriteLocal || geometry.sliceEntries.length <= 0) {
    return { cache: null, geometrySignature };
  }
  const triangles = buildRuntimeTrianglesFromMonolithicGeometry(input.overlay, input.draw, geometry);
  if (triangles.length <= 0) return { cache: null, geometrySignature };
  return {
    cache: buildRuntimeStructureTriangleCache(
      input.overlay,
      input.overlay.id,
      input.overlay.spriteId,
      geometrySignature,
      geometry,
      triangles,
    ),
    geometrySignature,
  };
}

export function rebuildMonolithicStructureTriangleCacheForMap(
  compiledMap: ReturnType<typeof getActiveCompiledMap>,
  deps: {
    cacheStore: RuntimeStructureTriangleCacheStore;
    getFlippedOverlayImage: (img: HTMLImageElement) => HTMLCanvasElement;
  },
): RuntimeStructureTriangleBuildResult {
  const overlays = collectMapWideStructureOverlays(compiledMap);
  let pendingCount = 0;
  let failedCount = 0;
  let builtCount = 0;
  let fallbackCount = 0;
  const pendingKeys: string[] = [];
  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];
    const rec = overlay.spriteId ? getTileSpriteById(overlay.spriteId) : null;
    const state = classifyRuntimeStructureTriangleAsset(rec);
    if (state === "PENDING") {
      pendingCount++;
      if (pendingKeys.length < 20 && overlay.spriteId) pendingKeys.push(overlay.spriteId);
      continue;
    }
    if (state === "FAILED" || !rec?.img || rec.img.width <= 0 || rec.img.height <= 0) {
      failedCount++;
      fallbackCount++;
      deps.cacheStore.markFallback(overlay.id);
      continue;
    }
    const draw = buildRuntimeStructureProjectedDraw(overlay, rec.img);
    const built = buildMonolithicStructureTriangleCacheForOverlay({
      overlay,
      image: rec.img,
      draw,
      getFlippedOverlayImage: deps.getFlippedOverlayImage,
    });
    if (!built.cache) {
      fallbackCount++;
      deps.cacheStore.markFallback(overlay.id);
      continue;
    }
    deps.cacheStore.set(built.cache);
    builtCount++;
  }
  return {
    pendingCount,
    failedCount,
    builtCount,
    fallbackCount,
    pendingKeys,
  };
}

let lastPendingSignature = "";
let lastPendingAtMs = 0;
let lastFailureKey = "";

export async function prepareMonolithicStructureTrianglesForLoading(
  deps: {
    cacheStore: RuntimeStructureTriangleCacheStore;
    getFlippedOverlayImage: (img: HTMLImageElement) => HTMLCanvasElement;
  },
): Promise<boolean> {
  const compiledMap = getActiveCompiledMap();
  const contextKey = buildRuntimeStructureTriangleContextKey({
    mapId: compiledMap.id,
  });
  deps.cacheStore.resetIfContextChanged(contextKey);
  const result = rebuildMonolithicStructureTriangleCacheForMap(compiledMap, deps);
  if (result.pendingCount > 0) {
    const signature = `${contextKey}::${result.pendingCount}::${result.failedCount}::${result.pendingKeys.join("|")}`;
    const now = performance.now();
    if (signature !== lastPendingSignature || now - lastPendingAtMs >= 1000) {
      lastPendingSignature = signature;
      lastPendingAtMs = now;
      console.debug(
        `[monolithic-structure-geometry:loading] built=${result.builtCount} pending=${result.pendingCount} failed=${result.failedCount} fallback=${result.fallbackCount}`,
        result.pendingKeys,
      );
    }
    return false;
  }
  lastPendingSignature = "";
  if (result.failedCount > 0) {
    const failureKey = `${contextKey}::${result.failedCount}::${result.fallbackCount}`;
    if (failureKey !== lastFailureKey) {
      lastFailureKey = failureKey;
      console.warn(
        `[monolithic-structure-geometry:loading] proceeding with ${result.failedCount} failed dependencies (fallback kept)`,
      );
    }
  } else {
    lastFailureKey = "";
  }
  return true;
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

export function resolveRuntimeSliceBandDiagonal(
  ownerParity: number,
  bandIndex: number,
): RuntimeSliceBandDiagonal {
  const parity = ((ownerParity | 0) + (bandIndex | 0)) & 1;
  return parity === 0 ? "A_to_Bprime" : "B_to_Aprime";
}

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

export function rectIntersects(
  a: RuntimeStructureTriangleRect,
  b: RuntimeStructureTriangleRect,
): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export function deriveParentTileRenderFields(parentTx: number, parentTy: number): { slice: number; within: number } {
  return {
    slice: parentTx + parentTy,
    within: parentTx,
  };
}

export class RuntimeStructureTriangleCacheStore {
  private contextKey: string = "";

  private cacheByStructureId = new Map<string, RuntimeStructureTriangleCache>();

  private fallbackStructureIds = new Set<string>();

  resetIfContextChanged(nextContextKey: string): boolean {
    if (this.contextKey === nextContextKey) return false;
    this.contextKey = nextContextKey;
    this.cacheByStructureId.clear();
    this.fallbackStructureIds.clear();
    return true;
  }

  set(cache: RuntimeStructureTriangleCache): void {
    this.cacheByStructureId.set(cache.structureInstanceId, cache);
    this.fallbackStructureIds.delete(cache.structureInstanceId);
  }

  get(structureInstanceId: string, geometrySignature: string): RuntimeStructureTriangleCache | undefined {
    const cache = this.cacheByStructureId.get(structureInstanceId);
    if (!cache) return undefined;
    if (cache.geometrySignature !== geometrySignature) return undefined;
    return cache;
  }

  markFallback(structureInstanceId: string): void {
    this.fallbackStructureIds.add(structureInstanceId);
    this.cacheByStructureId.delete(structureInstanceId);
  }

  isFallback(structureInstanceId: string): boolean {
    return this.fallbackStructureIds.has(structureInstanceId);
  }
}

export function getMonolithicGeometryFromCache(
  cache: RuntimeStructureTriangleCache | undefined,
): MonolithicStructureGeometry | null {
  return cache?.monolithic ?? null;
}
