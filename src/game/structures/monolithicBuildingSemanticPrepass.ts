import { getTileSpriteById } from "../../engine/render/sprites/renderSprites";
import {
  BUILDING_SKINS,
  BUILDING_PACKS,
  DEFAULT_BUILDING_PACK_ID,
  type BuildingPackId,
  type BuildingSkin,
} from "../content/buildings";
import { MONOLITHIC_BUILDING_SEMANTIC_PLACEMENT_FALLBACK } from "../content/monolithicBuildingSemanticPlacementFallback";
import type { TableMapDef } from "../map/formats/table/tableMapTypes";
import {
  buildMonolithicSliceGeometry,
  cullMonolithicTrianglesByAlphaWithDiagnostics,
  type MonolithicSliceEdgePoint,
  type MonolithicSliceTriangle,
} from "./buildMonolithicDebugSliceTriangles";
import {
  getStructureAnchorFromAlphaMap,
  type StructureAnchorResult,
  type StructureSliceDebugAlphaMap,
} from "./getStructureAnchor";
import { getStructureSlices, type StructureSliceBand } from "./getStructureSlices";
import {
  pixelHeightToSweepTileHeight,
  renderHeightUnitsToSweepTileHeight,
} from "../map/tileHeightUnits";

type RuntimeStructureTrianglePoint = { x: number; y: number };
type RuntimeStructureTriangleRect = { x: number; y: number; w: number; h: number };
type GuideSegment = { a: RuntimeStructureTrianglePoint; b: RuntimeStructureTrianglePoint };
type BuildingDir = "N" | "E" | "S" | "W";

export type MonolithicBuildingPlacementGeometry = {
  w: number;
  h: number;
  heightUnits: number;
  tileHeightUnits: number;
  source: "computed" | "fallback";
};

export type MonolithicBuildingFaceTriangleCounts = {
  leftSouth: number;
  rightEast: number;
  selected: number;
  rule: "max";
  triangleHeightPx: number;
};

export type MonolithicBuildingSemanticSliceEntry = {
  index: number;
  bandIndex: number;
  parentFootprintProgression: number;
  parentFootprintOffsetTx: number;
  parentFootprintOffsetTy: number;
  slice: StructureSliceBand;
  edgePoints: MonolithicSliceEdgePoint[];
  stripPoints: MonolithicSliceEdgePoint[];
  triangles: MonolithicSliceTriangle[];
  culledTriangles: MonolithicSliceTriangle[];
};

export type MonolithicBuildingSemanticGeometry = {
  skinId: string;
  spriteId: string;
  semanticKey: string;
  flipX: boolean;
  source: "computed" | "fallback";
  heightUnits: number;
  tileHeightUnits: number;
  faceTriangleCounts: MonolithicBuildingFaceTriangleCounts;
  n: number;
  m: number;
  anchorSpriteLocal: RuntimeStructureTrianglePoint | null;
  bboxSpriteLocal: RuntimeStructureTriangleRect | null;
  anchorResult: StructureAnchorResult | null;
  occupiedBoundsPx: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null;
  workRectSpriteLocal: RuntimeStructureTriangleRect | null;
  workAnchorLocal: RuntimeStructureTrianglePoint | null;
  slices: StructureSliceBand[];
  sliceEntries: MonolithicBuildingSemanticSliceEntry[];
  footprintCandidatesSpriteLocal: MonolithicSliceTriangle[];
  footprintLeftCount: number;
  footprintRightCount: number;
};

const PREPASS_ALPHA_THRESHOLD = 1;
const PREPASS_MIN_VISIBLE_PIXELS = 32;
const DEFAULT_HEIGHT_UNITS = 32;
const SEMANTIC_FACE_TRIANGLE_HEIGHT_PX = 64;

const semanticGeometryByKey = new Map<string, MonolithicBuildingSemanticGeometry>();
const canonicalSemanticKeyBySkinId = new Map<string, string>();
const warnedMissingBySemanticKey = new Set<string>();

type MonolithicSliceParentFootprintPosition = Pick<
  MonolithicBuildingSemanticSliceEntry,
  "parentFootprintProgression" | "parentFootprintOffsetTx" | "parentFootprintOffsetTy"
>;

type PendingMonolithicBuildingSemanticSliceEntry = Omit<
  MonolithicBuildingSemanticSliceEntry,
  "parentFootprintProgression" | "parentFootprintOffsetTx" | "parentFootprintOffsetTy"
>;

function normalizeSpriteToken(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed
    .replace(/\.png$/i, "")
    .replace(/\s*\/\s*/g, "/");
}

function semanticGeometryKey(skinId: string, spriteId: string, flipX: boolean = false): string {
  return `${skinId}::${spriteId}::flip:${flipX ? 1 : 0}`;
}

function resolveBuildingSpriteIdForDir(baseSpriteId: string, dir?: BuildingDir): string {
  if (!dir) return baseSpriteId;
  return `${baseSpriteId}/${dir.toLowerCase()}`;
}

function resolveSemanticSpriteVariantsForSkin(skin: BuildingSkin): string[] {
  const out = new Set<string>();
  const baseSpriteId = normalizeSpriteToken(skin.roof);
  if (!baseSpriteId) return [];
  out.add(baseSpriteId);
  out.add(resolveBuildingSpriteIdForDir(baseSpriteId, "N"));
  out.add(resolveBuildingSpriteIdForDir(baseSpriteId, "E"));
  out.add(resolveBuildingSpriteIdForDir(baseSpriteId, "S"));
  out.add(resolveBuildingSpriteIdForDir(baseSpriteId, "W"));
  return Array.from(out);
}

function isMonolithicBuildingDefinition(skin: BuildingSkin): boolean {
  if (!skin.roof) return false;
  if (!Array.isArray(skin.wallSouth) || !Array.isArray(skin.wallEast)) return false;
  return skin.wallSouth.every((id) => id === skin.roof) && skin.wallEast.every((id) => id === skin.roof);
}

function uniqueMonolithicBuildingSkins(): BuildingSkin[] {
  const byId = new Map<string, BuildingSkin>();
  for (const skin of Object.values(BUILDING_SKINS)) {
    if (!skin) continue;
    if (!isMonolithicBuildingDefinition(skin)) continue;
    if (!byId.has(skin.id)) byId.set(skin.id, skin);
  }
  return Array.from(byId.values());
}

