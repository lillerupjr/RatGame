// src/game/systems/render.ts
import { type World } from "../../../engine/world/world";
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
import { buildDiamondSourceQuad } from "./renderCommandGeometry";
import { orientedDims, seAnchorFromTopLeft } from "../../../engine/render/sprites/structureFootprintOwnership";
import {
  type DebugOverlayContext,
} from "../../../engine/render/debug/renderDebug";
import { configurePixelPerfect, snapPx } from "../../../engine/render/pixelPerfect";
import {
  drawProjectedLightAdditive,
  renderAmbientDarknessOverlay,
  resolveLightingGroundYScale,
} from "./renderLighting";
import { renderEntityShadow, type ShadowParams } from "./renderShadow";
import { buildUnifiedWorldShadowMap, computeSweepShadowMap, getSweepShadowMap } from "../../map/sweepShadow";
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
import {
  getCurrencyAtlasFrame,
  getCurrencyFrame,
  getCurrencyFrameForDarknessPercent,
} from "../../content/loot/currencyVisual";
import {
  beginRenderPerfFrame,
  countRenderCanvasGroundChunkRebuild,
  countRenderCanvasGroundChunkDraw,
  countRenderCanvasGroundChunksVisible,
  countRenderGroundStaticDecalAuthorityFiltered,
  countRenderGroundStaticDecalExamined,
  countRenderGroundStaticDecalFallbackEmitted,
  countRenderGroundStaticSurfaceAuthorityFiltered,
  countRenderGroundStaticSurfaceExamined,
  countRenderGroundStaticSurfaceFallbackEmitted,
  countRenderTileLoopIteration,
  countRenderDrawableSort,
  countRenderSliceKeySort,
  endRenderPerfFrame,
  setRenderBackendStats,
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
  computeNearestDynamicRelightAlpha,
  type DynamicRelightLightCandidate,
} from "./dynamicSpriteRelightV1";
import { type StaticRelightFrameContext } from "./staticRelight/staticRelightTypes";
import {
  STATIC_RELIGHT_INCLUDE_STRUCTURES,
  buildRampRoadTiles,
  decalRelightPieceKey,
  floorRelightPieceKey,
  syncStaticRelightRuntimeForFrame,
} from "./staticRelight/staticRelightBakeRebuild";
import {
  buildRuntimeStructureProjectedDraw,
  buildRuntimeStructureTriangleContextKey,
  type RuntimeStructureAnchorPlacementDebug,
  type RuntimeStructureTriangleRect,
  rebuildMonolithicStructureTriangleCacheForMap,
} from "../../structures/monolithicStructureGeometry";
import {
  resolveStructureV6SelectedCandidateIndex,
} from "./structureShadowV6FaceSlices";
import {
  buildStructureShadowFrameContext,
} from "./structureShadows/structureShadowFrameContext";
import {
  buildStructureV6VerticalShadowFrameResults,
} from "./structureShadows/structureShadowOrchestrator";
import {
  type StructureV6ShadowDebugCandidate,
} from "./structureShadows/structureShadowTypes";
import {
  buildStructureV6VerticalShadowMaskDebugData,
  countStructureV6CandidateTrianglesForBucket,
  type StructureV6VerticalShadowMaskDebugData,
} from "./structureShadows/structureShadowV6Slices";
import { drawTexturedQuad } from "./renderPrimitives/drawTexturedQuad";
import {
  getDiamondFitCanvas,
  getFlippedOverlayImage,
  getRuntimeIsoDecalCanvas,
  getRuntimeIsoTopCanvas,
} from "./presentationImageTransforms";
import {
  canvasGroundChunkCacheStore,
  monolithicStructureGeometryCacheStore,
  staticRelightBakeStore,
  structureSpriteAtlasStore,
  structureShadowV6CacheStore,
} from "./presentationSubsystemStores";
import { syncCanvasGroundChunkCacheForFrame } from "./canvasGroundChunkCache";
import type { StructureV6ShadowCacheFrameStats } from "./structureShadows/structureShadowV6Cache";
import { buildDebugFrameContext } from "./debug/debugFrameContext";
import { executeDebugPass } from "./debug/renderDebugPass";
import { prepareRenderFrame } from "./frame/prepareRenderFrame";
import { drawVoidBackgroundOnce } from "./frame/backgroundPass";
import { resolveCameraBootstrap } from "./frame/cameraBootstrap";
import {
  buildViewportCulling,
  isTileInPlayerSouthWedge,
  type ScreenRect,
  type TileBounds,
} from "./frame/viewportCulling";
import { collectFrameDrawables } from "./collection/collectFrameDrawables";
import { Canvas2DRenderer } from "./backend/Canvas2DRenderer";
import { WebGLRenderer } from "./backend/WebGLRenderer";
import { buildPureWebGLCommandList, createBackendStats } from "./backend/renderBackendRouting";
import { commandAxesKey, noteRenderBackendFamilyPlacement } from "./backend/renderBackendCapabilities";
import {
  resolveRenderBackendSelection,
  WEBGL_RUNTIME_FAILURE_REASON,
} from "./backend/renderBackendSelection";
import { buildRenderExecutionPlan } from "./backend/renderExecutionPlan";
import {
  clearWebGLWorldSurfaceFailure,
  getRenderableWebGLWorldSurface,
  getWebGLWorldSurfaceFailureReason,
  noteWebGLWorldSurfaceFailure,
  syncWorldCanvasBackendVisibility,
} from "./backend/webglSurface";
import {
  createRenderFrameBuilder,
  enqueueWorldBandCommand,
  finalizeRenderFrame,
} from "./frame/renderFrameBuilder";
import { renderScreenOverlays } from "./ui/renderScreenOverlays";
import { renderUiPass } from "./ui/renderUiPass";
import type { RenderFrameContext } from "./contracts/renderFrameContext";
import type { CollectionContext } from "./contracts/collectionContext";
import type { ScreenOverlayContext } from "./contracts/screenOverlayContext";
import type { UiPassContext } from "./contracts/uiPassContext";
import type { RenderDebugScreenPassInput } from "./debug/debugRenderTypes";
import { analyzeWorldBatchStream } from "./debug/worldBatchAudit";
import { resolveStructureOverlayAdmissionContext } from "./structures/structureOverlayAdmission";
import { collectStructureOverlays } from "./structures/collectStructureOverlays";
import { buildStructureSlices } from "./structures/buildStructureSlices";
import { buildStructureDrawables } from "./structures/buildStructureDrawables";
import { resolveShadowSunDayCycleRuntime } from "./shadowSunDayCycleRuntime";

