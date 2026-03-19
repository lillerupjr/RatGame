// src/game/systems/render.ts
import { gridAtPlayer, type World } from "../../../engine/world/world";
import { registry } from "../../content/registry";
import { ZONE_KIND } from "../../factories/zoneFactory";
import { getBossAccent, getFloorVisual } from "../../content/floors";
import { ENEMY_TYPE } from "../../content/enemies";
import {
  getPlayerSkin,
  getPlayerSpriteFrame,
  getPlayerSpriteFrameForDarknessPercent,
  playerSpritesReady,
} from "../../../engine/render/sprites/playerSprites";
import { type Dir8 } from "../../../engine/render/sprites/dir8";
import {
  getEnemySpriteFrame,
  getEnemySpriteFrameForDarknessPercent,
  preloadEnemySprites,
} from "../../../engine/render/sprites/enemySprites";
import {
  getVendorNpcSpriteFrame,
  getVendorNpcSpriteFrameForDarknessPercent,
  preloadVendorNpcSprites,
  vendorNpcSpritesReady,
} from "../../../engine/render/sprites/vendorSprites";
import {
  getPigeonFramesForClipAndScreenDirForDarknessPercent,
  preloadNeutralMobSprites,
} from "../../../engine/render/sprites/neutralSprites";
import {
  heightAtWorld,
  walkInfo,
  surfacesAtXY,
  facePieceLayers,
  facePiecesInViewForLayer,
  occluderLayers,
  occludersInViewForLayer,
  overlaysInView,
  blockedTilesInView,
  decalsInView,
  getActiveMap as getActiveCompiledMap,
  getSupportSurfaceAt,
  roadAreaWidthAt,
  type RenderPiece,
  type StampOverlay,
  type ViewRect,
} from "../../map/compile/kenneyMap";

import {
  getProjectileSpriteByKind,
  preloadProjectileSprites,
  getProjectileDrawScale,
  PROJECTILE_BASE_DRAW_PX,
} from "../../../engine/render/sprites/projectileSprites";

import { screenToWorld, worldDeltaToScreen, worldToScreen, ISO_X, ISO_Y } from "../../../engine/math/iso";

import { KENNEY_TILE_WORLD, KENNEY_TILE_ANCHOR_Y } from "../../../engine/render/kenneyTiles";
import {
  getEnemyWorld,
  getPickupWorld,
  getPlayerWorld,
  getProjectileWorld,
  getZoneWorld,
} from "../../coords/worldViews";

import {
  preloadRenderSprites,
  getAnimatedTileFrame,
  getRuntimeDecalSprite,
  getTileSpriteById,
  getSpriteById,
  getSpriteByIdForDarknessPercent,
  type LoadedImg,
} from "../../../engine/render/sprites/renderSprites";
import { VFX_CLIPS, VFX_CLIP_INDEX } from "../../content/vfxRegistry";
import { PRJ_KIND } from "../../factories/projectileFactory";
import { getDecalSpriteId, type RuntimeDecalSetId } from "../../content/runtimeDecalConfig";
import { roadMarkingDecalScale, shouldPixelSnapRoadMarking } from "../../roads/roadMarkingRender";
import {
  buildRuntimeStructureBandPieces,
} from "../../../engine/render/sprites/runtimeStructureSlicing";
import { orientedDims, seAnchorFromTopLeft } from "../../../engine/render/sprites/structureFootprintOwnership";
import {
  drawEnemyAimOverlay,
  drawLootGoblinOverlay,
  drawOccluderOverlay,
  drawProjectileFaceOverlay,
  drawRampOverlay,
  drawRoadSemanticOverlay,
  drawStructureHeightOverlay,
  drawTriggerOverlay,
  drawWalkMaskOverlay,
  type DebugOverlayContext,
} from "../../../engine/render/debug/renderDebug";
import { configurePixelPerfect, snapPx } from "../../../engine/render/pixelPerfect";
import {
  drawProjectedLightAdditive,
  renderAmbientDarknessOverlay,
  resolveLightingGroundYScale,
} from "./renderLighting";
import { getShadowSunModel, renderEntityShadow, type ShadowParams } from "./renderShadow";
import {
  buildFrameWorldLightRegistry,
  type WorldLightRenderPiece,
} from "./worldLightRenderPieces";
import {
  resolveEnemyShadowFootOffset,
  resolveNeutralShadowFootOffset,
  resolvePlayerShadowFootOffset,
  resolveProjectileShadowFootOffset,
  resolveVendorShadowFootOffset,
} from "./shadowFootOffsets";
import { resolveDebugFlags } from "../../../debugSettings";
import {
  getUserSettings,
  resolveVerticalTiles,
} from "../../../userSettings";
import { type FireZoneVfx, renderFireZoneVfx } from "../../vfx/fireZoneVfx";
import { BAZOOKA_EXHAUST_OFFSET, bazookaExhaustAssets } from "../../vfx/bazookaExhaustAssets";
import { TILE_ID_OCEAN } from "../../world/semanticFields";
import { getZoneTrialObjectiveState } from "../../objectives/zoneObjectiveSystem";
import { renderZoneObjectives } from "../../render/renderZoneObjectives";
import {
  resolveActivePaletteId,
  resolveActivePaletteSwapWeights,
  resolveActivePaletteVariantKey,
} from "../../render/activePalette";
import { shouldApplyAmbientDarknessOverlay } from "../../render/renderDebugPolicy";
import { resolveNavArrowTarget } from "../../ui/navArrowTarget";
import { renderNavArrow } from "../../ui/navArrowRender";
import { coinColorFromValue } from "../../economy/coins";
import { getCurrencyFrame, getCurrencyFrameForDarknessPercent } from "../../content/loot/currencyVisual";
import {
  beginRenderPerfFrame,
  countRenderTileLoopIteration,
  countRenderClosureCreated,
  countRenderDrawableSort,
  countRenderSliceKeySort,
  endRenderPerfFrame,
  getRenderPerfSnapshot,
  setRenderZBandCount,
  setRenderPerfCountersEnabled,
  setRenderPerfDrawTag,
  setRenderTileLoopRadius,
} from "./renderPerfCounters";
import { ViewportTransform } from "./viewportTransform";
import {
  deriveFeetSortYFromKey,
  deriveStructureSouthTieBreakFromSeAnchor,
  KindOrder,
  compareRenderKeys,
  isGroundKindForRenderPass,
  isWorldKindForRenderPass,
  resolveRenderZBand,
  type RenderKey,
} from "./worldRenderOrdering";
import {
  planPieceLocalRelight,
  type PieceLocalRelightPlan,
  type StaticRelightDarknessBucket,
  type StaticRelightLightCandidate,
} from "./staticRelightPoc";
import {
  computeNearestDynamicRelightAlpha,
  type DynamicRelightLightCandidate,
} from "./dynamicSpriteRelightV1";
import {
  buildStaticRelightBakeContextKey,
  buildStaticRelightPieceKey,
  StaticRelightBakeStore,
} from "./staticRelightBake";
import {
  buildRuntimeStructureTriangleContextKey,
  deriveParentTileRenderFields,
  rectIntersects as runtimeStructureRectIntersects,
  resolveRuntimeStructureBandProgressionIndex,
  RuntimeStructureTriangleCacheStore,
  type RuntimeStructureTriangleRect,
} from "./runtimeStructureTriangles";
import { pointInTriangle } from "./structureTriangles/structureTriangleCulling";
import { drawStructureSliceTriangleDebugOverlay } from "./structureTriangles/structureTriangleDebug";
import {
  mapWideOverlayViewRect,
  prepareRuntimeStructureTrianglesForLoading as prepareRuntimeStructureTrianglesForLoadingInternal,
  rebuildRuntimeStructureTriangleCacheForMap,
  runtimeStructureTriangleGeometrySignatureForOverlay,
} from "./structureTriangles/structureTriangleCacheRebuild";
import {
  buildStructureShadowCacheEntry,
  buildStructureShadowContextKey,
  STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
  StructureShadowCacheStore,
  type StructureShadowCacheEntry,
  type StructureShadowProjectedTriangle,
} from "./structureShadowV1";
import {
  buildStructureShadowV2CacheEntry,
  buildStructureShadowV2ContextKey,
  STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
  STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
  STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
  StructureShadowV2CacheStore,
  type StructureShadowV2CacheEntry,
} from "./structureShadowV2AlphaSilhouette";
import {
  buildHybridTriangleSemanticMap,
  resolveHybridSemanticMaskBuckets,
  buildStructureShadowHybridCacheEntry,
  buildStructureShadowHybridContextKey,
  StructureShadowHybridCacheStore,
  type HybridSemanticMaskBucket,
  type StructureHybridShadowProjectedTriangle,
  type StructureShadowHybridCacheEntry,
} from "./structureShadowHybridTriangles";
import {
  buildStructureShadowV4CacheEntry,
  buildStructureShadowV4ContextKey,
  StructureShadowV4CacheStore,
  type SliceCorrespondence,
  type ShadowTriangleCorrespondence,
  type StructureShadowV4CacheEntry,
} from "./structureShadowV4";
import {
  buildStructureV6SliceAxis,
  buildStructureV6FaceSlices,
  clampStructureV6SliceCount,
  resolveStructureV6SliceIndex,
  resolveStructureV6SelectedCandidateIndex,
  type StructureV6FaceSlice,
  type StructureV6SliceAxis,
  type StructureV6SemanticBucket,
} from "./structureShadowV6FaceSlices";

const DEBUG_PLAYER_WEDGE = false;
const DISABLE_WALLS_AND_CURTAINS = true;
const HARDCODED_VOID_TOP_SRC = `${import.meta.env.BASE_URL}assets-runtime/tiles/floor/void.png`;
const CAMERA_FOLLOW_HALF_LIFE_DEFAULT_SEC = 0.08;
const CAMERA_FOLLOW_SNAP_DISTANCE_SQ = 4096 * 4096;
const CAMERA_SMOOTHING_INTENSITY_SCALE = 0.25;
const LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT = 2.35;
const LOOT_GOBLIN_GLOW_INNER_RADIUS_MULT = 0.35;
const LOOT_GOBLIN_GLOW_PULSE_MIN = 0.95;
const LOOT_GOBLIN_GLOW_PULSE_RANGE = 0.3;
const LOOT_GOBLIN_GLOW_PULSE_SPEED = 2.8;
const STRUCTURE_SHADOW_V1_MAX_DARKNESS = 0.38;
const STRUCTURE_SHADOW_V5_LENGTH_PX = 220;
const STRUCTURE_SHADOW_V5_PIXEL_SLICE_STEP_PX = 1;
const STRUCTURE_SHADOW_V5_EAST_WEST_FIXED_AXIS: ScreenPt = {
  x: ISO_X / Math.hypot(ISO_X, ISO_Y),
  y: -ISO_Y / Math.hypot(ISO_X, ISO_Y),
};
const STRUCTURE_SHADOW_V5_SOUTH_NORTH_FIXED_AXIS: ScreenPt = {
  x: -ISO_X / Math.hypot(ISO_X, ISO_Y),
  y: -ISO_Y / Math.hypot(ISO_X, ISO_Y),
};
const STRUCTURE_SHADOW_V6_DEBUG_PANEL_PADDING_PX = 8;

// Background mode:
// - "SOLID" = fastest, clean black void
// - "PATTERN" = repeats void tile as canvas pattern (still fast, looks textured)
const VOID_BG_MODE: "SOLID" | "PATTERN" = "SOLID";

let voidBgPattern: CanvasPattern | null = null;
let voidBgPatternImgRef: HTMLImageElement | null = null;

const flippedOverlayImageCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

// ROI #3: prebaked iso runtime tops (sidewalk/asphalt/park)
// Keyed by the *actual* loaded image object (palette-specific) + rotation.
const runtimeIsoTopCache = new WeakMap<HTMLImageElement, Map<0 | 1 | 2 | 3, HTMLCanvasElement>>();
const runtimeIsoDecalCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();
const runtimeDiamondCanvasCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
let staticRelightPieceScratch: HTMLCanvasElement | null = null;
let staticRelightMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV5TopMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV5EastWestMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV5SouthNorthMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV5CoverageMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV5FinalMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV6FaceScratch: HTMLCanvasElement | null = null;
const staticRelightBakeStore = new StaticRelightBakeStore<HTMLCanvasElement>();
const runtimeStructureTriangleCacheStore = new RuntimeStructureTriangleCacheStore();
const structureShadowV1CacheStore = new StructureShadowCacheStore();
const structureShadowV2CacheStore = new StructureShadowV2CacheStore();
const structureShadowHybridCacheStore = new StructureShadowHybridCacheStore();
const structureShadowV4CacheStore = new StructureShadowV4CacheStore();
const STATIC_RELIGHT_RUNTIME_RETRY_INTERVAL_MS = 50;
let staticRelightPendingRuntimeRebuildContextKey = "";
let staticRelightPendingRuntimeRebuildAtMs = 0;

type ScreenPt = { x: number; y: number };

function getStaticRelightPieceScratchContext(
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const canvas = staticRelightPieceScratch ?? document.createElement("canvas");
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  staticRelightPieceScratch = canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  configurePixelPerfect(ctx);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function getStaticRelightMaskScratchContext(
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const canvas = staticRelightMaskScratch ?? document.createElement("canvas");
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  staticRelightMaskScratch = canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  configurePixelPerfect(ctx);
  ctx.imageSmoothingEnabled = true;
  return ctx;
}

type StructureShadowV5MaskScratchContexts = {
  topMaskCtx: CanvasRenderingContext2D;
  eastWestMaskCtx: CanvasRenderingContext2D;
  southNorthMaskCtx: CanvasRenderingContext2D;
  coverageMaskCtx: CanvasRenderingContext2D;
  finalMaskCtx: CanvasRenderingContext2D;
  topMaskCanvas: HTMLCanvasElement;
  eastWestMaskCanvas: HTMLCanvasElement;
  southNorthMaskCanvas: HTMLCanvasElement;
  coverageMaskCanvas: HTMLCanvasElement;
  finalMaskCanvas: HTMLCanvasElement;
  width: number;
  height: number;
};

function ensureScratchCanvas2D(
  existing: HTMLCanvasElement | null,
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const canvas = existing ?? document.createElement("canvas");
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  configurePixelPerfect(ctx);
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function getStructureShadowV5MaskScratchContexts(
  width: number,
  height: number,
): StructureShadowV5MaskScratchContexts | null {
  const top = ensureScratchCanvas2D(structureShadowV5TopMaskScratch, width, height);
  const eastWest = ensureScratchCanvas2D(structureShadowV5EastWestMaskScratch, width, height);
  const southNorth = ensureScratchCanvas2D(structureShadowV5SouthNorthMaskScratch, width, height);
  const coverage = ensureScratchCanvas2D(structureShadowV5CoverageMaskScratch, width, height);
  const finalMask = ensureScratchCanvas2D(structureShadowV5FinalMaskScratch, width, height);
  if (!top || !eastWest || !southNorth || !coverage || !finalMask) return null;
  structureShadowV5TopMaskScratch = top.canvas;
  structureShadowV5EastWestMaskScratch = eastWest.canvas;
  structureShadowV5SouthNorthMaskScratch = southNorth.canvas;
  structureShadowV5CoverageMaskScratch = coverage.canvas;
  structureShadowV5FinalMaskScratch = finalMask.canvas;
  return {
    topMaskCtx: top.ctx,
    eastWestMaskCtx: eastWest.ctx,
    southNorthMaskCtx: southNorth.ctx,
    coverageMaskCtx: coverage.ctx,
    finalMaskCtx: finalMask.ctx,
    topMaskCanvas: top.canvas,
    eastWestMaskCanvas: eastWest.canvas,
    southNorthMaskCanvas: southNorth.canvas,
    coverageMaskCanvas: coverage.canvas,
    finalMaskCanvas: finalMask.canvas,
    width: top.canvas.width,
    height: top.canvas.height,
  };
}

function drawPieceLocalRelightMask(
  maskCtx: CanvasRenderingContext2D,
  plan: PieceLocalRelightPlan,
  pieceW: number,
  pieceH: number,
): boolean {
  let hasMask = false;
  maskCtx.setTransform(1, 0, 0, 1, 0, 0);
  maskCtx.globalCompositeOperation = "source-over";
  maskCtx.globalAlpha = 1;
  maskCtx.clearRect(0, 0, pieceW, pieceH);
  maskCtx.globalCompositeOperation = "lighter";
  for (let i = 0; i < plan.masks.length; i++) {
    const mask = plan.masks[i];
    const maskAlpha = Math.max(0, Math.min(1, mask.alpha));
    const radiusPx = Math.max(1, mask.radiusPx);
    const yScale = Math.max(0.1, Math.min(2, Number(mask.yScale ?? 1)));
    if (maskAlpha <= 0 || radiusPx <= 0) continue;
    maskCtx.save();
    maskCtx.translate(mask.centerX, mask.centerY);
    maskCtx.scale(1, yScale);
    const grad = maskCtx.createRadialGradient(0, 0, 0, 0, 0, radiusPx);
    grad.addColorStop(0, `rgba(255,255,255,${maskAlpha})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    maskCtx.fillStyle = grad;
    maskCtx.fillRect(-radiusPx, -radiusPx, radiusPx * 2, radiusPx * 2);
    maskCtx.restore();
    hasMask = true;
  }
  return hasMask;
}

function composePieceLocalRelightBakedCanvas(
  plan: PieceLocalRelightPlan,
  pieceW: number,
  pieceH: number,
  drawBaseLocal: (target: CanvasRenderingContext2D, width: number, height: number) => void,
  drawVariantLocal: (target: CanvasRenderingContext2D, width: number, height: number) => void,
): HTMLCanvasElement | null {
  if (!(pieceW > 0) || !(pieceH > 0)) return null;
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.ceil(pieceW));
  output.height = Math.max(1, Math.ceil(pieceH));
  const outputCtx = output.getContext("2d");
  if (!outputCtx) return null;
  configurePixelPerfect(outputCtx);
  outputCtx.imageSmoothingEnabled = false;
  drawBaseLocal(outputCtx, pieceW, pieceH);

  if (!(plan.blendAlpha > 0) || plan.masks.length === 0) return output;
  const clampedBlendAlpha = Math.max(0, Math.min(1, plan.blendAlpha));
  if (clampedBlendAlpha <= 0) return output;
  const scratchCtx = getStaticRelightPieceScratchContext(pieceW, pieceH);
  if (!scratchCtx) return output;
  const maskCtx = getStaticRelightMaskScratchContext(pieceW, pieceH);
  if (!maskCtx) return output;

  scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
  scratchCtx.globalCompositeOperation = "source-over";
  scratchCtx.globalAlpha = 1;
  scratchCtx.clearRect(0, 0, pieceW, pieceH);
  drawVariantLocal(scratchCtx, pieceW, pieceH);
  const hasMask = drawPieceLocalRelightMask(maskCtx, plan, pieceW, pieceH);
  if (!hasMask) return output;
  scratchCtx.globalCompositeOperation = "destination-in";
  scratchCtx.globalAlpha = 1;
  scratchCtx.drawImage(staticRelightMaskScratch!, 0, 0, pieceW, pieceH);

  outputCtx.save();
  outputCtx.globalCompositeOperation = "source-over";
  outputCtx.globalAlpha = clampedBlendAlpha;
  outputCtx.drawImage(staticRelightPieceScratch!, 0, 0, pieceW, pieceH);
  outputCtx.restore();
  return output;
}

type StaticRelightFrameContext = {
  baseDarknessBucket: StaticRelightDarknessBucket;
  targetDarknessBucket: 0 | 25 | 50 | 75;
  strengthScale: number;
  lights: StaticRelightLightCandidate[];
  maxLights: number;
  tileInfluenceRadius: number;
  minBlendAlpha: number;
};

type StaticRelightRuntimeState = {
  compiledMap: ReturnType<typeof getActiveCompiledMap>;
  enabled: boolean;
  frame: StaticRelightFrameContext | null;
  relightLights: StaticRelightLightCandidate[];
  contextKey: string;
  targetDarknessBucket: 0 | 25 | 50 | 75;
  baseDarknessBucket: StaticRelightDarknessBucket;
  strengthScale: number;
};

const STATIC_RELIGHT_MAX_LIGHTS = 2;
const STATIC_RELIGHT_TILE_RADIUS = 6;
const STATIC_RELIGHT_MIN_BLEND_ALPHA = 0.04;
const STATIC_RELIGHT_INCLUDE_STRUCTURES = false;
const STATIC_RELIGHT_ELEV_PX = 16;
const STATIC_RELIGHT_SIDEWALK_SRC_SIZE = 128;
const STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT = 64;

function floorRelightPieceKey(
  tx: number,
  ty: number,
  zBase: number,
  renderAnchorY: number,
  family: "sidewalk" | "asphalt" | "park",
  variantIndex: number,
  rotationQuarterTurns: 0 | 1 | 2 | 3,
): string {
  return buildStaticRelightPieceKey({
    kind: "FLOOR_TOP",
    parts: [tx, ty, zBase, renderAnchorY, family, variantIndex, rotationQuarterTurns],
  });
}

function decalRelightPieceKey(
  tx: number,
  ty: number,
  zBase: number,
  renderAnchorY: number,
  setId: RuntimeDecalSetId,
  variantIndex: number,
  rotationQuarterTurns: 0 | 1 | 2 | 3,
  decalScale: number,
): string {
  return buildStaticRelightPieceKey({
    kind: "DECAL_TOP",
    parts: [tx, ty, zBase, renderAnchorY, setId, variantIndex, rotationQuarterTurns, decalScale],
  });
}

function structureSliceRelightPieceKey(
  o: StampOverlay,
  bandIndex: number,
  ownerTx: number,
  ownerTy: number,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  drawW: number,
  drawH: number,
  flipped: boolean,
): string {
  return buildStaticRelightPieceKey({
    kind: "STRUCTURE_SLICE",
    parts: [
      o.id,
      o.spriteId,
      bandIndex,
      ownerTx,
      ownerTy,
      srcX,
      srcY,
      srcW,
      srcH,
      drawW,
      drawH,
      flipped ? 1 : 0,
    ],
  });
}

function buildRampRoadTiles(compiledMap: ReturnType<typeof getActiveCompiledMap>): Set<string> {
  const rampRoadTiles = new Set<string>();
  if (!compiledMap?.roadSemanticRects) return rampRoadTiles;
  for (let i = 0; i < compiledMap.roadSemanticRects.length; i++) {
    const rr = compiledMap.roadSemanticRects[i];
    const semantic = rr.semantic?.trim().toLowerCase() ?? "";
    if (!(semantic === "ramp" || semantic.startsWith("ramp_"))) continue;
    const minX = rr.x | 0;
    const minY = rr.y | 0;
    const maxX = minX + Math.max(1, rr.w | 0) - 1;
    const maxY = minY + Math.max(1, rr.h | 0) - 1;
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        rampRoadTiles.add(`${tx},${ty}`);
      }
    }
  }
  return rampRoadTiles;
}

function resolveStaticRelightRuntimeState(w: World): StaticRelightRuntimeState {
  const compiledMap = getActiveCompiledMap();
  const settings = getUserSettings();
  const renderSettings = settings.render;
  const activePaletteId = resolveActivePaletteId();
  const activePaletteVariantKey = resolveActivePaletteVariantKey();
  const activePaletteSwapWeights = resolveActivePaletteSwapWeights();
  const staticRelightEnabled = renderSettings.staticRelightEnabled !== false;
  const baseDarknessBucket = settings.debug.paletteDarknessPercent as StaticRelightDarknessBucket;
  const strengthScale = Math.max(0, Math.min(1, settings.debug.staticRelightStrengthPercent / 100));
  const targetDarknessBucket = settings.debug.staticRelightTargetDarknessPercent as 0 | 25 | 50 | 75;
  const enabled = staticRelightEnabled
    && baseDarknessBucket > 0
    && strengthScale > 0;
  const tileHAtWorld = (x: number, y: number) => heightAtWorld(x, y, KENNEY_TILE_WORLD);
  const mapStaticLightRegistry = buildFrameWorldLightRegistry({
    mapId: compiledMap.id,
    tileWorld: KENNEY_TILE_WORLD,
    elevPx: STATIC_RELIGHT_ELEV_PX,
    worldScale: 1,
    streetLampOcclusionEnabled: w.lighting.occlusionEnabled,
    lightOverrides: {
      colorModeOverride: settings.render.lightColorModeOverride,
      strengthOverride: settings.render.lightStrengthOverride,
    },
    lightPalette: {
      paletteId: activePaletteId,
      saturationWeight: activePaletteSwapWeights.sWeight,
    },
    staticLights: compiledMap.lightDefs,
    runtimeBeam: {
      active: false,
      startWorldX: 0,
      startWorldY: 0,
      endWorldX: 0,
      endWorldY: 0,
      zVisual: 0,
      widthPx: 0,
      glowIntensity: 0,
    },
    tileHeightAtWorld: tileHAtWorld,
    isTileInRenderRadius: () => true,
    projectToScreen: (worldX, worldY, zPx) => {
      const p = worldToScreen(worldX, worldY);
      return { x: p.x, y: p.y - zPx };
    },
  });

  const relightLights: StaticRelightLightCandidate[] = [];
  if (enabled) {
    for (let i = 0; i < mapStaticLightRegistry.lights.length; i++) {
      const light = mapStaticLightRegistry.lights[i];
      if (light.source !== "MAP_STATIC") continue;
      const projected = light.projected;
      const intensity = Math.max(0, projected.intensity ?? 0);
      if (intensity <= 0) continue;
      const radiusPx = projected.shape === "STREET_LAMP"
        ? Math.max(1, projected.pool?.radiusPx ?? projected.radiusPx)
        : Math.max(1, projected.radiusPx);
      const centerY = projected.shape === "STREET_LAMP"
        ? (Number.isFinite(projected.poolSy) ? (projected.poolSy as number) : projected.sy)
        : projected.sy;
      relightLights.push({
        id: light.id,
        tileX: light.anchorTx,
        tileY: light.anchorTy,
        centerX: projected.sx,
        centerY,
        radiusPx,
        yScale: projected.shape === "STREET_LAMP"
          ? Math.max(0.1, Math.min(1.5, projected.pool?.yScale ?? 1))
          : 1,
        intensity,
      });
    }
  }

  let frame: StaticRelightFrameContext | null = null;
  if (enabled && relightLights.length > 0 && targetDarknessBucket < baseDarknessBucket) {
    frame = {
      baseDarknessBucket: baseDarknessBucket,
      targetDarknessBucket: targetDarknessBucket,
      strengthScale: strengthScale,
      lights: relightLights,
      maxLights: STATIC_RELIGHT_MAX_LIGHTS,
      tileInfluenceRadius: STATIC_RELIGHT_TILE_RADIUS,
      minBlendAlpha: STATIC_RELIGHT_MIN_BLEND_ALPHA,
    };
  }

  const contextKey = buildStaticRelightBakeContextKey({
    mapId: compiledMap.id,
    relightEnabled: enabled,
    staticRelightEnabled,
    paletteId: activePaletteId,
    paletteVariantKey: activePaletteVariantKey,
    paletteSwapEnabled: renderSettings.paletteSwapEnabled === true,
    paletteGroup: renderSettings.paletteGroup,
    paletteSelectionId: renderSettings.paletteId,
    saturationWeightPercent: Math.round(activePaletteSwapWeights.sWeight * 100),
    darknessPercent: baseDarknessBucket,
    baseDarknessBucket: baseDarknessBucket,
    staticRelightStrengthPercent: settings.debug.staticRelightStrengthPercent,
    staticRelightTargetDarknessPercent: targetDarknessBucket,
    lightColorModeOverride: settings.render.lightColorModeOverride,
    lightStrengthOverride: settings.render.lightStrengthOverride,
    lights: relightLights,
  });

  return {
    compiledMap,
    enabled,
    frame,
    relightLights,
    contextKey,
    targetDarknessBucket,
    baseDarknessBucket,
    strengthScale,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function planStaticRelightBlendForPiece(
  staticRelightFrame: StaticRelightFrameContext,
  pieceTileX: number,
  pieceTileY: number,
  pieceX: number,
  pieceY: number,
  pieceW: number,
  pieceH: number,
): PieceLocalRelightPlan | null {
  const planned = planPieceLocalRelight({
    baseDarknessBucket: staticRelightFrame.baseDarknessBucket,
    pieceTileX,
    pieceTileY,
    pieceScreenRect: {
      x: pieceX,
      y: pieceY,
      width: pieceW,
      height: pieceH,
    },
    lights: staticRelightFrame.lights,
    maxLights: staticRelightFrame.maxLights,
    tileInfluenceRadius: staticRelightFrame.tileInfluenceRadius,
    minBlendAlpha: staticRelightFrame.minBlendAlpha,
  });
  if (!planned) return null;
  const targetDarknessBucket = staticRelightFrame.targetDarknessBucket < staticRelightFrame.baseDarknessBucket
    ? staticRelightFrame.targetDarknessBucket
    : planned.targetDarknessBucket;
  const strengthBlendAlpha = clamp01(staticRelightFrame.strengthScale);
  if (strengthBlendAlpha < staticRelightFrame.minBlendAlpha) return null;
  return {
    ...planned,
    targetDarknessBucket,
    blendAlpha: strengthBlendAlpha,
  };
}

function hasNearbyStaticRelightTileLight(
  staticRelightFrame: StaticRelightFrameContext,
  tileX: number,
  tileY: number,
): boolean {
  const radius = Math.max(0.01, staticRelightFrame.tileInfluenceRadius);
  for (let i = 0; i < staticRelightFrame.lights.length; i++) {
    const light = staticRelightFrame.lights[i];
    const dx = light.tileX - tileX;
    const dy = light.tileY - tileY;
    if (Math.hypot(dx, dy) <= radius) return true;
  }
  return false;
}

type StaticRelightBakeAssetState = "READY" | "PENDING" | "FAILED";

type StaticGroundRelightBakeResult = {
  needsRetry: boolean;
  requiredKeyCount: number;
  readyCount: number;
  pendingCount: number;
  failedCount: number;
  pendingKeys: string[];
};

function classifyStaticRelightBakeAsset(rec: LoadedImg | null | undefined): StaticRelightBakeAssetState {
  if (!rec) return "FAILED";
  if (rec.ready && rec.img && rec.img.naturalWidth > 0 && rec.img.naturalHeight > 0) return "READY";
  if (rec.failed || rec.unsupported) return "FAILED";
  if (rec.ready) return "FAILED";
  return "PENDING";
}

type StaticRelightBakeDependencyTracker = {
  required: Set<string>;
  ready: Set<string>;
  pending: Set<string>;
  failed: Set<string>;
  pendingSample: string[];
};

function createStaticRelightBakeDependencyTracker(): StaticRelightBakeDependencyTracker {
  return {
    required: new Set<string>(),
    ready: new Set<string>(),
    pending: new Set<string>(),
    failed: new Set<string>(),
    pendingSample: [],
  };
}

function noteStaticRelightDependencyState(
  tracker: StaticRelightBakeDependencyTracker,
  key: string,
  state: StaticRelightBakeAssetState,
): void {
  tracker.required.add(key);
  if (state === "READY") {
    tracker.ready.add(key);
    tracker.pending.delete(key);
    tracker.failed.delete(key);
    return;
  }
  if (state === "PENDING") {
    tracker.pending.add(key);
    tracker.ready.delete(key);
    if (tracker.pendingSample.length < 20 && !tracker.pendingSample.includes(key)) {
      tracker.pendingSample.push(key);
    }
    return;
  }
  tracker.failed.add(key);
  tracker.ready.delete(key);
  tracker.pending.delete(key);
}

function rebuildFullMapStaticGroundRelightBake(
  compiledMap: ReturnType<typeof getActiveCompiledMap>,
  rampRoadTiles: Set<string>,
  staticRelightFrame: StaticRelightFrameContext,
): StaticGroundRelightBakeResult {
  let needsRetry = false;
  const deps = createStaticRelightBakeDependencyTracker();
  const seenSurfaceIds = new Set<string>();
  for (const surfaces of compiledMap.surfacesByKey.values()) {
    for (let i = 0; i < surfaces.length; i++) {
      const surface = surfaces[i];
      if (seenSurfaceIds.has(surface.id)) continue;
      seenSurfaceIds.add(surface.id);
      const runtimeTop = surface.runtimeTop;
      if (runtimeTop?.kind !== "SQUARE_128_RUNTIME") continue;
      const tx = surface.tx;
      const ty = surface.ty;
      const anchorY = surface.renderAnchorY ?? KENNEY_TILE_ANCHOR_Y;
      const pieceKey = floorRelightPieceKey(
        tx,
        ty,
        surface.zBase,
        anchorY,
        runtimeTop.family,
        runtimeTop.variantIndex,
        runtimeTop.rotationQuarterTurns,
      );
      if (staticRelightBakeStore.get(pieceKey)) continue;
      const isRampRoadTile = runtimeTop.family === "asphalt" && rampRoadTiles.has(`${tx},${ty}`);
      if (isRampRoadTile) continue;
      const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
      const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
      const p = worldToScreen(wx, wy);
      const centerX = snapPx(p.x);
      const centerY = snapPx(
        p.y - surface.zBase * STATIC_RELIGHT_ELEV_PX - STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT * (anchorY - 0.5),
      );
      const drawX = snapPx(centerX - STATIC_RELIGHT_SIDEWALK_SRC_SIZE * 0.5);
      const drawY = snapPx(centerY - STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT * 0.5);
      const relightPlan = planStaticRelightBlendForPiece(
        staticRelightFrame,
        tx,
        ty,
        drawX,
        drawY,
        STATIC_RELIGHT_SIDEWALK_SRC_SIZE,
        STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT,
      );
      if (!relightPlan) {
        staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const srcId = `tiles/floor/${runtimeTop.family}/${runtimeTop.variantIndex}`;
      const src = getTileSpriteById(srcId);
      const srcKey = `floor-base:${srcId}`;
      const srcState = classifyStaticRelightBakeAsset(src);
      noteStaticRelightDependencyState(deps, srcKey, srcState);
      if (srcState !== "READY" || !src.img || src.img.width <= 0 || src.img.height <= 0) {
        if (srcState === "PENDING") needsRetry = true;
        else staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const baseBaked = getRuntimeIsoTopCanvas(src.img, runtimeTop.rotationQuarterTurns);
      if (!baseBaked) {
        staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const lighterRec = getSpriteByIdForDarknessPercent(srcId, relightPlan.targetDarknessBucket);
      const lighterKey = `floor-lit:${srcId}@@dk:${relightPlan.targetDarknessBucket}`;
      const lighterState = classifyStaticRelightBakeAsset(lighterRec);
      noteStaticRelightDependencyState(deps, lighterKey, lighterState);
      if (lighterState !== "READY" || !lighterRec.img || lighterRec.img.width <= 0 || lighterRec.img.height <= 0) {
        if (lighterState === "PENDING") needsRetry = true;
        else staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const lighterBaked = getRuntimeIsoTopCanvas(lighterRec.img, runtimeTop.rotationQuarterTurns);
      if (!lighterBaked) {
        staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const baked = composePieceLocalRelightBakedCanvas(
        relightPlan,
        baseBaked.width,
        baseBaked.height,
        (target) => target.drawImage(baseBaked, 0, 0, baseBaked.width, baseBaked.height),
        (target) => target.drawImage(lighterBaked, 0, 0, baseBaked.width, baseBaked.height),
      );
      if (baked) staticRelightBakeStore.set(pieceKey, { kind: "RELIT", baked });
      else staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
    }
  }

  for (let i = 0; i < compiledMap.decals.length; i++) {
    const decal = compiledMap.decals[i];
    if (rampRoadTiles.has(`${decal.tx},${decal.ty}`)) continue;
    if (!hasNearbyStaticRelightTileLight(
      staticRelightFrame,
      Math.floor(decal.tx),
      Math.floor(decal.ty),
    )) {
      continue;
    }
    const decalScale = roadMarkingDecalScale(decal.setId, decal.variantIndex);
    const pieceKey = decalRelightPieceKey(
      decal.tx,
      decal.ty,
      decal.zBase,
      decal.renderAnchorY,
      decal.setId,
      decal.variantIndex,
      decal.rotationQuarterTurns,
      decalScale,
    );
    if (staticRelightBakeStore.get(pieceKey)) continue;
    const src = getRuntimeDecalSprite(decal.setId, decal.variantIndex);
    const decalSpriteId = getDecalSpriteId(decal.setId, decal.variantIndex);
    if (!decalSpriteId) {
      staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const srcKey = `decal-base:${decalSpriteId}`;
    const srcState = classifyStaticRelightBakeAsset(src);
    noteStaticRelightDependencyState(deps, srcKey, srcState);
    if (srcState !== "READY" || !src.img || src.img.width <= 0 || src.img.height <= 0) {
      if (srcState === "PENDING") needsRetry = true;
      else staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const baked = getRuntimeIsoDecalCanvas(src.img, decal.rotationQuarterTurns, decalScale);
    if (!baked) {
      staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const renderAnchorY = decal.renderAnchorY;
    const wx = decal.tx * KENNEY_TILE_WORLD;
    const wy = decal.ty * KENNEY_TILE_WORLD;
    const p = worldToScreen(wx, wy);
    const rawCenterX = p.x;
    const rawCenterY = p.y - decal.zBase * STATIC_RELIGHT_ELEV_PX - STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT * (renderAnchorY - 0.5);
    const shouldSnapRoadMarking = shouldPixelSnapRoadMarking(decal.setId, decal.variantIndex);
    const centerX = shouldSnapRoadMarking ? Math.round(rawCenterX) : snapPx(rawCenterX);
    const centerY = shouldSnapRoadMarking ? Math.round(rawCenterY) : snapPx(rawCenterY);
    const drawX = shouldSnapRoadMarking ? Math.round(centerX - baked.width * 0.5) : snapPx(centerX - baked.width * 0.5);
    const drawY = shouldSnapRoadMarking ? Math.round(centerY - baked.height * 0.5) : snapPx(centerY - baked.height * 0.5);
    const relightPlan = planStaticRelightBlendForPiece(
      staticRelightFrame,
      Math.floor(decal.tx),
      Math.floor(decal.ty),
      drawX,
      drawY,
      baked.width,
      baked.height,
    );
    if (!relightPlan) {
      staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const lighterRec = getSpriteByIdForDarknessPercent(decalSpriteId, relightPlan.targetDarknessBucket);
    const lighterKey = `decal-lit:${decalSpriteId}@@dk:${relightPlan.targetDarknessBucket}`;
    const lighterState = classifyStaticRelightBakeAsset(lighterRec);
    noteStaticRelightDependencyState(deps, lighterKey, lighterState);
    if (lighterState !== "READY" || !lighterRec.img || lighterRec.img.width <= 0 || lighterRec.img.height <= 0) {
      if (lighterState === "PENDING") needsRetry = true;
      else staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const lighterBaked = getRuntimeIsoDecalCanvas(lighterRec.img, decal.rotationQuarterTurns, decalScale);
    if (!lighterBaked) {
      staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const bakedCanvas = composePieceLocalRelightBakedCanvas(
      relightPlan,
      baked.width,
      baked.height,
      (target) => target.drawImage(baked, 0, 0, baked.width, baked.height),
      (target) => target.drawImage(lighterBaked, 0, 0, baked.width, baked.height),
    );
    if (bakedCanvas) staticRelightBakeStore.set(pieceKey, { kind: "RELIT", baked: bakedCanvas });
    else staticRelightBakeStore.set(pieceKey, { kind: "BASE" });
  }

  return {
    needsRetry,
    requiredKeyCount: deps.required.size,
    readyCount: deps.ready.size,
    pendingCount: deps.pending.size,
    failedCount: deps.failed.size,
    pendingKeys: deps.pendingSample,
  };
}

let lastStaticRelightLoadingFailureKey = "";
let lastStaticRelightLoadingPendingLogAtMs = 0;
let lastStaticRelightLoadingPendingSignature = "";

export async function prepareRuntimeStructureTrianglesForLoading(_w: World): Promise<boolean> {
  return prepareRuntimeStructureTrianglesForLoadingInternal({
    cacheStore: runtimeStructureTriangleCacheStore,
    getFlippedOverlayImage,
  });
}

export async function prepareStaticGroundRelightForLoading(w: World): Promise<boolean> {
  const staticRelight = resolveStaticRelightRuntimeState(w);
  staticRelightBakeStore.resetIfContextChanged(staticRelight.contextKey);
  if (!staticRelight.enabled || !staticRelight.frame) return true;
  const rampRoadTiles = buildRampRoadTiles(staticRelight.compiledMap);
  const result = rebuildFullMapStaticGroundRelightBake(
    staticRelight.compiledMap,
    rampRoadTiles,
    staticRelight.frame,
  );
  if (result.pendingCount > 0) {
    const signature = `${staticRelight.contextKey}::${result.pendingCount}::${result.failedCount}::${result.pendingKeys.join("|")}`;
    const now = performance.now();
    if (
      signature !== lastStaticRelightLoadingPendingSignature
      || now - lastStaticRelightLoadingPendingLogAtMs >= 1000
    ) {
      lastStaticRelightLoadingPendingSignature = signature;
      lastStaticRelightLoadingPendingLogAtMs = now;
      console.debug(
        `[static-relight:loading] required=${result.requiredKeyCount} ready=${result.readyCount} pending=${result.pendingCount} failed=${result.failedCount}`,
        result.pendingKeys,
      );
    }
    return false;
  }
  lastStaticRelightLoadingPendingSignature = "";
  if (result.failedCount > 0) {
    const failureKey = `${staticRelight.contextKey}::${result.failedCount}`;
    if (failureKey !== lastStaticRelightLoadingFailureKey) {
      lastStaticRelightLoadingFailureKey = failureKey;
      console.warn(
        `[static-relight:loading] proceeding with ${result.failedCount} failed static relight dependencies (fallback to base)`,
      );
    }
  } else {
    lastStaticRelightLoadingFailureKey = "";
  }
  return true;
}

function smoothTowardByHalfLife(current: number, target: number, halfLifeSec: number, dtRealSec: number): number {
  if (!Number.isFinite(current)) return target;
  if (!Number.isFinite(target)) return current;
  if (!Number.isFinite(halfLifeSec) || halfLifeSec <= 0) return target;
  if (!Number.isFinite(dtRealSec) || dtRealSec <= 0) return current;
  const alpha = 1 - Math.pow(0.5, dtRealSec / halfLifeSec);
  return current + (target - current) * alpha;
}

function computeTriToTriAffine(
  s0: ScreenPt, s1: ScreenPt, s2: ScreenPt,
  d0: ScreenPt, d1: ScreenPt, d2: ScreenPt,
): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
  const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(den) < 1e-8) return null;
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den;
  const e = (
    d0.x * (s1.x * s2.y - s2.x * s1.y) +
    d1.x * (s2.x * s0.y - s0.x * s2.y) +
    d2.x * (s0.x * s1.y - s1.x * s0.y)
  ) / den;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den;
  const f = (
    d0.y * (s1.x * s2.y - s2.x * s1.y) +
    d1.y * (s2.x * s0.y - s0.x * s2.y) +
    d2.y * (s0.x * s1.y - s1.x * s0.y)
  ) / den;
  return { a, b, c, d, e, f };
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  s0: ScreenPt, s1: ScreenPt, s2: ScreenPt,
  d0: ScreenPt, d1: ScreenPt, d2: ScreenPt,
): void {
  const m = computeTriToTriAffine(s0, s1, s2, d0, d1, d2);
  if (!m) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(img, 0, 0, imgW, imgH);
  ctx.restore();
}

function drawShadowTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  s0: ScreenPt, s1: ScreenPt, s2: ScreenPt,
  d0: ScreenPt, d1: ScreenPt, d2: ScreenPt,
  shadowAlpha: number,
): void {
  const m = computeTriToTriAffine(s0, s1, s2, d0, d1, d2);
  if (!m) return;
  const alpha = Math.max(0, Math.min(1, shadowAlpha));
  if (alpha <= 0) return;
  const textureAlpha = Math.max(0.14, Math.min(0.48, alpha * 0.95));
  const darkenAlpha = Math.max(alpha, Math.min(0.9, alpha * 1.75));
  ctx.save();
  const baseAlpha = ctx.globalAlpha;
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = baseAlpha * textureAlpha;
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(img, 0, 0, imgW, imgH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Keep warped source variation visible while forcing a dark shadow treatment.
  ctx.globalAlpha = baseAlpha;
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = `rgba(0,0,0,${darkenAlpha})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

type StructureHybridShadowRenderPiece = {
  sourceImage: CanvasImageSource;
  sourceImageWidth: number;
  sourceImageHeight: number;
  projectedMappings: readonly StructureHybridShadowProjectedTriangle[];
};

type StructureV4ShadowRenderPiece = {
  sourceImage: CanvasImageSource;
  sourceImageWidth: number;
  sourceImageHeight: number;
  topCapTriangles: readonly StructureShadowProjectedTriangle[];
  triangleCorrespondence: readonly ShadowTriangleCorrespondence[];
};

type StructureV5ShadowMaskTriangle = {
  stableId: number;
  semanticBucket: HybridSemanticMaskBucket;
  srcTriangle: [ScreenPt, ScreenPt, ScreenPt];
  dstTriangle: [ScreenPt, ScreenPt, ScreenPt];
};

type StructureV5ShadowRenderPiece = {
  structureInstanceId: string;
  sourceImage: CanvasImageSource;
  sourceImageWidth: number;
  sourceImageHeight: number;
  triangles: readonly StructureV5ShadowMaskTriangle[];
  buildingDrawOrigin: ScreenPt;
  buildingAnchor: ScreenPt;
  maskAnchor: ScreenPt;
};

type ShadowV5DebugViewMode = "finalOnly" | "topMask" | "eastWestMask" | "southNorthMask" | "all";
type ShadowV5TransformDebugMode = "deformed" | "raw";

type StructureV5ShadowDrawStats = {
  piecesDrawn: number;
  trianglesDrawn: number;
  finalShadowDrawCalls: number;
};

type StructureV5ShadowAnchorDiagnostic = {
  structureInstanceId: string;
  triangleDestinationSpace: "screen";
  rawBounds: { minX: number; minY: number; maxX: number; maxY: number };
  transformedBounds: { minX: number; minY: number; maxX: number; maxY: number };
  maskCanvasOrigin: ScreenPt;
  maskAnchor: ScreenPt;
  buildingDrawOrigin: ScreenPt;
  buildingAnchor: ScreenPt;
  transformedAnchor: ScreenPt;
  transformedMaskDrawOrigin: ScreenPt;
  finalShadowDrawOrigin: ScreenPt;
  offset: ScreenPt;
};

type StructureV6ShadowDebugCandidate = {
  structureInstanceId: string;
  sourceImage: CanvasImageSource;
  sourceImageWidth: number;
  sourceImageHeight: number;
  triangles: readonly StructureV5ShadowMaskTriangle[];
  zBand: number;
};

type StructureV6ExtrudedSliceDebug = {
  slice: StructureV6FaceSlice;
  t: number;
  offsetX: number;
  offsetY: number;
  canvas: HTMLCanvasElement;
  pixelCount: number;
  contentBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
};

type StructureV6FaceSliceDebugData = {
  structureInstanceId: string;
  zBand: number;
  requestedSemanticBucket: StructureV6SemanticBucket;
  semanticBucket: StructureV6SemanticBucket;
  requestedStructureIndex: number;
  selectedStructureIndex: number;
  candidateCount: number;
  sourceTriangleCount: number;
  nonEmptySliceCount: number;
  faceBounds: { minX: number; minY: number; maxX: number; maxY: number };
  faceCanvas: HTMLCanvasElement;
  axis: StructureV6SliceAxis;
  slices: ReadonlyArray<{
    slice: StructureV6FaceSlice;
    canvas: HTMLCanvasElement;
    pixelCount: number;
    contentBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  }>;
  shadowVector: ScreenPt;
  displacedCanvasOrigin: ScreenPt;
  faceCanvasOrigin: ScreenPt;
  mergedShadowDrawOrigin: ScreenPt;
  displacedSlices: readonly StructureV6ExtrudedSliceDebug[];
  displacedSlicesCanvas: HTMLCanvasElement;
  mergedShadowCanvas: HTMLCanvasElement;
};

type StructureV6FaceSliceCastMode = "baselineToTop" | "constantMax";

type StructureV6VerticalShadowMaskDebugData = {
  structureInstanceId: string;
  zBand: number;
  requestedSemanticBucket: StructureV6SemanticBucket;
  requestedStructureIndex: number;
  selectedStructureIndex: number;
  candidateCount: number;
  shadowVector: ScreenPt;
  bucketAShadow: StructureV6FaceSliceDebugData | null;
  bucketBShadow: StructureV6FaceSliceDebugData | null;
  topShadow: StructureV6FaceSliceDebugData | null;
  mergedVerticalShadowDrawOrigin: ScreenPt;
  mergedVerticalShadowCanvas: HTMLCanvasElement;
};

type DrawStructureV5ShadowMaskOutput = StructureV5ShadowDrawStats & {
  anchorDiagnostic: StructureV5ShadowAnchorDiagnostic | null;
};

type MutableBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type V5FaceLocalAxis = {
  centerBottom: ScreenPt;
  centerTop: ScreenPt;
  heightDir: ScreenPt;
  faceHeight: number;
};

type V5StripDebugBand = {
  tMid: number;
  lowerCenter: ScreenPt;
  upperCenter: ScreenPt;
};

function includeTriangleInBounds(bounds: MutableBounds, triangle: [ScreenPt, ScreenPt, ScreenPt], dx: number, dy: number): void {
  for (let i = 0; i < triangle.length; i++) {
    const p = triangle[i];
    if (p.x < bounds.minX) bounds.minX = p.x;
    if (p.y < bounds.minY) bounds.minY = p.y;
    if (p.x > bounds.maxX) bounds.maxX = p.x;
    if (p.y > bounds.maxY) bounds.maxY = p.y;
    const px = p.x + dx;
    const py = p.y + dy;
    if (px < bounds.minX) bounds.minX = px;
    if (py < bounds.minY) bounds.minY = py;
    if (px > bounds.maxX) bounds.maxX = px;
    if (py > bounds.maxY) bounds.maxY = py;
  }
}

function includePointInBounds(bounds: MutableBounds, point: ScreenPt): void {
  if (point.x < bounds.minX) bounds.minX = point.x;
  if (point.y < bounds.minY) bounds.minY = point.y;
  if (point.x > bounds.maxX) bounds.maxX = point.x;
  if (point.y > bounds.maxY) bounds.maxY = point.y;
}

function computeFaceLocalAxisFromFixedIsoDirection(
  triangles: readonly StructureV5ShadowMaskTriangle[],
  originX: number,
  originY: number,
  fixedHeightDir: ScreenPt,
): V5FaceLocalAxis | null {
  if (triangles.length <= 0) return null;
  const points: ScreenPt[] = [];
  let maxY = Number.NEGATIVE_INFINITY;
  for (let ti = 0; ti < triangles.length; ti++) {
    const tri = triangles[ti].dstTriangle;
    for (let vi = 0; vi < tri.length; vi++) {
      const local = { x: tri[vi].x - originX, y: tri[vi].y - originY };
      points.push(local);
      if (local.y > maxY) maxY = local.y;
    }
  }
  if (points.length <= 0 || !Number.isFinite(maxY)) return null;
  const dirLen = Math.hypot(fixedHeightDir.x, fixedHeightDir.y);
  if (!(dirLen > 1e-4)) return null;
  const heightDir = { x: fixedHeightDir.x / dirLen, y: fixedHeightDir.y / dirLen };
  let minY = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) if (points[i].y < minY) minY = points[i].y;
  const eps = Math.max(1, (maxY - minY) * 0.04);
  const bottomCandidates = points.filter((p) => p.y >= maxY - eps);
  const bottomPoints = bottomCandidates.length > 0 ? bottomCandidates : points.filter((p) => p.y >= maxY - 1e-3);
  if (bottomPoints.length <= 0) return null;
  const avgPoint = (arr: readonly ScreenPt[]): ScreenPt => {
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < arr.length; i++) {
      sx += arr[i].x;
      sy += arr[i].y;
    }
    return { x: sx / arr.length, y: sy / arr.length };
  };
  const centerBottom = avgPoint(bottomPoints);
  let maxAlong = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const along = (p.x - centerBottom.x) * heightDir.x + (p.y - centerBottom.y) * heightDir.y;
    if (along > maxAlong) maxAlong = along;
  }
  const fallbackHeight = Math.max(1, maxY - minY);
  const faceHeight = Math.max(maxAlong, fallbackHeight);
  return {
    centerBottom,
    centerTop: {
      x: centerBottom.x + heightDir.x * faceHeight,
      y: centerBottom.y + heightDir.y * faceHeight,
    },
    heightDir,
    faceHeight,
  };
}

function drawMaskTranslated(
  targetCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
): void {
  targetCtx.drawImage(maskCanvas, offsetX, offsetY);
}

function drawMaskHeightDeformedByFaceAxis(
  targetCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  axis: V5FaceLocalAxis,
  shadowVector: ScreenPt,
  sliceStepPx: number,
): V5StripDebugBand[] {
  const debugBands: V5StripDebugBand[] = [];
  if (!(axis.faceHeight > 1e-4)) {
    targetCtx.drawImage(maskCanvas, 0, 0);
    return debugBands;
  }
  const sliceStep = Math.max(1, Math.floor(sliceStepPx));
  const strips = Math.max(1, Math.ceil(axis.faceHeight / sliceStep));
  const tangent = { x: -axis.heightDir.y, y: axis.heightDir.x };
  const extent = Math.max(maskCanvas.width, maskCanvas.height) * 2 + 8;
  for (let i = 0; i < strips; i++) {
    const h0 = Math.min(axis.faceHeight, i * sliceStep);
    const h1 = Math.min(axis.faceHeight, h0 + sliceStep);
    if (!(h1 > h0)) continue;
    const lowerCenter = {
      x: axis.centerBottom.x + axis.heightDir.x * h0,
      y: axis.centerBottom.y + axis.heightDir.y * h0,
    };
    const upperCenter = {
      x: axis.centerBottom.x + axis.heightDir.x * h1,
      y: axis.centerBottom.y + axis.heightDir.y * h1,
    };
    const q0 = { x: lowerCenter.x + tangent.x * extent, y: lowerCenter.y + tangent.y * extent };
    const q1 = { x: lowerCenter.x - tangent.x * extent, y: lowerCenter.y - tangent.y * extent };
    const q2 = { x: upperCenter.x - tangent.x * extent, y: upperCenter.y - tangent.y * extent };
    const q3 = { x: upperCenter.x + tangent.x * extent, y: upperCenter.y + tangent.y * extent };
    let t = h0 / axis.faceHeight;
    if (h1 >= axis.faceHeight - 1e-4) t = 1;
    const stripOffset = {
      x: shadowVector.x * t,
      y: shadowVector.y * t,
    };
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.moveTo(q0.x, q0.y);
    targetCtx.lineTo(q1.x, q1.y);
    targetCtx.lineTo(q2.x, q2.y);
    targetCtx.lineTo(q3.x, q3.y);
    targetCtx.closePath();
    targetCtx.clip();
    targetCtx.drawImage(maskCanvas, stripOffset.x, stripOffset.y);
    targetCtx.restore();
    debugBands.push({
      tMid: t,
      lowerCenter,
      upperCenter,
    });
  }
  return debugBands;
}

function drawStructureV5ShadowMasks(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureV5ShadowRenderPiece[],
  projectionDirection: { x: number; y: number },
  debugView: ShadowV5DebugViewMode,
  maxDarkness: number,
  anchorDebugEnabled: boolean,
  transformDebugMode: ShadowV5TransformDebugMode,
): DrawStructureV5ShadowMaskOutput {
  if (pieces.length <= 0) {
    return {
      piecesDrawn: 0,
      trianglesDrawn: 0,
      finalShadowDrawCalls: 0,
      anchorDiagnostic: null,
    };
  }
  const offsetX = projectionDirection.x * STRUCTURE_SHADOW_V5_LENGTH_PX;
  const offsetY = projectionDirection.y * STRUCTURE_SHADOW_V5_LENGTH_PX;
  const shadowAlpha = Math.max(0, Math.min(1, maxDarkness));
  let piecesDrawn = 0;
  let trianglesDrawn = 0;
  let finalShadowDrawCalls = 0;
  let anchorDiagnostic: StructureV5ShadowAnchorDiagnostic | null = null;

  for (let pi = 0; pi < pieces.length; pi++) {
    const piece = pieces[pi];
    if (piece.triangles.length <= 0) continue;
    const eastWestTriangles = piece.triangles.filter((tri) => tri.semanticBucket === "EAST_WEST");
    const southNorthTriangles = piece.triangles.filter((tri) => tri.semanticBucket === "SOUTH_NORTH");
    const bounds: MutableBounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };
    const rawBounds: MutableBounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };
    for (let ti = 0; ti < piece.triangles.length; ti++) {
      const triangle = piece.triangles[ti].dstTriangle;
      includeTriangleInBounds(bounds, triangle, offsetX, offsetY);
      for (let vi = 0; vi < triangle.length; vi++) {
        const p = triangle[vi];
        if (p.x < rawBounds.minX) rawBounds.minX = p.x;
        if (p.y < rawBounds.minY) rawBounds.minY = p.y;
        if (p.x > rawBounds.maxX) rawBounds.maxX = p.x;
        if (p.y > rawBounds.maxY) rawBounds.maxY = p.y;
      }
    }
    if (
      !Number.isFinite(bounds.minX)
      || !Number.isFinite(bounds.minY)
      || !Number.isFinite(bounds.maxX)
      || !Number.isFinite(bounds.maxY)
      || !Number.isFinite(rawBounds.minX)
      || !Number.isFinite(rawBounds.minY)
      || !Number.isFinite(rawBounds.maxX)
      || !Number.isFinite(rawBounds.maxY)
    ) {
      continue;
    }
    const pad = 2;
    const originX = Math.floor(bounds.minX) - pad;
    const originY = Math.floor(bounds.minY) - pad;
    const canvasW = Math.max(1, Math.ceil(bounds.maxX - bounds.minX) + pad * 2);
    const canvasH = Math.max(1, Math.ceil(bounds.maxY - bounds.minY) + pad * 2);
    const scratch = getStructureShadowV5MaskScratchContexts(canvasW, canvasH);
    if (!scratch) continue;

    const {
      topMaskCtx,
      eastWestMaskCtx,
      southNorthMaskCtx,
      coverageMaskCtx,
      finalMaskCtx,
      topMaskCanvas,
      eastWestMaskCanvas,
      southNorthMaskCanvas,
      coverageMaskCanvas,
      finalMaskCanvas,
      width,
      height,
    } = scratch;
    const topLocalPoints: ScreenPt[] = [];
    const eastWestLocalPoints: ScreenPt[] = [];
    const southNorthLocalPoints: ScreenPt[] = [];

    topMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    eastWestMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    southNorthMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    coverageMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    finalMaskCtx.setTransform(1, 0, 0, 1, 0, 0);

    topMaskCtx.globalCompositeOperation = "source-over";
    eastWestMaskCtx.globalCompositeOperation = "source-over";
    southNorthMaskCtx.globalCompositeOperation = "source-over";
    coverageMaskCtx.globalCompositeOperation = "source-over";
    finalMaskCtx.globalCompositeOperation = "source-over";

    topMaskCtx.clearRect(0, 0, width, height);
    eastWestMaskCtx.clearRect(0, 0, width, height);
    southNorthMaskCtx.clearRect(0, 0, width, height);
    coverageMaskCtx.clearRect(0, 0, width, height);
    finalMaskCtx.clearRect(0, 0, width, height);

    for (let ti = 0; ti < piece.triangles.length; ti++) {
      const tri = piece.triangles[ti];
      const targetCtx = tri.semanticBucket === "TOP"
        ? topMaskCtx
        : tri.semanticBucket === "EAST_WEST"
          ? eastWestMaskCtx
          : southNorthMaskCtx;
      const [s0, s1, s2] = tri.srcTriangle;
      const [d0, d1, d2] = tri.dstTriangle;
      drawTexturedTriangle(
        targetCtx,
        piece.sourceImage,
        piece.sourceImageWidth,
        piece.sourceImageHeight,
        s0,
        s1,
        s2,
        { x: d0.x - originX, y: d0.y - originY },
        { x: d1.x - originX, y: d1.y - originY },
        { x: d2.x - originX, y: d2.y - originY },
      );
      const localA = { x: d0.x - originX, y: d0.y - originY };
      const localB = { x: d1.x - originX, y: d1.y - originY };
      const localC = { x: d2.x - originX, y: d2.y - originY };
      if (tri.semanticBucket === "TOP") {
        topLocalPoints.push(localA, localB, localC);
      } else if (tri.semanticBucket === "EAST_WEST") {
        eastWestLocalPoints.push(localA, localB, localC);
      } else {
        southNorthLocalPoints.push(localA, localB, localC);
      }
      trianglesDrawn += 1;
    }

    const shiftedX = offsetX;
    const shiftedY = offsetY;
    const shadowVector = { x: shiftedX, y: shiftedY };
    const eastWestAxis = computeFaceLocalAxisFromFixedIsoDirection(
      eastWestTriangles,
      originX,
      originY,
      STRUCTURE_SHADOW_V5_EAST_WEST_FIXED_AXIS,
    );
    const southNorthAxis = computeFaceLocalAxisFromFixedIsoDirection(
      southNorthTriangles,
      originX,
      originY,
      STRUCTURE_SHADOW_V5_SOUTH_NORTH_FIXED_AXIS,
    );
    const drawTopMaskLocal = (targetCtx: CanvasRenderingContext2D, raw: boolean): void => {
      if (raw) {
        targetCtx.drawImage(topMaskCanvas, 0, 0);
      } else {
        drawMaskTranslated(targetCtx, topMaskCanvas, shadowVector.x, shadowVector.y);
      }
    };
    const drawEastWestMaskLocal = (
      targetCtx: CanvasRenderingContext2D,
      raw: boolean,
    ): V5StripDebugBand[] => {
      if (raw) {
        targetCtx.drawImage(eastWestMaskCanvas, 0, 0);
        return [];
      }
      if (!eastWestAxis) return [];
      return drawMaskHeightDeformedByFaceAxis(
        targetCtx,
        eastWestMaskCanvas,
        eastWestAxis,
        shadowVector,
        STRUCTURE_SHADOW_V5_PIXEL_SLICE_STEP_PX,
      );
    };
    const drawSouthNorthMaskLocal = (
      targetCtx: CanvasRenderingContext2D,
      raw: boolean,
    ): V5StripDebugBand[] => {
      if (raw) {
        targetCtx.drawImage(southNorthMaskCanvas, 0, 0);
        return [];
      }
      if (!southNorthAxis) return [];
      return drawMaskHeightDeformedByFaceAxis(
        targetCtx,
        southNorthMaskCanvas,
        southNorthAxis,
        shadowVector,
        STRUCTURE_SHADOW_V5_PIXEL_SLICE_STEP_PX,
      );
    };
    const drawLocalMaskToWorld = (drawLocal: (targetCtx: CanvasRenderingContext2D) => void): void => {
      ctx.save();
      ctx.translate(originX, originY);
      drawLocal(ctx);
      ctx.restore();
    };

    coverageMaskCtx.clearRect(0, 0, width, height);
    coverageMaskCtx.globalCompositeOperation = "source-over";
    drawTopMaskLocal(coverageMaskCtx, false);
    const eastWestBands = drawEastWestMaskLocal(coverageMaskCtx, false);
    const southNorthBands = drawSouthNorthMaskLocal(coverageMaskCtx, false);

    finalMaskCtx.clearRect(0, 0, width, height);
    if (shadowAlpha > 0) {
      finalMaskCtx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
      finalMaskCtx.fillRect(0, 0, width, height);
      finalMaskCtx.globalCompositeOperation = "destination-in";
      finalMaskCtx.drawImage(coverageMaskCanvas, 0, 0);
      finalMaskCtx.globalCompositeOperation = "source-over";
    }
    const showRawDebugMasks = transformDebugMode === "raw";

    if (debugView === "topMask") {
      drawLocalMaskToWorld((targetCtx) => drawTopMaskLocal(targetCtx, showRawDebugMasks));
    } else if (debugView === "eastWestMask") {
      drawLocalMaskToWorld((targetCtx) => {
        drawEastWestMaskLocal(targetCtx, showRawDebugMasks);
      });
    } else if (debugView === "southNorthMask") {
      drawLocalMaskToWorld((targetCtx) => {
        drawSouthNorthMaskLocal(targetCtx, showRawDebugMasks);
      });
    } else if (debugView === "all") {
      drawLocalMaskToWorld((targetCtx) => {
        drawTopMaskLocal(targetCtx, showRawDebugMasks);
        drawEastWestMaskLocal(targetCtx, showRawDebugMasks);
        drawSouthNorthMaskLocal(targetCtx, showRawDebugMasks);
      });
    } else {
      ctx.drawImage(finalMaskCanvas, originX, originY);
      finalShadowDrawCalls += 1;
    }
    if (anchorDebugEnabled && !anchorDiagnostic) {
      const rawW = Math.max(0, rawBounds.maxX - rawBounds.minX);
      const rawH = Math.max(0, rawBounds.maxY - rawBounds.minY);
      const transformedBounds: MutableBounds = {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      };
      const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
      const includeDisplacedLocalPoints = (
        points: readonly ScreenPt[],
        axis: V5FaceLocalAxis | null,
        fullOffset: boolean,
      ) => {
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const t = fullOffset || !axis || !(axis.faceHeight > 1e-4)
            ? 1
            : clamp01(
              ((p.x - axis.centerBottom.x) * axis.heightDir.x + (p.y - axis.centerBottom.y) * axis.heightDir.y)
                / axis.faceHeight,
            );
          includePointInBounds(transformedBounds, {
            x: originX + p.x + shadowVector.x * t,
            y: originY + p.y + shadowVector.y * t,
          });
        }
      };
      includeDisplacedLocalPoints(topLocalPoints, null, true);
      includeDisplacedLocalPoints(eastWestLocalPoints, eastWestAxis, false);
      includeDisplacedLocalPoints(southNorthLocalPoints, southNorthAxis, false);
      if (!Number.isFinite(transformedBounds.minX)) {
        transformedBounds.minX = rawBounds.minX;
        transformedBounds.minY = rawBounds.minY;
        transformedBounds.maxX = rawBounds.maxX;
        transformedBounds.maxY = rawBounds.maxY;
      }
      const transformedAnchor = { x: piece.maskAnchor.x, y: piece.maskAnchor.y };
      // Verification overlay: raw masks + face-local axis/strip scaffolding for one structure.
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.translate(originX, originY);
      drawTopMaskLocal(ctx, true);
      drawEastWestMaskLocal(ctx, true);
      drawSouthNorthMaskLocal(ctx, true);
      ctx.translate(-originX, -originY);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(80, 220, 255, 0.95)";
      ctx.strokeRect(rawBounds.minX, rawBounds.minY, rawW, rawH);
      ctx.strokeStyle = "rgba(255, 180, 70, 0.95)";
      ctx.strokeRect(
        transformedBounds.minX,
        transformedBounds.minY,
        Math.max(0, transformedBounds.maxX - transformedBounds.minX),
        Math.max(0, transformedBounds.maxY - transformedBounds.minY),
      );
      const drawAnchorPoint = (point: ScreenPt, color: string, label: string) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = "rgba(245, 245, 245, 0.96)";
        ctx.font = "10px monospace";
        ctx.fillText(label, point.x + 4, point.y - 4);
      };
      drawAnchorPoint(piece.maskAnchor, "rgba(70, 220, 255, 0.96)", "mask");
      drawAnchorPoint(piece.buildingAnchor, "rgba(110, 255, 135, 0.96)", "build");
      drawAnchorPoint(transformedAnchor, "rgba(255, 200, 80, 0.98)", "xform");
      drawAnchorPoint(piece.buildingDrawOrigin, "rgba(255, 120, 220, 0.95)", "draw0");
      const drawAxisDebug = (
        axis: V5FaceLocalAxis | null,
        bands: readonly V5StripDebugBand[],
        lineColor: string,
        bandColor: string,
        label: string,
      ) => {
        if (!axis) return;
        const bottom = { x: originX + axis.centerBottom.x, y: originY + axis.centerBottom.y };
        const top = { x: originX + axis.centerTop.x, y: originY + axis.centerTop.y };
        const tangent = { x: -axis.heightDir.y, y: axis.heightDir.x };
        ctx.beginPath();
        ctx.moveTo(bottom.x, bottom.y);
        ctx.lineTo(top.x, top.y);
        ctx.strokeStyle = lineColor;
        ctx.stroke();
        ctx.fillStyle = "rgba(245, 245, 245, 0.96)";
        ctx.fillText(label, bottom.x + 4, bottom.y + 10);
        const span = 24;
        for (let bi = 0; bi < bands.length; bi++) {
          const lower = { x: originX + bands[bi].lowerCenter.x, y: originY + bands[bi].lowerCenter.y };
          const upper = { x: originX + bands[bi].upperCenter.x, y: originY + bands[bi].upperCenter.y };
          ctx.beginPath();
          ctx.moveTo(lower.x - tangent.x * span, lower.y - tangent.y * span);
          ctx.lineTo(lower.x + tangent.x * span, lower.y + tangent.y * span);
          ctx.strokeStyle = bandColor;
          ctx.stroke();
          if (bi === bands.length - 1) {
            ctx.beginPath();
            ctx.moveTo(upper.x - tangent.x * span, upper.y - tangent.y * span);
            ctx.lineTo(upper.x + tangent.x * span, upper.y + tangent.y * span);
            ctx.stroke();
          }
        }
      };
      drawAxisDebug(
        eastWestAxis,
        eastWestBands,
        "rgba(120, 220, 255, 0.95)",
        "rgba(120, 220, 255, 0.38)",
        "EW axis (fixed)",
      );
      drawAxisDebug(
        southNorthAxis,
        southNorthBands,
        "rgba(255, 140, 120, 0.95)",
        "rgba(255, 140, 120, 0.38)",
        "SN axis (fixed)",
      );
      ctx.restore();
      anchorDiagnostic = {
        structureInstanceId: piece.structureInstanceId,
        triangleDestinationSpace: "screen",
        rawBounds: {
          minX: rawBounds.minX,
          minY: rawBounds.minY,
          maxX: rawBounds.maxX,
          maxY: rawBounds.maxY,
        },
        transformedBounds,
        maskCanvasOrigin: { x: originX, y: originY },
        maskAnchor: { x: piece.maskAnchor.x, y: piece.maskAnchor.y },
        buildingDrawOrigin: { x: piece.buildingDrawOrigin.x, y: piece.buildingDrawOrigin.y },
        buildingAnchor: { x: piece.buildingAnchor.x, y: piece.buildingAnchor.y },
        transformedAnchor,
        transformedMaskDrawOrigin: { x: originX + shiftedX, y: originY + shiftedY },
        finalShadowDrawOrigin: { x: originX, y: originY },
        offset: { x: shiftedX, y: shiftedY },
      };
    }
    piecesDrawn += 1;
  }

  return {
    piecesDrawn,
    trianglesDrawn,
    finalShadowDrawCalls,
    anchorDiagnostic,
  };
}

function countStructureV6CandidateTrianglesForBucket(
  candidate: StructureV6ShadowDebugCandidate,
  bucket: StructureV6SemanticBucket,
): number {
  let count = 0;
  for (let i = 0; i < candidate.triangles.length; i++) {
    if (candidate.triangles[i].semanticBucket === bucket) count += 1;
  }
  return count;
}

function filterStructureV6CandidateForBucket(
  candidate: StructureV6ShadowDebugCandidate,
  bucket: StructureV6SemanticBucket,
): StructureV6ShadowDebugCandidate {
  const triangles = candidate.triangles.filter((triangle) => triangle.semanticBucket === bucket);
  return {
    structureInstanceId: candidate.structureInstanceId,
    sourceImage: candidate.sourceImage,
    sourceImageWidth: candidate.sourceImageWidth,
    sourceImageHeight: candidate.sourceImageHeight,
    triangles,
    zBand: candidate.zBand,
  };
}

type BuildStructureV6FaceSliceDebugOptions = {
  axisOverride?: StructureV6SliceAxis;
  useSunRelativeAxis?: boolean;
  castMode?: StructureV6FaceSliceCastMode;
  disableSlicing?: boolean;
};

function normalizeScreenVector(v: ScreenPt): ScreenPt {
  const len = Math.hypot(v.x, v.y);
  if (!(len > 1e-6)) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function dotScreenVectors(a: ScreenPt, b: ScreenPt): number {
  return a.x * b.x + a.y * b.y;
}

function perpendicularScreenVector(v: ScreenPt): ScreenPt {
  return { x: v.y, y: -v.x };
}

function buildStructureV6SunRelativeSliceAxis(
  faceWidth: number,
  faceHeight: number,
  shadowVector: ScreenPt,
): StructureV6SliceAxis {
  const width = Math.max(1, Math.ceil(faceWidth));
  const height = Math.max(1, Math.ceil(faceHeight));
  const sliceDir = normalizeScreenVector(shadowVector);
  const sliceNormal = normalizeScreenVector(perpendicularScreenVector(sliceDir));
  const corners: ScreenPt[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  let minT = Number.POSITIVE_INFINITY;
  let maxT = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < corners.length; i++) {
    const t = dotScreenVectors(corners[i], sliceNormal);
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }
  if (!Number.isFinite(minT) || !Number.isFinite(maxT)) {
    minT = 0;
    maxT = 1;
  }
  if (Math.abs(maxT - minT) < 1e-6) maxT = minT + 1;
  return {
    sliceDir,
    sliceNormal,
    minT,
    maxT,
  };
}

function buildStructureV6FaceSliceDebugData(
  candidate: StructureV6ShadowDebugCandidate,
  requestedSemanticBucket: StructureV6SemanticBucket,
  semanticBucket: StructureV6SemanticBucket,
  requestedStructureIndex: number,
  selectedStructureIndex: number,
  candidateCount: number,
  requestedSliceCount: number,
  shadowVector: ScreenPt,
  options?: BuildStructureV6FaceSliceDebugOptions,
): StructureV6FaceSliceDebugData | null {
  if (candidate.triangles.length <= 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let ti = 0; ti < candidate.triangles.length; ti++) {
    const tri = candidate.triangles[ti].dstTriangle;
    for (let vi = 0; vi < tri.length; vi++) {
      const p = tri[vi];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  const pad = 1;
  const originX = Math.floor(minX) - pad;
  const originY = Math.floor(minY) - pad;
  const width = Math.max(1, Math.ceil(maxX - minX) + pad * 2);
  const height = Math.max(1, Math.ceil(maxY - minY) + pad * 2);
  const scratch = ensureScratchCanvas2D(structureShadowV6FaceScratch, width, height);
  if (!scratch) return null;
  structureShadowV6FaceScratch = scratch.canvas;
  const faceCtx = scratch.ctx;
  faceCtx.setTransform(1, 0, 0, 1, 0, 0);
  faceCtx.globalAlpha = 1;
  faceCtx.globalCompositeOperation = "source-over";
  faceCtx.clearRect(0, 0, width, height);
  for (let ti = 0; ti < candidate.triangles.length; ti++) {
    const tri = candidate.triangles[ti];
    const [s0, s1, s2] = tri.srcTriangle;
    const [d0, d1, d2] = tri.dstTriangle;
    drawTexturedTriangle(
      faceCtx,
      candidate.sourceImage,
      candidate.sourceImageWidth,
      candidate.sourceImageHeight,
      s0,
      s1,
      s2,
      { x: d0.x - originX, y: d0.y - originY },
      { x: d1.x - originX, y: d1.y - originY },
      { x: d2.x - originX, y: d2.y - originY },
    );
  }
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = width;
  faceCanvas.height = height;
  const faceCanvasCtx = faceCanvas.getContext("2d");
  if (!faceCanvasCtx) return null;
  configurePixelPerfect(faceCanvasCtx);
  faceCanvasCtx.imageSmoothingEnabled = false;
  faceCanvasCtx.clearRect(0, 0, width, height);
  faceCanvasCtx.drawImage(scratch.canvas, 0, 0);

  const axis = options?.axisOverride
    ?? (options?.useSunRelativeAxis
      ? buildStructureV6SunRelativeSliceAxis(width, height, shadowVector)
      : buildStructureV6SliceAxis(width, height, semanticBucket));
  const castMode = options?.castMode ?? "baselineToTop";
  const disableSlicing = options?.disableSlicing === true;
  if (disableSlicing) {
    const offsetX = shadowVector.x;
    const offsetY = shadowVector.y;
    const displacedMinX = Math.min(0, offsetX);
    const displacedMinY = Math.min(0, offsetY);
    const displacedMaxX = Math.max(width, width + offsetX);
    const displacedMaxY = Math.max(height, height + offsetY);
    const displacedPad = 1;
    const displacedOriginX = Math.floor(displacedMinX) - displacedPad;
    const displacedOriginY = Math.floor(displacedMinY) - displacedPad;
    const displacedWidth = Math.max(1, Math.ceil(displacedMaxX - displacedMinX) + displacedPad * 2);
    const displacedHeight = Math.max(1, Math.ceil(displacedMaxY - displacedMinY) + displacedPad * 2);
    const displacedSlicesCanvas = document.createElement("canvas");
    displacedSlicesCanvas.width = displacedWidth;
    displacedSlicesCanvas.height = displacedHeight;
    const displacedSlicesCtx = displacedSlicesCanvas.getContext("2d");
    if (!displacedSlicesCtx) return null;
    configurePixelPerfect(displacedSlicesCtx);
    displacedSlicesCtx.imageSmoothingEnabled = false;
    displacedSlicesCtx.clearRect(0, 0, displacedWidth, displacedHeight);
    displacedSlicesCtx.drawImage(
      faceCanvas,
      Math.round(offsetX - displacedOriginX),
      Math.round(offsetY - displacedOriginY),
    );
    const mergedShadowCanvas = document.createElement("canvas");
    mergedShadowCanvas.width = displacedWidth;
    mergedShadowCanvas.height = displacedHeight;
    const mergedShadowCtx = mergedShadowCanvas.getContext("2d");
    if (!mergedShadowCtx) return null;
    configurePixelPerfect(mergedShadowCtx);
    mergedShadowCtx.imageSmoothingEnabled = false;
    mergedShadowCtx.clearRect(0, 0, displacedWidth, displacedHeight);
    mergedShadowCtx.drawImage(displacedSlicesCanvas, 0, 0);
    mergedShadowCtx.globalCompositeOperation = "source-in";
    mergedShadowCtx.fillStyle = "rgba(0,0,0,0.78)";
    mergedShadowCtx.fillRect(0, 0, displacedWidth, displacedHeight);
    mergedShadowCtx.globalCompositeOperation = "source-over";
    return {
      structureInstanceId: candidate.structureInstanceId,
      zBand: candidate.zBand,
      requestedSemanticBucket,
      semanticBucket,
      requestedStructureIndex,
      selectedStructureIndex,
      candidateCount,
      sourceTriangleCount: candidate.triangles.length,
      nonEmptySliceCount: candidate.triangles.length > 0 ? 1 : 0,
      faceBounds: { minX, minY, maxX, maxY },
      faceCanvas,
      axis,
      slices: [],
      shadowVector,
      displacedCanvasOrigin: { x: displacedOriginX, y: displacedOriginY },
      faceCanvasOrigin: { x: originX, y: originY },
      mergedShadowDrawOrigin: { x: originX + displacedOriginX, y: originY + displacedOriginY },
      displacedSlices: [],
      displacedSlicesCanvas,
      mergedShadowCanvas,
    };
  }
  const sliceCount = clampStructureV6SliceCount(requestedSliceCount);
  const sliceDefs = buildStructureV6FaceSlices(axis, sliceCount);
  const sourceImageData = faceCtx.getImageData(0, 0, width, height);
  const source = sourceImageData.data;
  const perSliceData: Uint8ClampedArray[] = new Array(sliceDefs.length);
  const perSlicePixelCounts: number[] = new Array(sliceDefs.length);
  const perSliceBounds: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = new Array(sliceDefs.length);
  for (let i = 0; i < sliceDefs.length; i++) {
    perSliceData[i] = new Uint8ClampedArray(source.length);
    perSlicePixelCounts[i] = 0;
    perSliceBounds[i] = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) << 2;
      const alpha = source[pixelIndex + 3] | 0;
      if (alpha <= 0) continue;
      const sliceIndex = resolveStructureV6SliceIndex(
        x + 0.5,
        y + 0.5,
        axis,
        sliceDefs.length,
      );
      const out = perSliceData[sliceIndex];
      out[pixelIndex] = source[pixelIndex];
      out[pixelIndex + 1] = source[pixelIndex + 1];
      out[pixelIndex + 2] = source[pixelIndex + 2];
      out[pixelIndex + 3] = source[pixelIndex + 3];
      perSlicePixelCounts[sliceIndex] += 1;
      const bounds = perSliceBounds[sliceIndex];
      if (x < bounds.minX) bounds.minX = x;
      if (y < bounds.minY) bounds.minY = y;
      if (x > bounds.maxX) bounds.maxX = x;
      if (y > bounds.maxY) bounds.maxY = y;
    }
  }
  const slices = sliceDefs.map((slice, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      configurePixelPerfect(ctx);
      ctx.imageSmoothingEnabled = false;
      const imageData = ctx.createImageData(width, height);
      imageData.data.set(perSliceData[index]);
      ctx.putImageData(imageData, 0, 0);
    }
    return {
      slice,
      canvas,
      pixelCount: perSlicePixelCounts[index],
      contentBounds: perSlicePixelCounts[index] > 0
        ? {
            minX: perSliceBounds[index].minX,
            minY: perSliceBounds[index].minY,
            maxX: perSliceBounds[index].maxX,
            maxY: perSliceBounds[index].maxY,
      }
        : null,
    };
  });
  const nonEmptySlices = slices.filter((sliceEntry) => sliceEntry.pixelCount > 0);
  const castSlices = nonEmptySlices.length > 0 ? nonEmptySlices : slices;
  const sliceDenominator = Math.max(1, castSlices.length - 1);
  const displacedSlices: StructureV6ExtrudedSliceDebug[] = new Array(castSlices.length);
  let displacedMinX = 0;
  let displacedMinY = 0;
  let displacedMaxX = width;
  let displacedMaxY = height;
  for (let i = 0; i < castSlices.length; i++) {
    const t = castMode === "constantMax"
      ? 1
      : castSlices.length <= 1
        ? 0
        : i / sliceDenominator;
    const offsetX = shadowVector.x * t;
    const offsetY = shadowVector.y * t;
    const sliceEntry = castSlices[i];
    displacedSlices[i] = {
      slice: sliceEntry.slice,
      t,
      offsetX,
      offsetY,
      canvas: sliceEntry.canvas,
      pixelCount: sliceEntry.pixelCount,
      contentBounds: sliceEntry.contentBounds,
    };
    const content = sliceEntry.contentBounds;
    if (!content) continue;
    const minXWithOffset = content.minX + offsetX;
    const minYWithOffset = content.minY + offsetY;
    const maxXWithOffset = content.maxX + 1 + offsetX;
    const maxYWithOffset = content.maxY + 1 + offsetY;
    if (minXWithOffset < displacedMinX) displacedMinX = minXWithOffset;
    if (minYWithOffset < displacedMinY) displacedMinY = minYWithOffset;
    if (maxXWithOffset > displacedMaxX) displacedMaxX = maxXWithOffset;
    if (maxYWithOffset > displacedMaxY) displacedMaxY = maxYWithOffset;
  }
  const displacedPad = 1;
  const displacedOriginX = Math.floor(displacedMinX) - displacedPad;
  const displacedOriginY = Math.floor(displacedMinY) - displacedPad;
  const displacedWidth = Math.max(1, Math.ceil(displacedMaxX - displacedMinX) + displacedPad * 2);
  const displacedHeight = Math.max(1, Math.ceil(displacedMaxY - displacedMinY) + displacedPad * 2);
  const displacedSlicesCanvas = document.createElement("canvas");
  displacedSlicesCanvas.width = displacedWidth;
  displacedSlicesCanvas.height = displacedHeight;
  const displacedSlicesCtx = displacedSlicesCanvas.getContext("2d");
  if (!displacedSlicesCtx) return null;
  configurePixelPerfect(displacedSlicesCtx);
  displacedSlicesCtx.imageSmoothingEnabled = false;
  displacedSlicesCtx.clearRect(0, 0, displacedWidth, displacedHeight);
  for (let i = 0; i < displacedSlices.length; i++) {
    const sliceEntry = displacedSlices[i];
    if (!sliceEntry.contentBounds) continue;
    displacedSlicesCtx.drawImage(
      sliceEntry.canvas,
      Math.round(sliceEntry.offsetX - displacedOriginX),
      Math.round(sliceEntry.offsetY - displacedOriginY),
    );
  }
  const mergedShadowCanvas = document.createElement("canvas");
  mergedShadowCanvas.width = displacedWidth;
  mergedShadowCanvas.height = displacedHeight;
  const mergedShadowCtx = mergedShadowCanvas.getContext("2d");
  if (!mergedShadowCtx) return null;
  configurePixelPerfect(mergedShadowCtx);
  mergedShadowCtx.imageSmoothingEnabled = false;
  mergedShadowCtx.clearRect(0, 0, displacedWidth, displacedHeight);
  mergedShadowCtx.drawImage(displacedSlicesCanvas, 0, 0);
  mergedShadowCtx.globalCompositeOperation = "source-in";
  mergedShadowCtx.fillStyle = "rgba(0,0,0,0.78)";
  mergedShadowCtx.fillRect(0, 0, displacedWidth, displacedHeight);
  mergedShadowCtx.globalCompositeOperation = "source-over";
  return {
    structureInstanceId: candidate.structureInstanceId,
    zBand: candidate.zBand,
    requestedSemanticBucket,
    semanticBucket,
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    sourceTriangleCount: candidate.triangles.length,
    nonEmptySliceCount: nonEmptySlices.length,
    faceBounds: { minX, minY, maxX, maxY },
    faceCanvas,
    axis,
    slices,
    shadowVector,
    displacedCanvasOrigin: { x: displacedOriginX, y: displacedOriginY },
    faceCanvasOrigin: { x: originX, y: originY },
    mergedShadowDrawOrigin: { x: originX + displacedOriginX, y: originY + displacedOriginY },
    displacedSlices,
    displacedSlicesCanvas,
    mergedShadowCanvas,
  };
}

function buildStructureV6VerticalShadowMaskDebugData(
  candidate: StructureV6ShadowDebugCandidate,
  requestedSemanticBucket: StructureV6SemanticBucket,
  requestedStructureIndex: number,
  selectedStructureIndex: number,
  candidateCount: number,
  requestedSliceCount: number,
  shadowVector: ScreenPt,
): StructureV6VerticalShadowMaskDebugData | null {
  const bucketAShadow = buildStructureV6FaceSliceDebugData(
    filterStructureV6CandidateForBucket(candidate, "EAST_WEST"),
    requestedSemanticBucket,
    "EAST_WEST",
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    requestedSliceCount,
    shadowVector,
  );
  const bucketBShadow = buildStructureV6FaceSliceDebugData(
    filterStructureV6CandidateForBucket(candidate, "SOUTH_NORTH"),
    requestedSemanticBucket,
    "SOUTH_NORTH",
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    requestedSliceCount,
    shadowVector,
  );
  const topSource = filterStructureV6CandidateForBucket(candidate, "TOP");
  const topShadow = buildStructureV6FaceSliceDebugData(
    topSource,
    requestedSemanticBucket,
    "TOP",
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    requestedSliceCount,
    shadowVector,
    {
      disableSlicing: true,
    },
  );
  if (!bucketAShadow && !bucketBShadow && !topShadow) return null;

  const bucketShadows = [bucketAShadow, bucketBShadow, topShadow].filter(
    (entry): entry is StructureV6FaceSliceDebugData => entry !== null,
  );
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < bucketShadows.length; i++) {
    const bucket = bucketShadows[i];
    const drawX = bucket.mergedShadowDrawOrigin.x;
    const drawY = bucket.mergedShadowDrawOrigin.y;
    minX = Math.min(minX, drawX);
    minY = Math.min(minY, drawY);
    maxX = Math.max(maxX, drawX + bucket.displacedSlicesCanvas.width);
    maxY = Math.max(maxY, drawY + bucket.displacedSlicesCanvas.height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  const mergedPad = 1;
  const mergedOriginX = Math.floor(minX) - mergedPad;
  const mergedOriginY = Math.floor(minY) - mergedPad;
  const mergedWidth = Math.max(1, Math.ceil(maxX - minX) + mergedPad * 2);
  const mergedHeight = Math.max(1, Math.ceil(maxY - minY) + mergedPad * 2);
  const mergedVerticalShadowCanvas = document.createElement("canvas");
  mergedVerticalShadowCanvas.width = mergedWidth;
  mergedVerticalShadowCanvas.height = mergedHeight;
  const mergedVerticalShadowCtx = mergedVerticalShadowCanvas.getContext("2d");
  if (!mergedVerticalShadowCtx) return null;
  configurePixelPerfect(mergedVerticalShadowCtx);
  mergedVerticalShadowCtx.imageSmoothingEnabled = false;
  mergedVerticalShadowCtx.clearRect(0, 0, mergedWidth, mergedHeight);
  for (let i = 0; i < bucketShadows.length; i++) {
    const bucket = bucketShadows[i];
    mergedVerticalShadowCtx.drawImage(
      bucket.displacedSlicesCanvas,
      Math.round(bucket.mergedShadowDrawOrigin.x - mergedOriginX),
      Math.round(bucket.mergedShadowDrawOrigin.y - mergedOriginY),
    );
  }
  // Tint once after unioning coverage so overlapping buckets do not add extra darkness.
  mergedVerticalShadowCtx.globalCompositeOperation = "source-in";
  mergedVerticalShadowCtx.fillStyle = "rgba(0,0,0,0.78)";
  mergedVerticalShadowCtx.fillRect(0, 0, mergedWidth, mergedHeight);
  mergedVerticalShadowCtx.globalCompositeOperation = "source-over";

  return {
    structureInstanceId: candidate.structureInstanceId,
    zBand: candidate.zBand,
    requestedSemanticBucket,
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    shadowVector,
    bucketAShadow,
    bucketBShadow,
    topShadow,
    mergedVerticalShadowDrawOrigin: { x: mergedOriginX, y: mergedOriginY },
    mergedVerticalShadowCanvas,
  };
}

function drawStructureV65MergedShadowMaskInWorld(
  ctx: CanvasRenderingContext2D,
  debugData: StructureV6VerticalShadowMaskDebugData,
): void {
  if (debugData.mergedVerticalShadowCanvas.width <= 0 || debugData.mergedVerticalShadowCanvas.height <= 0) return;
  const drawX = Math.round(debugData.mergedVerticalShadowDrawOrigin.x);
  const drawY = Math.round(debugData.mergedVerticalShadowDrawOrigin.y);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(
    debugData.mergedVerticalShadowCanvas,
    drawX,
    drawY,
  );
  ctx.restore();
}

function drawStructureV6FaceSliceDebugPanel(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  debugData: StructureV6VerticalShadowMaskDebugData,
): void {
  const panelPadding = STRUCTURE_SHADOW_V6_DEBUG_PANEL_PADDING_PX;
  const panelW = Math.max(420, Math.min(900, cssW - panelPadding * 2));
  const panelH = Math.max(300, Math.min(560, cssH - panelPadding * 2));
  const panelX = cssW - panelW - panelPadding;
  const panelY = panelPadding;

  const drawViewFrame = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
  ): { contentX: number; contentY: number; contentW: number; contentH: number } => {
    ctx.fillStyle = "rgba(32, 38, 52, 0.60)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(160, 186, 238, 0.52)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = "rgba(210, 228, 255, 0.92)";
    ctx.font = "10px monospace";
    ctx.fillText(label, x + 4, y + 11);
    return {
      contentX: x + 4,
      contentY: y + 14,
      contentW: Math.max(1, w - 8),
      contentH: Math.max(1, h - 18),
    };
  };

  const drawFittedCanvas = (
    canvas: HTMLCanvasElement,
    target: { contentX: number; contentY: number; contentW: number; contentH: number },
  ): { x: number; y: number; w: number; h: number } | null => {
    const srcW = Math.max(1, canvas.width);
    const srcH = Math.max(1, canvas.height);
    const scale = Math.min(target.contentW / srcW, target.contentH / srcH);
    if (!(scale > 0)) return null;
    const drawW = Math.max(1, Math.floor(srcW * scale));
    const drawH = Math.max(1, Math.floor(srcH * scale));
    const drawX = target.contentX + Math.floor((target.contentW - drawW) * 0.5);
    const drawY = target.contentY + Math.floor((target.contentH - drawH) * 0.5);
    ctx.drawImage(canvas, drawX, drawY, drawW, drawH);
    return { x: drawX, y: drawY, w: drawW, h: drawH };
  };

  const drawEmptyFrameLabel = (
    frame: { contentX: number; contentY: number; contentW: number; contentH: number },
    label: string,
  ): void => {
    ctx.fillStyle = "rgba(245, 245, 245, 0.85)";
    ctx.font = "11px monospace";
    ctx.fillText(label, frame.contentX + 4, frame.contentY + 14);
  };

  const drawTopCollected = (
    frame: { contentX: number; contentY: number; contentW: number; contentH: number },
    topShadow: StructureV6FaceSliceDebugData | null,
  ): void => {
    if (!topShadow) {
      drawEmptyFrameLabel(frame, "No TOP triangles");
      return;
    }
    drawFittedCanvas(topShadow.faceCanvas, frame);
  };

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(12, 14, 18, 0.88)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "rgba(185, 210, 255, 0.48)";
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

  const titleX = panelX + 10;
  let textY = panelY + 16;
  ctx.font = "12px monospace";
  ctx.fillStyle = "rgba(240, 245, 255, 0.96)";
  ctx.fillText("V6.7 TOP Face Shadow Cast (No Top Slicing)", titleX, textY);
  textY += 14;
  const trimmedId = debugData.structureInstanceId.length > 52
    ? `${debugData.structureInstanceId.slice(0, 49)}...`
    : debugData.structureInstanceId;
  ctx.fillStyle = "rgba(210, 228, 255, 0.9)";
  ctx.fillText(
    `id:${trimmedId} sel:${debugData.selectedStructureIndex}/${Math.max(0, debugData.candidateCount - 1)} req:${debugData.requestedStructureIndex} reqBucket:${debugData.requestedSemanticBucket}`,
    titleX,
    textY,
  );
  textY += 14;
  const bucketATris = debugData.bucketAShadow?.sourceTriangleCount ?? 0;
  const bucketBTriCount = debugData.bucketBShadow?.sourceTriangleCount ?? 0;
  const topTriCount = debugData.topShadow?.sourceTriangleCount ?? 0;
  const bucketACastSlices = debugData.bucketAShadow?.nonEmptySliceCount ?? 0;
  const bucketBCastSlices = debugData.bucketBShadow?.nonEmptySliceCount ?? 0;
  const topCastSlices = debugData.topShadow?.nonEmptySliceCount ?? 0;
  ctx.fillStyle = "rgba(195, 214, 246, 0.88)";
  ctx.fillText(
    `EW tris:${bucketATris} cast:${bucketACastSlices}  SN tris:${bucketBTriCount} cast:${bucketBCastSlices}  TOP tris:${topTriCount} cast:${topCastSlices}`,
    titleX,
    textY,
  );
  textY += 14;
  ctx.fillStyle = "rgba(255, 221, 168, 0.86)";
  ctx.fillText(
    `shadowVector(${debugData.shadowVector.x.toFixed(1)},${debugData.shadowVector.y.toFixed(1)}) zBand:${debugData.zBand} worldOrigin(${debugData.mergedVerticalShadowDrawOrigin.x.toFixed(1)},${debugData.mergedVerticalShadowDrawOrigin.y.toFixed(1)})`,
    titleX,
    textY,
  );

  const bodyTop = textY + 10;
  const bodyBottom = panelY + panelH - 10;
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);
  const bodyWidth = panelW - 20;
  const columnGap = 8;
  const rowGap = 8;
  const topRowH = Math.max(110, Math.floor((bodyHeight - rowGap) * 0.5));
  const bottomRowH = Math.max(110, bodyHeight - topRowH - rowGap);
  const columnW = Math.max(120, Math.floor((bodyWidth - columnGap) * 0.5));
  const leftX = panelX + 10;
  const rightX = leftX + columnW + columnGap;
  const topY = bodyTop;
  const bottomY = topY + topRowH + rowGap;

  const topCollectedFrame = drawViewFrame(leftX, topY, columnW, topRowH, "TOP Collected");
  const topModeFrame = drawViewFrame(rightX, topY, columnW, topRowH, "TOP Mode");
  const topCastFrame = drawViewFrame(leftX, bottomY, columnW, bottomRowH, "TOP Cast Shadow");
  const mergedFrame = drawViewFrame(rightX, bottomY, columnW, bottomRowH, "Merged Shadow (Vertical + TOP)");

  drawTopCollected(topCollectedFrame, debugData.topShadow);
  drawEmptyFrameLabel(topModeFrame, "whole-face move (no slicing)");
  ctx.fillStyle = "rgba(245, 245, 245, 0.92)";
  ctx.font = "10px monospace";
  ctx.fillText(
    `offset = shadowVector`,
    topModeFrame.contentX + 4,
    topModeFrame.contentY + 30,
  );
  if (debugData.topShadow) {
    drawFittedCanvas(debugData.topShadow.mergedShadowCanvas, topCastFrame);
  } else {
    drawEmptyFrameLabel(topCastFrame, "No TOP cast");
  }
  drawFittedCanvas(debugData.mergedVerticalShadowCanvas, mergedFrame);
  ctx.fillStyle = "rgba(245, 245, 245, 0.94)";
  ctx.font = "10px monospace";
  ctx.fillText(
    `single-tint merged mask (non-additive overlap)`,
    mergedFrame.contentX + 4,
    mergedFrame.contentY + mergedFrame.contentH - 2,
  );
  ctx.restore();
}

function drawStructureHybridShadowProjectedTriangles(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureHybridShadowRenderPiece[],
  maxDarkness: number,
): void {
  if (pieces.length <= 0) return;
  const shadowAlpha = Math.max(0, Math.min(1, maxDarkness));
  if (shadowAlpha <= 0) return;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const projectedMappings = piece.projectedMappings;
    for (let ti = 0; ti < projectedMappings.length; ti++) {
      const mapping = projectedMappings[ti];
      const [s0, s1, s2] = mapping.srcTriangle;
      const [d0, d1, d2] = mapping.projectedTriangle;
      drawShadowTexturedTriangle(
        ctx,
        piece.sourceImage,
        piece.sourceImageWidth,
        piece.sourceImageHeight,
        s0,
        s1,
        s2,
        d0,
        d1,
        d2,
        shadowAlpha,
      );
    }
  }
}

function countStructureHybridProjectedTriangles(
  pieces: readonly StructureHybridShadowRenderPiece[],
): number {
  let count = 0;
  for (let i = 0; i < pieces.length; i++) count += pieces[i].projectedMappings.length;
  return count;
}

function drawStructureHybridProjectedTrianglesSolid(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureHybridShadowRenderPiece[],
  fillStyle: string,
): number {
  if (pieces.length <= 0) return 0;
  let triangleCount = 0;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  for (let i = 0; i < pieces.length; i++) {
    const mappings = pieces[i].projectedMappings;
    for (let ti = 0; ti < mappings.length; ti++) {
      const [a, b, c] = mappings[ti].projectedTriangle;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      triangleCount++;
    }
  }
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
  return triangleCount;
}

function drawStructureV4ShadowWarpedTriangles(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureV4ShadowRenderPiece[],
  maxDarkness: number,
): number {
  if (pieces.length <= 0) return 0;
  const shadowAlpha = Math.max(0, Math.min(1, maxDarkness));
  if (shadowAlpha <= 0) return 0;
  let triangleCount = 0;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const correspondences = piece.triangleCorrespondence;
    for (let ci = 0; ci < correspondences.length; ci++) {
      const correspondence = correspondences[ci];
      const srcTriangle = correspondence.sourceSrcPoints ?? correspondence.sourceTrianglePoints;
      const [s0, s1, s2] = srcTriangle;
      const [d0, d1, d2] = correspondence.destinationTrianglePoints;
      drawShadowTexturedTriangle(
        ctx,
        piece.sourceImage,
        piece.sourceImageWidth,
        piece.sourceImageHeight,
        s0,
        s1,
        s2,
        d0,
        d1,
        d2,
        shadowAlpha,
      );
      triangleCount++;
    }
  }
  return triangleCount;
}

function drawStructureV4ShadowTrianglesSolid(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureV4ShadowRenderPiece[],
  fillStyle: string,
): number {
  if (pieces.length <= 0) return 0;
  let triangleCount = 0;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  for (let i = 0; i < pieces.length; i++) {
    const correspondences = pieces[i].triangleCorrespondence;
    for (let ci = 0; ci < correspondences.length; ci++) {
      const [a, b, c] = correspondences[ci].destinationTrianglePoints;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      triangleCount++;
    }
  }
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
  return triangleCount;
}

function drawStructureShadowProjectedTriangles(
  ctx: CanvasRenderingContext2D,
  triangles: readonly StructureShadowProjectedTriangle[],
  maxDarkness: number,
): void {
  if (triangles.length <= 0) return;
  const alpha = Math.max(0, Math.min(1, maxDarkness));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    const [a, b, c] = tri;
    const signedArea2 =
      (b.x - a.x) * (c.y - a.y)
      - (b.y - a.y) * (c.x - a.x);
    if (signedArea2 >= 0) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
    } else {
      // Normalize winding so overlapping triangles do not cancel under non-zero fill.
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.closePath();
  }
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fill();
  ctx.restore();
}

function getDiamondFitCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const cached = runtimeDiamondCanvasCache.get(src);
  if (cached) return cached;
  const out = document.createElement("canvas");
  out.width = 128;
  out.height = 64;
  const c2d = out.getContext("2d");
  if (c2d) {
    configurePixelPerfect(c2d);
    c2d.imageSmoothingEnabled = false;
    c2d.drawImage(src, Math.round((128 - src.width) * 0.5), Math.round((64 - src.height) * 0.5));
  }
  runtimeDiamondCanvasCache.set(src, out);
  return out;
}

function getRuntimeIsoTopCanvas(
  srcImg: HTMLImageElement,
  rotationQuarterTurns: 0 | 1 | 2 | 3,
): HTMLCanvasElement | null {
  if (!srcImg || srcImg.width <= 0 || srcImg.height <= 0) return null;

  let byRot = runtimeIsoTopCache.get(srcImg);
  if (!byRot) {
    byRot = new Map();
    runtimeIsoTopCache.set(srcImg, byRot);
  }

  const cached = byRot.get(rotationQuarterTurns);
  if (cached) return cached;

  // 128x128 square -> 128x64 iso diamond
  const outW = 128;
  const outH = 64;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const c2d = canvas.getContext("2d");
  if (!c2d) return null;
  configurePixelPerfect(c2d);

  // Bake so that the diamond is centered at (outW/2, outH/2).
  // This matches the runtime path that translated to (centerX, centerY).
  c2d.save();
  c2d.translate(outW * 0.5, outH * 0.5);

  // Apply 2:1 iso projection from square space into diamond space.
  c2d.transform(0.5, 0.25, -0.5, 0.25, 0, 0);

  // Apply rotation in square space (as before).
  c2d.rotate(rotationQuarterTurns * (Math.PI * 0.5));

  // Draw source square centered.
  c2d.translate(-(128 * 0.5), -(128 * 0.5));
  c2d.drawImage(srcImg, 0, 0, 128, 128);
  c2d.restore();

  byRot.set(rotationQuarterTurns, canvas);
  return canvas;
}

function getRuntimeIsoDecalCanvas(
  srcImg: HTMLImageElement,
  rotationQuarterTurns: 0 | 1 | 2 | 3,
  scale: number,
): HTMLCanvasElement | null {
  if (!srcImg || srcImg.width <= 0 || srcImg.height <= 0) return null;
  if (!(scale > 0)) return null;

  let byKey = runtimeIsoDecalCache.get(srcImg);
  if (!byKey) {
    byKey = new Map();
    runtimeIsoDecalCache.set(srcImg, byKey);
  }

  const scaleQ = Math.round(scale * 1000) / 1000;
  const key = `${rotationQuarterTurns}|${scaleQ}`;
  const cached = byKey.get(key);
  if (cached) return cached;

  const srcW = srcImg.width * scaleQ;
  const srcH = srcImg.height * scaleQ;
  const rotOdd = (rotationQuarterTurns & 1) === 1;
  const rotW = rotOdd ? srcH : srcW;
  const rotH = rotOdd ? srcW : srcH;
  const span = rotW + rotH;
  const outW = Math.max(1, Math.ceil(span * 0.5));
  const outH = Math.max(1, Math.ceil(span * 0.25));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const c2d = canvas.getContext("2d");
  if (!c2d) return null;
  configurePixelPerfect(c2d);

  c2d.save();
  c2d.translate(outW * 0.5, outH * 0.5);
  c2d.transform(0.5, 0.25, -0.5, 0.25, 0, 0);
  c2d.rotate(rotationQuarterTurns * (Math.PI * 0.5));
  c2d.translate(-(srcW * 0.5), -(srcH * 0.5));
  c2d.drawImage(srcImg, 0, 0, srcW, srcH);
  c2d.restore();

  byKey.set(key, canvas);
  return canvas;
}

let hardcodedVoidTopImage: HTMLImageElement | null = null;
let hardcodedVoidTopReady = false;
let hardcodedVoidTopFailed = false;

function getHardcodedVoidTop(): { ready: boolean; img: HTMLImageElement | null } {
  if (hardcodedVoidTopReady && hardcodedVoidTopImage) {
    return { ready: true, img: hardcodedVoidTopImage };
  }
  if (hardcodedVoidTopFailed) {
    return { ready: false, img: null };
  }
    if (!hardcodedVoidTopImage) {
    const img = new Image();
    img.src = HARDCODED_VOID_TOP_SRC;
    img.onload = () => { hardcodedVoidTopReady = true; };
    img.onerror = () => { hardcodedVoidTopFailed = true; };
    hardcodedVoidTopImage = img;
  }
  return { ready: false, img: hardcodedVoidTopImage };
}

function drawVoidBackgroundOnce(
  ctx: CanvasRenderingContext2D,
  devW: number,
  devH: number,
  viewport: ViewportTransform,
): void {
  // Always reset to screen space for background
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  if (VOID_BG_MODE === "SOLID") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, devW, devH);
    ctx.restore();
    return;
  }

  // PATTERN mode: use the void tile image as a repeating pattern
  const rec = getHardcodedVoidTop();
  const img = rec.ready ? rec.img : null;
  if (!img || img.width <= 0 || img.height <= 0) {
    // Fallback while loading
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, devW, devH);
    ctx.restore();
    return;
  }

  // Rebuild pattern only if image changes (or first time)
  if (!voidBgPattern || voidBgPatternImgRef !== img) {
    voidBgPatternImgRef = img;
    voidBgPattern = ctx.createPattern(img, "repeat");
  }

  if (voidBgPattern) {
    // World-locked: pattern origin follows the active viewport world transform.
    const patternOffset = viewport.getPatternOffsetDevice();
    const ox = patternOffset.x;
    const oy = patternOffset.y;

    // Force context-translate path; CanvasPattern.setTransform can trigger
    // slow paths on some browser/GPU combinations.
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = voidBgPattern;
    ctx.fillRect(-ox, -oy, devW, devH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, devW, devH);
  }

  ctx.restore();
}

function getFlippedOverlayImage(img: HTMLImageElement): HTMLCanvasElement {
  const cached = flippedOverlayImageCache.get(img);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const c2d = canvas.getContext("2d");
  if (!c2d) return canvas;
  configurePixelPerfect(c2d);
  c2d.translate(canvas.width, 0);
  c2d.scale(-1, 1);
  c2d.drawImage(img, 0, 0);
  flippedOverlayImageCache.set(img, canvas);
  return canvas;
}

function isTileInPlayerSouthWedge(
  tx: number,
  ty: number,
  playerTx: number,
  playerTy: number
): boolean {
  const dx = tx - playerTx;
  const dy = ty - playerTy;

  if (dx === 0 && dy === 0) return false;

  const sum = dx + dy;
  if (sum <= 0) return false;

  const diff = Math.abs(dx - dy);

  return diff <= sum;
}

/** Render tiles, entities, overlays, and debug layers. */
export async function renderSystem(
  w: World,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  uiCtx?: CanvasRenderingContext2D,
  uiCanvas?: HTMLCanvasElement,
) {
  const canvasRect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, canvasRect.width);
  const cssH = Math.max(1, canvasRect.height);
  const screenW = cssW;
  const screenH = cssH;
  const devW = Math.max(1, canvas.width);
  const devH = Math.max(1, canvas.height);
  const storedDpr = Number(canvas.dataset.effectiveDpr ?? "");
  const dpr = Number.isFinite(storedDpr) && storedDpr >= 1
    ? storedDpr
    : Math.max(1, window.devicePixelRatio || 1);
  const settings = getUserSettings();
  const renderSettings = settings.render;
  const snapshotViewerCamera = ((w as any).paletteSnapshotViewerCamera ?? null) as
    | { x?: unknown; y?: unknown; zoom?: unknown }
    | null;
  const snapshotZoom = Number(snapshotViewerCamera?.zoom);
  let visibleVerticalTiles = resolveVerticalTiles(renderSettings, cssW, cssH).effective;
  if (Number.isFinite(snapshotZoom) && snapshotZoom > 0) {
    const derivedVisibleTiles = cssH / (snapshotZoom * KENNEY_TILE_WORLD);
    if (Number.isFinite(derivedVisibleTiles) && derivedVisibleTiles > 0) {
      visibleVerticalTiles = derivedVisibleTiles;
    }
  }
  const hasUiOverlay = !!uiCtx && !!uiCanvas;
  const overlayCtx = uiCtx ?? ctx;
  const overlayCanvas = uiCanvas ?? canvas;
  const overlayDevW = Math.max(1, overlayCanvas.width);
  const overlayDevH = Math.max(1, overlayCanvas.height);
  const overlayStoredDpr = Number(overlayCanvas.dataset.effectiveDpr ?? "");
  const overlayDpr = Number.isFinite(overlayStoredDpr) && overlayStoredDpr >= 1
    ? overlayStoredDpr
    : dpr;
  const viewport = new ViewportTransform({
    cssWidth: cssW,
    cssHeight: cssH,
    dpr,
    visibleVerticalTiles,
    tileWorldUnits: KENNEY_TILE_WORLD,
    uiTopPx: 0,
    uiBottomPx: 0,
  });
  viewport.setWorldProjector(worldToScreen);
  const zoom = viewport.zoom;
  const ww = viewport.visibleWorldWidth;
  const hh = viewport.visibleWorldHeight;
  const scaledW = viewport.worldRect.width;
  const scaledH = viewport.worldRect.height;
  const safeOffsetX = viewport.safeOffsetCssX;
  const safeOffsetY = viewport.safeOffsetCssY;
  configurePixelPerfect(ctx);
  const renderPerfCountersEnabled = renderSettings.renderPerfCountersEnabled;
  setRenderPerfCountersEnabled(renderPerfCountersEnabled);
  beginRenderPerfFrame(devW, devH);
  (w as any).viewW = ww;
  (w as any).viewH = hh;
  (w as any).cameraSafeRect = {
    x: safeOffsetX,
    y: safeOffsetY,
    width: scaledW,
    height: scaledH,
    zoom,
    logicalWidth: ww,
    logicalHeight: hh,
  };

  const PLAYER_R = w.playerR;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, devW, devH);
  overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
  overlayCtx.clearRect(0, 0, overlayDevW, overlayDevH);

  const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const px = pWorld.wx;
  const py = pWorld.wy;

  // one-time enemy sprite preload
  if (!(w as any)._enemySpritesPreloaded) {
    (w as any)._enemySpritesPreloaded = true;
    preloadEnemySprites();
  }

  if (!(w as any)._vendorSpritesPreloaded) {
    (w as any)._vendorSpritesPreloaded = true;
    preloadVendorNpcSprites();
  }

  if (!(w as any)._neutralMobSpritesPreloaded) {
    (w as any)._neutralMobSpritesPreloaded = true;
    preloadNeutralMobSprites();
  }

  // one-time projectile sprite preload
  if (!(w as any)._projectileSpritesPreloaded) {
    (w as any)._projectileSpritesPreloaded = true;
    preloadProjectileSprites();
  }

  // one-time render sprite preload
  if (!(w as any)._renderSpritesPreloaded) {
    (w as any)._renderSpritesPreloaded = true;
    preloadRenderSprites();
  }

  // Isometric camera: project world coords into screen space, then keep player centered
  const p0 = worldToScreen(px, py);
  const cameraState = (w as any).camera as
    | {
      posX: number;
      posY: number;
      targetX: number;
      targetY: number;
      followHalfLifeSec: number;
    }
    | undefined;
  const cameraSmoothingEnabled = renderSettings.cameraSmoothingEnabled !== false;
  const dtReal = Number.isFinite(w.timeState?.dtReal) ? w.timeState.dtReal : 1 / 60;
  let cameraProjectedX = p0.x;
  let cameraProjectedY = p0.y;
  const hasSnapshotCameraOverride =
    Number.isFinite(Number(snapshotViewerCamera?.x))
    && Number.isFinite(Number(snapshotViewerCamera?.y));
  if (hasSnapshotCameraOverride) {
    cameraProjectedX = Number(snapshotViewerCamera?.x);
    cameraProjectedY = Number(snapshotViewerCamera?.y);
    if (cameraState) {
      cameraState.targetX = cameraProjectedX;
      cameraState.targetY = cameraProjectedY;
      cameraState.posX = cameraProjectedX;
      cameraState.posY = cameraProjectedY;
    }
  } else if (cameraState) {
    const wasUninitialized = cameraState.targetX === 0
      && cameraState.targetY === 0
      && cameraState.posX === 0
      && cameraState.posY === 0;
    cameraState.targetX = p0.x;
    cameraState.targetY = p0.y;
    const hasValidPos = Number.isFinite(cameraState.posX) && Number.isFinite(cameraState.posY);
    const dx = (cameraState.posX ?? p0.x) - p0.x;
    const dy = (cameraState.posY ?? p0.y) - p0.y;
    const shouldSnap = !cameraSmoothingEnabled
      || !hasValidPos
      || wasUninitialized
      || (dx * dx + dy * dy > CAMERA_FOLLOW_SNAP_DISTANCE_SQ);
    if (shouldSnap) {
      cameraState.posX = p0.x;
      cameraState.posY = p0.y;
    } else {
      const halfLifeSec = Number.isFinite(cameraState.followHalfLifeSec) && cameraState.followHalfLifeSec > 0
        ? cameraState.followHalfLifeSec
        : CAMERA_FOLLOW_HALF_LIFE_DEFAULT_SEC;
      const tunedHalfLifeSec = Math.max(0.001, halfLifeSec * CAMERA_SMOOTHING_INTENSITY_SCALE);
      cameraState.posX = smoothTowardByHalfLife(cameraState.posX, p0.x, tunedHalfLifeSec, dtReal);
      cameraState.posY = smoothTowardByHalfLife(cameraState.posY, p0.y, tunedHalfLifeSec, dtReal);
    }
    cameraProjectedX = cameraState.posX;
    cameraProjectedY = cameraState.posY;
  }
  (w as any).cameraX = cameraProjectedX;
  (w as any).cameraY = cameraProjectedY;
  viewport.centerOnProjected(cameraProjectedX, cameraProjectedY);
  const camTx = viewport.camTx;
  const camTy = viewport.camTy;
  const s = viewport.worldScaleDevice;
  // NEW: draw background once, world-locked to the camera
  drawVoidBackgroundOnce(ctx, devW, devH, viewport);
  const camX = 0;
  const camY = 0;
  const worldToScreenPx = (xWorld: number, yWorld: number) => viewport.projectProjectedToDevice(xWorld, yWorld);
  const drawAlignmentDot = (target: CanvasRenderingContext2D, color: string) => {
    target.save();
    target.fillStyle = color;
    target.fillRect(Math.round(p0.x) - 1, Math.round(p0.y) - 1, 3, 3);
    target.restore();
  };

  ctx.save();
  viewport.applyWorld(ctx);
  drawAlignmentDot(ctx, "rgba(255,0,255,0.9)"); // world


  // World-units per tile step (keep in sync with kenneyTiles constants)
  const T = KENNEY_TILE_WORLD;
  const playerTx = Math.floor(px / T);
  const playerTy = Math.floor(py / T);
  const worldToTile = (x: number, y: number) => ({ tx: Math.floor(x / T), ty: Math.floor(y / T) });

  // Anchor: tile sprites are usually taller than their footprint.
  const ANCHOR_Y = KENNEY_TILE_ANCHOR_Y;

  // Visual height step in screen pixels per tile-level (tune later).
  const ELEV_PX = 16;

  // Per-type sprite scale (1 = default size).
  const FLOOR_TOP_SCALE = 1;
  const FLOOR_APRON_SCALE = 1;
  const STAIR_TOP_SCALE = 1;
  const STAIR_APRON_SCALE = 1;
  const WALL_APRON_SCALE = 1;
  const VOID_TOP_SCALE = 1;
  const OCEAN_TOP_SCALE = 4;
  const OCEAN_ANIM_TIME_SCALE = 0.25;
  const OCEAN_BASE_FRAME_PX = 32;

  // Small render-order bias so container walls can occlude stacked container roofs.
  const CONTAINER_WALL_SORT_BIAS = 0.001;

  // Optional render-layer offset for stairs.
  // --- Render HEIGHT knobs (screen-space Y offsets, in pixels) ---
  // Positive moves DOWN on screen; negative moves UP.
  // These do NOT affect layer/sort; they only shift draw Y.
  const STAIR_TOP_DY = (w as any).stairTopDy ?? 8;
  const SHOW_SIDEWALK_VARIANT_DEBUG = (w as any).sidewalkVariantDebug ?? false;
  const SIDEWALK_SRC_SIZE = 128;
  const SIDEWALK_ISO_HEIGHT = 64;

  const tileHAtWorld = (x: number, y: number) => heightAtWorld(x, y, KENNEY_TILE_WORLD);

  const snapToNearestWalkableGround = (x: number, y: number) => {
    // If we're already on walkable top-face, keep it.
    const i0 = walkInfo(x, y, T);
    if (i0.walkable) return { x, y, z: i0.z };

    // Probe pattern (world units). Keep this small for perf.
    const RINGS = [6, 10, 16, 24, 34];
    const DIRS: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];

    for (let r = 0; r < RINGS.length; r++) {
      const rr = RINGS[r];
      for (let d = 0; d < DIRS.length; d++) {
        const ox = DIRS[d][0] * rr;
        const oy = DIRS[d][1] * rr;

        const ix = x + ox;
        const iy = y + oy;

        const info = walkInfo(ix, iy, T);
        if (info.walkable) return { x: ix, y: iy, z: info.z };
      }
    }

    return { x, y, z: tileHAtWorld(x, y) };
  };

  // Render all heights by default.
  const RENDER_ALL_HEIGHTS: boolean = (w as any).renderAllHeights ?? true;
  const LOG_STRUCTURE_ANCHOR_DEBUG = (w as any).structureAnchorDebug ?? false;
  const LOG_STRUCTURE_OWNERSHIP_DEBUG = (w as any).structureOwnershipDebug ?? false;
  const loggedStructureAnchorDebugIds = new Set<string>();
  const loggedStructureOwnershipDebugIds = new Set<string>();

  const floorFromZ = (z: number) => Math.ceil(z - 1e-6);

  const toScreen = (x: number, y: number) => {
    const p = worldToScreen(x, y);
    const h = tileHAtWorld(x, y);
    const elev = h * ELEV_PX;
    return { x: p.x + camX, y: p.y + camY - elev };
  };

  const toScreenAtZ = (x: number, y: number, zVisual: number) => {
    const p = worldToScreen(x, y);
    const elev = zVisual * ELEV_PX;
    return { x: p.x + camX, y: p.y + camY - elev };
  };

  const tileToScreen = (tx: number, ty: number, zVisual: number) => {
    const wx = (tx + 0.5) * T;
    const wy = (ty + 0.5) * T;
    const p = worldToScreen(wx, wy);
    return { x: p.x + camX - T * 0.5, y: p.y + camY - zVisual * ELEV_PX - T * 0.5 };
  };

  const ENTITY_ANCHOR_X01_DEFAULT = 0.5;
  const ENTITY_ANCHOR_Y01_DEFAULT = 0.92;

  const resolveAnchor01 = (
    overrideValue: number | undefined,
    baseValue: number | undefined,
    defaultValue: number,
  ): number => {
    const raw = Number.isFinite(overrideValue)
      ? (overrideValue as number)
      : Number.isFinite(baseValue)
        ? (baseValue as number)
        : defaultValue;
    return Math.max(0, Math.min(1, raw));
  };

  const getEntityFeetPos = (wx: number, wy: number, zVisual: number) => {
    const tx = Math.floor(wx / T);
    const ty = Math.floor(wy / T);
    const screen = toScreenAtZ(wx, wy, zVisual);
    return {
      tx,
      ty,
      slice: tx + ty,
      within: tx,
      screenX: screen.x,
      screenY: screen.y,
    };
  };

  const drawEntityAnchorOverlay = (
    feetX: number,
    feetY: number,
    drawX: number,
    drawY: number,
    drawW: number,
    drawH: number,
  ) => {
    if (!SHOW_ENTITY_ANCHOR_OVERLAY) return;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 80, 80, 0.95)";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(drawX), Math.round(drawY), Math.round(drawW), Math.round(drawH));
    ctx.strokeStyle = "rgba(80, 255, 220, 0.95)";
    ctx.beginPath();
    ctx.moveTo(Math.round(feetX - 4), Math.round(feetY));
    ctx.lineTo(Math.round(feetX + 4), Math.round(feetY));
    ctx.moveTo(Math.round(feetX), Math.round(feetY - 4));
    ctx.lineTo(Math.round(feetX), Math.round(feetY + 4));
    ctx.stroke();
    ctx.restore();
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const DYNAMIC_RELIGHT_MIN_ALPHA = 0.04;
  let staticRelightFrame: StaticRelightFrameContext | null = null;
  type DynamicSpriteRelightFrameContext = {
    targetDarknessBucket: 0 | 25 | 50 | 75;
    strengthScale: number;
    minAlpha: number;
    lights: DynamicRelightLightCandidate[];
  };
  let dynamicSpriteRelightFrame: DynamicSpriteRelightFrameContext | null = null;
  const resolveDynamicSpriteRelightAlpha = (
    screenX: number,
    screenY: number,
  ): number => {
    if (!dynamicSpriteRelightFrame) return 0;
    const nearest = computeNearestDynamicRelightAlpha({
      screenX,
      screenY,
      lights: dynamicSpriteRelightFrame.lights,
      strengthScale: dynamicSpriteRelightFrame.strengthScale,
      minAlpha: dynamicSpriteRelightFrame.minAlpha,
    });
    if (!nearest) return 0;
    return nearest.alpha;
  };
  const planStaticRelightForPiece = (
    pieceTileX: number,
    pieceTileY: number,
    pieceX: number,
    pieceY: number,
    pieceW: number,
    pieceH: number,
  ): PieceLocalRelightPlan | null => {
    if (!staticRelightFrame) return null;
    return planStaticRelightBlendForPiece(
      staticRelightFrame,
      pieceTileX,
      pieceTileY,
      pieceX,
      pieceY,
      pieceW,
      pieceH,
    );
  };

  // Existing optional cull (kept, but unrelated to masking)
  const ENABLE_BUILDING_SOUTH_CULL = false;
  const shouldCullBuildingAt = (tx: number, ty: number, w: number = 1, h: number = 1) => {
    if (!ENABLE_BUILDING_SOUTH_CULL) return false;
    const nx = clamp(playerTx, tx, tx + w - 1);
    const ny = clamp(playerTy, ty, ty + h - 1);
    const dx = Math.abs(playerTx - nx);
    const dy = Math.abs(playerTy - ny);
    const within3 = Math.max(dx, dy) <= 6;
    const south = ny > playerTy;
    return within3 && south;
  };

  // Frame-local cache: render paths query the same surface tile coordinates many times.
  const surfacesCache = new Map<number, Map<number, ReturnType<typeof surfacesAtXY>>>();
  const surfacesAtXYCached = (tx: number, ty: number) => {
    let byTy = surfacesCache.get(tx);
    if (!byTy) {
      byTy = new Map<number, ReturnType<typeof surfacesAtXY>>();
      surfacesCache.set(tx, byTy);
    }
    const cached = byTy.get(ty);
    if (cached) return cached;
    const resolved = surfacesAtXY(tx, ty);
    byTy.set(ty, resolved);
    return resolved;
  };

  const maxNonStairSurfaceZ = (tx: number, ty: number): number | null => {
    const surfaces = surfacesAtXYCached(tx, ty);
    if (surfaces.length === 0) return null;
    let best: number | null = null;
    for (let i = 0; i < surfaces.length; i++) {
      const s = surfaces[i];
      if (s.tile.kind === "STAIRS") continue;
      const z = s.zBase;
      if (best === null || z > best) best = z;
    }
    return best;
  };

  type RenderPieceDraw = {
    img: HTMLImageElement;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    zVisual?: number;

    flipX?: boolean;
    scale?: number;
  };

  type MaskDraw = (maskCtx: CanvasRenderingContext2D) => void;
  const entitySilhouetteMaskDraws: MaskDraw[] = [];

    // Preserve caller transform (world camera / mask camera) per piece.
    const drawRenderPieceTo = (target: CanvasRenderingContext2D, c: RenderPieceDraw) => {
      const img = c.img;
      if (!img || img.width <= 0 || img.height <= 0) return;
      const scale = c.scale ?? 1;

      target.save();
      target.translate(snapPx(c.dx), snapPx(c.dy));
      target.scale(scale, scale);
      if (c.flipX) {
        target.translate(c.dw, 0);
        target.scale(-1, 1);
      }
      target.drawImage(img, 0, 0, c.dw, c.dh);
      target.restore();
    };
    // Default draw to main ctx (unchanged behavior for most pieces)
    const drawRenderPiece = (c: RenderPieceDraw) => drawRenderPieceTo(ctx, c);

    const srcUvNW: ScreenPt = { x: 64, y: 0 };
    const srcUvNE: ScreenPt = { x: 128, y: 32 };
    const srcUvSE: ScreenPt = { x: 64, y: 64 };
    const srcUvSW: ScreenPt = { x: 0, y: 32 };
    const getRampQuadPoints = (tx: number, ty: number, renderAnchorY: number) => {
      const anchorYOffset = SIDEWALK_ISO_HEIGHT * (renderAnchorY - 0.5);
      const sample = (wx: number, wy: number): ScreenPt => {
        const p = worldToScreen(wx, wy);
        const hz = tileHAtWorld(wx, wy);
        return {
          x: snapPx(p.x + camX),
          y: snapPx(p.y + camY - hz * ELEV_PX - anchorYOffset),
        };
      };
      const x0 = tx * T;
      const y0 = ty * T;
      return {
        nw: sample(x0, y0),
        ne: sample(x0 + T, y0),
        se: sample(x0 + T, y0 + T),
        sw: sample(x0, y0 + T),
      };
    };
    const drawDiamondOnRampQuad = (
      srcDiamond: HTMLCanvasElement,
      tx: number,
      ty: number,
      renderAnchorY: number,
    ) => {
      const q = getRampQuadPoints(tx, ty, renderAnchorY);
      drawTexturedTriangle(ctx, srcDiamond, 128, 64, srcUvNW, srcUvNE, srcUvSE, q.nw, q.ne, q.se);
      drawTexturedTriangle(ctx, srcDiamond, 128, 64, srcUvNW, srcUvSE, srcUvSW, q.nw, q.se, q.sw);
    };

    const drawRuntimeSidewalkTop = (
      tx: number,
      ty: number,
      zBase: number,
      renderAnchorY: number,
      family: "sidewalk" | "asphalt" | "park",
      variantIndex: number,
      rotationQuarterTurns: 0 | 1 | 2 | 3,
    ) => {
      const src = getTileSpriteById(`tiles/floor/${family}/${variantIndex}`);
      if (!src.ready || !src.img || src.img.width <= 0 || src.img.height <= 0) return;

      const baseBaked = getRuntimeIsoTopCanvas(src.img, rotationQuarterTurns);
      if (!baseBaked) return;
      const isRampRoadTile = family === "asphalt" && rampRoadTiles.has(`${tx},${ty}`);
      if (isRampRoadTile) {
        drawDiamondOnRampQuad(baseBaked, tx, ty, renderAnchorY);
      } else {
        const wx = (tx + 0.5) * T;
        const wy = (ty + 0.5) * T;
        const p = worldToScreen(wx, wy);

        // This matches the old "centerX/centerY" placement, but now we draw the prebaked 128x64.
        const centerX = snapPx(p.x + camX);
        const centerY = snapPx(
          p.y + camY - zBase * ELEV_PX - SIDEWALK_ISO_HEIGHT * (renderAnchorY - 0.5),
        );

        const dx = centerX - SIDEWALK_SRC_SIZE * 0.5;
        const dy = centerY - SIDEWALK_ISO_HEIGHT * 0.5;
        const drawX = snapPx(dx);
        const drawY = snapPx(dy);
        let relitCanvas: HTMLCanvasElement | null = null;
        if (staticRelightFrame) {
          const pieceKey = floorRelightPieceKey(
            tx,
            ty,
            zBase,
            renderAnchorY,
            family,
            variantIndex,
            rotationQuarterTurns,
          );
          const bakedEntry = staticRelightBakeStore.get(pieceKey);
          if (bakedEntry?.kind === "RELIT") relitCanvas = bakedEntry.baked;
        }
        if (relitCanvas) {
          ctx.drawImage(relitCanvas, drawX, drawY, baseBaked.width, baseBaked.height);
        } else {
          ctx.drawImage(baseBaked, drawX, drawY);
        }
      }

      const wx = (tx + 0.5) * T;
      const wy = (ty + 0.5) * T;
      const p = worldToScreen(wx, wy);
      const centerX = snapPx(p.x + camX);
      const centerY = snapPx(
        p.y + camY - zBase * ELEV_PX - SIDEWALK_ISO_HEIGHT * (renderAnchorY - 0.5),
      );

      if (SHOW_SIDEWALK_VARIANT_DEBUG) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#00ffd5";
        ctx.font = "9px monospace";
        ctx.fillText(`${variantIndex} r${rotationQuarterTurns}`, centerX + 4, centerY - 4);
        ctx.restore();
      }
    };

    const drawRuntimeDecalTop = (
      tx: number,
      ty: number,
      zBase: number,
      renderAnchorY: number,
      setId: RuntimeDecalSetId,
      variantIndex: number,
      rotationQuarterTurns: 0 | 1 | 2 | 3,
    ) => {
      const src = getRuntimeDecalSprite(setId, variantIndex);
      if (!src.ready || !src.img || src.img.width <= 0 || src.img.height <= 0) return;
      const decalScale = roadMarkingDecalScale(setId, variantIndex);
      const baked = getRuntimeIsoDecalCanvas(src.img, rotationQuarterTurns, decalScale);
      if (!baked) return;

      const wx = tx * T;
      const wy = ty * T;
      const p = worldToScreen(wx, wy);
      const rawCenterX = p.x + camX;
      const rawCenterY = p.y + camY - zBase * ELEV_PX - SIDEWALK_ISO_HEIGHT * (renderAnchorY - 0.5);
      const shouldSnapRoadMarking = shouldPixelSnapRoadMarking(setId, variantIndex);
      const centerX = shouldSnapRoadMarking ? Math.round(rawCenterX) : snapPx(rawCenterX);
      const centerY = shouldSnapRoadMarking ? Math.round(rawCenterY) : snapPx(rawCenterY);

      if (rampRoadTiles.has(`${tx},${ty}`)) {
        const diamond = getDiamondFitCanvas(baked);
        drawDiamondOnRampQuad(diamond, tx, ty, renderAnchorY);
      } else {
        const dx = centerX - baked.width * 0.5;
        const dy = centerY - baked.height * 0.5;
        const drawX = shouldSnapRoadMarking ? Math.round(dx) : snapPx(dx);
        const drawY = shouldSnapRoadMarking ? Math.round(dy) : snapPx(dy);
        let relitCanvas: HTMLCanvasElement | null = null;
        if (staticRelightFrame) {
          const pieceKey = decalRelightPieceKey(
            Math.floor(tx),
            Math.floor(ty),
            zBase,
            renderAnchorY,
            setId,
            variantIndex,
            rotationQuarterTurns,
            decalScale,
          );
          const bakedEntry = staticRelightBakeStore.get(pieceKey);
          if (bakedEntry?.kind === "RELIT") relitCanvas = bakedEntry.baked;
        }
        if (relitCanvas) {
          ctx.drawImage(relitCanvas, drawX, drawY, baked.width, baked.height);
        } else {
          ctx.drawImage(baked, drawX, drawY);
        }
      }
    };

    const drawProjectedVoidTop = (
      img: HTMLImageElement,
      tx: number,
      ty: number,
      renderAnchorY: number,
    ) => {
      const wx = (tx + 0.5) * T;
      const wy = (ty + 0.5) * T;
      const p = worldToScreen(wx, wy);
      const centerX = snapPx(p.x + camX);
      const centerY = snapPx(
        p.y + camY + 2 * ELEV_PX - SIDEWALK_ISO_HEIGHT * (renderAnchorY - 0.5),
      );

      const srcW = img.width * VOID_TOP_SCALE;
      const srcH = img.height * VOID_TOP_SCALE;
      // Slightly overdraw each projected tile to hide subpixel seam cracks between neighbors.
      const bleed = 1;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.transform(0.5, 0.25, -0.5, 0.25, 0, 0);
      ctx.translate(-(srcW * 0.5) - bleed, -(srcH * 0.5) - bleed);
      ctx.drawImage(img, 0, 0, srcW + bleed * 2, srcH + bleed * 2);
      ctx.restore();
    };

    const dirToDelta = (dir: "N" | "E" | "S" | "W") => {
      switch (dir) {
        case "N": return { dx: 0, dy: -1 };
        case "E": return { dx: 1, dy: 0 };
        case "S": return { dx: 0, dy: 1 };
        case "W": return { dx: -1, dy: 0 };
      }
    };

  const buildMultiZFaceDraw = (
    c: RenderPiece,
    apronRec: { img: HTMLImageElement; ready: boolean },
    flipX: boolean,
  ): RenderPieceDraw[] => {
    if (!apronRec?.ready || !apronRec.img) return [];

    const scale = c.scale ?? 1;
    const anchorY = c.renderAnchorY ?? ANCHOR_Y;
    // Use native image dimensions (same pattern as buildOverlayDraw)
    const ow = apronRec.img.width;
    const oh = apronRec.img.height;

    // Position at the tile edge
    const wx = (c.tx + 0.5) * T;
    const wy = (c.ty + 0.5) * T;
    const edgeDir = c.edgeDir ?? c.renderDir ?? "N";
    const delta = dirToDelta(edgeDir);
    const apronWx = wx + delta.dx * T * 0.5;
    const apronWy = wy + delta.dy * T * 0.5;

    const p = worldToScreen(apronWx, apronWy);
    // Anchor at the top of the Z range; image hangs downward
    const zVisual = Math.floor(c.zTo) - 1;
    const dx = p.x + camX - ow * scale * 0.5;
    const dy = p.y + camY - oh * scale * anchorY - zVisual * ELEV_PX;

    return [{
      img: apronRec.img,
      dx,
      dy,
      dw: ow,
      dh: oh,
      zVisual,
      flipX,
      scale,
    }];
  };

  const buildFaceDraws = (c: RenderPiece): RenderPieceDraw[] => {
    const dir4 = c.renderDir ?? "N";
    const apronRec = c.spriteId ? getTileSpriteById(c.spriteId) : null;
    const apronFlipX = !!c.flipX;
    if (!apronRec?.ready || !apronRec.img || apronRec.img.width <= 0 || apronRec.img.height <= 0) return [];

      // Multi-Z sprite: draw one image covering the full Z range
      if (c.zSpan && c.zSpan > 1) {
        return buildMultiZFaceDraw(c, apronRec, apronFlipX);
      }

      const anchorY = c.renderAnchorY ?? ANCHOR_Y;
      const apronScale = c.kind === "FLOOR_APRON" ? FLOOR_APRON_SCALE : STAIR_APRON_SCALE;
      const aw = apronRec.img.width * apronScale;
      const ah = apronRec.img.height * apronScale;
      const scale = c.scale ?? 1;

      const wx = (c.tx + 0.5) * T;
      const wy = (c.ty + 0.5) * T;
      const edgeDirForApron = c.edgeDir ?? dir4;
      const apronDelta = dirToDelta(edgeDirForApron);
      const apronWx = wx + apronDelta.dx * T * 0.5;
      const apronWy = wy + apronDelta.dy * T * 0.5;

      const p = worldToScreen(apronWx, apronWy);
      const ax = p.x + camX - aw * scale * 0.5;
      const ayBase = p.y + camY - ah * scale * anchorY;

// Allow negative apron spans (e.g. -1 -> 0) so height-0 platforms still show aprons.
    const zTop = Math.floor(c.zTo);
    const zBottom = Math.floor(c.zFrom ?? c.zTo);
    const zStart = Math.min(zTop, zBottom);
    const zEnd = Math.max(zTop, zBottom);

    const draws: RenderPieceDraw[] = [];

    const edgeDir = c.edgeDir;
    const neighborBlocksAtZ = (z: number) => {
      if (!edgeDir) return false;
      let dx = 0;
      let dy = 0;
      if (edgeDir === "N") dy = -1;
      else if (edgeDir === "S") dy = 1;
      else if (edgeDir === "E") dx = 1;
      else if (edgeDir === "W") dx = -1;
      const nTx = c.tx + dx;
      const nTy = c.ty + dy;
      const surfaces = surfacesAtXYCached(nTx, nTy);
      if (surfaces.length === 0) return false;
      let maxZ = surfaces[0].zBase;
      for (let i = 1; i < surfaces.length; i++) {
        const zBase = surfaces[i].zBase;
        if (zBase > maxZ) maxZ = zBase;
      }
      return maxZ >= z;
    };

      for (let z = zEnd; z >= zStart; z -= 2) {
        if (neighborBlocksAtZ(z)) continue;
        const zVisual = z - 1;
        draws.push({
          img: apronRec.img,
          dx: ax,
          dy: ayBase - zVisual * ELEV_PX,
          dw: aw,
          dh: ah,
          zVisual,
          flipX: apronFlipX,
          scale,
        });
      }

    return draws;
  };
  const buildWallDraw = (c: RenderPiece, stableId: number): RenderPieceDraw | null => {
    if (c.kind !== "WALL") return null;
    const wallDir = c.wallDir ?? "N";
    const apronRec = c.spriteId ? getTileSpriteById(c.spriteId) : null;
    const apronFlipX = !!c.flipX;
      if (!apronRec?.ready || !apronRec.img || apronRec.img.width <= 0 || apronRec.img.height <= 0) return null;

      let wx = (c.tx + 0.5) * T;
      let wy = (c.ty + 0.5) * T;
      const wallDelta = dirToDelta(wallDir);
      wx += wallDelta.dx * T * 0.5;
      wy += wallDelta.dy * T * 0.5;

      const p = worldToScreen(wx, wy);
      const anchorY = c.renderAnchorY ?? ANCHOR_Y;

    // Walls should render at the midpoint of their vertical span (centered on half-height).
    const h = ((c.zFrom ?? c.zTo) + c.zTo) * 0.5;
    const dyOffset = c.renderDyOffset ?? 0;
    const scale = c.scale ?? 1;

    // Multi-Z wall sprites use native image dimensions
    const useNative = !!(c.zSpan && c.zSpan > 1);
    const aw = useNative ? apronRec.img.width : apronRec.img.width * WALL_APRON_SCALE;
    const ah = useNative ? apronRec.img.height : apronRec.img.height * WALL_APRON_SCALE;
    const ax = p.x + camX - aw * scale * 0.5;
    const ay = p.y + camY - ah * scale * anchorY - h * ELEV_PX - dyOffset;


    return {
      img: apronRec.img,
      dx: ax,
      dy: ay,
      dw: aw,
      dh: ah,
      flipX: apronFlipX,
      scale,
    };
  };

  const buildOverlayDraw = (o: StampOverlay): RenderPieceDraw | null => {
    const rec = o.spriteId ? getTileSpriteById(o.spriteId) : null;
    if (!rec?.ready || !rec.img || rec.img.width <= 0 || rec.img.height <= 0) return null;
    const ow = rec.img.width;
    const oh = rec.img.height;
    const scale = o.scale ?? 1;
    const southY = o.ty + o.h - 1;
    const anchorTx =
        o.anchorTx ??
        (o.w >= o.h ? (o.tx + o.w - 1) : o.tx); // SE if wide, SW if tall

    const anchorTy = o.anchorTy ?? southY;
    const footprintW = Math.max(1, o.w | 0);
    const isFootprintOverlay =
      o.layerRole === "STRUCTURE" || ((o.kind ?? "ROOF") === "PROP" && (footprintW > 1 || (o.h | 0) > 1));
    const tileWidth = 2 * T * ISO_X;
    const halfTileW = tileWidth * 0.5;
    // Derived footprint skew correction in screen X:
    // 3x2 => -32, 2x3 => +32 (with T=64, ISO_X=1), scales with (h-w).
    const footprintAnchorAdjustX = isFootprintOverlay
      ? ((o.h - o.w) * halfTileW) * 0.5
      : 0;
    const wx = (anchorTx + 0.5) * T;
    const wy = (anchorTy + 0.5) * T;
    const p = worldToScreen(wx, wy);
    const zVisual = o.z + (o.zVisualOffsetUnits ?? 0);
    const dx = p.x + camX - ow * scale * 0.5 + (o.drawDxOffset ?? 0) + footprintAnchorAdjustX;
    const dy = p.y + camY - oh * scale - zVisual * ELEV_PX - (o.drawDyOffset ?? 0);
    if (LOG_STRUCTURE_ANCHOR_DEBUG && isFootprintOverlay && !loggedStructureAnchorDebugIds.has(o.id)) {
      loggedStructureAnchorDebugIds.add(o.id);
      console.log("[structure-anchor-debug]", {
        id: o.id,
        anchorTx,
        anchorTy,
        tileW: footprintW,
        xAdjustPx: footprintAnchorAdjustX,
        screenX: dx,
      });
    }
    return {
      img: rec.img,
      dx,
      dy,
      dw: ow,
      dh: oh,
      flipX: !!o.flipX,
      scale,
    };
  };

  const debugContext: DebugOverlayContext = {
    ctx,
    w,
    ww,
    hh,
    px,
    py,
    camX,
    camY,
    T,
    ELEV_PX,
    renderAllHeights: RENDER_ALL_HEIGHTS,
    maxNonStairSurfaceZ,
    tileHAtWorld,
    toScreen,
    toScreenAtZ,
  };

  const debug = settings.debug;
  const RENDER_ENTITY_SHADOWS = !renderSettings.entityShadowsDisable;
  const RENDER_ENTITY_ANCHORS = renderSettings.entityAnchorsEnabled;
  const SHOW_ENTITY_ANCHOR_OVERLAY = debug.entityAnchorOverlay;
  const debugFlags = resolveDebugFlags(debug);
  const SHOW_WALK_MASK = debugFlags.showWalkMask;
  const SHOW_RAMPS = debugFlags.showRamps;
  const SHOW_OCCLUDER_DEBUG = debugFlags.showOccluders;
  const SHOW_DECAL_DEBUG = debugFlags.showDecals;
  const SHOW_PROJECTILE_FACES = debugFlags.showProjectileFaces;
  const SHOW_TRIGGER_ZONES = debugFlags.showTriggers;
  const SHOW_ROAD_SEMANTIC = debugFlags.showRoadSemantic;
  const SHOW_STRUCTURE_HEIGHTS = debugFlags.showStructureHeights;
  const SHOW_STRUCTURE_COLLISION_DEBUG = debugFlags.showStructureCollision;
  const SHOW_STRUCTURE_SLICE_DEBUG = debugFlags.showStructureSlices;
  const SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG = debugFlags.showStructureTriangleFootprint;
  const SHADOW_V1_DEBUG_GEOMETRY_MODE = debug.shadowV1DebugGeometryMode;
  const SHADOW_CASTER_MODE = debug.shadowCasterMode;
  const SHADOW_HYBRID_DIAGNOSTIC_MODE = debug.shadowHybridDiagnosticMode;
  const SHADOW_DEBUG_MODE = debug.shadowDebugMode;
  const SHADOW_V5_DEBUG_VIEW = debug.shadowV5DebugView;
  const SHADOW_V5_TRANSFORM_DEBUG_MODE = debug.shadowV5TransformDebugMode;
  const SHADOW_V6_REQUESTED_SEMANTIC_BUCKET = debug.shadowV6SemanticBucket;
  const SHADOW_V6_PRIMARY_SEMANTIC_BUCKET: StructureV6SemanticBucket = "EAST_WEST";
  const SHADOW_V6_SECONDARY_SEMANTIC_BUCKET: StructureV6SemanticBucket = "SOUTH_NORTH";
  const SHADOW_V6_TOP_SEMANTIC_BUCKET: StructureV6SemanticBucket = "TOP";
  const SHADOW_V6_STRUCTURE_INDEX = debug.shadowV6StructureIndex;
  const SHADOW_V6_SLICE_COUNT = debug.shadowV6SliceCount;
  const SHOW_ENEMY_AIM_OVERLAY = debugFlags.showEnemyAimOverlay;
  const SHOW_LOOT_GOBLIN_OVERLAY = debugFlags.showLootGoblinOverlay;
  const SHOW_ZONE_OBJECTIVE_BOUNDS = !!debug.objectives?.showZoneBounds;

  // Enemy Z buffer (optional visual override)
  const ez = w.ezVisual;

  // ----------------------------
  // Tile range / diagonals
  // ----------------------------
  const configuredRadius = Number(renderSettings.tileRenderRadius);
  const sliderPadding = Math.max(-12, Math.min(12, Number.isFinite(configuredRadius) ? Math.round(configuredRadius) : 0));
  const renderPaddingFactor = Math.max(-0.9, Math.min(0.9, sliderPadding / 12));
  setRenderTileLoopRadius(sliderPadding);
  type ScreenRect = { minX: number; maxX: number; minY: number; maxY: number };
  type TileBounds = { minTx: number; maxTx: number; minTy: number; maxTy: number };
  type CullingView = { screenRect: ScreenRect; tileBounds: TileBounds };

  const pointInRect = (px: number, py: number, r: ScreenRect): boolean => (
    px >= r.minX && px <= r.maxX && py >= r.minY && py <= r.maxY
  );
  const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number => (
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  );
  const pointInConvexQuad = (
    px: number,
    py: number,
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
  ): boolean => {
    const c0 = cross(x0, y0, x1, y1, px, py);
    const c1 = cross(x1, y1, x2, y2, px, py);
    const c2 = cross(x2, y2, x3, y3, px, py);
    const c3 = cross(x3, y3, x0, y0, px, py);
    const hasPos = c0 > 0 || c1 > 0 || c2 > 0 || c3 > 0;
    const hasNeg = c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0;
    return !(hasPos && hasNeg);
  };
  const onSegment = (ax: number, ay: number, bx: number, by: number, px: number, py: number): boolean => (
    px >= Math.min(ax, bx) && px <= Math.max(ax, bx) &&
    py >= Math.min(ay, by) && py <= Math.max(ay, by)
  );
  const segmentsIntersect = (
    ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, dx: number, dy: number,
  ): boolean => {
    const o1 = cross(ax, ay, bx, by, cx, cy);
    const o2 = cross(ax, ay, bx, by, dx, dy);
    const o3 = cross(cx, cy, dx, dy, ax, ay);
    const o4 = cross(cx, cy, dx, dy, bx, by);

    if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
    if (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
    if (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
    if (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
    if (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
    return false;
  };
  const tileDiamondIntersectsScreenRect = (tx: number, ty: number, rect: ScreenRect): boolean => {
    const x0w = tx * T;
    const y0w = ty * T;
    const p0 = worldToScreen(x0w, y0w);
    const p1 = worldToScreen(x0w + T, y0w);
    const p2 = worldToScreen(x0w + T, y0w + T);
    const p3 = worldToScreen(x0w, y0w + T);

    if (pointInRect(p0.x, p0.y, rect) || pointInRect(p1.x, p1.y, rect) || pointInRect(p2.x, p2.y, rect) || pointInRect(p3.x, p3.y, rect)) return true;

    const rx0 = rect.minX, ry0 = rect.minY;
    const rx1 = rect.maxX, ry1 = rect.minY;
    const rx2 = rect.maxX, ry2 = rect.maxY;
    const rx3 = rect.minX, ry3 = rect.maxY;

    if (
      pointInConvexQuad(rx0, ry0, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y) ||
      pointInConvexQuad(rx1, ry1, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y) ||
      pointInConvexQuad(rx2, ry2, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y) ||
      pointInConvexQuad(rx3, ry3, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    ) {
      return true;
    }

    const quadEdges: Array<[number, number, number, number]> = [
      [p0.x, p0.y, p1.x, p1.y],
      [p1.x, p1.y, p2.x, p2.y],
      [p2.x, p2.y, p3.x, p3.y],
      [p3.x, p3.y, p0.x, p0.y],
    ];
    const rectEdges: Array<[number, number, number, number]> = [
      [rx0, ry0, rx1, ry1],
      [rx1, ry1, rx2, ry2],
      [rx2, ry2, rx3, ry3],
      [rx3, ry3, rx0, ry0],
    ];
    for (let i = 0; i < quadEdges.length; i++) {
      const [ax, ay, bx, by] = quadEdges[i];
      for (let j = 0; j < rectEdges.length; j++) {
        const [cx, cy, dx, dy] = rectEdges[j];
        if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return true;
      }
    }
    return false;
  };

  const cullingCache = new Map<number, CullingView>();
  const getCullingView = (extraPadTiles: number): CullingView => {
    const p = Math.floor(extraPadTiles);
    const cached = cullingCache.get(p);
    if (cached) return cached;

    const baseMinX = -camTx;
    const baseMaxX = -camTx + ww;
    const baseMinY = -camTy;
    const baseMaxY = -camTy + hh;
    const centerX = (baseMinX + baseMaxX) * 0.5;
    const centerY = (baseMinY + baseMaxY) * 0.5;
    const baseHalfW = (baseMaxX - baseMinX) * 0.5;
    const baseHalfH = (baseMaxY - baseMinY) * 0.5;
    const padFactorExtra = p / 12;
    const scale = Math.max(0.1, 1 + renderPaddingFactor + padFactorExtra);
    const minHalfW = T * ISO_X;
    const minHalfH = T * ISO_Y;
    const halfW = Math.max(minHalfW, baseHalfW * scale);
    const halfH = Math.max(minHalfH, baseHalfH * scale);
    const sx0 = centerX - halfW;
    const sx1 = centerX + halfW;
    const sy0 = centerY - halfH;
    const sy1 = centerY + halfH;
    const screenRect: ScreenRect = {
      minX: Math.min(sx0, sx1),
      maxX: Math.max(sx0, sx1),
      minY: Math.min(sy0, sy1),
      maxY: Math.max(sy0, sy1),
    };

    const c0 = screenToWorld(screenRect.minX, screenRect.minY);
    const c1 = screenToWorld(screenRect.maxX, screenRect.minY);
    const c2 = screenToWorld(screenRect.minX, screenRect.maxY);
    const c3 = screenToWorld(screenRect.maxX, screenRect.maxY);
    const minWx = Math.min(c0.x, c1.x, c2.x, c3.x);
    const maxWx = Math.max(c0.x, c1.x, c2.x, c3.x);
    const minWy = Math.min(c0.y, c1.y, c2.y, c3.y);
    const maxWy = Math.max(c0.y, c1.y, c2.y, c3.y);
    const tileBounds: TileBounds = {
      minTx: Math.floor(minWx / T),
      maxTx: Math.floor(maxWx / T),
      minTy: Math.floor(minWy / T),
      maxTy: Math.floor(maxWy / T),
    };
    const view: CullingView = { screenRect, tileBounds };
    cullingCache.set(p, view);
    return view;
  };

  const baseCulling = getCullingView(0);
  const viewRect = baseCulling.tileBounds;
  const projectedViewportRect: RuntimeStructureTriangleRect = {
    x: -camTx,
    y: -camTy,
    w: ww,
    h: hh,
  };
  const strictViewportTileBounds: TileBounds = (() => {
    const vx0 = projectedViewportRect.x;
    const vy0 = projectedViewportRect.y;
    const vx1 = projectedViewportRect.x + projectedViewportRect.w;
    const vy1 = projectedViewportRect.y + projectedViewportRect.h;
    const c0 = screenToWorld(vx0, vy0);
    const c1 = screenToWorld(vx1, vy0);
    const c2 = screenToWorld(vx0, vy1);
    const c3 = screenToWorld(vx1, vy1);
    return {
      minTx: Math.floor(Math.min(c0.x, c1.x, c2.x, c3.x) / T),
      maxTx: Math.floor(Math.max(c0.x, c1.x, c2.x, c3.x) / T),
      minTy: Math.floor(Math.min(c0.y, c1.y, c2.y, c3.y) / T),
      maxTy: Math.floor(Math.max(c0.y, c1.y, c2.y, c3.y) / T),
    };
  })();
  const minTx = viewRect.minTx;
  const maxTx = viewRect.maxTx;
  const minTy = viewRect.minTy;
  const maxTy = viewRect.maxTy;

  const isTileInRenderRadius = (tx: number, ty: number): boolean => {
    if (tx < minTx || tx > maxTx || ty < minTy || ty > maxTy) return false;
    return tileDiamondIntersectsScreenRect(tx, ty, baseCulling.screenRect);
  };
  const isTileInRenderRadiusPadded = (tx: number, ty: number, padTiles: number): boolean => {
    const culling = getCullingView(Math.max(0, Math.floor(padTiles)));
    const bounds = culling.tileBounds;
    if (tx < bounds.minTx || tx > bounds.maxTx || ty < bounds.minTy || ty > bounds.maxTy) return false;
    return tileDiamondIntersectsScreenRect(tx, ty, culling.screenRect);
  };
  const tileRectIntersectsRenderRadius = (
    minRectTx: number,
    maxRectTx: number,
    minRectTy: number,
    maxRectTy: number,
  ): boolean => {
    return !(maxRectTx < minTx || minRectTx > maxTx || maxRectTy < minTy || minRectTy > maxTy);
  };
  const tileRectIntersectsBounds = (
    minRectTx: number,
    maxRectTx: number,
    minRectTy: number,
    maxRectTy: number,
    bounds: TileBounds,
  ): boolean => {
    return !(maxRectTx < bounds.minTx || minRectTx > bounds.maxTx || maxRectTy < bounds.minTy || minRectTy > bounds.maxTy);
  };
  const minSum = minTx + minTy;
  const maxSum = maxTx + maxTy;
  const playerTxForProjectileCull = Math.floor(px / KENNEY_TILE_WORLD);
  const playerTyForProjectileCull = Math.floor(py / KENNEY_TILE_WORLD);
  const projectileTileRenderRadius =
    Math.max(
      Math.abs(baseCulling.tileBounds.minTx - playerTxForProjectileCull),
      Math.abs(baseCulling.tileBounds.maxTx - playerTxForProjectileCull),
      Math.abs(baseCulling.tileBounds.minTy - playerTyForProjectileCull),
      Math.abs(baseCulling.tileBounds.maxTy - playerTyForProjectileCull),
    ) + 2;
  const activeH = w.activeFloorH ?? 0;
  const compiledMap = getActiveCompiledMap();
  const rampRoadTiles = buildRampRoadTiles(compiledMap);

  const beamLightZ = w.pzVisual ?? w.pz ?? tileHAtWorld(w.playerBeamStartX, w.playerBeamStartY);
  const activePaletteId = resolveActivePaletteId();
  const activePaletteSwapWeights = resolveActivePaletteSwapWeights();
  const currentSettings = getUserSettings();
  const worldLightRegistry = buildFrameWorldLightRegistry({
    mapId: compiledMap.id,
    tileWorld: T,
    elevPx: ELEV_PX,
    worldScale: s,
    streetLampOcclusionEnabled: w.lighting.occlusionEnabled,
    lightOverrides: {
      colorModeOverride: currentSettings.render.lightColorModeOverride,
      strengthOverride: currentSettings.render.lightStrengthOverride,
    },
    lightPalette: {
      paletteId: activePaletteId,
      saturationWeight: activePaletteSwapWeights.sWeight,
    },
    staticLights: compiledMap.lightDefs,
    runtimeBeam: {
      active: !!w.playerBeamActive,
      startWorldX: w.playerBeamStartX,
      startWorldY: w.playerBeamStartY,
      endWorldX: w.playerBeamEndX,
      endWorldY: w.playerBeamEndY,
      zVisual: beamLightZ,
      widthPx: w.playerBeamWidthPx || 6,
      glowIntensity: w.playerBeamGlowIntensity || 0,
    },
    tileHeightAtWorld: tileHAtWorld,
    isTileInRenderRadius,
    projectToScreen: (worldX, worldY, zPx) => viewport.project(worldX, worldY, zPx),
  });
  const staticRelight = resolveStaticRelightRuntimeState(w);
  dynamicSpriteRelightFrame = null;
  if (staticRelight.frame && staticRelight.relightLights.length > 0) {
    const dynamicLights: DynamicRelightLightCandidate[] = staticRelight.relightLights.map((light) => ({
      id: light.id,
      centerX: light.centerX,
      centerY: light.centerY,
      radiusPx: light.radiusPx,
      yScale: light.yScale,
      intensity: light.intensity,
    }));
    dynamicSpriteRelightFrame = {
      targetDarknessBucket: staticRelight.targetDarknessBucket,
      strengthScale: staticRelight.strengthScale,
      minAlpha: DYNAMIC_RELIGHT_MIN_ALPHA,
      lights: dynamicLights,
    };
  }
  const staticRelightContextChanged = staticRelightBakeStore.resetIfContextChanged(staticRelight.contextKey);
  const structureTriangleGeometryEnabled = renderSettings.structureTriangleGeometryEnabled !== false;
  const structureTriangleAdmissionMode = renderSettings.structureTriangleAdmissionMode ?? "hybrid";
  const structureTriangleCutoutEnabled = structureTriangleGeometryEnabled
    && renderSettings.structureTriangleCutoutEnabled === true;
  const structureTriangleCutoutHalfWidth = Math.max(
    0,
    Math.min(12, Math.round(Number(renderSettings.structureTriangleCutoutWidth ?? 2))),
  );
  const structureTriangleCutoutHalfHeight = Math.max(
    0,
    Math.min(12, Math.round(Number(renderSettings.structureTriangleCutoutHeight ?? 2))),
  );
  const structureTriangleCutoutAlpha = Math.max(
    0,
    Math.min(1, Number(renderSettings.structureTriangleCutoutAlpha ?? 0.45)),
  );
  const playerCameraTx = playerTx;
  const playerCameraTy = playerTy;
  const playerRenderFields = deriveParentTileRenderFields(playerTx, playerTy);
  const isParentTileAfterPlayer = (parentTx: number, parentTy: number): boolean => {
    const parentFields = deriveParentTileRenderFields(parentTx, parentTy);
    if (parentFields.slice !== playerRenderFields.slice) return parentFields.slice > playerRenderFields.slice;
    return parentFields.within > playerRenderFields.within;
  };
  const structureCutoutHalfWidthPx = Math.max(1, structureTriangleCutoutHalfWidth * T * ISO_X);
  const structureCutoutHalfHeightPx = Math.max(1, structureTriangleCutoutHalfHeight * T * ISO_Y);
  const structureCutoutScreenRect: ScreenRect = {
    minX: p0.x - structureCutoutHalfWidthPx,
    maxX: p0.x + structureCutoutHalfWidthPx,
    minY: p0.y - structureCutoutHalfHeightPx,
    maxY: p0.y + structureCutoutHalfHeightPx,
  };
  const isPointInsideStructureCutoutScreenRect = (x: number, y: number): boolean => (
    x >= structureCutoutScreenRect.minX
    && x <= structureCutoutScreenRect.maxX
    && y >= structureCutoutScreenRect.minY
    && y <= structureCutoutScreenRect.maxY
  );
  type ProjectedQuad = [ScreenPt, ScreenPt, ScreenPt, ScreenPt];
  type FootprintSupportCell = {
    col: number;
    row: number;
    quad: ProjectedQuad;
    supported: boolean;
  };
  type FootprintSupportLevel = {
    level: number;
    liftYPx: number;
    quad: ProjectedQuad;
    cells: FootprintSupportCell[];
    supportedCells: number;
    totalCells: number;
    anySupport: boolean;
    allSupported: boolean;
  };
  type StructureTriangleSemanticClass =
    | "TOP"
    | "LEFT_SOUTH"
    | "RIGHT_EAST"
    | "UNCLASSIFIED"
    | "CONFLICT";

  const STRUCTURE_FOOTPRINT_SCAN_STEP_PX = 64;

  const buildProjectedStructureFootprintQuad = (overlay: StampOverlay): ProjectedQuad => {
    const zVisual = overlay.z + (overlay.zVisualOffsetUnits ?? 0);
    const minWorldX = overlay.tx * T;
    const minWorldY = overlay.ty * T;
    const maxWorldX = (overlay.tx + overlay.w) * T;
    const maxWorldY = (overlay.ty + overlay.h) * T;
    const nw = toScreenAtZ(minWorldX, minWorldY, zVisual);
    const ne = toScreenAtZ(maxWorldX, minWorldY, zVisual);
    const se = toScreenAtZ(maxWorldX, maxWorldY, zVisual);
    const sw = toScreenAtZ(minWorldX, maxWorldY, zVisual);
    return [nw, ne, se, sw];
  };
  const isPointInsideProjectedStructureFootprintQuad = (
    quad: ProjectedQuad,
    x: number,
    y: number,
  ): boolean => {
    const p = { x, y };
    return pointInTriangle(p, quad[0], quad[1], quad[2]) || pointInTriangle(p, quad[0], quad[2], quad[3]);
  };
  const lerpScreenPt = (a: ScreenPt, b: ScreenPt, t: number): ScreenPt => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const sampleProjectedQuadPoint = (quad: ProjectedQuad, u: number, v: number): ScreenPt => {
    const top = lerpScreenPt(quad[0], quad[1], u);
    const bottom = lerpScreenPt(quad[3], quad[2], u);
    return lerpScreenPt(top, bottom, v);
  };
  const liftProjectedFootprintQuad = (quad: ProjectedQuad, liftYPx: number): ProjectedQuad => {
    const liftedY = -liftYPx;
    return [
      { x: quad[0].x, y: quad[0].y + liftedY },
      { x: quad[1].x, y: quad[1].y + liftedY },
      { x: quad[2].x, y: quad[2].y + liftedY },
      { x: quad[3].x, y: quad[3].y + liftedY },
    ];
  };
  const buildFootprintSupportLevel = (
    quad: ProjectedQuad,
    cols: number,
    rows: number,
    triangleCentroids: ScreenPt[],
    level: number,
    liftYPx: number,
  ): FootprintSupportLevel => {
    const cells: FootprintSupportCell[] = [];
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
          if (!isPointInsideProjectedStructureFootprintQuad(cellQuad, centroid.x, centroid.y)) continue;
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
    const totalCells = cols * rows;
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
  };
  const scanLiftedFootprintSupportLevels = (
    baseQuad: ProjectedQuad,
    cols: number,
    rows: number,
    triangleCentroids: ScreenPt[],
  ): { levels: FootprintSupportLevel[]; highestValidLevel: number } => {
    const levels: FootprintSupportLevel[] = [];
    let highestValidLevel = -1;
    const baseMaxY = Math.max(baseQuad[0].y, baseQuad[1].y, baseQuad[2].y, baseQuad[3].y);
    let minCentroidY = Number.POSITIVE_INFINITY;
    for (let i = 0; i < triangleCentroids.length; i++) {
      minCentroidY = Math.min(minCentroidY, triangleCentroids[i].y);
    }
    const maxLevels = Number.isFinite(minCentroidY)
      ? Math.max(1, Math.ceil((baseMaxY - minCentroidY) / STRUCTURE_FOOTPRINT_SCAN_STEP_PX) + 2)
      : 1;
    for (let level = 0; level < maxLevels; level++) {
      const liftYPx = level * STRUCTURE_FOOTPRINT_SCAN_STEP_PX;
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
    return { levels, highestValidLevel };
  };
  const runtimeStructureTriangleContextKey = buildRuntimeStructureTriangleContextKey({
    mapId: compiledMap.id,
    enabled: structureTriangleGeometryEnabled,
  });
  const runtimeStructureTriangleContextChanged = runtimeStructureTriangleCacheStore
    .resetIfContextChanged(runtimeStructureTriangleContextKey);
  const shadowSunModel = getShadowSunModel(debug.shadowSunTimeHour);
  const structureShadowContextKey = buildStructureShadowContextKey({
    mapId: compiledMap.id,
    enabled: structureTriangleGeometryEnabled,
    sunStepKey: shadowSunModel.stepKey,
    roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
  });
  const structureShadowV2ContextKey = buildStructureShadowV2ContextKey({
    mapId: compiledMap.id,
    enabled: structureTriangleGeometryEnabled,
    sunStepKey: shadowSunModel.stepKey,
    roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
    alphaThreshold: STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
    silhouetteSampleStep: STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
    maxLoopPoints: STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
  });
  const structureShadowHybridContextKey = buildStructureShadowHybridContextKey({
    mapId: compiledMap.id,
    enabled: structureTriangleGeometryEnabled,
    sunStepKey: shadowSunModel.stepKey,
    roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
  });
  const structureShadowV4ContextKey = buildStructureShadowV4ContextKey({
    mapId: compiledMap.id,
    enabled: structureTriangleGeometryEnabled,
    sunStepKey: shadowSunModel.stepKey,
  });
  structureShadowV1CacheStore.resetIfContextChanged(structureShadowContextKey);
  structureShadowV2CacheStore.resetIfContextChanged(structureShadowV2ContextKey);
  structureShadowHybridCacheStore.resetIfContextChanged(structureShadowHybridContextKey);
  structureShadowV4CacheStore.resetIfContextChanged(structureShadowV4ContextKey);
  staticRelightFrame = staticRelight.frame;
  if (runtimeStructureTriangleContextChanged && structureTriangleGeometryEnabled) {
    rebuildRuntimeStructureTriangleCacheForMap(compiledMap, {
      cacheStore: runtimeStructureTriangleCacheStore,
      getFlippedOverlayImage,
    });
  }
  if (staticRelightContextChanged) {
    staticRelightPendingRuntimeRebuildContextKey = "";
    staticRelightPendingRuntimeRebuildAtMs = 0;
  }
  if (staticRelightContextChanged && staticRelight.frame) {
    const result = rebuildFullMapStaticGroundRelightBake(
      staticRelight.compiledMap,
      rampRoadTiles,
      staticRelight.frame,
    );
    if (result.needsRetry) {
      staticRelightPendingRuntimeRebuildContextKey = staticRelight.contextKey;
      staticRelightPendingRuntimeRebuildAtMs = performance.now() + STATIC_RELIGHT_RUNTIME_RETRY_INTERVAL_MS;
    }
  } else if (
    staticRelight.frame
    && staticRelightPendingRuntimeRebuildContextKey === staticRelight.contextKey
    && performance.now() >= staticRelightPendingRuntimeRebuildAtMs
  ) {
    const retryResult = rebuildFullMapStaticGroundRelightBake(
      staticRelight.compiledMap,
      rampRoadTiles,
      staticRelight.frame,
    );
    if (retryResult.needsRetry) {
      staticRelightPendingRuntimeRebuildAtMs = performance.now() + STATIC_RELIGHT_RUNTIME_RETRY_INTERVAL_MS;
    } else {
      staticRelightPendingRuntimeRebuildContextKey = "";
      staticRelightPendingRuntimeRebuildAtMs = 0;
    }
  } else if (!staticRelight.frame) {
    staticRelightPendingRuntimeRebuildContextKey = "";
    staticRelightPendingRuntimeRebuildAtMs = 0;
  }

  // ----------------------------
  // Void
  // ----------------------------
  // Disabled: VOID is now drawn once as a screen background (see drawVoidBackgroundOnce).
  // This avoids thousands of drawImage calls per frame.
  {
    // noop
  }
  // ============================================
  // SLICE-BUCKETED COLLECTION AND DRAWING
  // ============================================
  // Drawable descriptor for any render element
  type SliceDrawFn = (payload: unknown) => void;
  type SliceDrawable = {
    key: RenderKey;
    drawFn: SliceDrawFn;
    payload: unknown;
  };

  // Map from slice -> array of drawables for that slice
  const sliceDrawables = new Map<number, SliceDrawable[]>();
  const structureShadowTrianglesByBand = new Map<number, StructureShadowProjectedTriangle[]>();
  const structureHybridShadowByBand = new Map<number, StructureHybridShadowRenderPiece[]>();
  const structureV4ShadowByBand = new Map<number, StructureV4ShadowRenderPiece[]>();
  const structureV5ShadowByBand = new Map<number, StructureV5ShadowRenderPiece[]>();
  const structureV6ShadowDebugCandidates: StructureV6ShadowDebugCandidate[] = [];
  let structureV6VerticalShadowDebugData: StructureV6VerticalShadowMaskDebugData | null = null;
  type HybridShadowDiagnosticStats = {
    cacheHits: number;
    cacheMisses: number;
    casterTriangles: number;
    projectedTriangles: number;
    piecesQueued: number;
    trianglesQueued: number;
    piecesDrawnShadowPass: number;
    trianglesDrawnShadowPass: number;
    piecesDrawnMainCanvas: number;
    trianglesDrawnMainCanvas: number;
    piecesComposited: number;
    trianglesComposited: number;
  };
  const hybridShadowDiagnosticStats: HybridShadowDiagnosticStats = {
    cacheHits: 0,
    cacheMisses: 0,
    casterTriangles: 0,
    projectedTriangles: 0,
    piecesQueued: 0,
    trianglesQueued: 0,
    piecesDrawnShadowPass: 0,
    trianglesDrawnShadowPass: 0,
    piecesDrawnMainCanvas: 0,
    trianglesDrawnMainCanvas: 0,
    piecesComposited: 0,
    trianglesComposited: 0,
  };
  type V4ShadowDiagnosticStats = {
    cacheHits: number;
    cacheMisses: number;
    correspondences: number;
    strips: number;
    layerEdges: number;
    layerBands: number;
    sourceBandTriangles: number;
    destinationBandEntries: number;
    correspondencePairs: number;
    correspondenceMismatches: number;
    topCapTriangles: number;
    destinationBandPairs: number;
    destinationTriangles: number;
    diagonalA: number;
    diagonalB: number;
    diagonalRule: string;
    deltaConstPass: number;
    deltaConstFail: number;
    firstSliceSummary: string;
    sampleRoofHeightPx: number | null;
    sampleLayerHeights: string;
    sampleSliceCount: number;
    sampleLayerEdges: number;
    sampleLayerBands: number;
    sampleSelectedSlice: string;
    sampleSelectedBand: string;
    renderMode: string;
    piecesQueued: number;
    trianglesQueued: number;
    topCapTrianglesQueued: number;
    topCapTrianglesDrawnShadowPass: number;
    topCapTrianglesDrawnMainCanvas: number;
    warpedTrianglesDrawnShadowPass: number;
    flatTrianglesDrawnShadowPass: number;
    flatTrianglesDrawnMainCanvas: number;
    warpedDrawCalls: number;
    flatDrawCalls: number;
    piecesComposited: number;
    trianglesComposited: number;
  };
  const v4ShadowDiagnosticStats: V4ShadowDiagnosticStats = {
    cacheHits: 0,
    cacheMisses: 0,
    correspondences: 0,
    strips: 0,
    layerEdges: 0,
    layerBands: 0,
    sourceBandTriangles: 0,
    destinationBandEntries: 0,
    correspondencePairs: 0,
    correspondenceMismatches: 0,
    topCapTriangles: 0,
    destinationBandPairs: 0,
    destinationTriangles: 0,
    diagonalA: 0,
    diagonalB: 0,
    diagonalRule: "A:0 B:0",
    deltaConstPass: 0,
    deltaConstFail: 0,
    firstSliceSummary: "none",
    sampleRoofHeightPx: null,
    sampleLayerHeights: "none",
    sampleSliceCount: 0,
    sampleLayerEdges: 0,
    sampleLayerBands: 0,
    sampleSelectedSlice: "none",
    sampleSelectedBand: "none",
    renderMode: SHADOW_DEBUG_MODE,
    piecesQueued: 0,
    trianglesQueued: 0,
    topCapTrianglesQueued: 0,
    topCapTrianglesDrawnShadowPass: 0,
    topCapTrianglesDrawnMainCanvas: 0,
    warpedTrianglesDrawnShadowPass: 0,
    flatTrianglesDrawnShadowPass: 0,
    flatTrianglesDrawnMainCanvas: 0,
    warpedDrawCalls: 0,
    flatDrawCalls: 0,
    piecesComposited: 0,
    trianglesComposited: 0,
  };
  type V5ShadowDiagnosticStats = {
    piecesQueued: number;
    trianglesQueued: number;
    piecesDrawn: number;
    trianglesDrawn: number;
    finalShadowDrawCalls: number;
  };
  const v5ShadowDiagnosticStats: V5ShadowDiagnosticStats = {
    piecesQueued: 0,
    trianglesQueued: 0,
    piecesDrawn: 0,
    trianglesDrawn: 0,
    finalShadowDrawCalls: 0,
  };
  let v5ShadowAnchorDiagnostic: StructureV5ShadowAnchorDiagnostic | null = null;
  const hybridMainCanvasDiagnosticPieces: StructureHybridShadowRenderPiece[] = [];
  const deferredStructureSliceDebugDraws: Array<() => void> = [];
  let didQueueStructureCutoutDebugRect = false;

  const drawClosureFn: SliceDrawFn = (payload) => {
    (payload as (() => void))();
  };

  const drawRuntimeSidewalkTopFn: SliceDrawFn = (payload) => {
    const p = payload as {
      tx: number;
      ty: number;
      zBase: number;
      anchorY: number;
      family: RuntimeDecalSetId;
      variantIndex: number;
      rotationQuarterTurns: number;
    };
    drawRuntimeSidewalkTop(
      p.tx,
      p.ty,
      p.zBase,
      p.anchorY,
      p.family as any,
      p.variantIndex,
      p.rotationQuarterTurns as any,
    );
  };

  const drawImageTopFn: SliceDrawFn = (payload) => {
    const p = payload as {
      img: CanvasImageSource;
      dx: number;
      dy: number;
      dw: number;
      dh: number;
    };
    ctx.drawImage(p.img, snapPx(p.dx), snapPx(p.dy), p.dw, p.dh);
  };

  const drawRuntimeDecalTopFn: SliceDrawFn = (payload) => {
    const p = payload as {
      tx: number;
      ty: number;
      zBase: number;
      renderAnchorY: number;
      setId: RuntimeDecalSetId;
      variantIndex: number;
      rotationQuarterTurns: number;
    };
    drawRuntimeDecalTop(
      p.tx,
      p.ty,
      p.zBase,
      p.renderAnchorY,
      p.setId,
      p.variantIndex,
      p.rotationQuarterTurns as any,
    );
  };

  const drawZoneObjectiveFn: SliceDrawFn = (payload) => {
    const p = payload as { zone: any };
    renderZoneObjectives(ctx, w, {
      zone: p.zone,
      mapOriginTx: compiledMap.originTx,
      mapOriginTy: compiledMap.originTy,
      tileWorld: T,
      toScreen,
      showZoneBounds: SHOW_ZONE_OBJECTIVE_BOUNDS,
    });
  };

  const drawEntityShadowFn: SliceDrawFn = (payload) => {
    renderEntityShadow(
      ctx,
      payload as ShadowParams,
      compiledMap,
      shadowSunModel.projectionDirection,
    );
  };
  const worldLightGroundYScale = resolveLightingGroundYScale(w.lighting.groundYScale ?? 0.65);

  const drawPendingLightRenderPieceFn: SliceDrawFn = (payload) => {
    const lightPiece = payload as WorldLightRenderPiece;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    configurePixelPerfect(ctx);
    drawProjectedLightAdditive(ctx, lightPiece.light.projected, w.time ?? 0, worldLightGroundYScale);
    ctx.restore();
  };

  const addToSlice = (
    slice: number,
    key: RenderKey,
    drawOrFn: (() => void) | SliceDrawFn,
    payload?: unknown,
  ) => {
    let bucket = sliceDrawables.get(slice);
    if (!bucket) {
      bucket = [];
      sliceDrawables.set(slice, bucket);
    }
    if (typeof payload === "undefined") {
      countRenderClosureCreated();
      bucket.push({ key, drawFn: drawClosureFn, payload: drawOrFn as (() => void) });
      return;
    }
    bucket.push({ key, drawFn: drawOrFn as SliceDrawFn, payload });
  };

  const queueStructureShadowTrianglesForBand = (
    zBand: number,
    triangles: readonly StructureShadowProjectedTriangle[],
  ): void => {
    if (triangles.length <= 0) return;
    let bucket = structureShadowTrianglesByBand.get(zBand);
    if (!bucket) {
      bucket = [];
      structureShadowTrianglesByBand.set(zBand, bucket);
    }
    for (let i = 0; i < triangles.length; i++) {
      bucket.push(triangles[i]);
    }
  };

  const queueStructureHybridShadowForBand = (
    zBand: number,
    piece: StructureHybridShadowRenderPiece,
  ): void => {
    if (piece.projectedMappings.length <= 0) return;
    let bucket = structureHybridShadowByBand.get(zBand);
    if (!bucket) {
      bucket = [];
      structureHybridShadowByBand.set(zBand, bucket);
    }
    bucket.push(piece);
  };

  const queueStructureV4ShadowForBand = (
    zBand: number,
    piece: StructureV4ShadowRenderPiece,
  ): void => {
    if (piece.triangleCorrespondence.length <= 0 && piece.topCapTriangles.length <= 0) return;
    let bucket = structureV4ShadowByBand.get(zBand);
    if (!bucket) {
      bucket = [];
      structureV4ShadowByBand.set(zBand, bucket);
    }
    bucket.push(piece);
  };

  const queueStructureV5ShadowForBand = (
    zBand: number,
    piece: StructureV5ShadowRenderPiece,
  ): void => {
    if (piece.triangles.length <= 0) return;
    let bucket = structureV5ShadowByBand.get(zBand);
    if (!bucket) {
      bucket = [];
      structureV5ShadowByBand.set(zBand, bucket);
    }
    bucket.push(piece);
  };

  // ----------------------------
  // Prepass: build all apron slice draws and bucket them by slice.
  // ----------------------------
  // (Underlay prepass removed; faces now render as occluders)

  // ----------------------------
  // COLLECTION PHASE: All drawable types collected into slices
  // ----------------------------

  // Collect TOPS (surfaces) into slices
  // ----------------------------
  {
    for (let s = minSum; s <= maxSum; s++) {
      const ty0 = Math.max(minTy, s - maxTx);
      const ty1 = Math.min(maxTy, s - minTx);

      for (let ty = ty1; ty >= ty0; ty--) {
        const tx = s - ty;
        if (!isTileInRenderRadius(tx, ty)) continue;
        countRenderTileLoopIteration();

        const surfaces = surfacesAtXYCached(tx, ty);
        if (surfaces.length === 0) continue;

        for (let si = 0; si < surfaces.length; si++) {
          const surface = surfaces[si];
          const tdef = surface.tile;
          const isStairTop = surface.renderTopKind === "STAIR";
          // Skip VOID surfaces entirely (VOID is background now)
          if (tdef.kind === "VOID") continue;

          // Height filtering
          if (RENDER_ALL_HEIGHTS) {
            // noop - render all
          } else {
            // Filter by activeH
            if (!isStairTop) {
              if (surface.zLogical !== activeH) continue;
            } else {
              const hs = tdef.h ?? 0;
              if (Math.abs(hs - activeH) > 1) continue;
            }
          }

          if (surface.id.startsWith("building_floor_") && shouldCullBuildingAt(tx, ty)) continue;
          if (surface.runtimeTop?.kind === "SQUARE_128_RUNTIME") {
            const runtimeTop = surface.runtimeTop;
            const renderKey: RenderKey = {
              slice: tx + ty,
              within: tx,
              baseZ: surface.zBase,
              kindOrder: KindOrder.FLOOR,
              stableId: (tx * 73856093 ^ ty * 19349663 ^ (surface.zBase * 100 | 0) * 83492791) + 17,
            };
            addToSlice(tx + ty, renderKey, drawRuntimeSidewalkTopFn, {
              tx,
              ty,
              zBase: surface.zBase,
              anchorY: surface.renderAnchorY ?? ANCHOR_Y,
              family: runtimeTop.family,
              variantIndex: runtimeTop.variantIndex,
              rotationQuarterTurns: runtimeTop.rotationQuarterTurns,
            });
            continue;
          }
          const topRec = tdef.kind === TILE_ID_OCEAN
            ? getAnimatedTileFrame("water1", (w.timeSec ?? w.time ?? 0) * OCEAN_ANIM_TIME_SCALE)
            : (surface.spriteIdTop ? getTileSpriteById(surface.spriteIdTop) : null);
          if (!topRec?.ready || !topRec.img || topRec.img.width <= 0 || topRec.img.height <= 0) continue;

          const topScale = tdef.kind === TILE_ID_OCEAN
            ? OCEAN_TOP_SCALE
            : (isStairTop ? STAIR_TOP_SCALE : FLOOR_TOP_SCALE);
          const oceanProjectionScale = tdef.kind === TILE_ID_OCEAN
            ? topScale * (OCEAN_BASE_FRAME_PX / Math.max(1, Math.max(topRec.img.width, topRec.img.height)))
            : 1;
          const projectedOceanTop = tdef.kind === TILE_ID_OCEAN
            ? getRuntimeIsoDecalCanvas(topRec.img, 0, oceanProjectionScale)
            : null;
          const topImg = projectedOceanTop ?? topRec.img;
          const topW = projectedOceanTop ? topImg.width : (topImg.width * topScale);
          const topH = projectedOceanTop ? topImg.height : (topImg.height * topScale);

          const wx = (tx + 0.5) * T;
          const wy = (ty + 0.5) * T;

          const p = worldToScreen(wx, wy);
          const dx = p.x + camX - topW * 0.5;

          const anchorY = surface.renderAnchorY ?? ANCHOR_Y;
          let dy = p.y + camY - topH * anchorY;

          const h = surface.zBase;
          dy -= h * ELEV_PX;

          // Stair render-height tweak (screen-space)
          if (isStairTop) dy += STAIR_TOP_DY;

          // Deterministic stableId based on tile and surface properties
          const topStableId = tx * 73856093 ^ ty * 19349663 ^ (surface.zBase * 100 | 0) * 83492791;

          const renderKey: RenderKey = {
            slice: tx + ty,
            within: tx,
            baseZ: surface.zBase,
            kindOrder: KindOrder.FLOOR,
            stableId: topStableId,
          };
          addToSlice(tx + ty, renderKey, drawImageTopFn, {
            img: topImg,
            dx,
            dy,
            dw: topW,
            dh: topH,
          });
        }
      }
    }
  }

  // ----------------------------
  // Collect DECALS into slices (after floor, before entities)
  // ----------------------------
  {
    const decals = decalsInView(viewRect);
    for (let i = 0; i < decals.length; i++) {
      const decal = decals[i];
      if (!isTileInRenderRadius(decal.tx, decal.ty)) continue;
      if (!RENDER_ALL_HEIGHTS && decal.zLogical !== activeH) continue;
      const renderKey: RenderKey = {
        slice: decal.tx + decal.ty,
        within: decal.tx,
        baseZ: decal.zBase,
        kindOrder: KindOrder.DECAL,
        stableId: (decal.tx * 73856093 ^ decal.ty * 19349663 ^ (decal.zBase * 100 | 0) * 83492791) + 19,
      };

      addToSlice(decal.tx + decal.ty, renderKey, drawRuntimeDecalTopFn, {
        tx: decal.tx,
        ty: decal.ty,
        zBase: decal.zBase,
        renderAnchorY: decal.renderAnchorY,
        setId: decal.setId,
        variantIndex: decal.variantIndex,
        rotationQuarterTurns: decal.rotationQuarterTurns,
      });
    }
  }

  // ----------------------------
  // Collect ZONE OBJECTIVES into slices (after floor/decals, before entities)
  // ----------------------------
  {
    const zoneTrial = getZoneTrialObjectiveState(w);
    if (zoneTrial && zoneTrial.zones.length > 0) {
      for (let i = 0; i < zoneTrial.zones.length; i++) {
        const zone = zoneTrial.zones[i];
        const absZoneX = compiledMap.originTx + zone.tileX;
        const absZoneY = compiledMap.originTy + zone.tileY;
        const centerTx = absZoneX + Math.floor(zone.tileW * 0.5);
        const centerTy = absZoneY + Math.floor(zone.tileH * 0.5);
        if (!isTileInRenderRadius(centerTx, centerTy)) continue;
        const centerWx = (centerTx + 0.5) * T;
        const centerWy = (centerTy + 0.5) * T;
        const centerZ = tileHAtWorld(centerWx, centerWy);
        const renderKey: RenderKey = {
          slice: centerTx + centerTy,
          within: centerTx,
          baseZ: centerZ,
          kindOrder: KindOrder.ZONE_OBJECTIVE,
          stableId: 210000 + zone.id,
        };

        addToSlice(centerTx + centerTy, renderKey, drawZoneObjectiveFn, { zone });
      }
    }
  }

  // ----------------------------
  // Collect ENTITY SHADOWS into slices (after floor/decals, before entities)
  // ----------------------------
  if (RENDER_ENTITY_SHADOWS) {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
      const zAbs = ez?.[i] ?? tileHAtWorld(ew.wx, ew.wy);
      const support = getSupportSurfaceAt(ew.wx, ew.wy, compiledMap, zAbs);
      const tx = Math.floor(ew.wx / T);
      const ty = Math.floor(ew.wy / T);
      if (!isTileInRenderRadius(tx, ty)) continue;
      const faceDx = w.eFaceX?.[i] ?? 0;
      const faceDy = w.eFaceY?.[i] ?? -1;
      const moving = Math.hypot(w.evx?.[i] ?? 0, w.evy?.[i] ?? 0) > 1e-4;
      const fr = getEnemySpriteFrame({ type: w.eType[i] as any, time: w.time ?? 0, faceDx, faceDy, moving });
      const spriteW = fr ? fr.sw * fr.scale : Math.max(16, (w.eR[i] ?? 10) * 2.4);
      const enemyShadowOffset = resolveEnemyShadowFootOffset(w.eType[i] as any);
      const renderKey: RenderKey = {
        slice: tx + ty,
        within: tx,
        baseZ: support.worldZ,
        feetSortY: support.screenY + camY,
        kindOrder: KindOrder.SHADOW,
        stableId: 220000 + i,
      };
      const shadowParams: ShadowParams = {
        worldX: ew.wx,
        worldY: ew.wy,
        worldZ: zAbs,
        spriteWidth: spriteW,
        shadowFootOffsetX: enemyShadowOffset.x,
        shadowFootOffsetY: enemyShadowOffset.y,
        screenOffsetX: camX,
        screenOffsetY: camY,
      };
      addToSlice(tx + ty, renderKey, drawEntityShadowFn, shadowParams);
      const feet = getEntityFeetPos(ew.wx, ew.wy, zAbs);
      entitySilhouetteMaskDraws.push((maskCtx) => {
        const frSilhouette = getEnemySpriteFrame({
          type: w.eType[i] as any,
          time: w.time ?? 0,
          faceDx,
          faceDy,
          moving,
        });
        if (frSilhouette) {
          const dw = frSilhouette.sw * frSilhouette.scale;
          const dh = frSilhouette.sh * frSilhouette.scale;
          const frAny = frSilhouette as any;
          const anchorX = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any).eAnchorX01?.[i], frAny.anchorX01 ?? frSilhouette.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
            : (frSilhouette.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
          const anchorY = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any).eAnchorY01?.[i], frAny.anchorY01 ?? frSilhouette.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
            : (frSilhouette.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
          const dx = feet.screenX - dw * anchorX;
          const dy = feet.screenY - dh * anchorY;
          maskCtx.drawImage(
            frSilhouette.img,
            frSilhouette.sx,
            frSilhouette.sy,
            frSilhouette.sw,
            frSilhouette.sh,
            Math.round(dx),
            Math.round(dy),
            dw,
            dh,
          );
          return;
        }
        maskCtx.fillStyle = "rgba(255,255,255,1)";
        maskCtx.beginPath();
        maskCtx.ellipse(
          feet.screenX,
          feet.screenY,
          (w.eR[i] ?? 10) * ISO_X,
          (w.eR[i] ?? 10) * ISO_Y,
          0,
          0,
          Math.PI * 2,
        );
        maskCtx.fill();
      });
    }

    for (let i = 0; i < w.npcs.length; i++) {
      const npc = w.npcs[i];
      const zAbs = tileHAtWorld(npc.wx, npc.wy);
      const support = getSupportSurfaceAt(npc.wx, npc.wy, compiledMap, zAbs);
      const tx = Math.floor(npc.wx / T);
      const ty = Math.floor(npc.wy / T);
      if (!isTileInRenderRadius(tx, ty)) continue;
      const fr = vendorNpcSpritesReady()
        ? getVendorNpcSpriteFrame({ dir: npc.dirCurrent, time: w.time ?? 0 })
        : null;
      const spriteW = fr ? fr.sw * fr.scale : 24;
      const vendorShadowOffset = resolveVendorShadowFootOffset(npc.kind);
      const renderKey: RenderKey = {
        slice: tx + ty,
        within: tx,
        baseZ: support.worldZ,
        feetSortY: support.screenY + camY,
        kindOrder: KindOrder.SHADOW,
        stableId: 225000 + i,
      };
      const shadowParams: ShadowParams = {
        worldX: npc.wx,
        worldY: npc.wy,
        worldZ: zAbs,
        spriteWidth: spriteW,
        shadowRadiusX: npc.shadowRadiusX,
        shadowRadiusY: npc.shadowRadiusY,
        castsShadow: npc.castsShadow,
        shadowFootOffsetX: vendorShadowOffset.x,
        shadowFootOffsetY: vendorShadowOffset.y,
        screenOffsetX: camX,
        screenOffsetY: camY,
      };
      addToSlice(tx + ty, renderKey, drawEntityShadowFn, shadowParams);
      const feet = getEntityFeetPos(npc.wx, npc.wy, zAbs);
      entitySilhouetteMaskDraws.push((maskCtx) => {
        const frSilhouette = vendorNpcSpritesReady()
          ? getVendorNpcSpriteFrame({ dir: npc.dirCurrent, time: w.time ?? 0 })
          : null;
        if (!frSilhouette) return;
        const dw = frSilhouette.sw * frSilhouette.scale;
        const dh = frSilhouette.sh * frSilhouette.scale;
        const frAny = frSilhouette as any;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((npc as any).anchorX01, frAny.anchorX01 ?? frSilhouette.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (frSilhouette.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((npc as any).anchorY01, frAny.anchorY01 ?? frSilhouette.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (frSilhouette.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
        const dx = feet.screenX - dw * anchorX;
        const dy = feet.screenY - dh * anchorY;
        maskCtx.drawImage(
          frSilhouette.img,
          frSilhouette.sx,
          frSilhouette.sy,
          frSilhouette.sw,
          frSilhouette.sh,
          Math.round(dx),
          Math.round(dy),
          dw,
          dh,
        );
      });
    }

    for (let i = 0; i < w.neutralMobs.length; i++) {
      const mob = w.neutralMobs[i];
      const zGround = tileHAtWorld(mob.pos.wx, mob.pos.wy);
      const zAbs = zGround + (mob.pos.wzOffset ?? 0);
      const support = getSupportSurfaceAt(mob.pos.wx, mob.pos.wy, compiledMap, zAbs);
      const tx = Math.floor(mob.pos.wx / T);
      const ty = Math.floor(mob.pos.wy / T);
      if (!isTileInRenderRadius(tx, ty)) continue;
      const frameCount = mob.spriteFrames.length;
      const frame = frameCount > 0 ? mob.spriteFrames[mob.anim.frameIndex % frameCount] : null;
      const spriteW = frame ? frame.width * mob.render.scale : 24;
      const neutralShadowOffset = resolveNeutralShadowFootOffset(mob.kind);
      const renderKey: RenderKey = {
        slice: tx + ty,
        within: tx,
        baseZ: support.worldZ,
        feetSortY: support.screenY + camY,
        kindOrder: KindOrder.SHADOW,
        stableId: 226000 + i,
      };
      const shadowParams: ShadowParams = {
        worldX: mob.pos.wx,
        worldY: mob.pos.wy,
        worldZ: zAbs,
        spriteWidth: spriteW,
        shadowRadiusX: mob.shadowRadiusX,
        shadowRadiusY: mob.shadowRadiusY,
        castsShadow: mob.castsShadow,
        shadowFootOffsetX: neutralShadowOffset.x,
        shadowFootOffsetY: neutralShadowOffset.y,
        screenOffsetX: camX,
        screenOffsetY: camY,
      };
      addToSlice(tx + ty, renderKey, drawEntityShadowFn, shadowParams);
      const feet = getEntityFeetPos(mob.pos.wx, mob.pos.wy, zAbs);
      entitySilhouetteMaskDraws.push((maskCtx) => {
        const frameCountSilhouette = mob.spriteFrames.length;
        if (frameCountSilhouette <= 0) return;
        const frameSilhouette = mob.spriteFrames[mob.anim.frameIndex % frameCountSilhouette];
        if (!frameSilhouette || frameSilhouette.width <= 0 || frameSilhouette.height <= 0) return;
        const dw = frameSilhouette.width * mob.render.scale;
        const dh = frameSilhouette.height * mob.render.scale;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((mob.render as any).anchorX01, mob.render.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (mob.render.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((mob.render as any).anchorY01, mob.render.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (mob.render.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
        const dx = feet.screenX - dw * anchorX;
        const dy = feet.screenY - dh * anchorY;
        if (mob.render.flipX) {
          maskCtx.save();
          maskCtx.translate(snapPx(dx + dw), snapPx(dy));
          maskCtx.scale(-1, 1);
          maskCtx.drawImage(frameSilhouette, 0, 0, dw, dh);
          maskCtx.restore();
          return;
        }
        maskCtx.drawImage(frameSilhouette, snapPx(dx), snapPx(dy), dw, dh);
      });
    }

    {
      const pzAbs = w.pzVisual ?? w.pz ?? tileHAtWorld(px, py);
      const support = getSupportSurfaceAt(px, py, compiledMap, pzAbs);
      const tx = Math.floor(px / T);
      const ty = Math.floor(py / T);
      const dir = ((w as any)._plDir ?? "N") as Dir8;
      const moving = (w as any)._plMoving ?? false;
      const fr = playerSpritesReady()
        ? getPlayerSpriteFrame({ dir, moving, time: w.time ?? 0 })
        : null;
      const spriteW = fr ? fr.sw * fr.scale : Math.max(16, PLAYER_R * 2.4);
      const playerSkin = getPlayerSkin();
      const playerShadowOffset = resolvePlayerShadowFootOffset(playerSkin);
      const renderKey: RenderKey = {
        slice: tx + ty,
        within: tx,
        baseZ: support.worldZ,
        feetSortY: support.screenY + camY,
        kindOrder: KindOrder.SHADOW,
        stableId: 200001,
      };
      const shadowParams: ShadowParams = {
        worldX: px,
        worldY: py,
        worldZ: pzAbs,
        spriteWidth: spriteW,
        shadowFootOffsetX: playerShadowOffset.x,
        shadowFootOffsetY: playerShadowOffset.y,
        screenOffsetX: camX,
        screenOffsetY: camY,
      };
      addToSlice(tx + ty, renderKey, drawEntityShadowFn, shadowParams);
      const feet = getEntityFeetPos(px, py, pzAbs);
      entitySilhouetteMaskDraws.push((maskCtx) => {
        const dirSilhouette = ((w as any)._plDir ?? "N") as Dir8;
        const movingSilhouette = (w as any)._plMoving ?? false;
        const frSilhouette = playerSpritesReady()
          ? getPlayerSpriteFrame({ dir: dirSilhouette, moving: movingSilhouette, time: w.time ?? 0 })
          : null;
        if (frSilhouette) {
          const dw = frSilhouette.sw * frSilhouette.scale;
          const dh = frSilhouette.sh * frSilhouette.scale;
          const frAny = frSilhouette as any;
          const anchorX = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any)._plAnchorX01, frAny.anchorX01 ?? frSilhouette.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
            : (frSilhouette.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
          const anchorY = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any)._plAnchorY01, frAny.anchorY01 ?? frSilhouette.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
            : (frSilhouette.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
          const dx = Math.round(feet.screenX - dw * anchorX);
          const dy = Math.round(feet.screenY - dh * anchorY);
          maskCtx.drawImage(
            frSilhouette.img,
            frSilhouette.sx,
            frSilhouette.sy,
            frSilhouette.sw,
            frSilhouette.sh,
            dx,
            dy,
            dw,
            dh,
          );
          return;
        }
        maskCtx.fillStyle = "rgba(255,255,255,1)";
        maskCtx.beginPath();
        maskCtx.ellipse(feet.screenX, feet.screenY, PLAYER_R * ISO_X, PLAYER_R * ISO_Y, 0, 0, Math.PI * 2);
        maskCtx.fill();
      });
    }
  }

  // ----------------------------
  // Collect ZONES into slices
  // ----------------------------
  {
    for (let i = 0; i < w.zAlive.length; i++) {
      if (!w.zAlive[i]) continue;

      const zp0 = getZoneWorld(w, i, KENNEY_TILE_WORLD);
      const zx0 = zp0.wx;
      const zy0 = zp0.wy;

      const sn = snapToNearestWalkableGround(zx0, zy0);
      const zx = sn.x;
      const zy = sn.y;
      const groundZ = sn.z;

      // Determine zone's anchor tile
      const ztx = Math.floor(zx / T);
      const zty = Math.floor(zy / T);
      if (!isTileInRenderRadius(ztx, zty)) continue;
      const zSlice = ztx + zty;

      const renderKey: RenderKey = {
        slice: zSlice,
        within: ztx,
        baseZ: groundZ,
        kindOrder: KindOrder.ENTITY,
        stableId: 100000 + i,
      };

      const kind = w.zKind[i];
      const r = w.zR[i];

      const drawClosure = () => {
        const p = toScreen(zx, zy);
        const rx = r * ISO_X;
        const ry = r * ISO_Y;

        if (kind === ZONE_KIND.AURA) {
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = "#7bdcff";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = 0.28;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx * 0.98, ry * 0.98, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.globalAlpha = 1;
        } else if (kind === ZONE_KIND.FIRE) {
          const fvfxArr = ((w as any)._fireZoneVfx ?? []) as (FireZoneVfx | null)[];
          const fvfx = fvfxArr[i];
          if (fvfx) {
            renderFireZoneVfx(ctx, fvfx, toScreen, getSpriteById, ISO_X, ISO_Y);
          } else {
            // Fallback: flat rendering if VFX data missing
            const pulse = 0.85 + 0.15 * Math.sin((w.time ?? 0) * 7 + i * 0.37);
            ctx.globalAlpha = 0.26 * pulse;
            ctx.fillStyle = "#ff3a2e";
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      };

      addToSlice(zSlice, renderKey, drawClosure);
    }
  }

  // ----------------------------
  // Collect VFX into slices
  // ----------------------------
  {
    for (let i = 0; i < w.vfxAlive.length; i++) {
      if (!w.vfxAlive[i]) continue;
      const vx = w.vfxX[i];
      const vy = w.vfxY[i];

      const vtx = Math.floor(vx / T);
      const vty = Math.floor(vy / T);
      if (!isTileInRenderRadius(vtx, vty)) continue;
      const vZ = tileHAtWorld(vx, vy);

      const renderKey: RenderKey = {
        slice: vtx + vty,
        within: vtx,
        baseZ: vZ,
        kindOrder: KindOrder.VFX,
        stableId: 200000 + i,
      };

      const drawClosure = () => {
        const clip = VFX_CLIPS[w.vfxClipId[i]];
        const rawFrame = Math.floor(w.vfxElapsed[i] * clip.fps);
        const frameIndex = clip.loop
          ? rawFrame % clip.spriteIds.length
          : Math.min(clip.spriteIds.length - 1, rawFrame);
        const sprite = getSpriteById(clip.spriteIds[frameIndex]);
        if (!sprite.ready) return;
        const scale = w.vfxRadius[i] > 0 ? w.vfxRadius[i] / 32 : w.vfxScale[i];
        const size = 64 * scale;
        const p = toScreen(w.vfxX[i], w.vfxY[i]);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite.img, p.x - size / 2, p.y - size / 2 + w.vfxOffsetYPx[i], size, size);
      };

      addToSlice(vtx + vty, renderKey, drawClosure);
    }
  }

  // ----------------------------
  // Collect PICKUPS into slices
  // ----------------------------
  {
    for (let i = 0; i < w.xAlive.length; i++) {
      if (!w.xAlive[i]) continue;

      const pickup = getPickupWorld(w, i, KENNEY_TILE_WORLD);
      const xtx = Math.floor(pickup.wx / T);
      const xty = Math.floor(pickup.wy / T);
      if (!isTileInRenderRadius(xtx, xty)) continue;
      const zAbs = tileHAtWorld(pickup.wx, pickup.wy);

      const renderKey: RenderKey = {
        slice: xtx + xty,
        within: xtx,
        baseZ: zAbs,
        kindOrder: KindOrder.ENTITY,
        stableId: 110000 + i,
      };

      const kind = w.xKind?.[i] ?? 1;
      const p = toScreen(pickup.wx, pickup.wy);

      const drawClosure = () => {
        if (kind === 1) {
          const value = Math.max(1, Math.floor(w.xValue?.[i] ?? 1));
          const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(p.x, p.y);
          const sprite = getCurrencyFrame(value, w.time ?? 0);
          if (sprite.ready) {
            const S = 16;
            ctx.globalAlpha = 1;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sprite.img, p.x - S / 2, p.y - S / 2, S, S);
            if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
              const litSprite = getCurrencyFrameForDarknessPercent(
                value,
                w.time ?? 0,
                dynamicSpriteRelightFrame.targetDarknessBucket,
              );
              if (litSprite.ready) {
                ctx.save();
                ctx.globalAlpha = dynamicRelightAlpha;
                ctx.drawImage(litSprite.img, p.x - S / 2, p.y - S / 2, S, S);
                ctx.restore();
              }
            }
          } else {
            const fill = coinColorFromValue(value);
            ctx.globalAlpha = 1;
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fdc";
          ctx.fillRect(p.x - 10, p.y - 8, 20, 16);

          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x - 10, p.y - 8, 20, 16);

          ctx.strokeStyle = "#b85";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x - 10, p.y);
          ctx.lineTo(p.x + 10, p.y);
          ctx.stroke();
        }
      };

      addToSlice(xtx + xty, renderKey, drawClosure);
    }
  }

  // ----------------------------
  // Collect ENEMIES into slices
  // ----------------------------
  {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;

      const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
      const etx = Math.floor(ew.wx / T);
      const ety = Math.floor(ew.wy / T);
      if (!isTileInRenderRadius(etx, ety)) continue;
      const zAbs = ez?.[i] ?? tileHAtWorld(ew.wx, ew.wy);
      const feet = getEntityFeetPos(ew.wx, ew.wy, zAbs);

      const renderKey: RenderKey = {
        slice: feet.slice,
        within: feet.within,
        baseZ: zAbs,
        feetSortY: feet.screenY,
        kindOrder: KindOrder.ENTITY,
        stableId: 120000 + i,
      };

      const def = registry.enemy(w.eType[i] as any);
      let baseColor: string = (def as any).color ?? "#f66";

      const isBoss = w.eType[i] === ENEMY_TYPE.BOSS;
      if (isBoss) baseColor = getBossAccent(w) ?? baseColor;

      const drawClosure = () => {
        const faceDx = w.eFaceX?.[i] ?? 0;
        const faceDy = w.eFaceY?.[i] ?? -1;
        const moving = Math.hypot(w.evx?.[i] ?? 0, w.evy?.[i] ?? 0) > 1e-4;
        const isLootGoblin = w.eType[i] === ENEMY_TYPE.LOOT_GOBLIN;

        if (isLootGoblin) {
          const pulse =
            LOOT_GOBLIN_GLOW_PULSE_MIN
            + LOOT_GOBLIN_GLOW_PULSE_RANGE * (0.5 + 0.5 * Math.sin((w.time ?? 0) * LOOT_GOBLIN_GLOW_PULSE_SPEED + i * 0.37));
          const enemyR = Math.max(8, w.eR[i] ?? 10);
          const outerRx = enemyR * ISO_X * LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT;
          const outerRy = enemyR * ISO_Y * LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT;
          const innerR = Math.max(1, enemyR * LOOT_GOBLIN_GLOW_INNER_RADIUS_MULT);
          const glow = ctx.createRadialGradient(
            feet.screenX,
            feet.screenY - enemyR * 0.25,
            innerR,
            feet.screenX,
            feet.screenY,
            Math.max(outerRx, outerRy),
          );
          glow.addColorStop(0, `rgba(255, 244, 178, ${0.42 * pulse})`);
          glow.addColorStop(0.55, `rgba(255, 215, 90, ${0.24 * pulse})`);
          glow.addColorStop(1, "rgba(255, 180, 60, 0)");
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.ellipse(feet.screenX, feet.screenY, outerRx, outerRy, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.45 * pulse;
          ctx.strokeStyle = "rgba(255, 214, 96, 0.95)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(feet.screenX, feet.screenY, outerRx * 0.92, outerRy * 0.92, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        const fr = getEnemySpriteFrame({
          type: w.eType[i] as any,
          time: w.time ?? 0,
          faceDx,
          faceDy,
          moving,
        });
        const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);

        if (fr) {
          const dw = fr.sw * fr.scale;
          const dh = fr.sh * fr.scale;
          const frAny = fr as any;
          const anchorX = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any).eAnchorX01?.[i], frAny.anchorX01 ?? fr.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
            : (fr.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
          const anchorY = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any).eAnchorY01?.[i], frAny.anchorY01 ?? fr.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
            : (fr.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);

          const dx = feet.screenX - dw * anchorX;
          const dy = feet.screenY - dh * anchorY;

          ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, Math.round(dx), Math.round(dy), dw, dh);
          if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
            const litFrame = getEnemySpriteFrameForDarknessPercent({
              type: w.eType[i] as any,
              time: w.time ?? 0,
              faceDx,
              faceDy,
              moving,
              darknessPercent: dynamicSpriteRelightFrame.targetDarknessBucket,
            });
            if (litFrame) {
              ctx.save();
              ctx.globalAlpha = dynamicRelightAlpha;
              ctx.drawImage(litFrame.img, litFrame.sx, litFrame.sy, litFrame.sw, litFrame.sh, Math.round(dx), Math.round(dy), dw, dh);
              ctx.restore();
            }
          }
          drawEntityAnchorOverlay(feet.screenX, feet.screenY, dx, dy, dw, dh);
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = baseColor;
          ctx.beginPath();
          ctx.ellipse(feet.screenX, feet.screenY, (w.eR[i] ?? 10) * ISO_X, (w.eR[i] ?? 10) * ISO_Y, 0, 0, Math.PI * 2);
          ctx.fill();
          drawEntityAnchorOverlay(feet.screenX, feet.screenY, feet.screenX - 8, feet.screenY - 8, 16, 16);
        }

        if (isBoss) {
          const pulse = 0.5 + 0.5 * Math.sin((w.time ?? 0) * 2.5);

          ctx.globalAlpha = 0.18 + pulse * 0.12;
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(
              feet.screenX,
              feet.screenY,
              (w.eR[i] ?? 10) * (1.25 + pulse * 0.05) * ISO_X,
              (w.eR[i] ?? 10) * (1.25 + pulse * 0.05) * ISO_Y,
              0,
              0,
              Math.PI * 2
          );
          ctx.stroke();

          ctx.globalAlpha = 0.28;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(feet.screenX, feet.screenY, (w.eR[i] ?? 10) * 1.55 * ISO_X, (w.eR[i] ?? 10) * 1.55 * ISO_Y, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.globalAlpha = 1;
        }



      };

      addToSlice(feet.slice, renderKey, drawClosure);
    }
  }

  // ----------------------------
  // Collect NPCS into slices
  // ----------------------------
  {
    for (let i = 0; i < w.npcs.length; i++) {
      const npc = w.npcs[i];
      const ntx = Math.floor(npc.wx / T);
      const nty = Math.floor(npc.wy / T);
      if (!isTileInRenderRadius(ntx, nty)) continue;
      const zAbs = tileHAtWorld(npc.wx, npc.wy);
      const feet = getEntityFeetPos(npc.wx, npc.wy, zAbs);

      const renderKey: RenderKey = {
        slice: feet.slice,
        within: feet.within,
        baseZ: zAbs,
        feetSortY: feet.screenY,
        kindOrder: KindOrder.ENTITY,
        stableId: 125000 + i,
      };

      const drawClosure = () => {
        const fr = vendorNpcSpritesReady()
          ? getVendorNpcSpriteFrame({ dir: npc.dirCurrent, time: w.time ?? 0 })
          : null;
        if (!fr) return;
        const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);
        const dw = fr.sw * fr.scale;
        const dh = fr.sh * fr.scale;
        const frAny = fr as any;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((npc as any).anchorX01, frAny.anchorX01 ?? fr.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (fr.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((npc as any).anchorY01, frAny.anchorY01 ?? fr.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (fr.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
        const dx = feet.screenX - dw * anchorX;
        const dy = feet.screenY - dh * anchorY;
        ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, Math.round(dx), Math.round(dy), dw, dh);
        if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
          const litFrame = getVendorNpcSpriteFrameForDarknessPercent({
            dir: npc.dirCurrent,
            time: w.time ?? 0,
            darknessPercent: dynamicSpriteRelightFrame.targetDarknessBucket,
          });
          if (litFrame) {
            ctx.save();
            ctx.globalAlpha = dynamicRelightAlpha;
            ctx.drawImage(litFrame.img, litFrame.sx, litFrame.sy, litFrame.sw, litFrame.sh, Math.round(dx), Math.round(dy), dw, dh);
            ctx.restore();
          }
        }
        drawEntityAnchorOverlay(feet.screenX, feet.screenY, dx, dy, dw, dh);
      };

      addToSlice(feet.slice, renderKey, drawClosure);
    }
  }

  // ----------------------------
  // Collect NEUTRAL MOBS into slices
  // ----------------------------
  {
    for (let i = 0; i < w.neutralMobs.length; i++) {
      const mob = w.neutralMobs[i];
      const mtx = Math.floor(mob.pos.wx / T);
      const mty = Math.floor(mob.pos.wy / T);
      if (!isTileInRenderRadius(mtx, mty)) continue;
      const zGround = tileHAtWorld(mob.pos.wx, mob.pos.wy);
      const zAbs = zGround + (mob.pos.wzOffset ?? 0);
      const feet = getEntityFeetPos(mob.pos.wx, mob.pos.wy, zAbs);

      const renderKey: RenderKey = {
        slice: feet.slice,
        within: feet.within,
        baseZ: zAbs,
        feetSortY: feet.screenY,
        kindOrder: KindOrder.ENTITY,
        stableId: 127000 + i,
      };
      const drawClosure = () => {
        const frameCount = mob.spriteFrames.length;
        if (frameCount <= 0) return;
        const frame = mob.spriteFrames[mob.anim.frameIndex % frameCount];
        if (!frame || frame.width <= 0 || frame.height <= 0) return;
        const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);

        const dw = frame.width * mob.render.scale;
        const dh = frame.height * mob.render.scale;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((mob.render as any).anchorX01, mob.render.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (mob.render.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((mob.render as any).anchorY01, mob.render.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (mob.render.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
        const dx = feet.screenX - dw * anchorX;
        const dy = feet.screenY - dh * anchorY;
        if (mob.render.flipX) {
          ctx.save();
          ctx.translate(snapPx(dx + dw), snapPx(dy));
          ctx.scale(-1, 1);
          ctx.drawImage(frame, 0, 0, dw, dh);
          ctx.restore();
        } else {
          ctx.drawImage(frame, snapPx(dx), snapPx(dy), dw, dh);
        }
        if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
          const litFrames = getPigeonFramesForClipAndScreenDirForDarknessPercent(
            mob.anim.clip,
            mob.render.screenDir,
            dynamicSpriteRelightFrame.targetDarknessBucket,
          );
          if (litFrames.length > 0) {
            const litFrame = litFrames[mob.anim.frameIndex % litFrames.length];
            if (litFrame) {
              ctx.save();
              ctx.globalAlpha = dynamicRelightAlpha;
              if (mob.render.flipX) {
                ctx.translate(snapPx(dx + dw), snapPx(dy));
                ctx.scale(-1, 1);
                ctx.drawImage(litFrame, 0, 0, dw, dh);
              } else {
                ctx.drawImage(litFrame, snapPx(dx), snapPx(dy), dw, dh);
              }
              ctx.restore();
            }
          }
        }

        drawEntityAnchorOverlay(feet.screenX, feet.screenY, dx, dy, dw, dh);

        if (!mob.debug.renderLogged) {
          mob.debug.renderLogged = true;
        }

        if (debug.neutralBirdAI.drawDebug) {
          const targetWx = (mob.behavior.targetTileX + 0.5) * T;
          const targetWy = (mob.behavior.targetTileY + 0.5) * T;
          const targetZ = tileHAtWorld(targetWx, targetWy);
          const targetP = toScreenAtZ(targetWx, targetWy, targetZ);
          const dPlayerTiles = Math.sqrt(Math.max(0, mob.behavior.lastPlayerDist2));
          const dTargetTiles = Math.sqrt(Math.max(0, mob.behavior.lastTargetDist2));
          const lines = [
            "PIGEON",
            `STATE: ${mob.behavior.state}`,
            `dPlayer: ${dPlayerTiles.toFixed(1)}`,
            `target: (${mob.behavior.targetTileX},${mob.behavior.targetTileY})`,
            `dTarget: ${dTargetTiles.toFixed(1)}`,
          ];
          ctx.save();
          ctx.font = "10px monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          const tx = snapPx(dx);
          const ty = snapPx(dy - 4);
          const pad = 2;
          let tw = 0;
          for (let li = 0; li < lines.length; li++) {
            tw = Math.max(tw, ctx.measureText(lines[li]).width);
          }
          const lineH = 11;
          const th = lineH * lines.length;
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(tx - pad, ty - th - pad, tw + pad * 2, th + pad * 2);
          ctx.fillStyle = "#8fffb0";
          for (let li = 0; li < lines.length; li++) {
            const ly = ty - lineH * (lines.length - 1 - li);
            ctx.fillText(lines[li], tx, ly);
          }

          ctx.strokeStyle = "#8fffb0";
          ctx.lineWidth = 1;
          const r = 5;
          ctx.beginPath();
          ctx.moveTo(targetP.x - r, targetP.y);
          ctx.lineTo(targetP.x + r, targetP.y);
          ctx.moveTo(targetP.x, targetP.y - r);
          ctx.lineTo(targetP.x, targetP.y + r);
          ctx.stroke();
          ctx.restore();
        }
      };

      addToSlice(feet.slice, renderKey, drawClosure);
    }
  }

  // ----------------------------
  // Collect PROJECTILES into slices (as VFX, not special cased anymore)
  // ----------------------------
  {
    for (let i = 0; i < w.pAlive.length; i++) {
      if (!w.pAlive[i]) continue;
      if (w.prHidden?.[i]) continue;

      const pp = getProjectileWorld(w, i, KENNEY_TILE_WORLD);
      const ptx = Math.floor(pp.wx / T);
      const pty = Math.floor(pp.wy / T);
      const firePlayerX = w.prPlayerFireX?.[i] ?? px;
      const firePlayerY = w.prPlayerFireY?.[i] ?? py;
      const firePlayerTx = Math.floor(firePlayerX / T);
      const firePlayerTy = Math.floor(firePlayerY / T);
      const inCurrentPlayerRange =
        Math.abs(ptx - playerTxForProjectileCull) <= projectileTileRenderRadius
        && Math.abs(pty - playerTyForProjectileCull) <= projectileTileRenderRadius;
      const inFirePlayerRange =
        Math.abs(ptx - firePlayerTx) <= projectileTileRenderRadius
        && Math.abs(pty - firePlayerTy) <= projectileTileRenderRadius;
      if (!inCurrentPlayerRange && !inFirePlayerRange) continue;
      const baseH = tileHAtWorld(pp.wx, pp.wy);
      const pzAbs = (w.prZVisual?.[i] ?? w.prZ?.[i] ?? baseH) || 0;
      const support = getSupportSurfaceAt(pp.wx, pp.wy, compiledMap, pzAbs);
      const feet = getEntityFeetPos(pp.wx, pp.wy, pzAbs);

      const renderKey: RenderKey = {
        slice: ptx + pty,
        within: ptx,
        baseZ: support.worldZ,
        feetSortY: feet.screenY,
        kindOrder: KindOrder.VFX,
        stableId: 130000 + i,
      };

      const zLift = (pzAbs - baseH) * ELEV_PX;
      const p = toScreen(pp.wx, pp.wy);

      // Spark projectile: dedicated VFX clip rendering, skip generic path entirely
      if (w.prjKind[i] === PRJ_KIND.SPARK) {
        const drawSpark = () => {
          const clip = VFX_CLIPS[VFX_CLIP_INDEX.LIGHTNING_PROJ];
          if (!clip) return;
          const elapsed = (3.0 - (w.prTtl[i] ?? 0));
          const rawFrame = Math.floor(elapsed * clip.fps);
          const frameIdx = rawFrame % clip.spriteIds.length;
          const sprite = getSpriteById(clip.spriteIds[frameIdx]);
          if (!sprite.ready) return;
          const wdx = w.prDirX[i] ?? 1;
          const wdy = w.prDirY[i] ?? 0;
          const sd = worldDeltaToScreen(wdx, wdy);
          const ang = Math.atan2(sd.dy, sd.dx);
          const size = 32;
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.imageSmoothingEnabled = false;
          ctx.translate(snapPx(p.x), snapPx(p.y - zLift));
          ctx.rotate(ang);
          ctx.drawImage(sprite.img, -size / 2, -size / 2, size, size);
          ctx.restore();
        };
        addToSlice(ptx + pty, renderKey, drawSpark);
        continue;
      }

      const spr = getProjectileSpriteByKind(w.prjKind[i]);

      const drawClosure = () => {
        const px = p.x;
        const py = p.y - zLift;

        // Shadow
        {
          const r = w.prR[i] ?? 4;

          const wx0 = pp.wx;
          const wy0 = pp.wy;
          const sn = snapToNearestWalkableGround(wx0, wy0);

          const sx = sn.x;
          const sy = sn.y;

          const sp = toScreen(sx, sy);
          const projectileShadowOffset = resolveProjectileShadowFootOffset(w.prjKind[i]);

          const lift = Math.max(0, zLift || 0);
          const t = Math.max(0, Math.min(1, 1 - lift / 70));

          const rx = r * ISO_X * (0.95 + 0.15 * t);
          const ry = r * ISO_Y * (0.85 + 0.1 * t);

          ctx.save();
          ctx.globalAlpha = 0.18 * t;
          ctx.fillStyle = "#000";
          ctx.beginPath();
          ctx.ellipse(
            sp.x + projectileShadowOffset.x,
            sp.y + projectileShadowOffset.y,
            rx,
            ry,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.restore();
        }

        const wdx = w.prDirX[i] ?? 1;
        const wdy = w.prDirY[i] ?? 0;
        const d = worldDeltaToScreen(wdx, wdy);
        const ang = Math.atan2(d.dy, d.dx);

        if (spr?.ready && spr.img && spr.img.width > 0 && spr.img.height > 0) {
          const areaMult = Math.max(0.6, Math.min(2.5, (w.prR[i] ?? 4) / 4));
          const target = PROJECTILE_BASE_DRAW_PX * areaMult * getProjectileDrawScale(w.prjKind[i]);

          const iw = spr.img.width;
          const ih = spr.img.height;

          const scale = target / Math.max(iw, ih);
          const dw = iw * scale;
          const dh = ih * scale;

          // Draw bazooka exhaust follower(s) before projectile so flame stays behind.
          const followers = (w as any).exhaustFollower as Record<number, { kind: string; targetEntity: number }> | undefined;
          const followerFrames = (w as any).exhaustFollowerFrame as Record<number, HTMLImageElement | null> | undefined;
          if (followers && followerFrames) {
            for (const eidKey of Object.keys(followers)) {
              const eid = Number(eidKey);
              const follower = followers[eid];
              if (!follower || follower.kind !== "bazooka_exhaust" || follower.targetEntity !== i) continue;
              const frame = followerFrames[eid];
              if (!frame || !frame.complete || frame.naturalWidth <= 0 || frame.naturalHeight <= 0) continue;

              const [anchorX, anchorY] = bazookaExhaustAssets.spec.anchorExhaust;
              const ax = (anchorX + BAZOOKA_EXHAUST_OFFSET.x) * scale;
              const ay = (anchorY + BAZOOKA_EXHAUST_OFFSET.y) * scale;
              const exhaustScale = scale * 0.5;
              const fw = frame.naturalWidth * exhaustScale;
              const fh = frame.naturalHeight * exhaustScale;
              const exhaustAng = ang + Math.PI * 0.5; // 90deg clockwise alignment fix

              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.globalAlpha = 0.95;
              ctx.translate(snapPx(px), snapPx(py));
              ctx.rotate(exhaustAng);
              ctx.drawImage(frame, snapPx(ax - fw * 0.5), snapPx(ay - fh * 0.5), fw, fh);
              ctx.restore();
            }
          }

          ctx.save();
          ctx.translate(snapPx(px), snapPx(py));
          ctx.rotate(ang);
          ctx.drawImage(spr.img, snapPx(-dw * 0.5), snapPx(-dh * 0.5), dw, dh);
          ctx.restore();
        } else {
          const src = registry.projectileSourceFromKind(w.prjKind[i]);
          ctx.fillStyle =
              src === "KNIFE"
                  ? "#fff"
                  : src === "PISTOL"
                      ? "#9f9"
                      : src === "KNUCKLES"
                          ? "#fc6"
                          : src === "SYRINGE"
                              ? "#7df"
                              : src === "BOUNCER"
                                  ? "#fdc"
                                  : "#bbb";

          ctx.beginPath();
          ctx.ellipse(px, py, (w.prR[i] ?? 4) * ISO_X, (w.prR[i] ?? 4) * ISO_Y, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      addToSlice(ptx + pty, renderKey, drawClosure);
    }
  }

  // ----------------------------
  // Collect PLAYER BEAM into slices
  // ----------------------------
  if (w.playerBeamActive) {
    const zBase = w.pzVisual ?? w.pz ?? tileHAtWorld(w.playerBeamStartX, w.playerBeamStartY);
    const BEAM_HEAD_LIFT_Z = 3;
    const start = toScreenAtZ(w.playerBeamStartX, w.playerBeamStartY, zBase + BEAM_HEAD_LIFT_Z);
    const end = toScreenAtZ(w.playerBeamEndX, w.playerBeamEndY, zBase);
    const midX = (w.playerBeamStartX + w.playerBeamEndX) * 0.5;
    const midY = (w.playerBeamStartY + w.playerBeamEndY) * 0.5;
    const feet = getEntityFeetPos(midX, midY, zBase);

    const renderKey: RenderKey = {
      slice: feet.slice,
      within: feet.within,
      baseZ: zBase,
      feetSortY: feet.screenY,
      kindOrder: KindOrder.VFX,
      stableId: 129500,
    };

    const drawClosure = () => {
      const glow = Math.max(0, w.playerBeamGlowIntensity || 0);
      const beamWidth = Math.max(1, w.playerBeamWidthPx || 6);
      const ax = start.x;
      const ay = start.y;
      const bx = end.x;
      const by = end.y;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      ctx.strokeStyle = `rgba(255, 90, 90, ${0.20 + 0.25 * glow})`;
      ctx.lineWidth = beamWidth * 2.6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 120, 120, ${0.40 + 0.35 * glow})`;
      ctx.lineWidth = beamWidth * 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -(w.playerBeamUvOffset * 20);
      ctx.strokeStyle = "rgba(255, 220, 220, 0.95)";
      ctx.lineWidth = beamWidth * 0.7;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = `rgba(255, 170, 170, ${0.40 + 0.30 * glow})`;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(2, beamWidth * 0.9), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    addToSlice(feet.slice, renderKey, drawClosure);
  }

  // ----------------------------
  // Collect PLAYER into slices
  // ----------------------------
  {
    const pzAbs2 = w.pzVisual ?? w.pz ?? tileHAtWorld(px, py);
    const feet = getEntityFeetPos(px, py, pzAbs2);

    const renderKey: RenderKey = {
      slice: feet.slice,
      within: feet.within,
      baseZ: pzAbs2,
      feetSortY: feet.screenY,
      kindOrder: KindOrder.ENTITY,
      stableId: 0,
    };

    const drawClosure = () => {
      ctx.globalAlpha = 1;

      const dir = ((w as any)._plDir ?? "N") as Dir8;
      const moving = (w as any)._plMoving ?? false;
      const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);
      const fr = playerSpritesReady()
        ? getPlayerSpriteFrame({ dir, moving, time: w.time ?? 0 })
        : null;

      if (fr) {
        const dw = fr.sw * fr.scale;
        const dh = fr.sh * fr.scale;
        const frAny = fr as any;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((w as any)._plAnchorX01, frAny.anchorX01 ?? fr.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (fr.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((w as any)._plAnchorY01, frAny.anchorY01 ?? fr.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (fr.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);

        const dx = Math.round(feet.screenX - dw * anchorX);
        const dy = Math.round(feet.screenY - dh * anchorY);

        ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, dx, dy, dw, dh);
        if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
          const litFrame = getPlayerSpriteFrameForDarknessPercent({
            dir,
            moving,
            time: w.time ?? 0,
            darknessPercent: dynamicSpriteRelightFrame.targetDarknessBucket,
          });
          if (litFrame) {
            ctx.save();
            ctx.globalAlpha = dynamicRelightAlpha;
            ctx.drawImage(litFrame.img, litFrame.sx, litFrame.sy, litFrame.sw, litFrame.sh, dx, dy, dw, dh);
            ctx.restore();
          }
        }
        drawEntityAnchorOverlay(feet.screenX, feet.screenY, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#eaeaf2";
        ctx.beginPath();
        ctx.ellipse(feet.screenX, feet.screenY, PLAYER_R * ISO_X, PLAYER_R * ISO_Y, 0, 0, Math.PI * 2);
        ctx.fill();
        drawEntityAnchorOverlay(feet.screenX, feet.screenY, feet.screenX - 8, feet.screenY - 8, 16, 16);
      }
    };

    addToSlice(feet.slice, renderKey, drawClosure);
  }

  // ----------------------------
  // Collect LIGHT render pieces into slices
  // ----------------------------
  {
    const lightRenderPieces: WorldLightRenderPiece[] = worldLightRegistry.renderPieces;
    for (let li = 0; li < lightRenderPieces.length; li++) {
      const lightPiece = lightRenderPieces[li];
      const renderKey: RenderKey = {
        slice: lightPiece.slice,
        within: lightPiece.within,
        baseZ: lightPiece.baseZ,
        kindOrder: KindOrder.LIGHT,
        stableId: lightPiece.stableId,
      };
      addToSlice(lightPiece.slice, renderKey, drawPendingLightRenderPieceFn, lightPiece);
    }
  }

  // ----------------------------
  // Collect non-wall FACE pieces into slices
  // ----------------------------
  {
    const allFaces: RenderPiece[] = [];
    const layers = facePieceLayers();
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const list = facePiecesInViewForLayer(layer, viewRect);
      if (list.length > 0) allFaces.push(...list);
    }

    for (let fi = 0; fi < allFaces.length; fi++) {
      const face = allFaces[fi];
      if (
        DISABLE_WALLS_AND_CURTAINS
        && (face.kind === "WALL" || face.kind === "FLOOR_APRON" || face.kind === "STAIR_APRON")
      ) continue;
      if (!isTileInRenderRadius(face.tx, face.ty)) continue;
      const faceStableId = face.tx * 73856093 ^ face.ty * 19349663 ^ (face.zFrom * 100 | 0) * 83492791;
      const draws = buildFaceDraws(face);
      for (let di = 0; di < draws.length; di++) {
        const d = draws[di];
        const faceKindOrder = face.layerRole === "STRUCTURE" ? KindOrder.STRUCTURE : KindOrder.FLOOR;
        const renderKey: RenderKey = {
          slice: face.tx + face.ty,
          within: face.tx,
          baseZ: face.zFrom ?? face.zTo ?? 0,
          kindOrder: faceKindOrder,
          stableId: faceStableId + di * 0.001,
        };
        addToSlice(face.tx + face.ty, renderKey, () => {
          drawRenderPiece(d);
        });
      }
    }
  }

  // ----------------------------
  // Collect OCCLUDERS (walls only) into slices
  // ----------------------------
  {
    const allOccluders: RenderPiece[] = [];
    const layers = occluderLayers();
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const list = occludersInViewForLayer(layer, viewRect);
      if (list.length > 0) allOccluders.push(...list);
    }
    let occluderId = 0;

    for (let oi = 0; oi < allOccluders.length; oi++) {
      const occ = allOccluders[oi];
      if (DISABLE_WALLS_AND_CURTAINS) continue;
      if (!isTileInRenderRadius(occ.tx, occ.ty)) continue;
      if (occ.kind !== "WALL") continue;
      const occStableId = occ.tx * 73856093 ^ occ.ty * 19349663 ^ (occ.zFrom * 100 | 0) * 83492791;
      if (occ.id.startsWith("stamp_wall_") && shouldCullBuildingAt(occ.tx, occ.ty)) continue;
      const draw = buildWallDraw(occ, occluderId++);
      if (!draw) continue;
      const isContainerWall = occ.spriteId?.includes("structures/containers/");
      const wallKindOrder = occ.layerRole === "STRUCTURE" ? KindOrder.STRUCTURE : KindOrder.OCCLUDER;
      const renderKey: RenderKey = {
        slice: occ.tx + occ.ty,
        within: occ.tx,
        baseZ: occ.zFrom + (isContainerWall ? CONTAINER_WALL_SORT_BIAS : 0),
        kindOrder: wallKindOrder,
        stableId: occStableId,
      };
      addToSlice(occ.tx + occ.ty, renderKey, () => {
        drawRenderPiece(draw);
      });
    }
  }

    // ----------------------------
    // Collect OVERLAYS (roofs + props) into slices
    // ----------------------------
    if (debugFlags.showMapOverlays) {
      const triangleOverlayPrefilterBounds = structureTriangleAdmissionMode === "viewport"
        ? strictViewportTileBounds
        : viewRect;
      // In triangle-geometry mode, STRUCTURE visibility authority is triangle camera-tiles.
      // So we must not cull structures by overlay footprint before triangle admission runs.
      const overlayPrefilterViewRect = structureTriangleGeometryEnabled
        ? mapWideOverlayViewRect(compiledMap)
        : viewRect;
      const ovs = overlaysInView(overlayPrefilterViewRect);
      for (let i = 0; i < ovs.length; i++) {
        const o = ovs[i];
        const passesOverlayCoarsePrefilter = structureTriangleGeometryEnabled && o.layerRole === "STRUCTURE"
          ? true
          : tileRectIntersectsRenderRadius(o.tx, o.tx + o.w - 1, o.ty, o.ty + o.h - 1);
        if (!passesOverlayCoarsePrefilter) continue;
        if ((o.kind ?? "ROOF") === "ROOF" && shouldCullBuildingAt(o.tx, o.ty, o.w, o.h)) continue;
        const draw = buildOverlayDraw(o);
        if (!draw) continue;
        const structureSouthTieBreak = o.layerRole === "STRUCTURE"
          ? deriveStructureSouthTieBreakFromSeAnchor(o.seTx, o.seTy)
          : null;
        const useRuntimeStructureSlicing =
          o.kind === "PROP" || o.layerRole === "STRUCTURE";

          if (useRuntimeStructureSlicing) {
          const bandPieces = buildRuntimeStructureBandPieces({
            structureInstanceId: o.id,
            spriteId: o.spriteId,
            seTx: o.seTx,
            seTy: o.seTy,
            footprintW: o.w,
            footprintH: o.h,
            flipped: !!o.flipX,
            sliceOffsetX: o.sliceOffsetPx?.x  ?? 0,
            sliceOffsetY: o.sliceOffsetPx?.y ?? 0,
            sliceOriginX: o.sliceOriginPx?.x,
            baseZ: o.z,
            baseDx: draw.dx,
            baseDy: draw.dy,
            spriteWidth: draw.dw,
            spriteHeight: draw.dh,
            scale: draw.scale ?? 1,
          });

          if (LOG_STRUCTURE_OWNERSHIP_DEBUG && !loggedStructureOwnershipDebugIds.has(o.id)) {
            loggedStructureOwnershipDebugIds.add(o.id);
            const oriented = { w: Math.max(1, o.w | 0), h: Math.max(1, o.h | 0) };
            const expectedSE = seAnchorFromTopLeft(o.tx, o.ty, oriented.w, oriented.h);
            const owners = bandPieces.map((piece) => ({
              tx: piece.renderKey.within,
              ty: piece.renderKey.slice - piece.renderKey.within,
            }));
            console.log("[structure-ownership]", {
              structureId: o.id,
              flipped: !!o.flipX,
              w: oriented.w,
              h: oriented.h,
              anchorTx: o.seTx,
              anchorTy: o.seTy,
              seMatchesTopLeft: o.seTx === expectedSE.anchorTx && o.seTy === expectedSE.anchorTy,
              first3: owners.slice(0, 3),
              last3: owners.slice(Math.max(0, owners.length - 3)),
            });
          }

          let usedTriangleGeometryPath = false;
          if (structureTriangleGeometryEnabled && o.layerRole === "STRUCTURE") {
            const geometrySignature = runtimeStructureTriangleGeometrySignatureForOverlay(o, {
              dx: draw.dx,
              dy: draw.dy,
              dw: draw.dw,
              dh: draw.dh,
              flipX: !!draw.flipX,
              scale: draw.scale ?? 1,
            });
            const triangleCache = runtimeStructureTriangleCacheStore.get(o.id, geometrySignature);
	            if (triangleCache && draw.img) {
	              usedTriangleGeometryPath = true;
	              const sourceImg: CanvasImageSource = draw.flipX ? getFlippedOverlayImage(draw.img) : draw.img;
                const usingV5Caster = SHADOW_CASTER_MODE === "v5TriangleShadowMask";
                const usingV6Caster = SHADOW_CASTER_MODE === "v6FaceSliceDebug";
                const admittedTrianglesForSemanticMasks: typeof triangleCache.triangles = [];
	              const footprintW = Math.max(1, o.w | 0);
	              const footprintH = Math.max(1, o.h | 0);
              const buildingMinCameraTx = o.tx;
              const buildingMaxCameraTx = o.tx + footprintW - 1;
              const buildingMinCameraTy = o.ty;
              const buildingMaxCameraTy = o.ty + footprintH - 1;
	              const buildingDirectionalRejected = (
	                buildingMaxCameraTx < playerCameraTx
	                || buildingMaxCameraTy < playerCameraTy
	              );
	              const buildingDirectionalEligible = !buildingDirectionalRejected;
	              const projectedFootprintQuad = SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG
	                ? buildProjectedStructureFootprintQuad(o)
	                : null;
	              let overlayHasVisibleTriangleGroup = false;
                let structureShadowCacheHit = false;
	              if (SHOW_STRUCTURE_SLICE_DEBUG && structureTriangleCutoutEnabled && !didQueueStructureCutoutDebugRect) {
	                didQueueStructureCutoutDebugRect = true;
	                deferredStructureSliceDebugDraws.push(() => {
                  ctx.save();
                  const x = structureCutoutScreenRect.minX;
                  const y = structureCutoutScreenRect.minY;
                  const wRect = structureCutoutScreenRect.maxX - structureCutoutScreenRect.minX;
                  const hRect = structureCutoutScreenRect.maxY - structureCutoutScreenRect.minY;
                  ctx.fillStyle = "rgba(120,40,255,0.08)";
                  ctx.strokeStyle = "rgba(160,90,255,0.8)";
                  ctx.lineWidth = 1;
                  ctx.fillRect(x, y, wRect, hRect);
                  ctx.strokeRect(x, y, wRect, hRect);
                  ctx.font = "11px monospace";
                  const labelPos = worldToScreen(playerCameraTx * T, playerCameraTy * T);
                  const label = `cutout screenRect C:${playerCameraTx},${playerCameraTy} w:${structureTriangleCutoutHalfWidth} h:${structureTriangleCutoutHalfHeight} px:${Math.round(wRect)}x${Math.round(hRect)} a:${structureTriangleCutoutAlpha.toFixed(2)}`;
                  ctx.fillStyle = "rgba(0,0,0,0.8)";
                  ctx.fillText(label, labelPos.x + 9, labelPos.y - 7);
                  ctx.fillStyle = "rgba(185,145,255,0.95)";
                  ctx.fillText(label, labelPos.x + 8, labelPos.y - 8);
                  ctx.restore();
                });
              }
              for (let gi = 0; gi < triangleCache.parentTileGroups.length; gi++) {
                const group = triangleCache.parentTileGroups[gi];
                const groupParentAfterPlayer = isParentTileAfterPlayer(group.parentTx, group.parentTy);
                const groupBoundsInViewport = runtimeStructureRectIntersects(group.localBounds, projectedViewportRect);
                const isCameraTileInsideStrictViewport = (tx: number, ty: number): boolean => (
                  tx >= strictViewportTileBounds.minTx
                  && tx <= strictViewportTileBounds.maxTx
                  && ty >= strictViewportTileBounds.minTy
                  && ty <= strictViewportTileBounds.maxTy
                );
                const viewportVisibleTriangles = [] as typeof group.triangles;
                const renderDistanceVisibleTriangles = [] as typeof group.triangles;
                const finalVisibleTriangles = [] as typeof group.triangles;
                const cutoutEligibleTriangles = [] as typeof group.triangles;
                let cutoutBuildingRejectedCount = 0;
                const compareDistanceOnlyTriangles = [] as typeof group.triangles;
                for (let ti = 0; ti < group.triangles.length; ti++) {
                  const tri = group.triangles[ti];
                  const viewportVisible = isCameraTileInsideStrictViewport(tri.cameraTx, tri.cameraTy);
                  const renderDistanceVisible = isTileInRenderRadius(tri.cameraTx, tri.cameraTy);
                  if (viewportVisible) viewportVisibleTriangles.push(tri);
                  if (renderDistanceVisible) renderDistanceVisibleTriangles.push(tri);
                  const finalVisible = structureTriangleAdmissionMode === "viewport"
                    ? viewportVisible
                    : structureTriangleAdmissionMode === "renderDistance"
                      ? renderDistanceVisible
                      : structureTriangleAdmissionMode === "hybrid"
                        ? (renderDistanceVisible && viewportVisible)
                        : renderDistanceVisible;
                  if (finalVisible) {
                    finalVisibleTriangles.push(tri);
                    if (structureTriangleAdmissionMode === "compare" && renderDistanceVisible && !viewportVisible) {
                      compareDistanceOnlyTriangles.push(tri);
                    }
                    if (structureTriangleCutoutEnabled && !buildingDirectionalEligible) cutoutBuildingRejectedCount++;
                    const triCenterX = (tri.points[0].x + tri.points[1].x + tri.points[2].x) / 3;
                    const triCenterY = (tri.points[0].y + tri.points[1].y + tri.points[2].y) / 3;
                    const cutoutEligible = structureTriangleCutoutEnabled
                      && buildingDirectionalEligible
                      && groupParentAfterPlayer
                      && isPointInsideStructureCutoutScreenRect(triCenterX, triCenterY);
                    if (cutoutEligible) cutoutEligibleTriangles.push(tri);
                  }
                }
                const finalAdmitted = finalVisibleTriangles.length > 0;
                if (SHOW_STRUCTURE_SLICE_DEBUG) {
                  deferredStructureSliceDebugDraws.push(() => {
                    ctx.save();
                    const bounds = group.localBounds;
                    const admittedViewportStyle = finalAdmitted && compareDistanceOnlyTriangles.length === 0;
                    ctx.lineWidth = admittedViewportStyle ? 1.5 : 1;
                    ctx.strokeStyle = admittedViewportStyle
                      ? "rgba(0,255,170,0.92)"
                      : compareDistanceOnlyTriangles.length > 0
                        ? "rgba(255,120,40,0.92)"
                        : "rgba(255,180,90,0.65)";
                    ctx.fillStyle = admittedViewportStyle
                      ? "rgba(0,255,170,0.08)"
                      : compareDistanceOnlyTriangles.length > 0
                        ? "rgba(255,120,40,0.08)"
                        : "rgba(255,180,90,0.04)";
                    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
                    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
                    for (let ti = 0; ti < group.triangles.length; ti++) {
                      const tri = group.triangles[ti];
                      const [a, b, c] = tri.points;
                      ctx.beginPath();
                      ctx.moveTo(a.x, a.y);
                      ctx.lineTo(b.x, b.y);
                      ctx.lineTo(c.x, c.y);
                      ctx.closePath();
                      ctx.strokeStyle = admittedViewportStyle
                        ? "rgba(0,255,170,0.72)"
                        : compareDistanceOnlyTriangles.length > 0
                          ? "rgba(255,120,40,0.72)"
                          : "rgba(255,180,90,0.38)";
                      ctx.stroke();
                    }
                    const labelX = bounds.x + bounds.w * 0.5;
                    const labelY = bounds.y + bounds.h * 0.5;
                    const representativeCamera = finalVisibleTriangles[0] ?? group.triangles[0] ?? null;
                    const labelSuffix = compareDistanceOnlyTriangles.length > 0 ? " rd-only" : "";
                    const label = representativeCamera
                      ? `P:${group.parentTx},${group.parentTy} C:${representativeCamera.cameraTx},${representativeCamera.cameraTy}${labelSuffix}`
                      : `P:${group.parentTx},${group.parentTy}${labelSuffix}`;
                    ctx.font = "10px monospace";
                    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
                    ctx.fillText(label, labelX + 1, labelY + 1);
                    ctx.fillStyle = admittedViewportStyle
                      ? "rgba(0,255,170,0.96)"
                      : compareDistanceOnlyTriangles.length > 0
                        ? "rgba(255,120,40,0.95)"
                        : "rgba(255,180,90,0.95)";
                    ctx.fillText(label, labelX, labelY);
                    const statsLabel = `vis:${finalVisibleTriangles.length}/${group.triangles.length} vp:${viewportVisibleTriangles.length} rd:${renderDistanceVisibleTriangles.length} cut:${cutoutEligibleTriangles.length} bdir:${buildingDirectionalEligible ? "pass" : "rej"} brej:${cutoutBuildingRejectedCount} bbox:${buildingMinCameraTx},${buildingMinCameraTy}-${buildingMaxCameraTx},${buildingMaxCameraTy} gb:${groupBoundsInViewport ? 1 : 0}`;
                    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
                    ctx.fillText(statsLabel, labelX + 1, labelY + 12);
                    ctx.fillStyle = "rgba(220, 240, 255, 0.95)";
                    ctx.fillText(statsLabel, labelX, labelY + 11);
                    ctx.restore();
                  });
	                }
	                if (!finalAdmitted) continue;
	                if (usingV5Caster || usingV6Caster) admittedTrianglesForSemanticMasks.push(...finalVisibleTriangles);
	                overlayHasVisibleTriangleGroup = true;
	                const renderFields = deriveParentTileRenderFields(group.parentTx, group.parentTy);
	                const overlayKey: RenderKey = {
	                  slice: renderFields.slice,
                  within: renderFields.within,
                  baseZ: o.z,
                  kindOrder: KindOrder.STRUCTURE,
                  ...(structureSouthTieBreak ?? {}),
                  stableId: group.stableId,
                };
                addToSlice(renderFields.slice, overlayKey, () => {
                  ctx.imageSmoothingEnabled = false;
                  for (let ti = 0; ti < finalVisibleTriangles.length; ti++) {
                    const tri = finalVisibleTriangles[ti];
                    const [s0, s1, s2] = tri.srcPoints;
                    const [d0, d1, d2] = tri.points;
                    const cutoutEligible = structureTriangleCutoutEnabled
                      && buildingDirectionalEligible
                      && groupParentAfterPlayer
                      && isPointInsideStructureCutoutScreenRect(
                        (tri.points[0].x + tri.points[1].x + tri.points[2].x) / 3,
                        (tri.points[0].y + tri.points[1].y + tri.points[2].y) / 3,
                      );
                    if (cutoutEligible && structureTriangleCutoutAlpha < 1) {
                      ctx.save();
                      ctx.globalAlpha = ctx.globalAlpha * structureTriangleCutoutAlpha;
                      drawTexturedTriangle(
                        ctx,
                        sourceImg,
                        draw.dw,
                        draw.dh,
                        s0,
                        s1,
                        s2,
                        d0,
                        d1,
                        d2,
                      );
                      ctx.restore();
                    } else {
                      drawTexturedTriangle(
                        ctx,
                        sourceImg,
                        draw.dw,
                        draw.dh,
                        s0,
                        s1,
                        s2,
                        d0,
                        d1,
                        d2,
                      );
                    }
                    const compareDistanceOnly = compareDistanceOnlyTriangles.includes(tri);
                    if (compareDistanceOnly) {
                      const [a, b, c] = tri.points;
                      ctx.save();
                      ctx.beginPath();
                      ctx.moveTo(a.x, a.y);
                      ctx.lineTo(b.x, b.y);
                      ctx.lineTo(c.x, c.y);
                      ctx.closePath();
                      ctx.fillStyle = "rgba(255,120,40,0.28)";
                      ctx.fill();
                      ctx.strokeStyle = "rgba(255,120,40,0.9)";
                      ctx.lineWidth = 1;
                      ctx.stroke();
                      ctx.restore();
                    }
                    if (SHOW_STRUCTURE_SLICE_DEBUG && cutoutEligible) {
                      const [a, b, c] = tri.points;
                      ctx.save();
                      ctx.beginPath();
                      ctx.moveTo(a.x, a.y);
                      ctx.lineTo(b.x, b.y);
                      ctx.lineTo(c.x, c.y);
                      ctx.closePath();
                      ctx.fillStyle = "rgba(160,90,255,0.18)";
                      ctx.fill();
                      ctx.strokeStyle = "rgba(190,130,255,0.95)";
                      ctx.lineWidth = 1;
                      ctx.stroke();
                      ctx.restore();
	                    }
	                  }
	                });
	              }
              if (overlayHasVisibleTriangleGroup) {
                let structureShadowV1CacheEntry: StructureShadowCacheEntry | null = null;
                let structureShadowV2CacheEntry: StructureShadowV2CacheEntry | null = null;
                let structureShadowHybridCacheEntry: StructureShadowHybridCacheEntry | null = null;
                let structureShadowV4CacheEntry: StructureShadowV4CacheEntry | null = null;
                let projectedStructureShadowTriangles: readonly StructureShadowProjectedTriangle[] = [];
                let projectedStructureShadowBounds: RuntimeStructureTriangleRect | null = null;
                let hybridProjectedMappings: readonly StructureHybridShadowProjectedTriangle[] = [];
                const usingV4Caster = SHADOW_CASTER_MODE === "v4SliceStrips";
                const usingHybridCaster = SHADOW_CASTER_MODE === "v3HybridTriangles";
                if (usingHybridCaster || usingV4Caster || usingV5Caster || usingV6Caster) {
                  const cachedStructureShadowHybrid = structureShadowHybridCacheStore.get(
                    o.id,
                    geometrySignature,
                    shadowSunModel.stepKey,
                  );
                  if (cachedStructureShadowHybrid) {
                    structureShadowHybridCacheEntry = cachedStructureShadowHybrid;
                    structureShadowCacheHit = true;
                    if (usingHybridCaster) hybridShadowDiagnosticStats.cacheHits += 1;
                  } else {
                    const rebuiltStructureShadowHybrid = buildStructureShadowHybridCacheEntry({
                      overlay: o,
                      triangleCache,
                      geometrySignature,
                      tileWorld: T,
                      toScreenAtZ,
                      sunForward: shadowSunModel.forward,
                      sunProjectionDirection: shadowSunModel.projectionDirection,
                      sunStepKey: shadowSunModel.stepKey,
                      roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
                    });
                    structureShadowHybridCacheEntry = rebuiltStructureShadowHybrid;
                    structureShadowHybridCacheStore.set(rebuiltStructureShadowHybrid);
                    structureShadowCacheHit = false;
                    if (usingHybridCaster) hybridShadowDiagnosticStats.cacheMisses += 1;
                  }
                  if (usingV4Caster) {
                    const cachedStructureShadowV4 = structureShadowV4CacheStore.get(
                      o.id,
                      geometrySignature,
                      shadowSunModel.stepKey,
                    );
                    if (cachedStructureShadowV4) {
                      structureShadowV4CacheEntry = cachedStructureShadowV4;
                      structureShadowCacheHit = true;
                      v4ShadowDiagnosticStats.cacheHits += 1;
                    } else {
                      const correspondences: SliceCorrespondence[] = structureShadowHybridCacheEntry.slicePerimeterSegments.map((segment) => ({
                        sliceIndex: segment.sliceIndex,
                        sourceBandIndex: segment.bandIndex,
                        baseSegment: {
                          a: { x: segment.baseSegment[0].x, y: segment.baseSegment[0].y },
                          b: { x: segment.baseSegment[1].x, y: segment.baseSegment[1].y },
                        },
                        topSegment: {
                          a: { x: segment.topSegment[0].x, y: segment.topSegment[0].y },
                          b: { x: segment.topSegment[1].x, y: segment.topSegment[1].y },
                        },
                      }));
                      const bandOwnerParity = new Map<number, 0 | 1>();
                      for (let ti = 0; ti < triangleCache.triangles.length; ti++) {
                        const tri = triangleCache.triangles[ti];
                        if (bandOwnerParity.has(tri.bandIndex)) continue;
                        bandOwnerParity.set(tri.bandIndex, ((tri.parentTx + tri.parentTy) & 1) as 0 | 1);
                      }
                      let parityAnchorBandIndex: number | null = null;
                      let parityAnchorValue: 0 | 1 = 0;
                      if (bandOwnerParity.size > 0) {
                        const orderedBands = Array.from(bandOwnerParity.keys()).sort((a, b) => a - b);
                        parityAnchorBandIndex = orderedBands[0];
                        parityAnchorValue = bandOwnerParity.get(parityAnchorBandIndex) ?? 0;
                      }
                      const sliceOwnerParity = new Map<number, 0 | 1>();
                      for (let si = 0; si < structureShadowHybridCacheEntry.slicePerimeterSegments.length; si++) {
                        const segment = structureShadowHybridCacheEntry.slicePerimeterSegments[si];
                        let parity = bandOwnerParity.get(segment.bandIndex);
                        if (parity == null && parityAnchorBandIndex != null) {
                          parity = ((parityAnchorValue + ((segment.bandIndex - parityAnchorBandIndex) & 1)) & 1) as 0 | 1;
                        }
                        if (parity != null) sliceOwnerParity.set(segment.sliceIndex, parity);
                      }
                      const rebuiltStructureShadowV4 = buildStructureShadowV4CacheEntry({
                        structureInstanceId: o.id,
                        geometrySignature,
                        sunStepKey: shadowSunModel.stepKey,
                        castHeightPx: structureShadowHybridCacheEntry.castHeightPx,
                        sunDirection: shadowSunModel.projectionDirection,
                        sliceCorrespondence: correspondences,
                        topCapTriangles: structureShadowHybridCacheEntry.projectedTopCapTriangles,
                        sourceTriangles: triangleCache.triangles,
                        sliceOwnerParity,
                      });
                      structureShadowV4CacheEntry = rebuiltStructureShadowV4;
                      structureShadowV4CacheStore.set(rebuiltStructureShadowV4);
                      structureShadowCacheHit = false;
                      v4ShadowDiagnosticStats.cacheMisses += 1;
                    }
                    projectedStructureShadowBounds = structureShadowV4CacheEntry.projectedBounds;
                    v4ShadowDiagnosticStats.correspondences += structureShadowV4CacheEntry.correspondences.length;
                    v4ShadowDiagnosticStats.strips += structureShadowV4CacheEntry.sliceStrips.length;
                    v4ShadowDiagnosticStats.layerEdges += structureShadowV4CacheEntry.layerEdges.length;
                    v4ShadowDiagnosticStats.layerBands += structureShadowV4CacheEntry.layerBands.length;
                    v4ShadowDiagnosticStats.topCapTriangles += structureShadowV4CacheEntry.topCapTriangles.length;
                    v4ShadowDiagnosticStats.sourceBandTriangles += structureShadowV4CacheEntry.sourceBandTriangles.length;
                    v4ShadowDiagnosticStats.destinationBandEntries += structureShadowV4CacheEntry.destinationBandEntries.length;
                    v4ShadowDiagnosticStats.correspondencePairs += structureShadowV4CacheEntry.triangleCorrespondence.length;
                    v4ShadowDiagnosticStats.correspondenceMismatches += structureShadowV4CacheEntry.triangleCorrespondenceMismatches.length;
                    v4ShadowDiagnosticStats.destinationBandPairs += structureShadowV4CacheEntry.destinationBandTriangles.length;
                    v4ShadowDiagnosticStats.destinationTriangles += structureShadowV4CacheEntry.destinationTriangles.length;
                    for (let di = 0; di < structureShadowV4CacheEntry.destinationBandTriangles.length; di++) {
                      if (structureShadowV4CacheEntry.destinationBandTriangles[di].diagonal === "A_to_Bprime") {
                        v4ShadowDiagnosticStats.diagonalA += 1;
                      } else {
                        v4ShadowDiagnosticStats.diagonalB += 1;
                      }
                    }
                    v4ShadowDiagnosticStats.diagonalRule = `A:${v4ShadowDiagnosticStats.diagonalA} B:${v4ShadowDiagnosticStats.diagonalB}`;
                    if (structureShadowV4CacheEntry.isDeltaConstant) {
                      v4ShadowDiagnosticStats.deltaConstPass += 1;
                    } else {
                      v4ShadowDiagnosticStats.deltaConstFail += 1;
                    }
                    const firstDiagnostic = structureShadowV4CacheEntry.midpointDiagnostics[0];
                    if (firstDiagnostic) {
                      v4ShadowDiagnosticStats.firstSliceSummary = `i${firstDiagnostic.sliceIndex} b(${firstDiagnostic.baseMidpoint.x.toFixed(1)},${firstDiagnostic.baseMidpoint.y.toFixed(1)}) t(${firstDiagnostic.topMidpoint.x.toFixed(1)},${firstDiagnostic.topMidpoint.y.toFixed(1)}) d(${firstDiagnostic.delta.x.toFixed(1)},${firstDiagnostic.delta.y.toFixed(1)})`;
                    }
                    if (v4ShadowDiagnosticStats.sampleRoofHeightPx == null) {
                      v4ShadowDiagnosticStats.sampleRoofHeightPx = structureShadowV4CacheEntry.roofHeightPx;
                      v4ShadowDiagnosticStats.sampleLayerHeights = structureShadowV4CacheEntry.layerHeightsPx.join(",");
                      v4ShadowDiagnosticStats.sampleSliceCount = structureShadowV4CacheEntry.sliceStrips.length;
                      v4ShadowDiagnosticStats.sampleLayerEdges = structureShadowV4CacheEntry.layerEdges.length;
                      v4ShadowDiagnosticStats.sampleLayerBands = structureShadowV4CacheEntry.layerBands.length;
                      const selectedSlice = structureShadowV4CacheEntry.sliceStrips[0];
                      if (selectedSlice) {
                        const selectedEdges = structureShadowV4CacheEntry.layerEdges.filter((edge) => edge.sliceIndex === selectedSlice.sliceIndex);
                        const layer0 = selectedEdges[0];
                        const layerLast = selectedEdges[selectedEdges.length - 1];
                        v4ShadowDiagnosticStats.sampleSelectedSlice = [
                          `i${selectedSlice.sliceIndex}`,
                          `baseA(${selectedSlice.baseA.x.toFixed(1)},${selectedSlice.baseA.y.toFixed(1)})`,
                          `baseB(${selectedSlice.baseB.x.toFixed(1)},${selectedSlice.baseB.y.toFixed(1)})`,
                          `topA(${selectedSlice.topA.x.toFixed(1)},${selectedSlice.topA.y.toFixed(1)})`,
                          `topB(${selectedSlice.topB.x.toFixed(1)},${selectedSlice.topB.y.toFixed(1)})`,
                          layer0
                            ? `L0A(${layer0.a.x.toFixed(1)},${layer0.a.y.toFixed(1)}) L0B(${layer0.b.x.toFixed(1)},${layer0.b.y.toFixed(1)})`
                            : "L0(none)",
                          layerLast
                            ? `LTA(${layerLast.a.x.toFixed(1)},${layerLast.a.y.toFixed(1)}) LTB(${layerLast.b.x.toFixed(1)},${layerLast.b.y.toFixed(1)})`
                            : "LT(none)",
                        ].join(" ");
                        const selectedBand = structureShadowV4CacheEntry.layerBands.find(
                          (band) => band.sliceIndex === selectedSlice.sliceIndex && band.bandIndex === 0,
                        );
                        const selectedPair = structureShadowV4CacheEntry.destinationBandTriangles.find(
                          (pair) => pair.sliceIndex === selectedSlice.sliceIndex && pair.bandIndex === 0,
                        );
                        if (selectedBand && selectedPair) {
                          const t0 = selectedPair.tri0;
                          const t1 = selectedPair.tri1;
                          const selectedGroup = structureShadowV4CacheEntry.triangleCorrespondenceGroups.find(
                            (group) => group.sliceIndex === selectedBand.sliceIndex && group.bandIndex === selectedBand.bandIndex,
                          );
                          const groupSummary = selectedGroup
                            ? [
                                `src:${selectedGroup.sourceTriangles.length}`,
                                `dst:${selectedGroup.destinationTriangles.length}`,
                                `map:${selectedGroup.correspondences.length}`,
                                selectedGroup.mismatch
                                  ? `mismatch:${selectedGroup.mismatch.sourceTriangleCount}/${selectedGroup.mismatch.destinationTriangleCount}`
                                  : "mismatch:none",
                              ].join(" ")
                            : "src:0 dst:0 map:0 mismatch:none";
                          const pairSummary = selectedGroup?.correspondences[0]
                            ? `pair sIdx:${selectedGroup.correspondences[0].sourceTriangleIndexWithinBand}->dIdx:${selectedGroup.correspondences[0].destinationTriangleIndex}`
                            : "pair:none";
                          v4ShadowDiagnosticStats.sampleSelectedBand = [
                            `i${selectedBand.sliceIndex} b${selectedBand.bandIndex}`,
                            `lowerA(${selectedBand.lowerA.x.toFixed(1)},${selectedBand.lowerA.y.toFixed(1)})`,
                            `lowerB(${selectedBand.lowerB.x.toFixed(1)},${selectedBand.lowerB.y.toFixed(1)})`,
                            `upperA(${selectedBand.upperA.x.toFixed(1)},${selectedBand.upperA.y.toFixed(1)})`,
                            `upperB(${selectedBand.upperB.x.toFixed(1)},${selectedBand.upperB.y.toFixed(1)})`,
                            `tri0[(${t0[0].x.toFixed(1)},${t0[0].y.toFixed(1)}),(${t0[1].x.toFixed(1)},${t0[1].y.toFixed(1)}),(${t0[2].x.toFixed(1)},${t0[2].y.toFixed(1)})]`,
                            `tri1[(${t1[0].x.toFixed(1)},${t1[0].y.toFixed(1)}),(${t1[1].x.toFixed(1)},${t1[1].y.toFixed(1)}),(${t1[2].x.toFixed(1)},${t1[2].y.toFixed(1)})]`,
                            groupSummary,
                            pairSummary,
                          ].join(" ");
                        }
                      }
                    }
                  } else if (usingHybridCaster) {
                    hybridProjectedMappings = structureShadowHybridCacheEntry.projectedMappings;
                    projectedStructureShadowBounds = structureShadowHybridCacheEntry.projectedBounds;
                    hybridShadowDiagnosticStats.casterTriangles += structureShadowHybridCacheEntry.casterTriangles.length;
                    hybridShadowDiagnosticStats.projectedTriangles += structureShadowHybridCacheEntry.projectedMappings.length;
                  }
                } else if (SHADOW_CASTER_MODE === "v2AlphaSilhouette") {
                  const cachedStructureShadowV2 = structureShadowV2CacheStore.get(
                    o.id,
                    geometrySignature,
                    shadowSunModel.stepKey,
                  );
                  if (cachedStructureShadowV2) {
                    structureShadowV2CacheEntry = cachedStructureShadowV2;
                    structureShadowCacheHit = true;
                  } else {
                    const rebuiltStructureShadowV2 = buildStructureShadowV2CacheEntry({
                      overlay: o,
                      triangleCache,
                      geometrySignature,
                      tileWorld: T,
                      toScreenAtZ,
                      sunForward: shadowSunModel.forward,
                      sunProjectionDirection: shadowSunModel.projectionDirection,
                      sunStepKey: shadowSunModel.stepKey,
                      drawDx: draw.dx,
                      drawDy: draw.dy,
                      drawScale: draw.scale ?? 1,
                      sourceImage: sourceImg,
                      roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
                      alphaThreshold: STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
                      silhouetteSampleStep: STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
                      maxLoopPoints: STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
                    });
                    structureShadowV2CacheEntry = rebuiltStructureShadowV2;
                    structureShadowV2CacheStore.set(rebuiltStructureShadowV2);
                    structureShadowCacheHit = false;
                  }
                  projectedStructureShadowTriangles = structureShadowV2CacheEntry.shadowTriangles;
                  projectedStructureShadowBounds = structureShadowV2CacheEntry.projectedBounds;
                } else {
                  const cachedStructureShadow = structureShadowV1CacheStore.get(
                    o.id,
                    geometrySignature,
                    shadowSunModel.stepKey,
                  );
                  if (cachedStructureShadow) {
                    structureShadowV1CacheEntry = cachedStructureShadow;
                    structureShadowCacheHit = true;
                  } else {
                    const rebuiltStructureShadow = buildStructureShadowCacheEntry({
                      overlay: o,
                      triangleCache,
                      geometrySignature,
                      tileWorld: T,
                      toScreenAtZ,
                      sunForward: shadowSunModel.forward,
                      sunProjectionDirection: shadowSunModel.projectionDirection,
                      sunStepKey: shadowSunModel.stepKey,
                      roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
                    });
                    structureShadowV1CacheEntry = rebuiltStructureShadow;
                    structureShadowV1CacheStore.set(rebuiltStructureShadow);
                    structureShadowCacheHit = false;
                  }
                  projectedStructureShadowTriangles = structureShadowV1CacheEntry.shadowTriangles;
                  projectedStructureShadowBounds = structureShadowV1CacheEntry.projectedBounds;
                }
                const projectedShadowVisible = projectedStructureShadowBounds
                  ? runtimeStructureRectIntersects(projectedStructureShadowBounds, projectedViewportRect)
                  : false;
                const v5Triangles: StructureV5ShadowMaskTriangle[] = [];
                const v6Triangles: StructureV5ShadowMaskTriangle[] = [];
                if (
                  (usingV5Caster || usingV6Caster)
                  && structureShadowHybridCacheEntry
                  && admittedTrianglesForSemanticMasks.length > 0
                ) {
                  const semanticByStableId = buildHybridTriangleSemanticMap({
                    overlay: o,
                    triangleCache,
                    activeRoofQuad: structureShadowHybridCacheEntry.roofScan.activeLevel?.quad ?? null,
                    triangles: admittedTrianglesForSemanticMasks,
                  });
                  for (let ti = 0; ti < admittedTrianglesForSemanticMasks.length; ti++) {
                    const tri = admittedTrianglesForSemanticMasks[ti];
                    const semantic = semanticByStableId.get(tri.stableId) ?? "UNCLASSIFIED";
                    const buckets = resolveHybridSemanticMaskBuckets(semantic);
                    for (let bi = 0; bi < buckets.length; bi++) {
                      const bucket = buckets[bi];
                      if (
                        usingV6Caster
                        && bucket !== SHADOW_V6_PRIMARY_SEMANTIC_BUCKET
                        && bucket !== SHADOW_V6_SECONDARY_SEMANTIC_BUCKET
                        && bucket !== SHADOW_V6_TOP_SEMANTIC_BUCKET
                      ) {
                        continue;
                      }
                      const triEntry: StructureV5ShadowMaskTriangle = {
                        stableId: tri.stableId,
                        semanticBucket: bucket,
                        srcTriangle: [tri.srcPoints[0], tri.srcPoints[1], tri.srcPoints[2]],
                        dstTriangle: [tri.points[0], tri.points[1], tri.points[2]],
                      };
                      if (usingV5Caster) v5Triangles.push(triEntry);
                      if (usingV6Caster) v6Triangles.push(triEntry);
                    }
                  }
                }
                let v5MaskAnchor: ScreenPt = {
                  x: draw.dx + draw.dw * 0.5,
                  y: draw.dy + draw.dh,
                };
                if (admittedTrianglesForSemanticMasks.length > 0) {
                  let minX = Number.POSITIVE_INFINITY;
                  let minY = Number.POSITIVE_INFINITY;
                  let maxX = Number.NEGATIVE_INFINITY;
                  let maxY = Number.NEGATIVE_INFINITY;
                  for (let ti = 0; ti < admittedTrianglesForSemanticMasks.length; ti++) {
                    const tri = admittedTrianglesForSemanticMasks[ti];
                    for (let vi = 0; vi < tri.points.length; vi++) {
                      const p = tri.points[vi];
                      if (p.x < minX) minX = p.x;
                      if (p.y < minY) minY = p.y;
                      if (p.x > maxX) maxX = p.x;
                      if (p.y > maxY) maxY = p.y;
                    }
                  }
                  if (Number.isFinite(minX) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
                    v5MaskAnchor = {
                      x: (minX + maxX) * 0.5,
                      y: maxY,
                    };
                  }
                }
                const v5BuildingAnchor: ScreenPt = {
                  x: draw.dx + draw.dw * 0.5,
                  y: draw.dy + draw.dh,
                };
                const structureShadowBand = resolveRenderZBand(
                  {
                    slice: o.seTx + o.seTy,
                    within: o.seTx,
                    baseZ: o.z,
                  },
                  rampRoadTiles,
                );
                if (usingV6Caster && v6Triangles.length > 0) {
                  structureV6ShadowDebugCandidates.push({
                    structureInstanceId: o.id,
                    sourceImage: sourceImg,
                    sourceImageWidth: Math.max(1, Math.round(draw.dw)),
                    sourceImageHeight: Math.max(1, Math.round(draw.dh)),
                    triangles: v6Triangles,
                    zBand: structureShadowBand,
                  });
                }
                const shouldQueueProjectedShadow = projectedShadowVisible && !usingV5Caster && !usingV6Caster;
                const shouldQueueV5Shadow = usingV5Caster && v5Triangles.length > 0;
                if (shouldQueueProjectedShadow || shouldQueueV5Shadow) {
                  if (shouldQueueV5Shadow) {
                    queueStructureV5ShadowForBand(structureShadowBand, {
                      structureInstanceId: o.id,
                      sourceImage: sourceImg,
                      sourceImageWidth: Math.max(1, Math.round(draw.dw)),
                      sourceImageHeight: Math.max(1, Math.round(draw.dh)),
                      triangles: v5Triangles,
                      buildingDrawOrigin: { x: draw.dx, y: draw.dy },
                      buildingAnchor: v5BuildingAnchor,
                      maskAnchor: v5MaskAnchor,
                    });
                    v5ShadowDiagnosticStats.piecesQueued += 1;
                    v5ShadowDiagnosticStats.trianglesQueued += v5Triangles.length;
                  } else if (
                    usingV4Caster
                    && structureShadowV4CacheEntry
                    && (
                      structureShadowV4CacheEntry.triangleCorrespondence.length > 0
                      || structureShadowV4CacheEntry.topCapTriangles.length > 0
                    )
                  ) {
                    queueStructureV4ShadowForBand(structureShadowBand, {
                      sourceImage: sourceImg,
                      sourceImageWidth: Math.max(1, Math.round(draw.dw)),
                      sourceImageHeight: Math.max(1, Math.round(draw.dh)),
                      topCapTriangles: structureShadowV4CacheEntry.topCapTriangles,
                      triangleCorrespondence: structureShadowV4CacheEntry.triangleCorrespondence,
                    });
                    v4ShadowDiagnosticStats.piecesQueued += 1;
                    v4ShadowDiagnosticStats.trianglesQueued += structureShadowV4CacheEntry.triangleCorrespondence.length;
                    v4ShadowDiagnosticStats.topCapTrianglesQueued += structureShadowV4CacheEntry.topCapTriangles.length;
                  } else if (usingHybridCaster && hybridProjectedMappings.length > 0) {
                    queueStructureHybridShadowForBand(structureShadowBand, {
                      sourceImage: sourceImg,
                      sourceImageWidth: Math.max(1, Math.round(draw.dw)),
                      sourceImageHeight: Math.max(1, Math.round(draw.dh)),
                      projectedMappings: hybridProjectedMappings,
                    });
                    hybridShadowDiagnosticStats.piecesQueued += 1;
                    hybridShadowDiagnosticStats.trianglesQueued += hybridProjectedMappings.length;
                  } else if (!usingV4Caster && projectedStructureShadowTriangles.length > 0) {
                    queueStructureShadowTrianglesForBand(structureShadowBand, projectedStructureShadowTriangles);
                  }
                }

                if (SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG) {
                  const debugShadowCacheHit = structureShadowCacheHit;
                  if (structureShadowV4CacheEntry) {
                    const debugShadowEntry = structureShadowV4CacheEntry;
                    deferredStructureSliceDebugDraws.push(() => {
                      ctx.save();
                      ctx.lineWidth = 1.15;
                      ctx.font = "9px monospace";
                      const selectedGroup = debugShadowEntry.triangleCorrespondenceGroups[0] ?? null;
                      const selectedSliceIndex = selectedGroup?.sliceIndex ?? debugShadowEntry.sliceStrips[0]?.sliceIndex ?? null;
                      const selectedBandIndex = selectedGroup?.bandIndex ?? 0;
                      const bandPairByKey = new Map<string, (typeof debugShadowEntry.destinationBandTriangles)[number]>();
                      for (let pi = 0; pi < debugShadowEntry.destinationBandTriangles.length; pi++) {
                        const pair = debugShadowEntry.destinationBandTriangles[pi];
                        bandPairByKey.set(`${pair.sliceIndex}:${pair.bandIndex}`, pair);
                      }
                      // 0) Top cap shadow geometry (distinct from strips).
                      for (let ti = 0; ti < debugShadowEntry.topCapTriangles.length; ti++) {
                        const [a, b, c] = debugShadowEntry.topCapTriangles[ti];
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.lineTo(c.x, c.y);
                        ctx.closePath();
                        ctx.fillStyle = "rgba(255, 175, 70, 0.16)";
                        ctx.strokeStyle = "rgba(255, 205, 115, 0.95)";
                        ctx.fill();
                        ctx.stroke();
                      }
                      // 1) Layer edges (faint). Selected slice is highlighted for readability.
                      for (let li = 0; li < debugShadowEntry.layerEdges.length; li++) {
                        const layerEdge = debugShadowEntry.layerEdges[li];
                        const isSelectedSlice = selectedSliceIndex != null && layerEdge.sliceIndex === selectedSliceIndex;
                        const midX = (layerEdge.a.x + layerEdge.b.x) * 0.5;
                        const midY = (layerEdge.a.y + layerEdge.b.y) * 0.5;
                        ctx.beginPath();
                        ctx.moveTo(layerEdge.a.x, layerEdge.a.y);
                        ctx.lineTo(layerEdge.b.x, layerEdge.b.y);
                        ctx.strokeStyle = isSelectedSlice
                          ? "rgba(170, 230, 255, 0.75)"
                          : "rgba(170, 230, 255, 0.30)";
                        ctx.stroke();
                        if (isSelectedSlice) {
                          ctx.fillStyle = "rgba(200, 235, 255, 0.92)";
                          ctx.fillText(`${layerEdge.layerIndex}`, midX + 2, midY - 2);
                        }
                      }
                      // 2) Band side edges lower->upper.
                      for (let bi = 0; bi < debugShadowEntry.layerBands.length; bi++) {
                        const band = debugShadowEntry.layerBands[bi];
                        const isSelectedSlice = selectedSliceIndex != null && band.sliceIndex === selectedSliceIndex;
                        ctx.beginPath();
                        ctx.moveTo(band.lowerA.x, band.lowerA.y);
                        ctx.lineTo(band.upperA.x, band.upperA.y);
                        ctx.moveTo(band.lowerB.x, band.lowerB.y);
                        ctx.lineTo(band.upperB.x, band.upperB.y);
                        ctx.strokeStyle = isSelectedSlice
                          ? "rgba(120, 240, 220, 0.8)"
                          : "rgba(120, 240, 220, 0.25)";
                        ctx.stroke();
                      }
                      // 3) Band quad outline + runtime diagonal per (sliceParity + bandIndex).
                      for (let bi = 0; bi < debugShadowEntry.layerBands.length; bi++) {
                        const band = debugShadowEntry.layerBands[bi];
                        const pair = bandPairByKey.get(`${band.sliceIndex}:${band.bandIndex}`);
                        const isSelectedSlice = selectedSliceIndex != null && band.sliceIndex === selectedSliceIndex;
                        const isSelectedBand = isSelectedSlice && band.bandIndex === selectedBandIndex;
                        ctx.beginPath();
                        ctx.moveTo(band.lowerA.x, band.lowerA.y);
                        ctx.lineTo(band.lowerB.x, band.lowerB.y);
                        ctx.lineTo(band.upperB.x, band.upperB.y);
                        ctx.lineTo(band.upperA.x, band.upperA.y);
                        ctx.closePath();
                        ctx.strokeStyle = isSelectedBand
                          ? "rgba(230, 245, 255, 0.85)"
                          : isSelectedSlice
                          ? "rgba(205, 215, 255, 0.70)"
                          : "rgba(205, 215, 255, 0.20)";
                        ctx.stroke();
                        if (pair) {
                          ctx.beginPath();
                          if (pair.diagonal === "A_to_Bprime") {
                            ctx.moveTo(band.lowerA.x, band.lowerA.y);
                            ctx.lineTo(band.upperB.x, band.upperB.y);
                          } else {
                            ctx.moveTo(band.lowerB.x, band.lowerB.y);
                            ctx.lineTo(band.upperA.x, band.upperA.y);
                          }
                          ctx.strokeStyle = isSelectedSlice
                            ? "rgba(255, 245, 125, 0.92)"
                            : "rgba(255, 245, 125, 0.28)";
                          ctx.stroke();
                        }
                        if (isSelectedSlice) {
                          const centerX = (band.lowerA.x + band.lowerB.x + band.upperA.x + band.upperB.x) * 0.25;
                          const centerY = (band.lowerA.y + band.lowerB.y + band.upperA.y + band.upperB.y) * 0.25;
                          ctx.fillStyle = "rgba(225, 235, 255, 0.9)";
                          const suffix = isSelectedBand ? "*" : "";
                          ctx.fillText(`b${band.bandIndex}${suffix}`, centerX + 2, centerY - 2);
                        }
                      }
                      // 4) Destination triangles tri0 / tri1.
                      for (let pi = 0; pi < debugShadowEntry.destinationBandTriangles.length; pi++) {
                        const pair = debugShadowEntry.destinationBandTriangles[pi];
                        const isSelectedSlice = selectedSliceIndex != null && pair.sliceIndex === selectedSliceIndex;
                        const [t0a, t0b, t0c] = pair.tri0;
                        const [t1a, t1b, t1c] = pair.tri1;
                        ctx.beginPath();
                        ctx.moveTo(t0a.x, t0a.y);
                        ctx.lineTo(t0b.x, t0b.y);
                        ctx.lineTo(t0c.x, t0c.y);
                        ctx.closePath();
                        ctx.strokeStyle = isSelectedSlice
                          ? "rgba(255, 120, 170, 0.85)"
                          : "rgba(255, 120, 170, 0.32)";
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(t1a.x, t1a.y);
                        ctx.lineTo(t1b.x, t1b.y);
                        ctx.lineTo(t1c.x, t1c.y);
                        ctx.closePath();
                        ctx.strokeStyle = isSelectedSlice
                          ? "rgba(165, 145, 255, 0.85)"
                          : "rgba(165, 145, 255, 0.30)";
                        ctx.stroke();
                        if (isSelectedSlice) {
                          const t0cx = (t0a.x + t0b.x + t0c.x) / 3;
                          const t0cy = (t0a.y + t0b.y + t0c.y) / 3;
                          const t1cx = (t1a.x + t1b.x + t1c.x) / 3;
                          const t1cy = (t1a.y + t1b.y + t1c.y) / 3;
                          ctx.fillStyle = "rgba(255, 130, 180, 0.95)";
                          ctx.fillText("t0", t0cx + 1, t0cy - 1);
                          ctx.fillStyle = "rgba(180, 160, 255, 0.95)";
                          ctx.fillText("t1", t1cx + 1, t1cy - 1);
                        }
                      }
                      const triangleCentroid = (tri: readonly [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]) => ({
                        x: (tri[0].x + tri[1].x + tri[2].x) / 3,
                        y: (tri[0].y + tri[1].y + tri[2].y) / 3,
                      });
                      // 5) Explicit source -> destination correspondence for selected slice+band.
                      for (let gi = 0; gi < debugShadowEntry.triangleCorrespondenceGroups.length; gi++) {
                        const group = debugShadowEntry.triangleCorrespondenceGroups[gi];
                        const isSelectedGroup = selectedSliceIndex != null
                          && group.sliceIndex === selectedSliceIndex
                          && group.bandIndex === selectedBandIndex;
                        if (!isSelectedGroup) continue;
                        for (let si = 0; si < group.sourceTriangles.length; si++) {
                          const src = group.sourceTriangles[si];
                          const [a, b, c] = src.sourceTrianglePoints;
                          ctx.beginPath();
                          ctx.moveTo(a.x, a.y);
                          ctx.lineTo(b.x, b.y);
                          ctx.lineTo(c.x, c.y);
                          ctx.closePath();
                          ctx.strokeStyle = "rgba(255, 150, 70, 0.92)";
                          ctx.stroke();
                        }
                        for (let di = 0; di < group.destinationTriangles.length; di++) {
                          const dst = group.destinationTriangles[di];
                          const [a, b, c] = dst.destinationTrianglePoints;
                          ctx.beginPath();
                          ctx.moveTo(a.x, a.y);
                          ctx.lineTo(b.x, b.y);
                          ctx.lineTo(c.x, c.y);
                          ctx.closePath();
                          ctx.strokeStyle = "rgba(90, 255, 160, 0.92)";
                          ctx.stroke();
                        }
                        for (let ci = 0; ci < group.correspondences.length; ci++) {
                          const pair = group.correspondences[ci];
                          const srcCentroid = triangleCentroid(pair.sourceTrianglePoints);
                          const dstCentroid = triangleCentroid(pair.destinationTrianglePoints);
                          const midX = (srcCentroid.x + dstCentroid.x) * 0.5;
                          const midY = (srcCentroid.y + dstCentroid.y) * 0.5;
                          ctx.beginPath();
                          ctx.moveTo(srcCentroid.x, srcCentroid.y);
                          ctx.lineTo(dstCentroid.x, dstCentroid.y);
                          ctx.strokeStyle = "rgba(255, 225, 85, 0.95)";
                          ctx.stroke();
                          ctx.fillStyle = "rgba(255, 250, 205, 0.98)";
                          ctx.fillText(
                            `s${pair.sliceIndex} b${pair.bandIndex} src${pair.sourceTriangleIndexWithinBand}->dst${pair.destinationTriangleIndex}`,
                            midX + 2,
                            midY - 2,
                          );
                        }
                        if (group.mismatch) {
                          const srcAnchor = group.sourceTriangles[0]
                            ? triangleCentroid(group.sourceTriangles[0].sourceTrianglePoints)
                            : null;
                          const dstAnchor = group.destinationTriangles[0]
                            ? triangleCentroid(group.destinationTriangles[0].destinationTrianglePoints)
                            : null;
                          const anchorX = srcAnchor ? srcAnchor.x : (dstAnchor ? dstAnchor.x : draw.dx);
                          const anchorY = srcAnchor ? srcAnchor.y : (dstAnchor ? dstAnchor.y : draw.dy);
                          ctx.fillStyle = "rgba(255, 90, 90, 0.98)";
                          ctx.fillText(
                            `MISMATCH s${group.sliceIndex} b${group.bandIndex} src:${group.mismatch.sourceTriangleCount} dst:${group.mismatch.destinationTriangleCount}`,
                            anchorX + 4,
                            anchorY - 10,
                          );
                        }
                      }
                      for (let mi = 0; mi < debugShadowEntry.triangleCorrespondenceMismatches.length; mi++) {
                        const mismatch = debugShadowEntry.triangleCorrespondenceMismatches[mi];
                        const sourceCandidate = debugShadowEntry.sourceBandTriangles.find(
                          (source) => source.sliceIndex === mismatch.sliceIndex && source.bandIndex === mismatch.bandIndex,
                        );
                        const destinationCandidate = debugShadowEntry.destinationBandEntries.find(
                          (destination) => destination.sliceIndex === mismatch.sliceIndex && destination.bandIndex === mismatch.bandIndex,
                        );
                        const sourceAnchor = sourceCandidate ? triangleCentroid(sourceCandidate.sourceTrianglePoints) : null;
                        const destinationAnchor = destinationCandidate ? triangleCentroid(destinationCandidate.destinationTrianglePoints) : null;
                        const anchorX = sourceAnchor ? sourceAnchor.x : (destinationAnchor ? destinationAnchor.x : draw.dx);
                        const anchorY = sourceAnchor ? sourceAnchor.y : (destinationAnchor ? destinationAnchor.y : draw.dy);
                        ctx.beginPath();
                        ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
                        ctx.fillStyle = "rgba(255, 70, 70, 0.98)";
                        ctx.fill();
                      }
                      for (let si = 0; si < debugShadowEntry.sliceStrips.length; si++) {
                        const strip = debugShadowEntry.sliceStrips[si];
                        const baseMidX = (strip.baseA.x + strip.baseB.x) * 0.5;
                        const baseMidY = (strip.baseA.y + strip.baseB.y) * 0.5;
                        const topMidX = (strip.topA.x + strip.topB.x) * 0.5;
                        const topMidY = (strip.topA.y + strip.topB.y) * 0.5;
                        // Base segment: red
                        ctx.beginPath();
                        ctx.moveTo(strip.baseA.x, strip.baseA.y);
                        ctx.lineTo(strip.baseB.x, strip.baseB.y);
                        ctx.strokeStyle = "rgba(255, 70, 70, 0.96)";
                        ctx.stroke();
                        // Top segment: green
                        ctx.beginPath();
                        ctx.moveTo(strip.topA.x, strip.topA.y);
                        ctx.lineTo(strip.topB.x, strip.topB.y);
                        ctx.strokeStyle = "rgba(70, 255, 120, 0.96)";
                        ctx.stroke();
                        // Strip edges: cyan
                        ctx.beginPath();
                        ctx.moveTo(strip.baseA.x, strip.baseA.y);
                        ctx.lineTo(strip.topA.x, strip.topA.y);
                        ctx.moveTo(strip.baseB.x, strip.baseB.y);
                        ctx.lineTo(strip.topB.x, strip.topB.y);
                        ctx.strokeStyle = "rgba(80, 225, 255, 0.96)";
                        ctx.stroke();
                        // Midpoint connector: yellow
                        ctx.beginPath();
                        ctx.moveTo(baseMidX, baseMidY);
                        ctx.lineTo(topMidX, topMidY);
                        ctx.strokeStyle = "rgba(255, 235, 90, 0.98)";
                        ctx.stroke();
                        ctx.fillStyle = "rgba(255, 245, 190, 0.98)";
                        ctx.fillText(`${strip.sliceIndex}`, baseMidX + 2, baseMidY - 2);
                      }
                      const bounds = debugShadowEntry.projectedBounds;
                      const anchor = debugShadowEntry.sliceStrips[0];
                      const labelX = bounds
                        ? bounds.x + 4
                        : anchor
                          ? anchor.baseA.x + 4
                          : draw.dx + 4;
                      const labelY = bounds
                        ? bounds.y - 8
                        : anchor
                          ? anchor.baseA.y - 8
                          : draw.dy - 8;
                      if (bounds) {
                        ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
                        ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
                      }
                      const ref = debugShadowEntry.deltaReference;
                      const deltaLabel = ref
                        ? `d(${ref.x.toFixed(1)},${ref.y.toFixed(1)})`
                        : "d(none)";
                      const focusLabel = selectedSliceIndex != null ? `${selectedSliceIndex}:${selectedBandIndex}` : "none";
                      let diagonalACount = 0;
                      let diagonalBCount = 0;
                      for (let di = 0; di < debugShadowEntry.destinationBandTriangles.length; di++) {
                        if (debugShadowEntry.destinationBandTriangles[di].diagonal === "A_to_Bprime") {
                          diagonalACount += 1;
                        } else {
                          diagonalBCount += 1;
                        }
                      }
                      const diagonalLabel = `A:${diagonalACount} B:${diagonalBCount}`;
                      const cacheLabel = `shadow:v4 cache:${debugShadowCacheHit ? "hit" : "rebuild"} cap:${debugShadowEntry.topCapTriangles.length} corr:${debugShadowEntry.correspondences.length} strips:${debugShadowEntry.sliceStrips.length} layers:${debugShadowEntry.layerHeightsPx.length} edges:${debugShadowEntry.layerEdges.length} bands:${debugShadowEntry.layerBands.length} triPairs:${debugShadowEntry.destinationBandTriangles.length} tri:${debugShadowEntry.destinationTriangles.length} srcTri:${debugShadowEntry.sourceBandTriangles.length} dstTri:${debugShadowEntry.destinationBandEntries.length} map:${debugShadowEntry.triangleCorrespondence.length} mismatch:${debugShadowEntry.triangleCorrespondenceMismatches.length} diag:${diagonalLabel} focus:${focusLabel} deltaConst:${debugShadowEntry.isDeltaConstant ? "yes" : "no"} ${deltaLabel}`;
                      ctx.font = "10px monospace";
                      ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
                      ctx.fillText(cacheLabel, labelX + 1, labelY + 1);
                      ctx.fillStyle = "rgba(210, 230, 255, 0.97)";
                      ctx.fillText(cacheLabel, labelX, labelY);
                      ctx.restore();
                    });
                  } else if (structureShadowHybridCacheEntry) {
                    const debugShadowEntry = structureShadowHybridCacheEntry;
                    deferredStructureSliceDebugDraws.push(() => {
                      const activeRoofLevel = debugShadowEntry.roofScan.activeLevel;
                      const roofCorner = activeRoofLevel?.quad?.[0]
                        ?? debugShadowEntry.projectedTopCapTriangles[0]?.[0]
                        ?? debugShadowEntry.casterTriangles[0]?.[0]
                        ?? null;
                      const showCapDebug = SHADOW_V1_DEBUG_GEOMETRY_MODE !== "connectorsOnly";
                      const showStripDebug = SHADOW_V1_DEBUG_GEOMETRY_MODE !== "capOnly";
                      const showSourceDebug = SHADOW_V1_DEBUG_GEOMETRY_MODE !== "capOnly";
                      const showRebuiltDebug = SHADOW_V1_DEBUG_GEOMETRY_MODE !== "capOnly";
                      ctx.save();
                      ctx.lineWidth = 1;
                      if (activeRoofLevel) {
                        const [rnw, rne, rse, rsw] = activeRoofLevel.quad;
                        ctx.beginPath();
                        ctx.moveTo(rnw.x, rnw.y);
                        ctx.lineTo(rne.x, rne.y);
                        ctx.lineTo(rse.x, rse.y);
                        ctx.lineTo(rsw.x, rsw.y);
                        ctx.closePath();
                        ctx.strokeStyle = "rgba(255, 240, 180, 0.92)";
                        ctx.stroke();
                      }
                      if (showSourceDebug) {
                        for (let ti = 0; ti < debugShadowEntry.casterTriangles.length; ti++) {
                          const [a, b, c] = debugShadowEntry.casterTriangles[ti];
                          ctx.beginPath();
                          ctx.moveTo(a.x, a.y);
                          ctx.lineTo(b.x, b.y);
                          ctx.lineTo(c.x, c.y);
                          ctx.closePath();
                          ctx.fillStyle = "rgba(255, 220, 90, 0.28)";
                          ctx.strokeStyle = "rgba(255, 245, 175, 0.96)";
                          ctx.fill();
                          ctx.stroke();
                        }
                      }
                      if (showCapDebug) {
                        for (let ti = 0; ti < debugShadowEntry.projectedTopCapTriangles.length; ti++) {
                          const [a, b, c] = debugShadowEntry.projectedTopCapTriangles[ti];
                          ctx.beginPath();
                          ctx.moveTo(a.x, a.y);
                          ctx.lineTo(b.x, b.y);
                          ctx.lineTo(c.x, c.y);
                          ctx.closePath();
                          ctx.fillStyle = "rgba(20, 110, 245, 0.15)";
                          ctx.strokeStyle = "rgba(90, 170, 255, 0.95)";
                          ctx.fill();
                          ctx.stroke();
                        }
                      }
                      if (showStripDebug) {
                        ctx.font = "9px monospace";
                        for (let si = 0; si < debugShadowEntry.slicePerimeterSegments.length; si++) {
                          const segment = debugShadowEntry.slicePerimeterSegments[si];
                          const [ba, bb] = segment.baseSegment;
                          const [ta, tb] = segment.topSegment;
                          const hue = (segment.sliceIndex * 37) % 360;
                          const baseMidX = (ba.x + bb.x) * 0.5;
                          const baseMidY = (ba.y + bb.y) * 0.5;
                          const topMidX = (ta.x + tb.x) * 0.5;
                          const topMidY = (ta.y + tb.y) * 0.5;
                          ctx.beginPath();
                          ctx.moveTo(ba.x, ba.y);
                          ctx.lineTo(bb.x, bb.y);
                          ctx.strokeStyle = `hsla(${hue}, 92%, 65%, 0.98)`;
                          ctx.stroke();
                          ctx.beginPath();
                          ctx.moveTo(ta.x, ta.y);
                          ctx.lineTo(tb.x, tb.y);
                          ctx.strokeStyle = `hsla(${hue}, 80%, 56%, 0.95)`;
                          ctx.stroke();
                          ctx.save();
                          ctx.setLineDash([3, 2]);
                          ctx.beginPath();
                          ctx.moveTo(baseMidX, baseMidY);
                          ctx.lineTo(topMidX, topMidY);
                          ctx.strokeStyle = `hsla(${hue}, 75%, 74%, 0.9)`;
                          ctx.stroke();
                          ctx.restore();
                          ctx.fillStyle = `hsla(${hue}, 90%, 78%, 0.98)`;
                          ctx.fillText(`${segment.sliceIndex}`, baseMidX + 2, baseMidY - 2);
                        }
                      }
                      if (showRebuiltDebug) {
                        for (let ti = 0; ti < debugShadowEntry.projectedTriangles.length; ti++) {
                          const [a, b, c] = debugShadowEntry.projectedTriangles[ti];
                          ctx.beginPath();
                          ctx.moveTo(a.x, a.y);
                          ctx.lineTo(b.x, b.y);
                          ctx.lineTo(c.x, c.y);
                          ctx.closePath();
                          ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
                          ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
                          ctx.fill();
                          ctx.stroke();
                        }
                      }
                      if (showStripDebug) {
                        const sampleBandIndex = debugShadowEntry.slicePerimeterSegments[0]?.bandIndex
                          ?? debugShadowEntry.sliceShadowStrips[0]?.bandIndex
                          ?? null;
                        if (sampleBandIndex != null) {
                          for (let mi = 0; mi < debugShadowEntry.projectedMappings.length; mi++) {
                            const mapping = debugShadowEntry.projectedMappings[mi];
                            if (mapping.bandIndex !== sampleBandIndex) continue;
                            const [sa, sb, sc] = mapping.sourceTriangle;
                            const [da, db, dc] = mapping.projectedTriangle;
                            const sx = (sa.x + sb.x + sc.x) / 3;
                            const sy = (sa.y + sb.y + sc.y) / 3;
                            const dx = (da.x + db.x + dc.x) / 3;
                            const dy = (da.y + db.y + dc.y) / 3;
                            ctx.beginPath();
                            ctx.moveTo(sx, sy);
                            ctx.lineTo(dx, dy);
                            ctx.strokeStyle = "rgba(255, 110, 240, 0.85)";
                            ctx.stroke();
                          }
                        }
                      }
                      const shadowBounds = debugShadowEntry.projectedBounds;
                      const labelX = shadowBounds
                        ? shadowBounds.x + 4
                        : roofCorner
                          ? roofCorner.x + 4
                          : draw.dx + 4;
                      const labelY = shadowBounds
                        ? shadowBounds.y - 8
                        : roofCorner
                          ? roofCorner.y - 8
                          : draw.dy - 8;
                      if (shadowBounds && (showCapDebug || showRebuiltDebug)) {
                        ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
                        ctx.strokeRect(shadowBounds.x, shadowBounds.y, shadowBounds.w, shadowBounds.h);
                      }
                      const roofLevelLabel = activeRoofLevel ? `${activeRoofLevel.level}` : "none";
                      const cacheLabel = `shadow:v3-hybrid cache:${debugShadowCacheHit ? "hit" : "rebuild"} mode:${SHADOW_V1_DEBUG_GEOMETRY_MODE} roofL:${roofLevelLabel} side:${debugShadowEntry.sideSemantic} cast:${debugShadowEntry.casterTriangles.length} top:${debugShadowEntry.topCasterTriangleCount} sideCast:${debugShadowEntry.sideCasterTriangleCount} seg:${debugShadowEntry.slicePerimeterSegments.length} strips:${debugShadowEntry.sliceShadowStrips.length} cap:${debugShadowEntry.projectedTopCapTriangles.length} rebuilt:${debugShadowEntry.projectedTriangles.length}`;
                      ctx.font = "10px monospace";
                      ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
                      ctx.fillText(cacheLabel, labelX + 1, labelY + 1);
                      ctx.fillStyle = "rgba(210, 230, 255, 0.97)";
                      ctx.fillText(cacheLabel, labelX, labelY);
                      ctx.restore();
                    });
                  } else if (structureShadowV2CacheEntry) {
                    const debugShadowEntry = structureShadowV2CacheEntry;
                    deferredStructureSliceDebugDraws.push(() => {
                      const showCapDebug = SHADOW_V1_DEBUG_GEOMETRY_MODE !== "connectorsOnly";
                      const showConnectorDebug = SHADOW_V1_DEBUG_GEOMETRY_MODE !== "capOnly";
                      const activeRoofLevel = debugShadowEntry.roofScan.activeLevel;
                      const roofCorner = activeRoofLevel?.quad?.[0] ?? null;
                      ctx.save();
                      ctx.lineWidth = 1;
                      if (activeRoofLevel) {
                        const [rnw, rne, rse, rsw] = activeRoofLevel.quad;
                        ctx.beginPath();
                        ctx.moveTo(rnw.x, rnw.y);
                        ctx.lineTo(rne.x, rne.y);
                        ctx.lineTo(rse.x, rse.y);
                        ctx.lineTo(rsw.x, rsw.y);
                        ctx.closePath();
                        ctx.strokeStyle = "rgba(255, 240, 180, 0.92)";
                        ctx.stroke();
                      }
                      if (showCapDebug) {
                        for (let ti = 0; ti < debugShadowEntry.projectedCapTriangles.length; ti++) {
                          const [a, b, c] = debugShadowEntry.projectedCapTriangles[ti];
                          ctx.beginPath();
                          ctx.moveTo(a.x, a.y);
                          ctx.lineTo(b.x, b.y);
                          ctx.lineTo(c.x, c.y);
                          ctx.closePath();
                          ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
                          ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
                          ctx.fill();
                          ctx.stroke();
                        }
                      }
                      if (showConnectorDebug) {
                        for (let ti = 0; ti < debugShadowEntry.connectorTriangles.length; ti++) {
                          const [a, b, c] = debugShadowEntry.connectorTriangles[ti];
                          ctx.beginPath();
                          ctx.moveTo(a.x, a.y);
                          ctx.lineTo(b.x, b.y);
                          ctx.lineTo(c.x, c.y);
                          ctx.closePath();
                          ctx.fillStyle = "rgba(15, 20, 35, 0.20)";
                          ctx.strokeStyle = "rgba(180, 210, 255, 0.90)";
                          ctx.fill();
                          ctx.stroke();
                        }
                      }
                      for (let ei = 0; ei < debugShadowEntry.sourceBoundaryEdges.length; ei++) {
                        const [a, b] = debugShadowEntry.sourceBoundaryEdges[ei];
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = "rgba(255, 150, 80, 0.97)";
                        ctx.stroke();
                      }
                      for (let ei = 0; ei < debugShadowEntry.projectedBoundaryEdges.length; ei++) {
                        const [a, b] = debugShadowEntry.projectedBoundaryEdges[ei];
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = "rgba(110, 190, 255, 0.98)";
                        ctx.stroke();
                      }
                      const shadowBounds = debugShadowEntry.projectedBounds;
                      const labelX = shadowBounds
                        ? shadowBounds.x + 4
                        : roofCorner
                          ? roofCorner.x + 4
                          : draw.dx + 4;
                      const labelY = shadowBounds
                        ? shadowBounds.y - 8
                        : roofCorner
                          ? roofCorner.y - 8
                          : draw.dy - 8;
                      if (shadowBounds) {
                        ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
                        ctx.strokeRect(shadowBounds.x, shadowBounds.y, shadowBounds.w, shadowBounds.h);
                      }
                      const roofLevelLabel = activeRoofLevel ? `${activeRoofLevel.level}` : "none";
                      const cacheLabel = `shadow:v2 cache:${debugShadowCacheHit ? "hit" : "rebuild"} mode:${SHADOW_V1_DEBUG_GEOMETRY_MODE} roofL:${roofLevelLabel} castH:${Math.round(debugShadowEntry.castHeightPx)} loops:${debugShadowEntry.sourceBoundaryLoops.length} edge:${debugShadowEntry.sourceBoundaryEdges.length} cap:${debugShadowEntry.projectedCapTriangles.length} conn:${debugShadowEntry.connectorTriangles.length}`;
                      ctx.font = "10px monospace";
                      ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
                      ctx.fillText(cacheLabel, labelX + 1, labelY + 1);
                      ctx.fillStyle = "rgba(210, 230, 255, 0.97)";
                      ctx.fillText(cacheLabel, labelX, labelY);
                      ctx.restore();
                    });
                  } else if (structureShadowV1CacheEntry) {
                    const debugShadowEntry = structureShadowV1CacheEntry;
                    deferredStructureSliceDebugDraws.push(() => {
                      const activeRoofLevel = debugShadowEntry.roofScan.activeLevel;
                      if (!activeRoofLevel) return;
                      const showCapDebug = SHADOW_V1_DEBUG_GEOMETRY_MODE !== "connectorsOnly";
                      const showConnectorDebug = SHADOW_V1_DEBUG_GEOMETRY_MODE !== "capOnly";
                      ctx.save();
                      ctx.lineWidth = 1;
                      for (let ti = 0; ti < debugShadowEntry.roofCasterTriangles.length; ti++) {
                        const tri = debugShadowEntry.roofCasterTriangles[ti];
                        const [a, b, c] = tri.points;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.lineTo(c.x, c.y);
                        ctx.closePath();
                        ctx.fillStyle = "rgba(255, 220, 90, 0.32)";
                        ctx.strokeStyle = "rgba(255, 245, 175, 0.98)";
                        ctx.fill();
                        ctx.stroke();
                      }
                      const [rnw, rne, rse, rsw] = activeRoofLevel.quad;
                      ctx.beginPath();
                      ctx.moveTo(rnw.x, rnw.y);
                      ctx.lineTo(rne.x, rne.y);
                      ctx.lineTo(rse.x, rse.y);
                      ctx.lineTo(rsw.x, rsw.y);
                      ctx.closePath();
                      ctx.strokeStyle = "rgba(255, 240, 180, 0.96)";
                      ctx.stroke();
                      if (showCapDebug) {
                        for (let ti = 0; ti < debugShadowEntry.projectedTriangles.length; ti++) {
                          const [a, b, c] = debugShadowEntry.projectedTriangles[ti];
                          ctx.beginPath();
                          ctx.moveTo(a.x, a.y);
                          ctx.lineTo(b.x, b.y);
                          ctx.lineTo(c.x, c.y);
                          ctx.closePath();
                          ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
                          ctx.strokeStyle = "rgba(130, 170, 255, 0.95)";
                          ctx.fill();
                          ctx.stroke();
                        }
                      }
                      if (showConnectorDebug) {
                        for (let ti = 0; ti < debugShadowEntry.connectorTriangles.length; ti++) {
                          const [a, b, c] = debugShadowEntry.connectorTriangles[ti];
                          ctx.beginPath();
                          ctx.moveTo(a.x, a.y);
                          ctx.lineTo(b.x, b.y);
                          ctx.lineTo(c.x, c.y);
                          ctx.closePath();
                          ctx.fillStyle = "rgba(15, 20, 35, 0.20)";
                          ctx.strokeStyle = "rgba(175, 200, 255, 0.90)";
                          ctx.fill();
                          ctx.stroke();
                        }
                      }
                      for (let ei = 0; ei < debugShadowEntry.roofBoundaryEdges.length; ei++) {
                        const [a, b] = debugShadowEntry.roofBoundaryEdges[ei];
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = "rgba(255, 140, 70, 0.98)";
                        ctx.stroke();
                      }
                      for (let ei = 0; ei < debugShadowEntry.footprintBoundaryEdges.length; ei++) {
                        const [a, b] = debugShadowEntry.footprintBoundaryEdges[ei];
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = "rgba(140, 255, 170, 0.95)";
                        ctx.stroke();
                      }
                      for (let ei = 0; ei < debugShadowEntry.projectedBoundaryEdges.length; ei++) {
                        const [a, b] = debugShadowEntry.projectedBoundaryEdges[ei];
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = "rgba(110, 190, 255, 0.98)";
                        ctx.stroke();
                      }
                      const shadowBounds = debugShadowEntry.projectedBounds;
                      const labelX = shadowBounds ? shadowBounds.x + 4 : rnw.x + 4;
                      const labelY = shadowBounds ? shadowBounds.y - 8 : rnw.y - 8;
                      if (shadowBounds) {
                        ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
                        ctx.strokeRect(shadowBounds.x, shadowBounds.y, shadowBounds.w, shadowBounds.h);
                      }
                      const cacheLabel = `shadow:v1 cache:${debugShadowCacheHit ? "hit" : "rebuild"} mode:${SHADOW_V1_DEBUG_GEOMETRY_MODE} roofL:${activeRoofLevel.level} cast:${debugShadowEntry.roofCasterTriangles.length} edge:${debugShadowEntry.roofBoundaryEdges.length} base:${debugShadowEntry.footprintBoundaryEdges.length} cap:${debugShadowEntry.projectedTriangles.length} conn:${debugShadowEntry.connectorTriangles.length}`;
                      ctx.font = "10px monospace";
                      ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
                      ctx.fillText(cacheLabel, labelX + 1, labelY + 1);
                      ctx.fillStyle = "rgba(210, 230, 255, 0.97)";
                      ctx.fillText(cacheLabel, labelX, labelY);
                      ctx.restore();
                    });
                  }
                }
              }
              if (SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG && projectedFootprintQuad && overlayHasVisibleTriangleGroup) {
                const allTriangles = triangleCache.triangles;
                const triangleCentroids: Array<{ tri: typeof allTriangles[number]; centroid: ScreenPt }> = [];
                const centroidPoints: ScreenPt[] = [];
                for (let ti = 0; ti < allTriangles.length; ti++) {
                  const tri = allTriangles[ti];
                  const [a, b, c] = tri.points;
                  const centroid = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
                  triangleCentroids.push({ tri, centroid });
                  centroidPoints.push(centroid);
                }
                const supportScan = scanLiftedFootprintSupportLevels(
                  projectedFootprintQuad,
                  footprintW,
                  footprintH,
                  centroidPoints,
                );
                const activeLevelIndex = supportScan.highestValidLevel >= 0 ? supportScan.highestValidLevel : 0;
                const activeLevel = supportScan.levels[Math.min(activeLevelIndex, supportScan.levels.length - 1)] ?? null;
                const leftSouthMaxProgression = footprintW - 1;
                const rightEastMinProgression = footprintW;
                const progressionByOwnerTile = new Map<string, { min: number; max: number }>();
                for (let bi = 0; bi < bandPieces.length; bi++) {
                  const band = bandPieces[bi];
                  const ownerTx = band.renderKey.within;
                  const ownerTy = band.renderKey.slice - band.renderKey.within;
                  const ownerKey = `${ownerTx},${ownerTy}`;
                  const progression = resolveRuntimeStructureBandProgressionIndex(band.index, footprintW, footprintH);
                  const existing = progressionByOwnerTile.get(ownerKey);
                  if (!existing) {
                    progressionByOwnerTile.set(ownerKey, { min: progression, max: progression });
                  } else {
                    if (progression < existing.min) existing.min = progression;
                    if (progression > existing.max) existing.max = progression;
                  }
                }
                const semanticCounts: Record<StructureTriangleSemanticClass, number> = {
                  TOP: 0,
                  LEFT_SOUTH: 0,
                  RIGHT_EAST: 0,
                  UNCLASSIFIED: 0,
                  CONFLICT: 0,
                };
                const semanticTriangles = triangleCentroids.map((entry) => {
                  const ownerKey = `${entry.tri.parentTx},${entry.tri.parentTy}`;
                  const ownerRange = progressionByOwnerTile.get(ownerKey);
                  const isTop = !!activeLevel && isPointInsideProjectedStructureFootprintQuad(
                    activeLevel.quad,
                    entry.centroid.x,
                    entry.centroid.y,
                  );
                  const leftCandidate = !!ownerRange && ownerRange.min <= leftSouthMaxProgression;
                  const rightCandidate = !!ownerRange && ownerRange.max >= rightEastMinProgression;
                  let semantic: StructureTriangleSemanticClass = "UNCLASSIFIED";
                  if (isTop) {
                    semantic = "TOP";
                  } else if (leftCandidate && rightCandidate) {
                    semantic = "CONFLICT";
                  } else if (leftCandidate) {
                    semantic = "LEFT_SOUTH";
                  } else if (rightCandidate) {
                    semantic = "RIGHT_EAST";
                  }
                  semanticCounts[semantic]++;
                  return {
                    tri: entry.tri,
                    centroid: entry.centroid,
                    semantic,
                  };
                });
                deferredStructureSliceDebugDraws.push(() => {
                  if (!activeLevel) return;
                  ctx.save();
                  ctx.lineWidth = 1;
                  for (let ti = 0; ti < semanticTriangles.length; ti++) {
                    const entry = semanticTriangles[ti];
                    const tri = entry.tri;
                    const [a, b, c] = tri.points;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.lineTo(c.x, c.y);
                    ctx.closePath();
                    if (entry.semantic === "TOP") {
                      ctx.fillStyle = "rgba(255, 216, 64, 0.30)";
                      ctx.strokeStyle = "rgba(255, 240, 170, 0.95)";
                    } else if (entry.semantic === "LEFT_SOUTH") {
                      ctx.fillStyle = "rgba(85, 210, 255, 0.24)";
                      ctx.strokeStyle = "rgba(150, 240, 255, 0.95)";
                    } else if (entry.semantic === "RIGHT_EAST") {
                      ctx.fillStyle = "rgba(255, 150, 80, 0.24)";
                      ctx.strokeStyle = "rgba(255, 195, 130, 0.95)";
                    } else if (entry.semantic === "CONFLICT") {
                      ctx.fillStyle = "rgba(255, 80, 220, 0.26)";
                      ctx.strokeStyle = "rgba(255, 150, 240, 0.96)";
                    } else {
                      ctx.fillStyle = "rgba(95, 120, 150, 0.18)";
                      ctx.strokeStyle = "rgba(180, 205, 235, 0.82)";
                    }
                    ctx.fill();
                    ctx.stroke();
                  }
                  for (let ci = 0; ci < activeLevel.cells.length; ci++) {
                    const cell = activeLevel.cells[ci];
                    const [c0, c1, c2, c3] = cell.quad;
                    ctx.beginPath();
                    ctx.moveTo(c0.x, c0.y);
                    ctx.lineTo(c1.x, c1.y);
                    ctx.lineTo(c2.x, c2.y);
                    ctx.lineTo(c3.x, c3.y);
                    ctx.closePath();
                    ctx.fillStyle = cell.supported
                      ? "rgba(120, 255, 145, 0.07)"
                      : "rgba(255, 90, 90, 0.16)";
                    ctx.strokeStyle = cell.supported
                      ? "rgba(120, 255, 145, 0.42)"
                      : "rgba(255, 110, 110, 0.88)";
                    ctx.fill();
                    ctx.stroke();
                  }
                  const [nw, ne, se, sw] = activeLevel.quad;
                  ctx.beginPath();
                  ctx.moveTo(nw.x, nw.y);
                  ctx.lineTo(ne.x, ne.y);
                  ctx.lineTo(se.x, se.y);
                  ctx.lineTo(sw.x, sw.y);
                  ctx.closePath();
                  ctx.fillStyle = activeLevel.allSupported
                    ? "rgba(120, 255, 145, 0.10)"
                    : "rgba(255, 120, 120, 0.08)";
                  ctx.strokeStyle = activeLevel.allSupported
                    ? "rgba(120, 255, 145, 0.95)"
                    : "rgba(255, 140, 140, 0.95)";
                  ctx.fill();
                  ctx.stroke();
                  const roofLevelLabel = supportScan.highestValidLevel >= 0
                    ? `${supportScan.highestValidLevel}`
                    : "none";
                  const labelX = nw.x + 8;
                  const labelY = nw.y - 8;
                  ctx.font = "10px monospace";
                  const header = `roof:${roofLevelLabel} active:${activeLevel.level} lift:${Math.round(activeLevel.liftYPx)} cells:${activeLevel.supportedCells}/${activeLevel.totalCells}`;
                  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
                  ctx.fillText(header, labelX + 1, labelY + 1);
                  ctx.fillStyle = "rgba(235, 255, 235, 0.96)";
                  ctx.fillText(header, labelX, labelY);
                  const semanticLabel = `TOP:${semanticCounts.TOP} LS:${semanticCounts.LEFT_SOUTH} RE:${semanticCounts.RIGHT_EAST} U:${semanticCounts.UNCLASSIFIED} C:${semanticCounts.CONFLICT}`;
                  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
                  ctx.fillText(semanticLabel, labelX + 1, labelY + 12);
                  ctx.fillStyle = "rgba(235, 240, 255, 0.96)";
                  ctx.fillText(semanticLabel, labelX, labelY + 11);
                  const ownershipLabel = `ranges first:${footprintW + 1} last:${footprintH + 1} split@i=${rightEastMinProgression}`;
                  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
                  ctx.fillText(ownershipLabel, labelX + 1, labelY + 23);
                  ctx.fillStyle = "rgba(230, 230, 230, 0.95)";
                  ctx.fillText(ownershipLabel, labelX, labelY + 22);
                  const maxLevelRows = 6;
                  for (let li = 0; li < supportScan.levels.length && li < maxLevelRows; li++) {
                    const level = supportScan.levels[li];
                    const rowY = labelY + 34 + li * 11;
                    const levelLabel = `L${level.level}: ${level.supportedCells}/${level.totalCells} ${level.allSupported ? "ok" : "fail"}`;
                    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
                    ctx.fillText(levelLabel, labelX + 1, rowY + 1);
                    ctx.fillStyle = level.allSupported
                      ? "rgba(150, 255, 175, 0.95)"
                      : "rgba(255, 160, 160, 0.96)";
                    ctx.fillText(levelLabel, labelX, rowY);
                  }
                  if (supportScan.levels.length > maxLevelRows) {
                    const rowY = labelY + 34 + maxLevelRows * 11;
                    const overflowLabel = `... +${supportScan.levels.length - maxLevelRows} levels`;
                    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
                    ctx.fillText(overflowLabel, labelX + 1, rowY + 1);
                    ctx.fillStyle = "rgba(220, 220, 220, 0.95)";
                    ctx.fillText(overflowLabel, labelX, rowY);
                  }
                  ctx.restore();
                });
              }
	            }
	          }

          if (usedTriangleGeometryPath) continue;

          for (let bi = 0; bi < bandPieces.length; bi++) {
            const band = bandPieces[bi];
            const ownerTx = band.renderKey.within;
            const ownerTy = band.renderKey.slice - band.renderKey.within;
            if (!isTileInRenderRadius(ownerTx, ownerTy)) continue;
            const overlayKey: RenderKey = {
              slice: band.renderKey.slice,
              within: band.renderKey.within,
              baseZ: band.renderKey.baseZ,
              kindOrder: KindOrder.STRUCTURE,
              ...(structureSouthTieBreak ?? {}),
              stableId: band.renderKey.stableId,
            };
            addToSlice(band.renderKey.slice, overlayKey, () => {
              const img = draw.img;
              if (!img) return;
              const sourceImg: CanvasImageSource = draw.flipX ? getFlippedOverlayImage(img) : img;
              const x0 = Math.round(band.dstRect.x);
              const y0 = Math.round(band.dstRect.y);
              const x1 = Math.round(band.dstRect.x + band.dstRect.w);
              const y1 = Math.round(band.dstRect.y + band.dstRect.h);
              const snappedW = Math.max(0, x1 - x0);
              const snappedH = Math.max(0, y1 - y0);
              if (snappedW <= 0 || snappedH <= 0) return;
              ctx.imageSmoothingEnabled = false;
              let relitCanvas: HTMLCanvasElement | null = null;
              if (STATIC_RELIGHT_INCLUDE_STRUCTURES && o.layerRole === "STRUCTURE" && staticRelightFrame) {
                const pieceKey = structureSliceRelightPieceKey(
                  o,
                  band.index,
                  ownerTx,
                  ownerTy,
                  band.srcRect.x,
                  band.srcRect.y,
                  band.srcRect.w,
                  band.srcRect.h,
                  snappedW,
                  snappedH,
                  !!draw.flipX,
                );
                const bakedEntry = staticRelightBakeStore.get(pieceKey);
                if (bakedEntry?.kind === "RELIT") relitCanvas = bakedEntry.baked;
              }
              if (relitCanvas) {
                ctx.drawImage(relitCanvas, x0, y0, snappedW, snappedH);
              } else {
                ctx.drawImage(
                  sourceImg,
                  band.srcRect.x,
                  band.srcRect.y,
                  band.srcRect.w,
                  band.srcRect.h,
                  x0,
                  y0,
                  snappedW,
                  snappedH,
                );
              }
              if (SHOW_STRUCTURE_SLICE_DEBUG) {
                deferredStructureSliceDebugDraws.push(() => {
                  ctx.save();
                  ctx.strokeStyle = "#00ffd5";
                  ctx.lineWidth = 1;
                  ctx.strokeRect(band.dstRect.x, band.dstRect.y, band.dstRect.w, band.dstRect.h);
                  const progressionIndex = resolveRuntimeStructureBandProgressionIndex(
                    band.index,
                    o.w,
                    o.h,
                  );
                  drawStructureSliceTriangleDebugOverlay(
                    ctx,
                    band.dstRect,
                    progressionIndex,
                    T,
                    o.id,
                    band.index,
                    sourceImg,
                    band.srcRect,
                  );
                  ctx.fillStyle = "#00ffd5";
                  ctx.font = "10px monospace";
                  const topY = band.dstRect.y + 12;
                  ctx.fillText(`#${band.index}`, band.dstRect.x + 2, topY);
                  ctx.restore();
                });
              }
            });
          }
        } else {
          const slice = (o.anchorTx ?? (o.tx + o.w - 1)) + (o.anchorTy ?? (o.ty + o.h - 1));
          const within = o.anchorTx ?? (o.tx + o.w - 1);
          const kindOrder = o.layerRole === "STRUCTURE"
            ? KindOrder.STRUCTURE
            : (o.kind ?? "ROOF") === "PROP"
              ? KindOrder.ENTITY
              : KindOrder.OVERLAY;
          const overlayKey: RenderKey = {
            slice,
            within,
            baseZ: o.z,
            kindOrder,
            stableId: 200000 + i,
          };
          addToSlice(slice, overlayKey, () => {
            drawRenderPiece(draw);
          });
        }
      }
    }

  if (SHADOW_CASTER_MODE === "v6FaceSliceDebug" && structureV6ShadowDebugCandidates.length > 0) {
    const v65ShadowVector: ScreenPt = {
      x: shadowSunModel.projectionDirection.x * STRUCTURE_SHADOW_V5_LENGTH_PX,
      y: shadowSunModel.projectionDirection.y * STRUCTURE_SHADOW_V5_LENGTH_PX,
    };
    const candidatesWithPrimaryBucket = structureV6ShadowDebugCandidates.filter(
      (candidate) => countStructureV6CandidateTrianglesForBucket(candidate, SHADOW_V6_PRIMARY_SEMANTIC_BUCKET) > 0,
    );
    const candidatePool = candidatesWithPrimaryBucket.length > 0
      ? candidatesWithPrimaryBucket
      : structureV6ShadowDebugCandidates;
    const orderedCandidates = candidatePool
      .slice()
      .sort((a, b) => {
        const byId = a.structureInstanceId.localeCompare(b.structureInstanceId);
        if (byId !== 0) return byId;
        return (
          countStructureV6CandidateTrianglesForBucket(b, SHADOW_V6_PRIMARY_SEMANTIC_BUCKET)
          - countStructureV6CandidateTrianglesForBucket(a, SHADOW_V6_PRIMARY_SEMANTIC_BUCKET)
        );
      });
    const selectedStructureIndex = resolveStructureV6SelectedCandidateIndex(
      orderedCandidates.length,
      SHADOW_V6_STRUCTURE_INDEX,
    );
    const selected = selectedStructureIndex >= 0 ? orderedCandidates[selectedStructureIndex] : null;
    if (selected) {
      structureV6VerticalShadowDebugData = buildStructureV6VerticalShadowMaskDebugData(
        selected,
        SHADOW_V6_REQUESTED_SEMANTIC_BUCKET,
        SHADOW_V6_STRUCTURE_INDEX,
        selectedStructureIndex,
        orderedCandidates.length,
        SHADOW_V6_SLICE_COUNT,
        v65ShadowVector,
      );
    }
  }

  // ============================================
  // FINAL RENDER PASS: Execute by zBand with GROUND then WORLD
  // ============================================
  const sliceKeys = Array.from(sliceDrawables.keys());
  countRenderSliceKeySort();
  sliceKeys.sort((a, b) => a - b);

  const kindToDrawTag = (kind: KindOrder): "floors" | "decals" | "entities" | "structures" | "lighting" => {
    if (kind === KindOrder.FLOOR || kind === KindOrder.SHADOW) return "floors";
    if (kind === KindOrder.DECAL) return "decals";
    if (kind === KindOrder.LIGHT) return "lighting";
    if (
      kind === KindOrder.ENTITY
      || kind === KindOrder.VFX
      || kind === KindOrder.ZONE_OBJECTIVE
    ) return "entities";
    return "structures";
  };

  // Sort once per slice and collect all zBands. WORLD keys missing feetSortY
  // get a deterministic derived value from owner tile center projection.
  const zBands = new Set<number>();
  for (let i = 0; i < sliceKeys.length; i++) {
    const drawables = sliceDrawables.get(sliceKeys[i])!;
    for (let j = 0; j < drawables.length; j++) {
      const key = drawables[j].key;
      if (isWorldKindForRenderPass(key.kindOrder) && key.feetSortY == null) {
        key.feetSortY = deriveFeetSortYFromKey(key, T, toScreenAtZ);
      }
      zBands.add(resolveRenderZBand(key, rampRoadTiles));
    }
    countRenderDrawableSort();
    drawables.sort((a, b) => compareRenderKeys(a.key, b.key));
  }
  structureShadowTrianglesByBand.forEach((triangles, zBand) => {
    if (triangles.length > 0) zBands.add(zBand);
  });
  structureHybridShadowByBand.forEach((pieces, zBand) => {
    if (pieces.length > 0) zBands.add(zBand);
  });
  structureV4ShadowByBand.forEach((pieces, zBand) => {
    if (pieces.length > 0) zBands.add(zBand);
  });
  structureV5ShadowByBand.forEach((pieces, zBand) => {
    if (pieces.length > 0) zBands.add(zBand);
  });
  if (SHADOW_CASTER_MODE === "v6FaceSliceDebug" && structureV6VerticalShadowDebugData) {
    zBands.add(structureV6VerticalShadowDebugData.zBand);
  }

  const zBandKeys = Array.from(zBands);
  zBandKeys.sort((a, b) => a - b);
  setRenderZBandCount(zBandKeys.length);

  for (let zi = 0; zi < zBandKeys.length; zi++) {
    const zb = zBandKeys[zi];

    // Pass 1: GROUND
    for (let si = 0; si < sliceKeys.length; si++) {
      const drawables = sliceDrawables.get(sliceKeys[si])!;
      for (let di = 0; di < drawables.length; di++) {
        const drawable = drawables[di];
        if (resolveRenderZBand(drawable.key, rampRoadTiles) !== zb) continue;
        if (!isGroundKindForRenderPass(drawable.key.kindOrder)) continue;
        setRenderPerfDrawTag(kindToDrawTag(drawable.key.kindOrder));
        drawable.drawFn(drawable.payload);
      }
    }
    const structureShadowBandTriangles = structureShadowTrianglesByBand.get(zb) ?? [];
    if (structureShadowBandTriangles.length > 0) {
      setRenderPerfDrawTag("floors");
      drawStructureShadowProjectedTriangles(ctx, structureShadowBandTriangles, STRUCTURE_SHADOW_V1_MAX_DARKNESS);
    }
    const structureHybridBandPieces = structureHybridShadowByBand.get(zb) ?? [];
    if (structureHybridBandPieces.length > 0) {
      if (SHADOW_HYBRID_DIAGNOSTIC_MODE === "solidMainCanvas") {
        for (let pi = 0; pi < structureHybridBandPieces.length; pi++) {
          hybridMainCanvasDiagnosticPieces.push(structureHybridBandPieces[pi]);
        }
      } else {
        const hybridTrianglesInBand = countStructureHybridProjectedTriangles(structureHybridBandPieces);
        hybridShadowDiagnosticStats.piecesDrawnShadowPass += structureHybridBandPieces.length;
        hybridShadowDiagnosticStats.trianglesDrawnShadowPass += hybridTrianglesInBand;
        hybridShadowDiagnosticStats.piecesComposited += structureHybridBandPieces.length;
        setRenderPerfDrawTag("floors");
        if (SHADOW_HYBRID_DIAGNOSTIC_MODE === "solidShadowPass") {
          const drawnTriangles = drawStructureHybridProjectedTrianglesSolid(
            ctx,
            structureHybridBandPieces,
            "rgba(255, 60, 140, 0.92)",
          );
          hybridShadowDiagnosticStats.trianglesComposited += drawnTriangles;
        } else {
          drawStructureHybridShadowProjectedTriangles(ctx, structureHybridBandPieces, STRUCTURE_SHADOW_V1_MAX_DARKNESS);
          hybridShadowDiagnosticStats.trianglesComposited += hybridTrianglesInBand;
        }
      }
    }
    const structureV4BandPieces = structureV4ShadowByBand.get(zb) ?? [];
    if (structureV4BandPieces.length > 0) {
      const bandTopCapTriangles: StructureShadowProjectedTriangle[] = [];
      for (let pi = 0; pi < structureV4BandPieces.length; pi++) {
        const piece = structureV4BandPieces[pi];
        for (let ci = 0; ci < piece.topCapTriangles.length; ci++) {
          bandTopCapTriangles.push(piece.topCapTriangles[ci]);
        }
      }
      const drawFlatContribution = SHADOW_DEBUG_MODE === "flatOnly" || SHADOW_DEBUG_MODE === "both";
      const drawWarpedContribution = SHADOW_DEBUG_MODE === "warpedOnly" || SHADOW_DEBUG_MODE === "both";
      const flatShadowFill = `rgba(0,0,0,${Math.max(0, Math.min(1, STRUCTURE_SHADOW_V1_MAX_DARKNESS)).toFixed(3)})`;

      setRenderPerfDrawTag("floors");
      if (drawFlatContribution) {
        if (bandTopCapTriangles.length > 0) {
          drawStructureShadowProjectedTriangles(ctx, bandTopCapTriangles, STRUCTURE_SHADOW_V1_MAX_DARKNESS);
          v4ShadowDiagnosticStats.topCapTrianglesDrawnShadowPass += bandTopCapTriangles.length;
          v4ShadowDiagnosticStats.trianglesComposited += bandTopCapTriangles.length;
          v4ShadowDiagnosticStats.flatDrawCalls += 1;
        }
        const flatTriangles = drawStructureV4ShadowTrianglesSolid(
          ctx,
          structureV4BandPieces,
          flatShadowFill,
        );
        v4ShadowDiagnosticStats.flatTrianglesDrawnShadowPass += flatTriangles;
        v4ShadowDiagnosticStats.trianglesComposited += flatTriangles;
        if (flatTriangles > 0) {
          v4ShadowDiagnosticStats.flatDrawCalls += 1;
        }
      }
      if (drawWarpedContribution) {
        const warpedTriangles = drawStructureV4ShadowWarpedTriangles(
          ctx,
          structureV4BandPieces,
          STRUCTURE_SHADOW_V1_MAX_DARKNESS,
        );
        v4ShadowDiagnosticStats.warpedTrianglesDrawnShadowPass += warpedTriangles;
        v4ShadowDiagnosticStats.trianglesComposited += warpedTriangles;
        if (warpedTriangles > 0) {
          v4ShadowDiagnosticStats.warpedDrawCalls += 1;
        }
      }
      v4ShadowDiagnosticStats.piecesComposited += structureV4BandPieces.length;
    }
    const structureV5BandPieces = structureV5ShadowByBand.get(zb) ?? [];
    if (structureV5BandPieces.length > 0) {
      setRenderPerfDrawTag("floors");
      const v5Draw = drawStructureV5ShadowMasks(
        ctx,
        structureV5BandPieces,
        shadowSunModel.projectionDirection,
        SHADOW_V5_DEBUG_VIEW,
        STRUCTURE_SHADOW_V1_MAX_DARKNESS,
        SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
        SHADOW_V5_TRANSFORM_DEBUG_MODE,
      );
      v5ShadowDiagnosticStats.piecesDrawn += v5Draw.piecesDrawn;
      v5ShadowDiagnosticStats.trianglesDrawn += v5Draw.trianglesDrawn;
      v5ShadowDiagnosticStats.finalShadowDrawCalls += v5Draw.finalShadowDrawCalls;
      if (!v5ShadowAnchorDiagnostic && v5Draw.anchorDiagnostic) {
        v5ShadowAnchorDiagnostic = v5Draw.anchorDiagnostic;
      }
    }
    if (
      SHADOW_CASTER_MODE === "v6FaceSliceDebug"
      && structureV6VerticalShadowDebugData
      && structureV6VerticalShadowDebugData.zBand === zb
    ) {
      setRenderPerfDrawTag("floors");
      drawStructureV65MergedShadowMaskInWorld(ctx, structureV6VerticalShadowDebugData);
    }

    // Pass 2: WORLD
    for (let si = 0; si < sliceKeys.length; si++) {
      const drawables = sliceDrawables.get(sliceKeys[si])!;
      for (let di = 0; di < drawables.length; di++) {
        const drawable = drawables[di];
        if (resolveRenderZBand(drawable.key, rampRoadTiles) !== zb) continue;
        if (!isWorldKindForRenderPass(drawable.key.kindOrder)) continue;
        setRenderPerfDrawTag(kindToDrawTag(drawable.key.kindOrder));
        drawable.drawFn(drawable.payload);
      }
    }
  }
  if (SHADOW_HYBRID_DIAGNOSTIC_MODE === "solidMainCanvas" && hybridMainCanvasDiagnosticPieces.length > 0) {
    setRenderPerfDrawTag("floors");
    const drawnTriangles = drawStructureHybridProjectedTrianglesSolid(
      ctx,
      hybridMainCanvasDiagnosticPieces,
      "rgba(40, 255, 155, 0.9)",
    );
    hybridShadowDiagnosticStats.piecesDrawnMainCanvas = hybridMainCanvasDiagnosticPieces.length;
    hybridShadowDiagnosticStats.trianglesDrawnMainCanvas = drawnTriangles;
    hybridShadowDiagnosticStats.piecesComposited += hybridMainCanvasDiagnosticPieces.length;
    hybridShadowDiagnosticStats.trianglesComposited += drawnTriangles;
  }
  setRenderPerfDrawTag(null);

  // Optional floor tint overlay
  const floorVis = getFloorVisual(w);
  if (floorVis) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = floorVis.tintAlpha;
    ctx.fillStyle = floorVis.tint;
    ctx.fillRect(0, 0, devW, devH);
    ctx.restore();
  }

  const GLOBAL_SCREEN_TINT_ALPHA = (w.lighting.darknessAlpha ?? 0) > 0 ? 0 : 0.3;
  if (GLOBAL_SCREEN_TINT_ALPHA > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = GLOBAL_SCREEN_TINT_ALPHA;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, devW, devH);
    ctx.restore();
  }

  drawWalkMaskOverlay(debugContext, SHOW_WALK_MASK);
  drawRampOverlay(debugContext, SHOW_RAMPS);
  drawOccluderOverlay(debugContext, SHOW_OCCLUDER_DEBUG, viewRect);
  if (SHOW_DECAL_DEBUG) {
    const decals = decalsInView(viewRect);
    if (decals.length > 0) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.font = "10px monospace";
      for (let i = 0; i < decals.length; i++) {
        const d = decals[i];
        if (!isTileInRenderRadius(d.tx, d.ty)) continue;
        const p0 = toScreen(d.tx * T, d.ty * T);
        const p1 = toScreen((d.tx + 1) * T, d.ty * T);
        const p2 = toScreen((d.tx + 1) * T, (d.ty + 1) * T);
        const p3 = toScreen(d.tx * T, (d.ty + 1) * T);
        const color = d.setId === "sidewalk" ? "rgba(40,220,255,0.95)" : "rgba(255,170,40,0.95)";
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(d.setId, p0.x + 4, p0.y + 10);
      }
      ctx.restore();
    }
  }
  drawProjectileFaceOverlay(debugContext, SHOW_PROJECTILE_FACES, viewRect);
  drawStructureHeightOverlay(debugContext, SHOW_STRUCTURE_HEIGHTS, viewRect);
  drawTriggerOverlay(debugContext, SHOW_TRIGGER_ZONES);
  drawRoadSemanticOverlay(debugContext, SHOW_ROAD_SEMANTIC, viewRect);
  drawEnemyAimOverlay(debugContext, SHOW_ENEMY_AIM_OVERLAY);
  drawLootGoblinOverlay(debugContext, SHOW_LOOT_GOBLIN_OVERLAY);
  if (SHOW_STRUCTURE_COLLISION_DEBUG) {
    const blocked = blockedTilesInView(viewRect);
    if (blocked.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 80, 80, 0.95)";
      ctx.fillStyle = "rgba(255, 80, 80, 0.12)";
      ctx.lineWidth = 1;
      for (let i = 0; i < blocked.length; i++) {
        const t = blocked[i];
        const p0 = toScreen(t.tx * T, t.ty * T);
        const p1 = toScreen((t.tx + 1) * T, t.ty * T);
        const p2 = toScreen((t.tx + 1) * T, (t.ty + 1) * T);
        const p3 = toScreen(t.tx * T, (t.ty + 1) * T);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  for (let i = 0; i < deferredStructureSliceDebugDraws.length; i++) {
    deferredStructureSliceDebugDraws[i]();
  }

  // Floating combat text: world pass (same camera transform as world content)
  renderFloatingText(w, ctx, toScreen);

  // Restore camera transform before drawing screen-space overlays / HUD.
  ctx.restore();


  // PASS 8: final screen-space ambient darkness/tint only
  if (shouldApplyAmbientDarknessOverlay(renderSettings)) {
    setRenderPerfDrawTag("lighting");
    renderAmbientDarknessOverlay(ctx, w.lighting, devW, devH);
    setRenderPerfDrawTag(null);
  }
  // Building-mask debug overlay draw disabled to avoid full-canvas mask artifacts.


  // Screen-space debug text
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = "12px monospace";
  ctx.fillStyle = "#fff";
  if (SHADOW_CASTER_MODE === "v6FaceSliceDebug" && structureV6VerticalShadowDebugData) {
    drawStructureV6FaceSliceDebugPanel(ctx, cssW, cssH, structureV6VerticalShadowDebugData);
  }
  const perf = getRenderPerfSnapshot();
  if (renderPerfCountersEnabled) {
    const tag = perf.drawImageByTagPerFrame;
    const saveTag = perf.saveByTagPerFrame;
    const restoreTag = perf.restoreByTagPerFrame;
    const perfLines = [
      `drawImage/frame: ${perf.drawImageCallsPerFrame.toFixed(1)}`,
      `tag void:${tag.void.toFixed(1)} floors:${tag.floors.toFixed(1)} decals:${tag.decals.toFixed(1)} ent:${tag.entities.toFixed(1)}`,
      `tag struct:${tag.structures.toFixed(1)}`,
      `tag lighting:${tag.lighting.toFixed(1)} untagged:${tag.untagged.toFixed(1)}`,
      `gradientCreate/frame: ${perf.gradientCreateCallsPerFrame.toFixed(1)} addColorStop/frame: ${perf.addColorStopCallsPerFrame.toFixed(1)}`,
      `save/frame: ${perf.saveCallsPerFrame.toFixed(1)} restore/frame: ${perf.restoreCallsPerFrame.toFixed(1)}`,
      `saveTag fl:${saveTag.floors.toFixed(1)} de:${saveTag.decals.toFixed(1)} li:${saveTag.lighting.toFixed(1)} un:${saveTag.untagged.toFixed(1)}`,
      `saveTag struct:${saveTag.structures.toFixed(1)}`,
      `restoreTag fl:${restoreTag.floors.toFixed(1)} de:${restoreTag.decals.toFixed(1)} li:${restoreTag.lighting.toFixed(1)} un:${restoreTag.untagged.toFixed(1)}`,
      `restoreTag struct:${restoreTag.structures.toFixed(1)}`,
      `closures/frame: ${perf.closuresCreatedPerFrame.toFixed(1)}`,
      `sliceSorts/frame: ${perf.sliceKeySortsPerFrame.toFixed(1)} drawableSorts/frame: ${perf.drawableSortsPerFrame.toFixed(1)}`,
      `fullCanvasBlits/frame: ${perf.fullCanvasBlitsPerFrame.toFixed(1)}`,
      `tileRadius: ${perf.tileLoopRadius.toFixed(0)} tileLoopIters/frame: ${perf.tileLoopIterationsPerFrame.toFixed(1)}`,
      `triAdmission: mode=${structureTriangleAdmissionMode} authority=${structureTriangleAdmissionMode === "viewport" ? "viewportRect" : "sharedRenderDistance(tileRadius)"} tileRadius=${sliderPadding}`,
      `triCutout: ${structureTriangleCutoutEnabled ? "on" : "off"} center=${playerCameraTx},${playerCameraTy} size=${structureTriangleCutoutHalfWidth}x${structureTriangleCutoutHalfHeight} alpha=${structureTriangleCutoutAlpha.toFixed(2)}`,
      `bands z:${perf.zBandCountPerFrame.toFixed(1)} light:${perf.lightBandCountPerFrame.toFixed(1)} masks build:${perf.maskBuildsPerFrame.toFixed(1)} hit:${perf.maskCacheHitsPerFrame.toFixed(1)} miss:${perf.maskCacheMissesPerFrame.toFixed(1)}`,
      `masks rasterChunks/frame: ${perf.maskRasterChunksPerFrame.toFixed(1)} drawEntries/frame: ${perf.maskDrawEntriesPerFrame.toFixed(1)}`,
    ];
    ctx.textAlign = "right";
    const perfX = cssW - 8;
    const perfLineH = 16;
    const perfY0 = cssH - 8 - perfLineH * (perfLines.length - 1);
    for (let i = 0; i < perfLines.length; i++) {
      ctx.fillText(perfLines[i], perfX, perfY0 + i * perfLineH);
    }
    ctx.textAlign = "left";
  }
  let screenDebugLineY = 30;
  if (SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG) {
    const forward = shadowSunModel.forward;
    const projection = shadowSunModel.projectionDirection;
    const sunLine = `shadowSun ${shadowSunModel.timeLabel} caster:${SHADOW_CASTER_MODE} elev:${shadowSunModel.elevationDeg.toFixed(1)} dir:${shadowSunModel.directionLabel} f(${forward.x.toFixed(3)},${forward.y.toFixed(3)},${forward.z.toFixed(3)}) p(${projection.x.toFixed(3)},${projection.y.toFixed(3)}) step:${shadowSunModel.stepKey}`;
    ctx.fillText(sunLine, 8, screenDebugLineY);
    screenDebugLineY += 16;
    if (SHADOW_CASTER_MODE === "v3HybridTriangles") {
      const hybridLine = `hybridDiag mode:${SHADOW_HYBRID_DIAGNOSTIC_MODE} cache h:${hybridShadowDiagnosticStats.cacheHits} m:${hybridShadowDiagnosticStats.cacheMisses} cast:${hybridShadowDiagnosticStats.casterTriangles} proj:${hybridShadowDiagnosticStats.projectedTriangles} queue p:${hybridShadowDiagnosticStats.piecesQueued} t:${hybridShadowDiagnosticStats.trianglesQueued} pass p:${hybridShadowDiagnosticStats.piecesDrawnShadowPass} t:${hybridShadowDiagnosticStats.trianglesDrawnShadowPass} main p:${hybridShadowDiagnosticStats.piecesDrawnMainCanvas} t:${hybridShadowDiagnosticStats.trianglesDrawnMainCanvas} comp p:${hybridShadowDiagnosticStats.piecesComposited} t:${hybridShadowDiagnosticStats.trianglesComposited}`;
      ctx.fillText(hybridLine, 8, screenDebugLineY);
      screenDebugLineY += 16;
    } else if (SHADOW_CASTER_MODE === "v4SliceStrips") {
      const v4Line = `v4Diag mode:${v4ShadowDiagnosticStats.renderMode} cache h:${v4ShadowDiagnosticStats.cacheHits} m:${v4ShadowDiagnosticStats.cacheMisses} cap:${v4ShadowDiagnosticStats.topCapTriangles} corr:${v4ShadowDiagnosticStats.correspondences} strips:${v4ShadowDiagnosticStats.strips} edges:${v4ShadowDiagnosticStats.layerEdges} bands:${v4ShadowDiagnosticStats.layerBands} srcTri:${v4ShadowDiagnosticStats.sourceBandTriangles} dstTri:${v4ShadowDiagnosticStats.destinationBandEntries} map:${v4ShadowDiagnosticStats.correspondencePairs} mismatch:${v4ShadowDiagnosticStats.correspondenceMismatches} queue p:${v4ShadowDiagnosticStats.piecesQueued} stripT:${v4ShadowDiagnosticStats.trianglesQueued} capT:${v4ShadowDiagnosticStats.topCapTrianglesQueued} draw capPass:${v4ShadowDiagnosticStats.topCapTrianglesDrawnShadowPass} capMain:${v4ShadowDiagnosticStats.topCapTrianglesDrawnMainCanvas} warp:${v4ShadowDiagnosticStats.warpedTrianglesDrawnShadowPass} flatPass:${v4ShadowDiagnosticStats.flatTrianglesDrawnShadowPass} flatMain:${v4ShadowDiagnosticStats.flatTrianglesDrawnMainCanvas} calls warp:${v4ShadowDiagnosticStats.warpedDrawCalls} flat:${v4ShadowDiagnosticStats.flatDrawCalls} comp p:${v4ShadowDiagnosticStats.piecesComposited} t:${v4ShadowDiagnosticStats.trianglesComposited} triPairs:${v4ShadowDiagnosticStats.destinationBandPairs} tri:${v4ShadowDiagnosticStats.destinationTriangles} diag:${v4ShadowDiagnosticStats.diagonalRule} deltaConst pass:${v4ShadowDiagnosticStats.deltaConstPass} fail:${v4ShadowDiagnosticStats.deltaConstFail} ${v4ShadowDiagnosticStats.firstSliceSummary}`;
      ctx.fillText(v4Line, 8, screenDebugLineY);
      screenDebugLineY += 16;
      const v4SampleLine = `v4Sample roofH:${v4ShadowDiagnosticStats.sampleRoofHeightPx ?? "none"} heights:${v4ShadowDiagnosticStats.sampleLayerHeights} slices:${v4ShadowDiagnosticStats.sampleSliceCount} edges:${v4ShadowDiagnosticStats.sampleLayerEdges} bands:${v4ShadowDiagnosticStats.sampleLayerBands} ${v4ShadowDiagnosticStats.sampleSelectedSlice}`;
      ctx.fillText(v4SampleLine, 8, screenDebugLineY);
      screenDebugLineY += 16;
      const v4BandLine = `v4Band ${v4ShadowDiagnosticStats.sampleSelectedBand}`;
      ctx.fillText(v4BandLine, 8, screenDebugLineY);
      screenDebugLineY += 16;
    } else if (SHADOW_CASTER_MODE === "v5TriangleShadowMask") {
      const v5Line = `v5Diag view:${SHADOW_V5_DEBUG_VIEW} xf:${SHADOW_V5_TRANSFORM_DEBUG_MODE} queue p:${v5ShadowDiagnosticStats.piecesQueued} t:${v5ShadowDiagnosticStats.trianglesQueued} draw p:${v5ShadowDiagnosticStats.piecesDrawn} t:${v5ShadowDiagnosticStats.trianglesDrawn} finalCalls:${v5ShadowDiagnosticStats.finalShadowDrawCalls}`;
      ctx.fillText(v5Line, 8, screenDebugLineY);
      screenDebugLineY += 16;
      if (v5ShadowAnchorDiagnostic) {
        const d = v5ShadowAnchorDiagnostic;
        const v5SpaceLineA = [
          `v5Space id:${d.structureInstanceId}`,
          `dst:${d.triangleDestinationSpace}`,
          `maskOrigin(${d.maskCanvasOrigin.x.toFixed(1)},${d.maskCanvasOrigin.y.toFixed(1)})`,
          `buildOrigin(${d.buildingDrawOrigin.x.toFixed(1)},${d.buildingDrawOrigin.y.toFixed(1)})`,
          `xformOrigin(${d.transformedMaskDrawOrigin.x.toFixed(1)},${d.transformedMaskDrawOrigin.y.toFixed(1)})`,
          `finalOrigin(${d.finalShadowDrawOrigin.x.toFixed(1)},${d.finalShadowDrawOrigin.y.toFixed(1)})`,
        ].join(" ");
        ctx.fillText(v5SpaceLineA, 8, screenDebugLineY);
        screenDebugLineY += 16;
        const v5SpaceLineB = [
          `v5Anchor mask(${d.maskAnchor.x.toFixed(1)},${d.maskAnchor.y.toFixed(1)})`,
          `build(${d.buildingAnchor.x.toFixed(1)},${d.buildingAnchor.y.toFixed(1)})`,
          `xform(${d.transformedAnchor.x.toFixed(1)},${d.transformedAnchor.y.toFixed(1)})`,
          `offset(${d.offset.x.toFixed(2)},${d.offset.y.toFixed(2)})`,
          `raw[${d.rawBounds.minX.toFixed(1)},${d.rawBounds.minY.toFixed(1)}→${d.rawBounds.maxX.toFixed(1)},${d.rawBounds.maxY.toFixed(1)}]`,
          `xraw[${d.transformedBounds.minX.toFixed(1)},${d.transformedBounds.minY.toFixed(1)}→${d.transformedBounds.maxX.toFixed(1)},${d.transformedBounds.maxY.toFixed(1)}]`,
        ].join(" ");
        ctx.fillText(v5SpaceLineB, 8, screenDebugLineY);
        screenDebugLineY += 16;
      }
    } else if (SHADOW_CASTER_MODE === "v6FaceSliceDebug") {
      const selectedId = structureV6VerticalShadowDebugData?.structureInstanceId ?? "none";
      const bucketATris = structureV6VerticalShadowDebugData?.bucketAShadow?.sourceTriangleCount ?? 0;
      const bucketBTriCount = structureV6VerticalShadowDebugData?.bucketBShadow?.sourceTriangleCount ?? 0;
      const topTriCount = structureV6VerticalShadowDebugData?.topShadow?.sourceTriangleCount ?? 0;
      const bucketACastSlices = structureV6VerticalShadowDebugData?.bucketAShadow?.nonEmptySliceCount ?? 0;
      const bucketBCastSlices = structureV6VerticalShadowDebugData?.bucketBShadow?.nonEmptySliceCount ?? 0;
      const topCastSlices = structureV6VerticalShadowDebugData?.topShadow?.nonEmptySliceCount ?? 0;
      const shadowVector = structureV6VerticalShadowDebugData?.shadowVector ?? { x: 0, y: 0 };
      const v6Line = `v6.7Diag buckets:${SHADOW_V6_PRIMARY_SEMANTIC_BUCKET}+${SHADOW_V6_SECONDARY_SEMANTIC_BUCKET}+${SHADOW_V6_TOP_SEMANTIC_BUCKET} reqBucket:${SHADOW_V6_REQUESTED_SEMANTIC_BUCKET} structReq:${SHADOW_V6_STRUCTURE_INDEX} selected:${selectedId} candidates:${structureV6ShadowDebugCandidates.length} triEW:${bucketATris} triSN:${bucketBTriCount} triTOP:${topTriCount} castEW:${bucketACastSlices} castSN:${bucketBCastSlices} castTOP:${topCastSlices} vec(${shadowVector.x.toFixed(1)},${shadowVector.y.toFixed(1)})`;
      ctx.fillText(v6Line, 8, screenDebugLineY);
      screenDebugLineY += 16;
    }
  }
  if (SHOW_ROAD_SEMANTIC) {
    const roadWPlayer = roadAreaWidthAt(playerTx, playerTy);
    ctx.fillText(`roadW(player): ${roadWPlayer}`, 8, screenDebugLineY);
  }
  ctx.restore();
  endRenderPerfFrame(w.timeSec ?? 0);

  if (DEBUG_PLAYER_WEDGE) {
    const playerPos = { x: px, y: py };
    const playerTile = worldToTile(playerPos.x, playerPos.y);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 0, 0, 0.18)";
    for (let sum = minSum; sum <= maxSum; sum++) {
      const ty0 = Math.max(minTy, sum - maxTx);
      const ty1 = Math.min(maxTy, sum - minTx);
      for (let ty = ty1; ty >= ty0; ty--) {
        const tx = sum - ty;
        if (!isTileInPlayerSouthWedge(tx, ty, playerTile.tx, playerTile.ty)) continue;
        const wx = (tx + 0.5) * T;
        const wy = (ty + 0.5) * T;
        const z = tileHAtWorld(wx, wy);
        const screen = tileToScreen(tx, ty, z);
        const p = worldToScreenPx(screen.x, screen.y);
        ctx.fillRect(
          Math.floor(p.x),
          Math.floor(p.y),
          KENNEY_TILE_WORLD * s,
          (KENNEY_TILE_WORLD / 2) * s
        );
      }
    }
    ctx.restore();
  }

  // --- UI ---
  overlayCtx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
  if (hasUiOverlay && w.state === "RUN" && w.runState === "FLOOR") {
    const target = resolveNavArrowTarget(w);
    renderNavArrow(
      overlayCtx,
      target,
      { x: 0, y: 0, w: cssW, h: cssH },
      (wx, wy) => {
        const p = worldToScreen(wx, wy);
        return viewport.projectProjectedToCss(p.x, p.y);
      }
    );
  }
  overlayCtx.setTransform(overlayDpr, 0, 0, overlayDpr, safeOffsetX * overlayDpr, safeOffsetY * overlayDpr);
  if (debugFlags.showGrid) renderTileGridCompass(w, overlayCtx, scaledW, scaledH); // tile-grid N/E/S/W (matches in-game tests)

  overlayCtx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
  if (getUserSettings().debug.dpsMeter) {
    renderDPSMeter(w, overlayCtx, screenW, screenH);
  }
  renderDeathFxOverlay(w, overlayCtx, screenW, screenH);
}

function deathFxClamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function renderDeathFxOverlay(w: World, ctx: CanvasRenderingContext2D, ww: number, hh: number): void {
  const deathFx = w.deathFx;
  if (!deathFx?.active) return;

  const blackAlpha = deathFxClamp01(deathFx.aBlack);
  const titleAlpha = deathFxClamp01(deathFx.aTitle);
  if (blackAlpha <= 0 && titleAlpha <= 0) return;

  ctx.fillStyle = `rgba(0, 0, 0, ${blackAlpha.toFixed(4)})`;
  ctx.fillRect(0, 0, ww, hh);

  if (titleAlpha <= 0) return;

  const cx = ww * 0.5;
  const cy = hh * 0.5;
  const textScale = 1.06 - 0.06 * titleAlpha;
  const fontSize = Math.round(Math.max(52, Math.min(120, ww * 0.14)));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(textScale, textScale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
  ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.08));
  ctx.strokeStyle = `rgba(0, 0, 0, ${(0.90 * titleAlpha).toFixed(4)})`;
  ctx.fillStyle = `rgba(165, 18, 18, ${(0.98 * titleAlpha).toFixed(4)})`;
  ctx.strokeText("WASTED", 0, 0);
  ctx.fillText("WASTED", 0, 0);
  ctx.restore();
}


/**
 * Render a compass that shows TILE-GRID directions (TableMapDef x/y axes),
 * using the empirically verified mapping:
 *  - tile East  (+x) => screen South-East (↘)
 *  - tile North (-y) => screen North-East (↗)
 *  - tile South (+y) => screen South-West (↙)
 *  - tile West  (-x) => screen North-West (↖)
 *
 * This compass is intentionally NOT "screen north"; it is the tile grid axes.
 */
function renderTileGridCompass(w: World, ctx: CanvasRenderingContext2D, ww: number, hh: number) {
  // Optional toggle (defaults ON)
  const enabled = ((w as any).tileCompassEnabled ?? true) as boolean;
  if (!enabled) return;

  // Panel placement (top-right) and sizing
  const pad = 12;
  const size = 120;

  // Top-aligned, horizontally centered
  const x0 = Math.round(ww * 0.5 - size * 0.5);
  const y0 = pad;


  const cx = x0 + size * 0.5;
  const cy = y0 + size * 0.5;

  // Radius for arrows/labels
  const R = size * 0.36;

  // Draw panel
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#111";
  ctx.fillRect(x0, y0, size, size);

  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, size, size);

  // Title
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Center dot
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Helper: draw a single arrow + label
  const drawArrow = (dx: number, dy: number, label: string) => {
    // Normalize direction
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const x1 = cx + ux * R;
    const y1 = cy + uy * R;

    // Shaft
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // Arrow head
    const headL = 10;
    const headW = 6;

    // Perp vector
    const px = -uy;
    const py = ux;

    const hx0 = x1 - ux * headL;
    const hy0 = y1 - uy * headL;

    const hxL = hx0 + px * headW;
    const hyL = hy0 + py * headW;

    const hxR = hx0 - px * headW;
    const hyR = hy0 - py * headW;

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(hxL, hyL);
    ctx.lineTo(hxR, hyR);
    ctx.closePath();
    ctx.fill();

    // Label near arrow tip
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx + ux * (R + 18), cy + uy * (R + 18));
  };

  // IMPORTANT: these are SCREEN vectors (pixels), not world or tile vectors.
  // Based on your verified mapping:
  //  N(tile) = ↗ , E(tile) = ↘ , S(tile) = ↙ , W(tile) = ↖
  drawArrow(+1, -1, "N"); // ↗
  drawArrow(+1, +1, "E"); // ↘
  drawArrow(-1, +1, "S"); // ↙
  drawArrow(-1, -1, "W"); // ↖

  // Optional: show player grid coords for sanity (tiny)
  const g = gridAtPlayer(w);
  const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const ptx = Math.floor(pWorld.wx / KENNEY_TILE_WORLD);
  const pty = Math.floor(pWorld.wy / KENNEY_TILE_WORLD);
  const roadW = roadAreaWidthAt(ptx, pty);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`gx:${g.gx.toFixed(2)} gy:${g.gy.toFixed(2)}`, x0 + 8, y0 + size - 8);
  ctx.fillText(`roadW:${roadW}`, x0 + 8, y0 + size - 20);

  ctx.restore();
}
/**
 * Render floating combat text (damage numbers).
 */
function renderFloatingText(
    w: World,
    ctx: CanvasRenderingContext2D,
    toScreen: (x: number, y: number) => { x: number; y: number },
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = w.floatTextX.length - 1; i >= 0; i--) {
    const ttl = w.floatTextTtl[i];
    if (ttl <= 0) continue;

    const p = toScreen(w.floatTextX[i], w.floatTextY[i]);
    const x = p.x;
    const y = p.y;

    const value = w.floatTextValue[i];
    const color = w.floatTextColor[i];
    const size = w.floatTextSize[i] ?? (w.floatTextIsCrit[i] ? 16 : 12);
    const isPlayer = w.floatTextIsPlayer[i] ?? false;

    const maxTtl = 0.8;
    const progress = 1 - ttl / maxTtl;

    const rise = progress * 0.35;
    const alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `${size}px monospace`;
    ctx.fillText(isPlayer ? `-${value}` : `${value}`, x, y - rise);
  }
  ctx.restore();
}

/* =======================================================================
   UI components (unchanged)
   ======================================================================= */

function renderHealthOrb(w: World, ctx: CanvasRenderingContext2D, ww: number, hh: number) {
  const x = 80;
  const y = hh - 80;
  const r = 56;

  ctx.save();

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(x, y, r + 6, 0, Math.PI * 2);
  ctx.fill();

  const hp = Math.max(0, Math.min(1, w.playerHp / w.playerHpMax));
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#c33";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1 - hp;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.font = "14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.ceil(w.playerHp)} / ${Math.ceil(w.playerHpMax)}`, x, y);

  ctx.restore();
}

/**
 * Render DPS meter in top-right corner
 * Toggle with w.dpsEnabled boolean
 */
function renderDPSMeter(w: World, ctx: CanvasRenderingContext2D, ww: number, hh: number) {
  if (!w.dpsEnabled) return;

  const currentTime = w.time;
  const totalTime = currentTime - w.dpsStartTime;

  const avgDPS = totalTime > 0 ? w.dpsTotalDamage / totalTime : 0;

  let recentDPS = 0;
  if (w.dpsRecentDamage.length > 0) {
    const recentTotal = w.dpsRecentDamage.reduce((sum, dmg) => sum + dmg, 0);
    const oldestTime = w.dpsRecentTimes[0] || currentTime;
    const recentWindow = currentTime - oldestTime;
    recentDPS = recentWindow > 0 ? recentTotal / recentWindow : 0;
  }

  const panelW = 180;
  const panelH = 80;
  const x = ww - panelW - 12;
  const y = 12;

  ctx.save();

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, panelW, panelH);

  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("DPS METER", x + 8, y + 8);

  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#4fc3f7";
  ctx.fillText(`${Math.round(recentDPS).toLocaleString()}`, x + 8, y + 28);

  ctx.font = "11px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("current", x + 8, y + 50);

  ctx.font = "12px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.textAlign = "right";
  ctx.fillText(`avg: ${Math.round(avgDPS).toLocaleString()}`, x + panelW - 8, y + 28);

  ctx.font = "10px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`total: ${Math.round(w.dpsTotalDamage).toLocaleString()}`, x + panelW - 8, y + panelH - 10);

  ctx.restore();
}