function normalizeSkinToken(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed
    .replace(/\s*_\s*/g, "_")
    .replace(/\s*\/\s*/g, "/");
}

function resolveTargetMonolithicBuildingSkins(requiredSkinIds?: Iterable<string>): BuildingSkin[] {
  const all = uniqueMonolithicBuildingSkins();
  if (!requiredSkinIds) return all;
  const required = new Set<string>();
  for (const id of requiredSkinIds) {
    if (typeof id !== "string") continue;
    const normalized = normalizeSkinToken(id);
    if (normalized) required.add(normalized);
  }
  if (required.size === 0) return [];
  return all.filter((skin) => required.has(skin.id));
}

type NodeProcessWithBuiltins = NodeJS.Process & {
  getBuiltinModule?: (id: string) => unknown;
};

type NodeMonolithicSemanticAssetLoader = {
  loadAlphaMap(spriteId: string): StructureSliceDebugAlphaMap | null;
};

let cachedNodeMonolithicSemanticAssetLoader: NodeMonolithicSemanticAssetLoader | null | undefined;

function getNodeMonolithicSemanticAssetLoader(): NodeMonolithicSemanticAssetLoader | null {
  if (typeof window !== "undefined") return null;
  if (cachedNodeMonolithicSemanticAssetLoader !== undefined) {
    return cachedNodeMonolithicSemanticAssetLoader;
  }
  const processRef = globalThis.process as NodeProcessWithBuiltins | undefined;
  if (!processRef?.getBuiltinModule) {
    cachedNodeMonolithicSemanticAssetLoader = null;
    return cachedNodeMonolithicSemanticAssetLoader;
  }
  try {
    const fs = processRef.getBuiltinModule("fs") as typeof import("node:fs") | undefined;
    const path = processRef.getBuiltinModule("path") as typeof import("node:path") | undefined;
    const url = processRef.getBuiltinModule("url") as typeof import("node:url") | undefined;
    const moduleBuiltin = processRef.getBuiltinModule("module") as typeof import("node:module") | undefined;
    if (!fs || !path || !url || !moduleBuiltin) {
      cachedNodeMonolithicSemanticAssetLoader = null;
      return cachedNodeMonolithicSemanticAssetLoader;
    }
    const require = moduleBuiltin.createRequire(import.meta.url);
    const { PNG } = require("pngjs") as typeof import("pngjs");
    const repoRoot = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../../..");
    cachedNodeMonolithicSemanticAssetLoader = {
      loadAlphaMap(spriteId: string): StructureSliceDebugAlphaMap | null {
        const normalizedSpriteId = normalizeSpriteToken(spriteId);
        if (!normalizedSpriteId) return null;
        const assetPaths = [
          path.join(repoRoot, "public", "assets-runtime", "base_db32", `${normalizedSpriteId}.png`),
          path.join(repoRoot, "public", "assets-runtime", `${normalizedSpriteId}.png`),
        ];
        for (let i = 0; i < assetPaths.length; i++) {
          const assetPath = assetPaths[i];
          if (!fs.existsSync(assetPath)) continue;
          const png = PNG.sync.read(fs.readFileSync(assetPath));
          return {
            width: png.width,
            height: png.height,
            data: new Uint8ClampedArray(png.data),
          };
        }
        return null;
      },
    };
  } catch {
    cachedNodeMonolithicSemanticAssetLoader = null;
  }
  return cachedNodeMonolithicSemanticAssetLoader;
}

export function collectRequiredMonolithicBuildingSkinIdsForMap(def: TableMapDef): string[] {
  const required = new Set<string>();
  const addId = (rawId: string | undefined): void => {
    const normalizedId = normalizeSkinToken(rawId);
    if (!normalizedId) return;
    const skin = BUILDING_SKINS[normalizedId];
    if (!skin) return;
    if (!isMonolithicBuildingDefinition(skin)) return;
    required.add(skin.id);
  };
  const addPack = (rawPackId: string | undefined): void => {
    const normalizedPackId = normalizeSkinToken(rawPackId) ?? DEFAULT_BUILDING_PACK_ID;
    if (!Object.prototype.hasOwnProperty.call(BUILDING_PACKS, normalizedPackId)) return;
    const candidateIds = BUILDING_PACKS[normalizedPackId as BuildingPackId] ?? [];
    for (let i = 0; i < candidateIds.length; i++) {
      addId(candidateIds[i]);
    }
  };

  const stamps = def.stamps ?? [];
  for (let i = 0; i < stamps.length; i++) {
    const stamp = stamps[i];
    if (!stamp) continue;
    if (stamp.type === "building") {
      const stampPools = Array.isArray(stamp.pool) ? stamp.pool : [];
      addId(stamp.skinId);
      if (stampPools.length > 0) {
        for (let p = 0; p < stampPools.length; p++) {
          addPack(stampPools[p]);
        }
      } else if (!normalizeSkinToken(stamp.skinId)) {
        addPack(def.buildingPackId);
      }
      continue;
    }
    if (stamp.type !== "container") continue;
    addId(stamp.skinId);
    const containerPools = Array.isArray(stamp.pool) ? stamp.pool : [];
    for (let p = 0; p < containerPools.length; p++) {
      addPack(containerPools[p]);
    }
  }

  return Array.from(required).sort((a, b) => a.localeCompare(b));
}

function setSemanticGeometry(entry: MonolithicBuildingSemanticGeometry): void {
  const key = semanticGeometryKey(entry.skinId, entry.spriteId, entry.flipX);
  semanticGeometryByKey.set(key, entry);
  if (entry.flipX) return;
  const existingCanonicalKey = canonicalSemanticKeyBySkinId.get(entry.skinId);
  const skin = BUILDING_SKINS[entry.skinId];
  const baseSpriteId = normalizeSpriteToken(skin?.roof);
  if (!existingCanonicalKey) {
    canonicalSemanticKeyBySkinId.set(entry.skinId, key);
    return;
  }
  const existingCanonical = semanticGeometryByKey.get(existingCanonicalKey);
  const currentIsBase = baseSpriteId !== undefined && entry.spriteId === baseSpriteId;
  const existingIsBase = baseSpriteId !== undefined && existingCanonical?.spriteId === baseSpriteId;
  if (currentIsBase && !existingIsBase) {
    canonicalSemanticKeyBySkinId.set(entry.skinId, key);
  }
}