const DEBUG_PLAYER_WEDGE = false;
const DISABLE_WALLS_AND_CURTAINS = true;
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

type ScreenPt = { x: number; y: number };

/** Render tiles, entities, overlays, and debug layers. */
export async function renderSystem(
  w: World,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  uiCtx?: CanvasRenderingContext2D,
  uiCanvas?: HTMLCanvasElement,
  presentationDtRealSec: number = 0,
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
  const cameraSmoothingEnabled = renderSettings.cameraSmoothingEnabled !== false;
  const dtReal = Number.isFinite(presentationDtRealSec)
    ? presentationDtRealSec
    : (Number.isFinite(w.timeState?.dtReal) ? w.timeState.dtReal : 1 / 60);
  const cameraBootstrap = resolveCameraBootstrap({
    world: w,
    projectedPlayerX: p0.x,
    projectedPlayerY: p0.y,
    snapshotViewerCamera,
    cameraSmoothingEnabled,
    dtReal,
    followHalfLifeDefaultSec: CAMERA_FOLLOW_HALF_LIFE_DEFAULT_SEC,
    followSnapDistanceSq: CAMERA_FOLLOW_SNAP_DISTANCE_SQ,
    smoothingIntensityScale: CAMERA_SMOOTHING_INTENSITY_SCALE,
  });
  const cameraProjectedX = cameraBootstrap.cameraProjectedX;
  const cameraProjectedY = cameraBootstrap.cameraProjectedY;
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
  ctx.restore();


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
    anchorPlacementDebugNoCamera?: RuntimeStructureAnchorPlacementDebug;
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
      drawTexturedQuad(
        ctx,
        srcDiamond,
        0,
        0,
        srcDiamond.width,
        srcDiamond.height,
        q,
        buildDiamondSourceQuad(srcDiamond.width, srcDiamond.height),
      );
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
    const projectedNoCamera = buildRuntimeStructureProjectedDraw(o, rec.img);
    const footprintW = Math.max(1, o.w | 0);
    const isFootprintOverlay =
      o.layerRole === "STRUCTURE" || ((o.kind ?? "ROOF") === "PROP" && (footprintW > 1 || (o.h | 0) > 1));
    const dx = projectedNoCamera.dx + camX;
    const dy = projectedNoCamera.dy + camY;
    if (LOG_STRUCTURE_ANCHOR_DEBUG && isFootprintOverlay && !loggedStructureAnchorDebugIds.has(o.id)) {
      loggedStructureAnchorDebugIds.add(o.id);
      console.log("[structure-anchor-debug]", {
        id: o.id,
        tileW: footprintW,
        mode: projectedNoCamera.anchorPlacementDebugNoCamera?.mode ?? "n/a",
        alignmentDelta: projectedNoCamera.anchorPlacementDebugNoCamera?.alignmentDeltaPx ?? null,
        screenX: dx,
      });
    }
    return {
      img: rec.img,
      dx,
      dy,
      dw: projectedNoCamera.dw,
      dh: projectedNoCamera.dh,
      flipX: projectedNoCamera.flipX,
      scale: projectedNoCamera.scale,
      anchorPlacementDebugNoCamera: projectedNoCamera.anchorPlacementDebugNoCamera,
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
  const debugFrame = buildDebugFrameContext(debug);
  const shadowSunDayCycle = resolveShadowSunDayCycleRuntime({
    world: w,
    manualSeedHour: debug.shadowSunTimeHour,
    enabled: debug.shadowSunDayCycleEnabled,
    cycleMode: debug.shadowSunCycleMode,
    speedMultiplier: debug.shadowSunDayCycleSpeedMultiplier,
    stepsPerDay: debug.shadowSunStepsPerDay,
    dtRealSec: dtReal,
  });
  const RENDER_ENTITY_SHADOWS = !renderSettings.entityShadowsDisable;
  const RENDER_ENTITY_ANCHORS = renderSettings.entityAnchorsEnabled;
  const debugFlags = debugFrame.flags;
  const SHOW_ENTITY_ANCHOR_OVERLAY = debugFlags.showEntityAnchorOverlay;
  const SHOW_STRUCTURE_SLICE_DEBUG = debugFlags.showStructureSlices;
  const SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG = debugFlags.showStructureTriangleFootprint;
  const SHOW_STRUCTURE_ANCHORS = debugFlags.showStructureAnchors || ((w as any).showStructureAnchors ?? false);
  const SHOW_STRUCTURE_TRIANGLE_OWNERSHIP_SORT_DEBUG = debugFlags.showStructureTriangleOwnershipSort;
  const DEBUG_STRUCTURE_RENDER_MODE = debugFlags.debugStructureRenderMode;
  const SHADOW_CASTER_MODE = debugFlags.shadowCasterMode;
  const SHADOW_V6_REQUESTED_SEMANTIC_BUCKET = debugFlags.shadowV6RequestedSemanticBucket;
  const SHADOW_V6_PRIMARY_SEMANTIC_BUCKET = debugFlags.shadowV6PrimarySemanticBucket;
  const SHADOW_V6_SECONDARY_SEMANTIC_BUCKET = debugFlags.shadowV6SecondarySemanticBucket;
  const SHADOW_V6_TOP_SEMANTIC_BUCKET = debugFlags.shadowV6TopSemanticBucket;
  const SHADOW_V6_STRUCTURE_INDEX = debugFlags.shadowV6StructureIndex;
  const SHADOW_V6_SLICE_COUNT = debugFlags.shadowV6SliceCount;
  const SHADOW_V6_ALL_STRUCTURES = debugFlags.shadowV6AllStructures;
  const SHADOW_V6_ONE_STRUCTURE_ONLY = debugFlags.shadowV6OneStructureOnly;
  const SHADOW_V6_VERTICAL_ONLY = debugFlags.shadowV6VerticalOnly;
  const SHADOW_V6_TOP_ONLY = debugFlags.shadowV6TopOnly;
  const SHADOW_V6_FORCE_REFRESH = debugFlags.shadowV6ForceRefresh;
  const SHOW_ZONE_OBJECTIVE_BOUNDS = debugFlags.showZoneObjectiveBounds;
  const drawEntityAnchorDebug = (
    feetX: number,
    feetY: number,
    drawX: number,
    drawY: number,
    drawW: number,
    drawH: number,
  ): void => {
    executeDebugPass({
      phase: "entityAnchor",
      input: {
        ctx,
        show: SHOW_ENTITY_ANCHOR_OVERLAY,
        feetX,
        feetY,
        drawX,
        drawY,
        drawW,
        drawH,
      },
    });
  };

  // Enemy Z buffer (optional visual override)
  const ez = w.ezVisual;

  // ----------------------------
  // Tile range / diagonals
  // ----------------------------
  const configuredRadius = Number(renderSettings.tileRenderRadius);
  const sliderPadding = Math.max(-12, Math.min(12, Number.isFinite(configuredRadius) ? Math.round(configuredRadius) : 0));
  const renderPaddingFactor = Math.max(-0.9, Math.min(0.9, sliderPadding / 12));
  setRenderTileLoopRadius(sliderPadding);
  const viewportCulling = buildViewportCulling({
    camTx,
    camTy,
    visibleWorldWidth: ww,
    visibleWorldHeight: hh,
    tileWorld: T,
    isoX: ISO_X,
    isoY: ISO_Y,
    renderPaddingFactor,
    worldToScreen,
    screenToWorld,
  });
  const baseCulling = viewportCulling.baseCulling;
  const viewRect = viewportCulling.viewRect;
  const projectedViewportRect: RuntimeStructureTriangleRect = viewportCulling.projectedViewportRect;
  const strictViewportTileBounds: TileBounds = viewportCulling.strictViewportTileBounds;
  const minTx = viewRect.minTx;
  const maxTx = viewRect.maxTx;
  const minTy = viewRect.minTy;
  const maxTy = viewRect.maxTy;
  const isTileInRenderRadius = viewportCulling.isTileInRenderRadius;
  const isTileInRenderRadiusPadded = viewportCulling.isTileInRenderRadiusPadded;
  const tileRectIntersectsRenderRadius = viewportCulling.tileRectIntersectsRenderRadius;
  const tileRectIntersectsBounds = viewportCulling.tileRectIntersectsBounds;
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
  const activePaletteVariantKey = resolveActivePaletteVariantKey();
  const activePaletteSwapWeights = resolveActivePaletteSwapWeights();
  const currentSettings = getUserSettings();
  const worldLightRegistry = buildFrameWorldLightRegistry({
    mapId: compiledMap.id,
    tileWorld: T,
    elevPx: ELEV_PX,
    worldScale: s,
    streetLampOcclusionEnabled: w.lighting.occlusionEnabled,
    staticLightCycleOverride: debug.staticLightCycleOverride,
    shadowSunTimeHour: shadowSunDayCycle.effectiveTimeHour,
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
  const staticRelight = syncStaticRelightRuntimeForFrame(w, {
    bakeStore: staticRelightBakeStore,
    getRuntimeIsoTopCanvas,
    getRuntimeIsoDecalCanvas,
  }, rampRoadTiles);
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
  const groundChunkCacheContextKey = [
    staticRelight.contextKey,
    `renderAll:${RENDER_ALL_HEIGHTS ? 1 : 0}`,
    `activeH:${activeH}`,
  ].join("||");
  const groundChunkCacheSync = syncCanvasGroundChunkCacheForFrame({
    cacheStore: canvasGroundChunkCacheStore,
    contextKey: groundChunkCacheContextKey,
    compiledMap,
    renderAllHeights: RENDER_ALL_HEIGHTS,
    activeH,
    viewRect,
    shouldCullBuildingAt,
    w,
    ANCHOR_Y,
    TILE_ID_OCEAN,
    getAnimatedTileFrame,
    OCEAN_ANIM_TIME_SCALE,
    getTileSpriteById,
    getRuntimeIsoTopCanvas,
    OCEAN_TOP_SCALE,
    STAIR_TOP_SCALE,
    FLOOR_TOP_SCALE,
    OCEAN_BASE_FRAME_PX,
    getRuntimeIsoDecalCanvas,
    getDiamondFitCanvas,
    getRuntimeDecalSprite,
    T,
    worldToScreen,
    camX,
    camY,
    ELEV_PX,
    STAIR_TOP_DY,
    SIDEWALK_ISO_HEIGHT,
    rampRoadTiles,
    staticRelightFrame: staticRelight.frame,
    staticRelightBakeStore,
    floorRelightPieceKey,
    decalRelightPieceKey,
    roadMarkingDecalScale,
    shouldPixelSnapRoadMarking,
    snapPx,
    getRampQuadPoints: (tx: number, ty: number, renderAnchorY: number) => {
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
    },
  });
  if (groundChunkCacheSync.rebuiltChunkCount > 0) {
    countRenderCanvasGroundChunkRebuild(groundChunkCacheSync.rebuiltChunkCount);
  }
  structureSpriteAtlasStore.sync({
    compiledMap,
    paletteVariantKey: activePaletteVariantKey,
  });
  const structureTriangleAdmissionMode = renderSettings.structureTriangleAdmissionMode ?? "hybrid";
  const structureTriangleCutoutEnabled = renderSettings.structureTriangleCutoutEnabled === true;
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
  const isParentTileAfterPlayer = (parentTx: number, parentTy: number): boolean => {
    const parentSlice = parentTx + parentTy;
    const playerSlice = playerCameraTx + playerCameraTy;
    if (parentSlice !== playerSlice) return parentSlice > playerSlice;
    return parentTx > playerCameraTx;
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
  const runtimeStructureTriangleContextKey = buildRuntimeStructureTriangleContextKey({
    mapId: compiledMap.id,
  });
  const runtimeStructureTriangleContextChanged = monolithicStructureGeometryCacheStore
    .resetIfContextChanged(runtimeStructureTriangleContextKey);
  const structureShadowFrame = buildStructureShadowFrameContext({
    mapId: compiledMap.id,
    shadowCasterMode: SHADOW_CASTER_MODE,
    shadowSunTimeHour: shadowSunDayCycle.effectiveTimeHour,
    shadowSunStepKeyOverride: shadowSunDayCycle.shadowStepKeyOverride,
    shadowSunAzimuthDeg: debugFlags.shadowSunAzimuthDeg,
    sunElevationOverrideEnabled: debugFlags.sunElevationOverrideEnabled,
    sunElevationOverrideDeg: debugFlags.sunElevationOverrideDeg,
  });
  const shadowSunModel = structureShadowFrame.sunModel;
  const ambientSunLighting = structureShadowFrame.ambientSunLighting;
  if (SHADOW_CASTER_MODE === "v6SweepShadow") {
    computeSweepShadowMap(compiledMap.tileHeightGrid, shadowSunModel, compiledMap.id);
  }
  staticRelightFrame = staticRelight.frame;
  if (runtimeStructureTriangleContextChanged) {
    rebuildMonolithicStructureTriangleCacheForMap(compiledMap, {
      cacheStore: monolithicStructureGeometryCacheStore,
      getFlippedOverlayImage,
    });
  }

  // ----------------------------
  // Void
  // ----------------------------
  // Disabled: VOID is now drawn once as a screen background (see drawVoidBackgroundOnce).
  // This avoids thousands of drawImage calls per frame.
  {
    // noop
  }
  const frameBuilder = createRenderFrameBuilder();
  const structureV6ShadowDebugCandidates: StructureV6ShadowDebugCandidate[] = [];
  let structureV6VerticalShadowDebugData: StructureV6VerticalShadowMaskDebugData | null = null;
  let structureV6VerticalShadowDebugDataList: StructureV6VerticalShadowMaskDebugData[] = [];
  let structureV6ShadowCacheStats: StructureV6ShadowCacheFrameStats | null = null;
  const deferredStructureSliceDebugDraws: Array<() => void> = [];
  let didQueueStructureCutoutDebugRect = false;
  const worldLightGroundYScale = resolveLightingGroundYScale(w.lighting.groundYScale ?? 0.65);

  // ----------------------------
  // Prepass: build all apron slice draws and bucket them by slice.
  // ----------------------------
  // (Underlay prepass removed; faces now render as occluders)

  // ----------------------------
  const renderFrame: RenderFrameContext = prepareRenderFrame({
    world: w,
    ctx,
    canvas,
    uiCtx,
    uiCanvas,
    overlayCtx,
    overlayCanvas,
    hasUiOverlay,
    cssW,
    cssH,
    screenW,
    screenH,
    devW,
    devH,
    dpr,
    overlayDevW,
    overlayDevH,
    overlayDpr,
    visibleVerticalTiles,
    viewport,
    zoom,
    worldWidth: ww,
    worldHeight: hh,
    scaledW,
    scaledH,
    safeOffsetX,
    safeOffsetY,
    playerWorldX: px,
    playerWorldY: py,
    playerTileX: playerTx,
    playerTileY: playerTy,
    cameraProjectedX,
    cameraProjectedY,
    camTx,
    camTy,
    worldScaleDevice: s,
    renderSettings,
  } as RenderFrameContext);

  const collectionContext: CollectionContext = {
    frame: renderFrame,
    frameBuilder,
    w,
    minSum,
    maxSum,
    minTy,
    maxTy,
    minTx,
    maxTx,
    isTileInRenderRadius,
    countRenderTileLoopIteration,
    surfacesAtXYCached,
    RENDER_ALL_HEIGHTS,
    activeH,
    shouldCullBuildingAt,
    ANCHOR_Y,
    TILE_ID_OCEAN,
    getAnimatedTileFrame,
    OCEAN_ANIM_TIME_SCALE,
    getTileSpriteById,
    getRuntimeIsoTopCanvas,
    OCEAN_TOP_SCALE,
    STAIR_TOP_SCALE,
    FLOOR_TOP_SCALE,
    OCEAN_BASE_FRAME_PX,
    getRuntimeIsoDecalCanvas,
    getDiamondFitCanvas,
    getRuntimeDecalSprite,
    T,
    worldToScreen,
    camX,
    camY,
    ELEV_PX,
    STAIR_TOP_DY,
    SIDEWALK_ISO_HEIGHT,
    decalsInView,
    viewRect,
    KindOrder,
    getZoneTrialObjectiveState,
    compiledMap,
    tileHAtWorld,
    RENDER_ENTITY_SHADOWS,
    getEnemyWorld,
    KENNEY_TILE_WORLD,
    ez,
    getSupportSurfaceAt,
    getEnemySpriteFrame,
    resolveEnemyShadowFootOffset,
    entitySilhouetteMaskDraws,
    getEntityFeetPos,
    RENDER_ENTITY_ANCHORS,
    resolveAnchor01,
    ENTITY_ANCHOR_X01_DEFAULT,
    ENTITY_ANCHOR_Y01_DEFAULT,
    ISO_X,
    ISO_Y,
    vendorNpcSpritesReady,
    getVendorNpcSpriteFrame,
    resolveVendorShadowFootOffset,
    snapPx,
    resolveNeutralShadowFootOffset,
    playerSpritesReady,
    getPlayerSpriteFrame,
    getPlayerSkin,
    resolvePlayerShadowFootOffset,
    px,
    py,
    PLAYER_R,
    isGroundChunkTileAuthoritative: (tx: number, ty: number) => canvasGroundChunkCacheStore.isTileAuthoritative(tx, ty),
    countRenderGroundStaticSurfaceExamined,
    countRenderGroundStaticSurfaceAuthorityFiltered,
    countRenderGroundStaticSurfaceFallbackEmitted,
    countRenderGroundStaticDecalExamined,
    countRenderGroundStaticDecalAuthorityFiltered,
    countRenderGroundStaticDecalFallbackEmitted,
    ZONE_KIND,
    getZoneWorld,
    snapToNearestWalkableGround,
    toScreen,
    renderFireZoneVfx,
    getSpriteById,
    VFX_CLIPS,
    ctx,
    getPickupWorld,
    resolveDynamicSpriteRelightAlpha,
    getCurrencyAtlasFrame,
    getCurrencyFrame,
    dynamicSpriteRelightFrame,
    getCurrencyFrameForDarknessPercent,
    coinColorFromValue,
    registry,
    ENEMY_TYPE,
    getBossAccent,
    LOOT_GOBLIN_GLOW_PULSE_MIN,
    LOOT_GOBLIN_GLOW_PULSE_RANGE,
    LOOT_GOBLIN_GLOW_PULSE_SPEED,
    LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT,
    LOOT_GOBLIN_GLOW_INNER_RADIUS_MULT,
    getEnemySpriteFrameForDarknessPercent,
    drawEntityAnchorDebug,
    getVendorNpcSpriteFrameForDarknessPercent,
    getPigeonFramesForClipAndScreenDirForDarknessPercent,
    debug,
    toScreenAtZ,
    getProjectileWorld,
    playerTxForProjectileCull,
    playerTyForProjectileCull,
    projectileTileRenderRadius,
    worldDeltaToScreen,
    resolveProjectileShadowFootOffset,
    getProjectileSpriteByKind,
    PROJECTILE_BASE_DRAW_PX,
    getProjectileDrawScale,
    staticRelightFrame,
    staticRelightBakeStore,
    floorRelightPieceKey,
    decalRelightPieceKey,
    roadMarkingDecalScale,
    shouldPixelSnapRoadMarking,
    bazookaExhaustAssets,
    BAZOOKA_EXHAUST_OFFSET,
    PRJ_KIND,
    VFX_CLIP_INDEX,
    getPlayerSpriteFrameForDarknessPercent,
    worldLightRegistry,
    DISABLE_WALLS_AND_CURTAINS,
    buildFaceDraws,
    facePieceLayers,
    facePiecesInViewForLayer,
    occluderLayers,
    occludersInViewForLayer,
    buildWallDraw,
    CONTAINER_WALL_SORT_BIAS,
    resolveStructureOverlayAdmissionContext,
    strictViewportTileBounds,
    structureTriangleAdmissionMode,
    collectStructureOverlays,
    debugFlags,
    tileRectIntersectsRenderRadius,
    buildOverlayDraw,
    deriveStructureSouthTieBreakFromSeAnchor,
    buildStructureSlices,
    projectedViewportRect,
    structureTriangleCutoutEnabled,
    structureTriangleCutoutHalfWidth,
    structureTriangleCutoutHalfHeight,
    structureTriangleCutoutAlpha,
    structureCutoutScreenRect,
    isPointInsideStructureCutoutScreenRect,
    playerCameraTx,
    playerCameraTy,
    isParentTileAfterPlayer,
    rampRoadTiles,
    resolveRenderZBand,
    structureShadowFrame,
    SHADOW_V6_PRIMARY_SEMANTIC_BUCKET,
    SHADOW_V6_SECONDARY_SEMANTIC_BUCKET,
    SHADOW_V6_TOP_SEMANTIC_BUCKET,
    getStructureSpriteAtlasFrame: (spriteId: string) => structureSpriteAtlasStore.getAtlasFrame(spriteId),
    monolithicStructureGeometryCacheStore,
    getFlippedOverlayImage,
    SHOW_STRUCTURE_SLICE_DEBUG,
    SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
    SHOW_STRUCTURE_ANCHORS,
    SHOW_STRUCTURE_TRIANGLE_OWNERSHIP_SORT_DEBUG,
    DEBUG_STRUCTURE_RENDER_MODE,
    deferredStructureSliceDebugDraws,
    LOG_STRUCTURE_OWNERSHIP_DEBUG,
    loggedStructureOwnershipDebugIds,
    structureV6ShadowDebugCandidates,
    staticRelight,
    buildStructureDrawables,
    buildStructureV6VerticalShadowFrameResults,
    SHADOW_V6_REQUESTED_SEMANTIC_BUCKET,
    SHADOW_V6_STRUCTURE_INDEX,
    SHADOW_V6_SLICE_COUNT,
    SHADOW_V6_ALL_STRUCTURES,
    SHADOW_V6_ONE_STRUCTURE_ONLY,
    SHADOW_V6_VERTICAL_ONLY,
    SHADOW_V6_TOP_ONLY,
    SHADOW_V6_FORCE_REFRESH,
    STRUCTURE_SHADOW_V5_LENGTH_PX,
    countStructureV6CandidateTrianglesForBucket,
    resolveStructureV6SelectedCandidateIndex,
    buildStructureV6VerticalShadowMaskDebugData,
    structureShadowV6CacheStore,
    didQueueStructureCutoutDebugRect,
    structureV6VerticalShadowDebugData,
    structureV6VerticalShadowDebugDataList,
    structureV6ShadowCacheStats,
  } as CollectionContext;

  const collectionResult = collectFrameDrawables(collectionContext);

  didQueueStructureCutoutDebugRect = collectionResult.didQueueStructureCutoutDebugRect;
  structureV6VerticalShadowDebugData =
    collectionResult.structureV6VerticalShadowDebugData as StructureV6VerticalShadowMaskDebugData | null;
  structureV6VerticalShadowDebugDataList =
    collectionResult.structureV6VerticalShadowDebugDataList as StructureV6VerticalShadowMaskDebugData[];
  structureV6ShadowCacheStats =
    collectionResult.structureV6ShadowCacheStats as StructureV6ShadowCacheFrameStats | null;

  const screenOverlayContext: ScreenOverlayContext = {
    frame: renderFrame,
    frameBuilder,
    w,
    ctx,
    getFloorVisual,
    devW,
    devH,
    debugFrame,
    executeDebugPass,
    debugContext,
    viewRect,
    toScreen,
    T,
    isTileInRenderRadius,
    deferredStructureSliceDebugDraws,
    debugFlags,
    shouldApplyAmbientDarknessOverlay,
    renderSettings,
    setRenderPerfDrawTag,
    renderAmbientDarknessOverlay,
    renderPerfCountersEnabled,
    structureShadowFrame,
    structureV6VerticalShadowDebugData,
    structureV6VerticalShadowDebugDataList,
    structureV6ShadowDebugCandidates,
    structureV6ShadowCacheStats,
    shadowSunModel,
    ambientSunLighting,
    shadowSunDayCycleStatus: shadowSunDayCycle.status,
    structureTriangleAdmissionMode,
    sliderPadding,
    playerCameraTx,
    playerCameraTy,
    structureTriangleCutoutEnabled,
    structureTriangleCutoutHalfWidth,
    structureTriangleCutoutHalfHeight,
    structureTriangleCutoutAlpha,
    roadAreaWidthAt,
    playerTx,
    playerTy,
    DEBUG_PLAYER_WEDGE,
    px,
    py,
    worldToTile,
    minSum,
    maxSum,
    minTy,
    maxTy,
    minTx,
    maxTx,
    isTileInPlayerSouthWedge,
    tileHAtWorld,
    tileToScreen,
    worldToScreenPx,
    KENNEY_TILE_WORLD,
    s,
    cssW,
    cssH,
    dpr,
  } as ScreenOverlayContext;
  renderScreenOverlays(screenOverlayContext);

  if (SHADOW_CASTER_MODE === "v6SweepShadow") {
    const unifiedWorldShadowMap = buildUnifiedWorldShadowMap(
      compiledMap.tileHeightGrid,
      getSweepShadowMap(),
      ambientSunLighting.ambientDarkness01,
    );
    if (unifiedWorldShadowMap) {
      enqueueWorldBandCommand(frameBuilder, {
        semanticFamily: "debug",
        finalForm: "primitive",
        payload: {
          zBand: "FIRST",
          sweepShadowMap: unifiedWorldShadowMap,
        },
      });
    }
  }

  for (let i = 0; i < structureV6VerticalShadowDebugDataList.length; i++) {
    const debugData = structureV6VerticalShadowDebugDataList[i];
    enqueueWorldBandCommand(frameBuilder, {
      semanticFamily: "debug",
      finalForm: "primitive",
      payload: {
        phase: "structureV6MergedMask",
        zBand: debugData.zBand,
        input: {
          debugData,
        },
      },
    });
  }

  const commandFrame = finalizeRenderFrame({
    builder: frameBuilder,
    countRenderSliceKeySort,
    countRenderDrawableSort,
    setRenderZBandCount,
    tileWorld: T,
    projectToScreenAtZ: toScreenAtZ,
    rampRoadTiles,
  });
  const executionPlan = buildRenderExecutionPlan(commandFrame, rampRoadTiles);

  {
    const sampleGroundCommandDiagnostics = (
      command: (typeof executionPlan.world)[number],
    ) => {
      if (command.semanticFamily !== "groundSurface" || command.finalForm !== "quad") return null;
      const tx = Number(command.key.within);
      const ty = Number(command.key.slice) - tx;
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
      const surface = surfacesAtXY(tx, ty).find((candidate) => {
        const stableId = candidate.runtimeTop?.kind === "SQUARE_128_RUNTIME"
          ? ((tx * 73856093 ^ ty * 19349663 ^ (candidate.zBase * 100 | 0) * 83492791) + 17)
          : (tx * 73856093 ^ ty * 19349663 ^ (candidate.zBase * 100 | 0) * 83492791);
        return stableId === command.key.stableId;
      }) ?? null;
      const rawRenderAnchorY = surface?.renderAnchorY;
      const resolvedAnchorY = Number.isFinite(Number(rawRenderAnchorY))
        ? Number(rawRenderAnchorY)
        : ANCHOR_Y;
      const anchorYOffset = SIDEWALK_ISO_HEIGHT * (resolvedAnchorY - 0.5);
      const x0 = tx * T;
      const y0 = ty * T;
      const corners = [
        { label: "nw", worldX: x0, worldY: y0 },
        { label: "ne", worldX: x0 + T, worldY: y0 },
        { label: "se", worldX: x0 + T, worldY: y0 + T },
        { label: "sw", worldX: x0, worldY: y0 + T },
      ].map((corner) => {
        const projected = worldToScreen(corner.worldX, corner.worldY);
        const preSnapY = projected.y + camY - command.key.baseZ * ELEV_PX - anchorYOffset;
        return {
          label: corner.label,
          worldX: corner.worldX,
          worldY: corner.worldY,
          projectedX: projected.x,
          projectedY: projected.y,
          preSnapY,
          snappedY: snapPx(preSnapY),
        };
      });
      return {
        tx,
        ty,
        surfaceId: surface?.id ?? null,
        rawRenderAnchorY,
        resolvedAnchorY,
        anchorYOffset,
        corners,
      };
    };

    const projectToDevice = (point: { x: number; y: number }) => ({
      x: (point.x + viewport.camTx) * viewport.worldScaleDevice + viewport.safeOffsetDeviceX,
      y: (point.y + viewport.camTy) * viewport.worldScaleDevice + viewport.safeOffsetDeviceY,
    });
    const groundProjectedSurfaceCommands = executionPlan.world.filter((command) =>
      command.semanticFamily === "groundSurface" && command.finalForm === "quad"
    ).slice(0, 5);
    (globalThis as any).__renderGroundProjectedSurfaceSample = {
      viewport: {
        camTx: viewport.camTx,
        camTy: viewport.camTy,
        worldScaleDevice: viewport.worldScaleDevice,
        safeOffsetDeviceX: viewport.safeOffsetDeviceX,
        safeOffsetDeviceY: viewport.safeOffsetDeviceY,
        devW,
        devH,
      },
      totalGroundProjectedSurfaceCommands: executionPlan.world.filter((command) =>
        command.semanticFamily === "groundSurface" && command.finalForm === "quad"
      ).length,
      samples: groundProjectedSurfaceCommands.map((command) => {
        const payload = command.payload as unknown as {
          sx?: number;
          sy?: number;
          sw?: number;
          sh?: number;
          alpha?: number;
          x0: number;
          y0: number;
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          x3: number;
          y3: number;
        };
        const firstPoint = { x: payload.x0, y: payload.y0 };
        const inferredProjectedX = Number(firstPoint.x) - viewport.camTx;
        const inferredProjectedY = Number(firstPoint.y) - viewport.camTy;
        const deviceQuad = [
          projectToDevice({ x: payload.x0, y: payload.y0 }),
          projectToDevice({ x: payload.x1, y: payload.y1 }),
          projectToDevice({ x: payload.x2, y: payload.y2 }),
          projectToDevice({ x: payload.x3, y: payload.y3 }),
        ];
        const allDevicePoints = deviceQuad;
        const minX = Math.min(...allDevicePoints.map((point) => point.x));
        const maxX = Math.max(...allDevicePoints.map((point) => point.x));
        const minY = Math.min(...allDevicePoints.map((point) => point.y));
        const maxY = Math.max(...allDevicePoints.map((point) => point.y));
        return {
          key: command.key,
          emissionDiagnostics: sampleGroundCommandDiagnostics(command),
          inferredWorldInputs: {
            projectedX: inferredProjectedX,
            projectedY: inferredProjectedY,
            baseZ: command.key.baseZ,
            kindOrder: command.key.kindOrder,
          },
          diagnosticInputs: {
            camTx: viewport.camTx,
            camTy: viewport.camTy,
            worldScaleDevice: viewport.worldScaleDevice,
            safeOffsetDeviceX: viewport.safeOffsetDeviceX,
            safeOffsetDeviceY: viewport.safeOffsetDeviceY,
            ELEV_PX,
            SIDEWALK_ISO_HEIGHT,
          },
          sourceRect: {
            sx: payload.sx ?? 0,
            sy: payload.sy ?? 0,
            sw: payload.sw ?? 0,
            sh: payload.sh ?? 0,
          },
          quadAlpha: payload.alpha ?? 1,
          dstPoints: [
            { x: payload.x0, y: payload.y0 },
            { x: payload.x1, y: payload.y1 },
            { x: payload.x2, y: payload.y2 },
            { x: payload.x3, y: payload.y3 },
          ],
          deviceDstPoints: deviceQuad,
          deviceBounds: { minX, maxX, minY, maxY },
          intersectsCanvas: maxX >= 0 && maxY >= 0 && minX <= devW && minY <= devH,
        };
      }),
    };
  }

  const canvasRenderer = new Canvas2DRenderer(renderFrame, {
    w,
    T,
    compiledMap,
    shadowSunModel,
    ambientSunLighting,
    rampRoadTiles,
    camX,
    camY,
    ELEV_PX,
    ANCHOR_Y,
    SIDEWALK_SRC_SIZE,
    SIDEWALK_ISO_HEIGHT,
    staticRelightFrame,
    staticRelightBakeStore,
    worldLightGroundYScale,
    SHOW_ZONE_OBJECTIVE_BOUNDS,
    SHOW_ENTITY_ANCHOR_OVERLAY,
    RENDER_ENTITY_ANCHORS,
    ENTITY_ANCHOR_X01_DEFAULT,
    ENTITY_ANCHOR_Y01_DEFAULT,
    worldToScreen,
    toScreen,
    toScreenAtZ,
    tileHAtWorld,
    getRuntimeIsoTopCanvas,
    getRuntimeIsoDecalCanvas,
    getRuntimeDecalSprite,
    getDiamondFitCanvas,
    getFlippedOverlayImage,
    getTileSpriteById,
    getSpriteById,
    getEnemySpriteFrame,
    getEnemySpriteFrameForDarknessPercent,
    getVendorNpcSpriteFrame,
    getVendorNpcSpriteFrameForDarknessPercent,
    getPigeonFramesForClipAndScreenDirForDarknessPercent,
    getPlayerSpriteFrame,
    getPlayerSpriteFrameForDarknessPercent,
    playerSpritesReady,
    vendorNpcSpritesReady,
    getProjectileWorld,
    KENNEY_TILE_WORLD,
    getProjectileSpriteByKind,
    getProjectileDrawScale,
    PROJECTILE_BASE_DRAW_PX,
    resolveProjectileShadowFootOffset,
    bazookaExhaustAssets,
    BAZOOKA_EXHAUST_OFFSET,
    worldDeltaToScreen,
    snapToNearestWalkableGround,
    renderFireZoneVfx,
    ZONE_KIND,
    ISO_X,
    ISO_Y,
    VFX_CLIPS,
    VFX_CLIP_INDEX,
    registry,
    resolveDynamicSpriteRelightAlpha,
    dynamicSpriteRelightFrame,
    getCurrencyFrame,
    getCurrencyFrameForDarknessPercent,
    coinColorFromValue,
    ENEMY_TYPE,
    LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT,
    LOOT_GOBLIN_GLOW_INNER_RADIUS_MULT,
    LOOT_GOBLIN_GLOW_PULSE_MIN,
    LOOT_GOBLIN_GLOW_PULSE_RANGE,
    LOOT_GOBLIN_GLOW_PULSE_SPEED,
    resolveAnchor01,
    debug,
    PLAYER_R,
    roadMarkingDecalScale,
    shouldPixelSnapRoadMarking,
    floorRelightPieceKey,
    decalRelightPieceKey,
    getUserSettings,
    setRenderPerfDrawTag,
    countRenderCanvasGroundChunkDraw,
    countRenderCanvasGroundChunksVisible,
    viewRect,
    groundChunkCache: canvasGroundChunkCacheStore,
    renderAmbientDarknessOverlay,
    executeDebugPass,
    srcUvNW,
    srcUvNE,
    srcUvSE,
    srcUvSW,
    getRampQuadPoints,
  });
  const webglSurface = getRenderableWebGLWorldSurface(canvas);
  const backendSelection = resolveRenderBackendSelection(
    renderSettings as any,
    webglSurface,
    getWebGLWorldSurfaceFailureReason(canvas),
  );
  const worldBatchAudit = renderPerfCountersEnabled
    ? analyzeWorldBatchStream(executionPlan.world, backendSelection.selectedBackend)
    : null;
  if (backendSelection.selectedBackend === "webgl" && webglSurface) {
    const stats = createBackendStats("webgl");
    try {
      clearWebGLWorldSurfaceFailure(canvas);
      const cachedSurface = webglSurface as typeof webglSurface & { renderer?: WebGLRenderer };
      const webglRenderer = cachedSurface.renderer ?? new WebGLRenderer(renderFrame, webglSurface.gl);
      cachedSurface.renderer = webglRenderer;
      webglRenderer.setFrameContext(renderFrame);
      const webglWorldCommands = buildPureWebGLCommandList(executionPlan.world, stats);
      const webglScreenCommands = buildPureWebGLCommandList(executionPlan.screen, stats);

      canvasRenderer.clearOverlayCanvas();
      canvasRenderer.clearMainCanvas();
      webglRenderer.beginFrame();
      webglRenderer.useWorldSpace();
      webglRenderer.renderCommands(webglWorldCommands, {
        groundChunkCache: canvasGroundChunkCacheStore,
        viewRect,
        rampRoadTiles,
      });
      canvasRenderer.renderScreenCommands(executionPlan.screen);

      setRenderBackendStats({
        requestedBackend: backendSelection.requestedBackend,
        selectedBackend: backendSelection.selectedBackend,
        defaultBackend: backendSelection.policy.defaultBackend,
        webglReadyForDefault: backendSelection.policy.webglReadyForDefault,
        fallbackReason: backendSelection.fallbackReason,
        webglCommandCount: stats.webglCommandCount,
        canvasFallbackCommandCount: stats.canvasFallbackCommandCount,
        unsupportedCommandCount: stats.unsupportedCommandCount,
        webglGroundCommandCount: stats.webglGroundCommandCount,
        unsupportedGroundCommandCount: stats.unsupportedGroundCommandCount,
        unsupportedCommandKeys: stats.unsupportedCommandKeys,
        webglByAxes: stats.webglByAxes,
        canvasFallbackByAxes: stats.canvasFallbackByAxes,
        unsupportedByAxes: stats.unsupportedByAxes,
        unsupportedBySemanticFamily: stats.unsupportedBySemanticFamily,
        partiallyHandledAxes: stats.partiallyHandledAxes,
      });
    } catch (error) {
      noteWebGLWorldSurfaceFailure(canvas, WEBGL_RUNTIME_FAILURE_REASON);
      syncWorldCanvasBackendVisibility(canvas, "canvas2d", true);
      console.error("[render] WebGL backend failed, falling back to Canvas2D.", error);
      canvasRenderer.render(executionPlan);
      const fallbackStats = createBackendStats("canvas2d");
      const allCommands = [...executionPlan.world, ...executionPlan.screen];
      fallbackStats.canvasFallbackCommandCount = allCommands.length;
      for (let i = 0; i < allCommands.length; i++) {
        noteRenderBackendFamilyPlacement(fallbackStats, commandAxesKey(allCommands[i]), "canvas2d");
      }
      setRenderBackendStats({
        requestedBackend: backendSelection.requestedBackend,
        selectedBackend: "canvas2d",
        defaultBackend: backendSelection.policy.defaultBackend,
        webglReadyForDefault: backendSelection.policy.webglReadyForDefault,
        fallbackReason: WEBGL_RUNTIME_FAILURE_REASON,
        webglCommandCount: fallbackStats.webglCommandCount,
        canvasFallbackCommandCount: fallbackStats.canvasFallbackCommandCount,
        unsupportedCommandCount: fallbackStats.unsupportedCommandCount,
        webglGroundCommandCount: fallbackStats.webglGroundCommandCount,
        unsupportedGroundCommandCount: fallbackStats.unsupportedGroundCommandCount,
        unsupportedCommandKeys: fallbackStats.unsupportedCommandKeys,
        webglByAxes: fallbackStats.webglByAxes,
        canvasFallbackByAxes: fallbackStats.canvasFallbackByAxes,
        unsupportedByAxes: fallbackStats.unsupportedByAxes,
        unsupportedBySemanticFamily: fallbackStats.unsupportedBySemanticFamily,
        partiallyHandledAxes: fallbackStats.partiallyHandledAxes,
      });
    }
  } else {
    syncWorldCanvasBackendVisibility(canvas, "canvas2d", true);
    canvasRenderer.render(executionPlan);
    const stats = createBackendStats("canvas2d");
    const allCommands = [...executionPlan.world, ...executionPlan.screen];
    stats.canvasFallbackCommandCount = allCommands.length;
    for (let i = 0; i < allCommands.length; i++) {
      noteRenderBackendFamilyPlacement(stats, commandAxesKey(allCommands[i]), "canvas2d");
    }
    setRenderBackendStats({
      requestedBackend: backendSelection.requestedBackend,
      selectedBackend: "canvas2d",
      defaultBackend: backendSelection.policy.defaultBackend,
      webglReadyForDefault: backendSelection.policy.webglReadyForDefault,
      fallbackReason: backendSelection.fallbackReason,
      webglCommandCount: stats.webglCommandCount,
      canvasFallbackCommandCount: stats.canvasFallbackCommandCount,
      unsupportedCommandCount: stats.unsupportedCommandCount,
      webglGroundCommandCount: stats.webglGroundCommandCount,
      unsupportedGroundCommandCount: stats.unsupportedGroundCommandCount,
      unsupportedCommandKeys: stats.unsupportedCommandKeys,
      webglByAxes: stats.webglByAxes,
      canvasFallbackByAxes: stats.canvasFallbackByAxes,
      unsupportedByAxes: stats.unsupportedByAxes,
      unsupportedBySemanticFamily: stats.unsupportedBySemanticFamily,
      partiallyHandledAxes: stats.partiallyHandledAxes,
    });
  }
  endRenderPerfFrame(w.timeSec ?? 0);

  const perfDebugScreenInput: RenderDebugScreenPassInput | null = renderPerfCountersEnabled
    ? {
        ctx: overlayCtx,
        cssW,
        cssH,
        dpr,
        flags: debugFlags,
        fps: Number((w as { fps?: number }).fps ?? 0),
        frameTimeMs: Number((w as { fps?: number }).fps ?? 0) > 0 ? 1000 / Number((w as { fps?: number }).fps ?? 0) : 0,
        renderPerfCountersEnabled: true,
        structureShadowRouting: structureShadowFrame.routing,
        structureV6VerticalShadowDebugData,
        structureV6ShadowDebugCandidateCount: structureV6ShadowDebugCandidates.length,
        structureV6ShadowCastCount: structureV6VerticalShadowDebugDataList.length,
        structureV6ShadowCacheStats,
        shadowSunModel,
        ambientSunLighting,
        shadowSunDayCycleStatus: shadowSunDayCycle.status,
        structureTriangleAdmissionMode,
        sliderPadding,
        playerCameraTx,
        playerCameraTy,
        structureTriangleCutoutEnabled,
        structureTriangleCutoutHalfWidth,
        structureTriangleCutoutHalfHeight,
        structureTriangleCutoutAlpha,
        roadWidthAtPlayer: roadAreaWidthAt(playerTx, playerTy),
        worldBatchAudit,
      }
    : null;

  const uiPassContext: UiPassContext = {
    frame: renderFrame,
    overlayCtx,
    overlayDpr,
    hasUiOverlay,
    w,
    resolveNavArrowTarget,
    renderNavArrow,
    cssW,
    cssH,
    worldToScreen,
    viewport,
    safeOffsetX,
    safeOffsetY,
    debugFlags,
    executeDebugPass,
    scaledW,
    scaledH,
    getUserSettings,
    screenW,
    screenH,
    perfDebugScreenInput,
    renderFrame,
  } as UiPassContext;
  renderUiPass(uiPassContext);
}