function buildPlacementOnlySemanticGeometry(input: {
  skinId: string;
  spriteId: string;
  heightUnits: number;
  tileHeightUnits?: number;
  n: number;
  m: number;
}): MonolithicBuildingSemanticGeometry {
  const tileHeightUnits = Math.max(
    pixelHeightToSweepTileHeight(SEMANTIC_FACE_TRIANGLE_HEIGHT_PX),
    input.tileHeightUnits ?? renderHeightUnitsToSweepTileHeight(input.heightUnits),
  );
  const faceTriangleCount = Math.max(
    1,
    Math.round(tileHeightUnits / pixelHeightToSweepTileHeight(SEMANTIC_FACE_TRIANGLE_HEIGHT_PX)),
  );
  return {
    skinId: input.skinId,
    spriteId: input.spriteId,
    semanticKey: semanticGeometryKey(input.skinId, input.spriteId, false),
    flipX: false,
    source: "fallback",
    heightUnits: Math.max(1, input.heightUnits | 0),
    tileHeightUnits,
    faceTriangleCounts: {
      leftSouth: faceTriangleCount,
      rightEast: faceTriangleCount,
      selected: faceTriangleCount,
      rule: "max",
      triangleHeightPx: SEMANTIC_FACE_TRIANGLE_HEIGHT_PX,
    },
    n: Math.max(1, input.n | 0),
    m: Math.max(1, input.m | 0),
    anchorSpriteLocal: null,
    bboxSpriteLocal: null,
    anchorResult: null,
    occupiedBoundsPx: null,
    workRectSpriteLocal: null,
    workAnchorLocal: null,
    slices: [],
    sliceEntries: [],
    footprintCandidatesSpriteLocal: [],
    footprintLeftCount: Math.max(1, input.n | 0),
    footprintRightCount: Math.max(1, input.m | 0),
  };
}

function tryComputeSemanticGeometryFromNodeAsset(
  skinId: string,
  spriteId: string,
  input?: { flipX?: boolean },
): MonolithicBuildingSemanticGeometry | null {
  const loader = getNodeMonolithicSemanticAssetLoader();
  if (!loader) return null;
  const alphaMap = loader.loadAlphaMap(spriteId);
  if (!alphaMap) return null;
  const normal = buildMonolithicBuildingSemanticGeometryFromAlphaMap(skinId, spriteId, alphaMap, {
    flipX: false,
  });
  if (normal) setSemanticGeometry(normal);
  const flipped = buildMonolithicBuildingSemanticGeometryFromAlphaMap(skinId, spriteId, alphaMap, {
    flipX: true,
  });
  if (flipped) setSemanticGeometry(flipped);
  return (input?.flipX ? flipped : normal) ?? null;
}

function ensureNodeSemanticPlacementFallbackForSkin(skinId: string): void {
  if (typeof Image !== "undefined") return;
  const normalizedSkinId = normalizeSkinToken(skinId);
  if (!normalizedSkinId) return;
  const skin = BUILDING_SKINS[normalizedSkinId];
  if (skin && isMonolithicBuildingDefinition(skin)) {
    const spriteIds = resolveSemanticSpriteVariantsForSkin(skin);
    for (let i = 0; i < spriteIds.length; i++) {
      const normalizedSpriteId = normalizeSpriteToken(spriteIds[i]);
      if (!normalizedSpriteId) continue;
      const existing = semanticGeometryByKey.get(
        semanticGeometryKey(normalizedSkinId, normalizedSpriteId, false),
      );
      if (existing?.source === "computed") continue;
      tryComputeSemanticGeometryFromNodeAsset(normalizedSkinId, normalizedSpriteId);
    }
    const canonicalKey = canonicalSemanticKeyBySkinId.get(normalizedSkinId);
    const canonical = canonicalKey ? semanticGeometryByKey.get(canonicalKey) : null;
    if (canonical?.source === "computed") return;
  }
  const fallback = MONOLITHIC_BUILDING_SEMANTIC_PLACEMENT_FALLBACK[normalizedSkinId];
  if (!fallback) return;
  const spriteIds = Object.keys(fallback.bySpriteId);
  for (let i = 0; i < spriteIds.length; i++) {
    const spriteId = spriteIds[i];
    const normalizedSpriteId = normalizeSpriteToken(spriteId);
    if (!normalizedSpriteId) continue;
    if (semanticGeometryByKey.has(semanticGeometryKey(normalizedSkinId, normalizedSpriteId, false))) continue;
    const entry = fallback.bySpriteId[spriteId];
    setSemanticGeometry(buildPlacementOnlySemanticGeometry({
      skinId: normalizedSkinId,
      spriteId: normalizedSpriteId,
      heightUnits: entry.heightUnits,
      tileHeightUnits: entry.tileHeightUnits,
      n: entry.n,
      m: entry.m,
    }));
  }
  if (!canonicalSemanticKeyBySkinId.has(normalizedSkinId)) {
    const canonicalSpriteId = normalizeSpriteToken(fallback.canonicalSpriteId);
    if (canonicalSpriteId) {
      canonicalSemanticKeyBySkinId.set(
        normalizedSkinId,
        semanticGeometryKey(normalizedSkinId, canonicalSpriteId, false),
      );
    }
  }
}

export function resolveMonolithicSliceParentFootprintPosition(
  bandIndex: number,
  footprintW: number,
  footprintH: number,
): MonolithicSliceParentFootprintPosition {
  const safeW = Math.max(1, footprintW | 0);
  const safeH = Math.max(1, footprintH | 0);
  const coreCount = safeW + safeH;
  const lastProgression = Math.max(0, coreCount - 1);
  const clampedBandIndex = Math.max(0, Math.min(coreCount + 1, bandIndex | 0));

  if (clampedBandIndex <= 0) {
    return {
      parentFootprintProgression: 0,
      parentFootprintOffsetTx: 0,
      parentFootprintOffsetTy: safeH - 1,
    };
  }

  if (clampedBandIndex >= coreCount + 1) {
    return {
      parentFootprintProgression: lastProgression,
      parentFootprintOffsetTx: safeW - 1,
      parentFootprintOffsetTy: 0,
    };
  }

  if (clampedBandIndex <= safeW) {
    return {
      parentFootprintProgression: clampedBandIndex - 1,
      parentFootprintOffsetTx: clampedBandIndex - 1,
      parentFootprintOffsetTy: safeH - 1,
    };
  }

  const eastProgression = clampedBandIndex - safeW - 1;
  return {
    parentFootprintProgression: clampedBandIndex - 1,
    parentFootprintOffsetTx: safeW - 1,
    parentFootprintOffsetTy: Math.max(0, safeH - 1 - eastProgression),
  };
}

function ensureNodeSemanticPlacementFallback(requiredSkinIds?: Iterable<string>): void {
  if (typeof Image !== "undefined") return;
  const skins = resolveTargetMonolithicBuildingSkins(requiredSkinIds);
  for (let i = 0; i < skins.length; i++) {
    ensureNodeSemanticPlacementFallbackForSkin(skins[i].id);
  }
}

function getSemanticGeometryBySkinAndSprite(
  skinId: string,
  spriteId: string,
  input?: { flipX?: boolean },
): MonolithicBuildingSemanticGeometry | null {
  const normalizedSkinId = normalizeSkinToken(skinId);
  const normalizedSpriteId = normalizeSpriteToken(spriteId);
  if (!normalizedSkinId || !normalizedSpriteId) return null;
  ensureNodeSemanticPlacementFallbackForSkin(normalizedSkinId);
  return semanticGeometryByKey.get(
    semanticGeometryKey(normalizedSkinId, normalizedSpriteId, !!input?.flipX),
  ) ?? null;
}

function getCanonicalSemanticGeometryForSkin(
  skinId: string,
): MonolithicBuildingSemanticGeometry | null {
  const normalizedSkinId = normalizeSkinToken(skinId);
  if (!normalizedSkinId) return null;
  ensureNodeSemanticPlacementFallbackForSkin(normalizedSkinId);
  const canonicalKey = canonicalSemanticKeyBySkinId.get(normalizedSkinId);
  if (canonicalKey) {
    return semanticGeometryByKey.get(canonicalKey) ?? null;
  }
  const skin = BUILDING_SKINS[normalizedSkinId];
  const baseSpriteId = normalizeSpriteToken(skin?.roof);
  if (baseSpriteId) {
    const byBase = semanticGeometryByKey.get(semanticGeometryKey(normalizedSkinId, baseSpriteId, false)) ?? null;
    if (byBase) return byBase;
  }
  for (const entry of semanticGeometryByKey.values()) {
    if (entry.skinId === normalizedSkinId && !entry.flipX) return entry;
  }
  return null;
}

function isSpriteReady(rec: ReturnType<typeof getTileSpriteById> | null | undefined): rec is {
  img: HTMLImageElement;
  ready: true;
} {
  return !!rec
    && !!rec.ready
    && !!rec.img
    && rec.img.naturalWidth > 0
    && rec.img.naturalHeight > 0;
}

function alphaMapFromImage(image: CanvasImageSource): StructureSliceDebugAlphaMap | null {
  const width = Math.max(0, Math.round(((image as any).width ?? 0)));
  const height = Math.max(0, Math.round(((image as any).height ?? 0)));
  if (width <= 0 || height <= 0) return null;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    return null;
  }
  return {
    width,
    height,
    data: imageData.data,
  };
}

function buildBoundsRectFromAnchorResult(anchorResult: StructureAnchorResult): RuntimeStructureTriangleRect {
  const alphaBounds = anchorResult.occupiedBoundsPx;
  const alphaMaxXExclusive = alphaBounds.maxX + 1;
  const alphaMaxYExclusive = alphaBounds.maxY + 1;
  const minX = Math.min(alphaBounds.minX, anchorResult.anchorPx.x);
  const maxX = Math.max(alphaMaxXExclusive, anchorResult.anchorPx.x);
  const minY = Math.min(alphaBounds.minY, anchorResult.anchorPx.y);
  const maxY = Math.max(alphaMaxYExclusive, anchorResult.anchorPx.y);
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
  };
}

function isPointOnSegment(
  p: RuntimeStructureTrianglePoint,
  a: RuntimeStructureTrianglePoint,
  b: RuntimeStructureTrianglePoint,
): boolean {
  const eps = 1e-4;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const cross = abx * apy - aby * apx;
  if (Math.abs(cross) > eps) return false;
  const dot = apx * abx + apy * aby;
  if (dot < -eps) return false;
  const lenSq = abx * abx + aby * aby;
  if (dot > lenSq + eps) return false;
  return true;
}

function segmentOverlapLengthOnLine(
  edgeA: RuntimeStructureTrianglePoint,
  edgeB: RuntimeStructureTrianglePoint,
  guideA: RuntimeStructureTrianglePoint,
  guideB: RuntimeStructureTrianglePoint,
): number {
  const eps = 1e-4;
  const dx = edgeB.x - edgeA.x;
  const dy = edgeB.y - edgeA.y;
  const edgeLen = Math.hypot(dx, dy);
  if (edgeLen <= eps) return 0;
  const crossA = dx * (guideA.y - edgeA.y) - dy * (guideA.x - edgeA.x);
  const crossB = dx * (guideB.y - edgeA.y) - dy * (guideB.x - edgeA.x);
  if (Math.abs(crossA) > eps || Math.abs(crossB) > eps) return 0;
  const ux = dx / edgeLen;
  const uy = dy / edgeLen;
  const project = (p: RuntimeStructureTrianglePoint): number => ((p.x - edgeA.x) * ux) + ((p.y - edgeA.y) * uy);
  const g0 = project(guideA);
  const g1 = project(guideB);
  const guideMin = Math.min(g0, g1);
  const guideMax = Math.max(g0, g1);
  const overlapMin = Math.max(0, guideMin);
  const overlapMax = Math.min(edgeLen, guideMax);
  return Math.max(0, overlapMax - overlapMin);
}

function isPointAboveGuideLine(
  p: RuntimeStructureTrianglePoint,
  a: RuntimeStructureTrianglePoint,
  b: RuntimeStructureTrianglePoint,
): boolean {
  const dx = b.x - a.x;
  if (Math.abs(dx) <= 1e-6) return p.y < Math.min(a.y, b.y);
  const t = (p.x - a.x) / dx;
  const yOnLine = a.y + (b.y - a.y) * t;
  return p.y < yOnLine - 1e-4;
}

function triangleIsFootprintCandidate(
  triangle: MonolithicSliceTriangle,
  guide: GuideSegment | null,
): boolean {
  if (!guide) return false;
  const edges: Array<{ p0: RuntimeStructureTrianglePoint; p1: RuntimeStructureTrianglePoint }> = [
    { p0: triangle.a, p1: triangle.b },
    { p0: triangle.b, p1: triangle.c },
    { p0: triangle.c, p1: triangle.a },
  ];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const edgeLen = Math.hypot(edge.p1.x - edge.p0.x, edge.p1.y - edge.p0.y);
    if (edgeLen <= 1e-4) continue;
    const fullSharedEdge = isPointOnSegment(edge.p0, guide.a, guide.b)
      && isPointOnSegment(edge.p1, guide.a, guide.b);
    const overlapLen = segmentOverlapLengthOnLine(edge.p0, edge.p1, guide.a, guide.b);
    const majorityOverlap = overlapLen > edgeLen * 0.5 + 1e-4;
    if (!fullSharedEdge && !majorityOverlap) continue;
    const centroid = {
      x: (triangle.a.x + triangle.b.x + triangle.c.x) / 3,
      y: (triangle.a.y + triangle.b.y + triangle.c.y) / 3,
    };
    if (isPointAboveGuideLine(centroid, guide.a, guide.b)) return true;
  }
  return false;
}

function minTriangleVertexY(triangle: MonolithicSliceTriangle): number {
  return Math.min(triangle.a.y, triangle.b.y, triangle.c.y);
}

function resolveSemanticFaceTriangleRow(
  triangle: MonolithicSliceTriangle,
  anchorSpriteLocal: RuntimeStructureTrianglePoint,
): number {
  const verticalDistancePx = anchorSpriteLocal.y - minTriangleVertexY(triangle);
  if (!(verticalDistancePx > 0)) return 0;
  return Math.ceil(verticalDistancePx / SEMANTIC_FACE_TRIANGLE_HEIGHT_PX);
}

function resolveSemanticFaceTriangleCounts(
  sliceEntries: readonly MonolithicBuildingSemanticSliceEntry[],
  n: number,
  anchorSpriteLocal: RuntimeStructureTrianglePoint,
): MonolithicBuildingFaceTriangleCounts {
  const leftSouthRows = new Set<number>();
  const rightEastRows = new Set<number>();
  for (let si = 0; si < sliceEntries.length; si++) {
    const entry = sliceEntries[si];
    for (let ti = 0; ti < entry.triangles.length; ti++) {
      const triangle = entry.triangles[ti];
      const row = resolveSemanticFaceTriangleRow(triangle, anchorSpriteLocal);
      if (row <= 0) continue;
      if (entry.parentFootprintProgression < n) leftSouthRows.add(row);
      else rightEastRows.add(row);
    }
  }
  const leftSouth = leftSouthRows.size;
  const rightEast = rightEastRows.size;
  const selected = Math.max(leftSouth, rightEast);
  return {
    leftSouth,
    rightEast,
    selected,
    rule: "max",
    triangleHeightPx: SEMANTIC_FACE_TRIANGLE_HEIGHT_PX,
  };
}

function intersectRayWithRectBoundary(
  origin: RuntimeStructureTrianglePoint,
  direction: RuntimeStructureTrianglePoint,
  rect: { minX: number; maxX: number; minY: number; maxY: number },
): RuntimeStructureTrianglePoint | null {
  const eps = 1e-6;
  const hits: Array<{ t: number; x: number; y: number }> = [];
  const push = (t: number): void => {
    if (!(t > eps) || !Number.isFinite(t)) return;
    const x = origin.x + direction.x * t;
    const y = origin.y + direction.y * t;
    if (x < rect.minX - eps || x > rect.maxX + eps) return;
    if (y < rect.minY - eps || y > rect.maxY + eps) return;
    hits.push({ t, x, y });
  };
  if (Math.abs(direction.x) > eps) {
    push((rect.minX - origin.x) / direction.x);
    push((rect.maxX - origin.x) / direction.x);
  }
  if (Math.abs(direction.y) > eps) {
    push((rect.minY - origin.y) / direction.y);
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.t - b.t);
  return { x: hits[0].x, y: hits[0].y };
}

export function buildMonolithicBuildingSemanticGeometryFromAlphaMap(
  skinId: string,
  spriteId: string,
  alphaMap: StructureSliceDebugAlphaMap,
  input?: {
    flipX?: boolean;
    heightUnits?: number;
  },
): MonolithicBuildingSemanticGeometry | null {
  const flipX = !!input?.flipX;
  const anchorResult = getStructureAnchorFromAlphaMap({ alphaMap, flipX });
  if (!anchorResult) return null;
  const bboxSpriteLocal = {
    x: anchorResult.occupiedBoundsPx.minX,
    y: anchorResult.occupiedBoundsPx.minY,
    w: anchorResult.occupiedBoundsPx.maxX - anchorResult.occupiedBoundsPx.minX + 1,
    h: anchorResult.occupiedBoundsPx.maxY - anchorResult.occupiedBoundsPx.minY + 1,
  } satisfies RuntimeStructureTriangleRect;
  const workRect = buildBoundsRectFromAnchorResult(anchorResult);
  if (workRect.w <= 0 || workRect.h <= 0) return null;
  const workAnchor = {
    x: anchorResult.anchorPx.x - workRect.x,
    y: anchorResult.anchorPx.y - workRect.y,
  };
  const slices = getStructureSlices({
    bounds: {
      width: workRect.w,
      height: workRect.h,
    },
    anchor: workAnchor,
  });
  const sortedByX = slices
    .map((slice, index) => ({ slice, index }))
    .sort((a, b) => a.slice.x - b.slice.x || a.index - b.index);
  const bandIndexBySliceIndex = new Map<number, number>();
  for (let i = 0; i < sortedByX.length; i++) {
    bandIndexBySliceIndex.set(sortedByX[i].index, i);
  }

  const leftGuideTarget = intersectRayWithRectBoundary(
    workAnchor,
    { x: -1, y: -0.5 },
    { minX: 0, maxX: workRect.w, minY: 0, maxY: workRect.h },
  );
  const rightGuideTarget = intersectRayWithRectBoundary(
    workAnchor,
    { x: 1, y: -0.5 },
    { minX: 0, maxX: workRect.w, minY: 0, maxY: workRect.h },
  );
  const leftGuideSegment = leftGuideTarget
    ? {
      a: { x: workRect.x + workAnchor.x, y: workRect.y + workAnchor.y },
      b: { x: workRect.x + leftGuideTarget.x, y: workRect.y + leftGuideTarget.y },
    }
    : null;
  const rightGuideSegment = rightGuideTarget
    ? {
      a: { x: workRect.x + workAnchor.x, y: workRect.y + workAnchor.y },
      b: { x: workRect.x + rightGuideTarget.x, y: workRect.y + rightGuideTarget.y },
    }
    : null;

  const pendingSliceEntries: PendingMonolithicBuildingSemanticSliceEntry[] = [];
  const footprintCandidatesSpriteLocal: MonolithicSliceTriangle[] = [];
  let footprintLeftCount = 0;
  let footprintRightCount = 0;

  for (let si = 0; si < slices.length; si++) {
    const slice = slices[si];
    const bandIndex = bandIndexBySliceIndex.get(si) ?? si;
    const geometry = buildMonolithicSliceGeometry(slice, workAnchor);
    const cull = cullMonolithicTrianglesByAlphaWithDiagnostics({
      triangles: geometry.triangles,
      alphaMap,
      workRectSpriteLocal: workRect,
      workOffsetSpriteLocal: { x: workRect.x, y: workRect.y },
      alphaThreshold: PREPASS_ALPHA_THRESHOLD,
      minVisiblePixels: PREPASS_MIN_VISIBLE_PIXELS,
    });
    const keptTriangles: MonolithicSliceTriangle[] = cull.keptTriangles.map((tri) => ({
      a: { x: tri.a.x + workRect.x, y: tri.a.y + workRect.y, side: tri.a.side },
      b: { x: tri.b.x + workRect.x, y: tri.b.y + workRect.y, side: tri.b.side },
      c: { x: tri.c.x + workRect.x, y: tri.c.y + workRect.y, side: tri.c.side },
    }));
    const culledTriangles: MonolithicSliceTriangle[] = cull.samples
      .filter((sample) => !sample.kept)
      .map((sample) => ({
        a: { x: sample.triangle.a.x + workRect.x, y: sample.triangle.a.y + workRect.y, side: sample.triangle.a.side },
        b: { x: sample.triangle.b.x + workRect.x, y: sample.triangle.b.y + workRect.y, side: sample.triangle.b.side },
        c: { x: sample.triangle.c.x + workRect.x, y: sample.triangle.c.y + workRect.y, side: sample.triangle.c.side },
      }));
    const edgePoints = geometry.edgePoints.map((p) => ({
      x: p.x + workRect.x,
      y: p.y + workRect.y,
      side: p.side,
    }));
    const stripPoints = geometry.stripPoints.map((p) => ({
      x: p.x + workRect.x,
      y: p.y + workRect.y,
      side: p.side,
    }));
    for (let ti = 0; ti < keptTriangles.length; ti++) {
      const tri = keptTriangles[ti];
      const onLeft = triangleIsFootprintCandidate(tri, leftGuideSegment);
      const onRight = !onLeft && triangleIsFootprintCandidate(tri, rightGuideSegment);
      if (!onLeft && !onRight) continue;
      footprintCandidatesSpriteLocal.push(tri);
      const centroidX = (tri.a.x + tri.b.x + tri.c.x) / 3;
      if (centroidX < anchorResult.anchorPx.x) footprintLeftCount++;
      else footprintRightCount++;
    }
    pendingSliceEntries.push({
      index: si,
      bandIndex,
      slice,
      edgePoints,
      stripPoints,
      triangles: keptTriangles,
      culledTriangles,
    });
  }

  const n = Math.max(1, footprintLeftCount | 0);
  const m = Math.max(1, footprintRightCount | 0);
  const sliceEntries: MonolithicBuildingSemanticSliceEntry[] = pendingSliceEntries.map((entry) => ({
    ...entry,
    ...resolveMonolithicSliceParentFootprintPosition(entry.bandIndex, n, m),
  }));
  const anchorSpriteLocal = {
    x: anchorResult.anchorPx.x,
    y: anchorResult.anchorPx.y,
  } satisfies RuntimeStructureTrianglePoint;
  const faceTriangleCounts = resolveSemanticFaceTriangleCounts(sliceEntries, n, anchorSpriteLocal);
  const tileHeightUnits = Math.max(
    pixelHeightToSweepTileHeight(SEMANTIC_FACE_TRIANGLE_HEIGHT_PX),
    pixelHeightToSweepTileHeight(faceTriangleCounts.selected * SEMANTIC_FACE_TRIANGLE_HEIGHT_PX),
  );

  return {
    skinId,
    spriteId,
    semanticKey: semanticGeometryKey(skinId, spriteId, flipX),
    flipX,
    source: "computed",
    heightUnits: Math.max(1, Math.round(input?.heightUnits ?? DEFAULT_HEIGHT_UNITS)),
    tileHeightUnits,
    faceTriangleCounts,
    n,
    m,
    anchorSpriteLocal,
    bboxSpriteLocal,
    anchorResult,
    occupiedBoundsPx: anchorResult.occupiedBoundsPx,
    workRectSpriteLocal: workRect,
    workAnchorLocal: workAnchor,
    slices,
    sliceEntries,
    footprintCandidatesSpriteLocal,
    footprintLeftCount,
    footprintRightCount,
  };
}

function tryComputeSemanticGeometryFromLoadedSprite(
  skinId: string,
  spriteId: string,
  input?: { flipX?: boolean },
): MonolithicBuildingSemanticGeometry | null {
  if (typeof Image === "undefined" || typeof document === "undefined") return null;
  const rec = getTileSpriteById(spriteId);
  if (!isSpriteReady(rec)) return null;
  const alphaMap = alphaMapFromImage(rec.img);
  if (!alphaMap) return null;
  const normal = buildMonolithicBuildingSemanticGeometryFromAlphaMap(skinId, spriteId, alphaMap, {
    flipX: false,
  });
  if (normal) setSemanticGeometry(normal);
  const flipped = buildMonolithicBuildingSemanticGeometryFromAlphaMap(skinId, spriteId, alphaMap, {
    flipX: true,
  });
  if (flipped) setSemanticGeometry(flipped);
  return (input?.flipX ? flipped : normal) ?? null;
}

export function primeMonolithicBuildingSemanticPrepass(requiredSkinIds?: Iterable<string>): {
  computed: number;
  missing: number;
} {
  ensureNodeSemanticPlacementFallback(requiredSkinIds);
  let computed = 0;
  let missing = 0;
  const skins = resolveTargetMonolithicBuildingSkins(requiredSkinIds);
  for (let i = 0; i < skins.length; i++) {
    const skin = skins[i];
    const spriteIds = resolveSemanticSpriteVariantsForSkin(skin);
    for (let si = 0; si < spriteIds.length; si++) {
      const spriteId = spriteIds[si];
      const existing = getSemanticGeometryBySkinAndSprite(skin.id, spriteId);
      if (existing?.source === "computed") continue;
      const computedGeometry = tryComputeSemanticGeometryFromLoadedSprite(skin.id, spriteId);
      if (!computedGeometry) continue;
      computed++;
    }
    const canonical = getCanonicalSemanticGeometryForSkin(skin.id);
    if (!canonical) {
      const fallback = spriteIds.length > 0
        ? getSemanticGeometryBySkinAndSprite(skin.id, spriteIds[0])
        : null;
      if (fallback) {
        canonicalSemanticKeyBySkinId.set(skin.id, semanticGeometryKey(fallback.skinId, fallback.spriteId, false));
      } else {
        missing++;
      }
    }
  }
  return { computed, missing };
}

export type MonolithicBuildingSemanticPrepassStatus = {
  totalMonolithicSkins: number;
  computedSkins: number;
  missingSkinIds: string[];
};

export function getMonolithicBuildingSemanticPrepassStatus(
  requiredSkinIds?: Iterable<string>,
): MonolithicBuildingSemanticPrepassStatus {
  ensureNodeSemanticPlacementFallback(requiredSkinIds);
  const skins = resolveTargetMonolithicBuildingSkins(requiredSkinIds);
  const missingSkinIds: string[] = [];
  let computedSkins = 0;
  const canReadSpriteImages = typeof Image !== "undefined";
  for (let i = 0; i < skins.length; i++) {
    const skin = skins[i];
    if (!canReadSpriteImages) {
      const canonical = getCanonicalSemanticGeometryForSkin(skin.id);
      if (canonical?.source === "computed") {
        computedSkins++;
      } else {
        missingSkinIds.push(skin.id);
      }
      continue;
    }
    const spriteIds = resolveSemanticSpriteVariantsForSkin(skin);
    let resolvedAll = true;
    for (let si = 0; si < spriteIds.length; si++) {
      const spriteId = spriteIds[si];
      const cached = getSemanticGeometryBySkinAndSprite(skin.id, spriteId);
      if (cached?.source === "computed") continue;
      const rec = getTileSpriteById(spriteId);
      if (rec?.failed || rec?.unsupported) continue;
      resolvedAll = false;
      break;
    }
    if (resolvedAll) {
      computedSkins++;
    } else {
      missingSkinIds.push(skin.id);
    }
  }
  return {
    totalMonolithicSkins: skins.length,
    computedSkins,
    missingSkinIds,
  };
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function computeMonolithicBuildingSemanticsForSkinIds(
  requiredSkinIds: Iterable<string>,
  input?: {
  timeoutMs?: number;
  pollMs?: number;
}): Promise<{
  computed: number;
  missing: number;
  missingSkinIds: string[];
}> {
  const ids = Array.from(requiredSkinIds);
  const timeoutMs = Math.max(250, input?.timeoutMs ?? 15000);
  const pollMs = Math.max(8, input?.pollMs ?? 16);

  let first = primeMonolithicBuildingSemanticPrepass(ids);
  let status = getMonolithicBuildingSemanticPrepassStatus(ids);
  if (status.missingSkinIds.length === 0) {
    return { ...first, missingSkinIds: [] };
  }

  if (typeof window === "undefined") {
    return { ...first, missingSkinIds: status.missingSkinIds };
  }

  const startedAt = performance.now();
  let latest = first;
  while (performance.now() - startedAt < timeoutMs) {
    await waitMs(pollMs);
    latest = primeMonolithicBuildingSemanticPrepass(ids);
    status = getMonolithicBuildingSemanticPrepassStatus(ids);
    if (status.missingSkinIds.length === 0) {
      return { ...latest, missingSkinIds: [] };
    }
  }

  return {
    ...latest,
    missingSkinIds: getMonolithicBuildingSemanticPrepassStatus(ids).missingSkinIds,
  };
}

export function assertMonolithicBuildingSemanticPrepassComplete(
  context: string,
  requiredSkinIds?: Iterable<string>,
): void {
  const status = getMonolithicBuildingSemanticPrepassStatus(requiredSkinIds);
  if (status.missingSkinIds.length === 0) return;
  throw new Error(
    `[monolithic-semantic-prepass] Incomplete semantic geometry in ${context}. `
    + `Computed ${status.computedSkins}/${status.totalMonolithicSkins}. `
    + `Missing: ${status.missingSkinIds.join(", ")}`,
  );
}

export function getMonolithicBuildingSemanticGeometry(
  skinId: string,
): MonolithicBuildingSemanticGeometry | null {
  return getCanonicalSemanticGeometryForSkin(skinId);
}

export function getMonolithicBuildingSemanticGeometryForSprite(
  skinId: string,
  spriteId: string,
  input?: { flipX?: boolean },
): MonolithicBuildingSemanticGeometry | null {
  const normalizedSkinId = normalizeSkinToken(skinId) ?? skinId;
  const normalizedSpriteId = normalizeSpriteToken(spriteId) ?? spriteId;
  let semantic = getSemanticGeometryBySkinAndSprite(normalizedSkinId, normalizedSpriteId, input);
  if (!semantic && typeof Image !== "undefined") {
    semantic = tryComputeSemanticGeometryFromLoadedSprite(normalizedSkinId, normalizedSpriteId, input);
  }
  return semantic;
}

export function getRequiredMonolithicBuildingSemanticGeometryForSprite(
  skinId: string,
  spriteId: string,
  context: string,
  input?: { flipX?: boolean },
): MonolithicBuildingSemanticGeometry {
  const normalizedSkinId = normalizeSkinToken(skinId) ?? skinId;
  const normalizedSpriteId = normalizeSpriteToken(spriteId) ?? spriteId;
  const semantic = getMonolithicBuildingSemanticGeometryForSprite(
    normalizedSkinId,
    normalizedSpriteId,
    input,
  );
  if (semantic) return semantic;
  const warnKey = semanticGeometryKey(normalizedSkinId, normalizedSpriteId, !!input?.flipX);
  if (!warnedMissingBySemanticKey.has(warnKey)) {
    warnedMissingBySemanticKey.add(warnKey);
    console.warn(
      `[monolithic-semantic-prepass] Missing semantic geometry for ${normalizedSkinId} sprite=${normalizedSpriteId} flip=${input?.flipX ? 1 : 0} in ${context}.`,
    );
  }
  throw new Error(
    `[monolithic-semantic-prepass] Missing required semantic geometry for ${normalizedSkinId} sprite=${normalizedSpriteId} flip=${input?.flipX ? 1 : 0} (${context}).`,
  );
}

function toPlacementGeometry(semantic: MonolithicBuildingSemanticGeometry): MonolithicBuildingPlacementGeometry {
  return {
    w: Math.max(1, semantic.n | 0),
    h: Math.max(1, semantic.m | 0),
    heightUnits: Math.max(1, semantic.heightUnits | 0),
    tileHeightUnits: Math.max(
      pixelHeightToSweepTileHeight(SEMANTIC_FACE_TRIANGLE_HEIGHT_PX),
      semantic.tileHeightUnits,
    ),
    source: semantic.source,
  };
}

export function resolveMonolithicFootprintTopLeftFromSeAnchor(
  seTx: number,
  seTy: number,
  n: number,
  m: number,
): { tx: number; ty: number } {
  return {
    tx: (seTx | 0) - Math.max(1, n | 0) + 1,
    ty: (seTy | 0) - Math.max(1, m | 0) + 1,
  };
}

export function resolveMonolithicSliceParentTileFromSeAnchor(
  seTx: number,
  seTy: number,
  n: number,
  m: number,
  bandIndex: number,
): {
  tx: number;
  ty: number;
} & MonolithicSliceParentFootprintPosition {
  const topLeft = resolveMonolithicFootprintTopLeftFromSeAnchor(seTx, seTy, n, m);
  const parent = resolveMonolithicSliceParentFootprintPosition(bandIndex, n, m);
  return {
    ...parent,
    tx: topLeft.tx + parent.parentFootprintOffsetTx,
    ty: topLeft.ty + parent.parentFootprintOffsetTy,
  };
}

export function resolveMonolithicFootprintTileBoundsFromSeAnchor(
  seTx: number,
  seTy: number,
  n: number,
  m: number,
): { minTx: number; maxTx: number; minTy: number; maxTy: number } {
  const topLeft = resolveMonolithicFootprintTopLeftFromSeAnchor(seTx, seTy, n, m);
  return {
    minTx: topLeft.tx,
    maxTx: topLeft.tx + Math.max(1, n | 0) - 1,
    minTy: topLeft.ty,
    maxTy: topLeft.ty + Math.max(1, m | 0) - 1,
  };
}

export function getMonolithicBuildingPlacementGeometry(
  skinId: string,
): MonolithicBuildingPlacementGeometry | null {
  const semantic = getCanonicalSemanticGeometryForSkin(skinId);
  if (!semantic) return null;
  return toPlacementGeometry(semantic);
}

export function getMonolithicBuildingPlacementGeometryForSprite(
  skinId: string,
  spriteId: string,
): MonolithicBuildingPlacementGeometry | null {
  const semantic = getMonolithicBuildingSemanticGeometryForSprite(skinId, spriteId)
    ?? getCanonicalSemanticGeometryForSkin(skinId);
  if (!semantic) return null;
  return toPlacementGeometry(semantic);
}

export function getRequiredMonolithicBuildingPlacementGeometry(
  skinId: string,
  context: string,
): MonolithicBuildingPlacementGeometry {
  const semantic = getMonolithicBuildingPlacementGeometry(skinId);
  if (semantic) return semantic;
  const normalizedSkinId = normalizeSkinToken(skinId) ?? skinId;
  if (!warnedMissingBySemanticKey.has(normalizedSkinId)) {
    warnedMissingBySemanticKey.add(normalizedSkinId);
    console.warn(
      `[monolithic-semantic-prepass] Missing semantic geometry for ${normalizedSkinId} in ${context}.`,
    );
  }
  throw new Error(
    `[monolithic-semantic-prepass] Missing required semantic placement geometry for ${normalizedSkinId} (${context}).`,
  );
}

export function getRequiredMonolithicBuildingPlacementGeometryForSprite(
  skinId: string,
  spriteId: string,
  context: string,
): MonolithicBuildingPlacementGeometry {
  const normalizedSkinId = normalizeSkinToken(skinId) ?? skinId;
  const normalizedSpriteId = normalizeSpriteToken(spriteId) ?? spriteId;
  const placement = getMonolithicBuildingPlacementGeometryForSprite(normalizedSkinId, normalizedSpriteId);
  if (placement) return placement;
  const warnKey = semanticGeometryKey(normalizedSkinId, normalizedSpriteId, false);
  if (!warnedMissingBySemanticKey.has(warnKey)) {
    warnedMissingBySemanticKey.add(warnKey);
    console.warn(
      `[monolithic-semantic-prepass] Missing semantic geometry for ${normalizedSkinId} sprite=${normalizedSpriteId} in ${context}.`,
    );
  }
  throw new Error(
    `[monolithic-semantic-prepass] Missing required semantic placement geometry for ${normalizedSkinId} sprite=${normalizedSpriteId} (${context}).`,
  );
}
