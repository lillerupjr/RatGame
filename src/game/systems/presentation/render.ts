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
import {
  buildRuntimeStructureBandPieces,
} from "../../../engine/render/sprites/runtimeStructureSlicing";
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
import { getCurrencyFrame, getCurrencyFrameForDarknessPercent } from "../../content/loot/currencyVisual";
import {
  beginRenderPerfFrame,
  countRenderTileLoopIteration,
  countRenderClosureCreated,
  countRenderDrawableSort,
  countRenderSliceKeySort,
  endRenderPerfFrame,
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
  structureSliceRelightPieceKey,
  syncStaticRelightRuntimeForFrame,
} from "./staticRelight/staticRelightBakeRebuild";
import {
  buildRuntimeStructureTriangleContextKey,
  type RuntimeStructureTriangleRect,
} from "./runtimeStructureTriangles";
import {
  rebuildRuntimeStructureTriangleCacheForMap,
} from "./structureTriangles/structureTriangleCacheRebuild";
import {
  type StructureShadowProjectedTriangle,
} from "./structureShadowV1";
import {
  resolveStructureV6SelectedCandidateIndex,
} from "./structureShadowV6FaceSlices";
import {
  buildStructureShadowFrameContext,
} from "./structureShadows/structureShadowFrameContext";
import {
  buildStructureShadowFrameResult as buildOrchestratedStructureShadowFrameResult,
  buildStructureV6VerticalShadowFrameResult,
} from "./structureShadows/structureShadowOrchestrator";
import {
  countStructureHybridProjectedTriangles,
  drawStructureHybridProjectedTrianglesSolid,
  drawStructureHybridShadowProjectedTriangles,
  drawStructureShadowProjectedTriangles,
  drawStructureV4ShadowTrianglesSolid,
  drawStructureV4ShadowWarpedTriangles,
} from "./structureShadows/structureShadowProjectedDraw";
import {
  type StructureHybridShadowRenderPiece,
  type StructureV4ShadowRenderPiece,
  type StructureV5ShadowRenderPiece,
  type StructureV6ShadowDebugCandidate,
} from "./structureShadows/structureShadowTypes";
import {
  drawStructureV5ShadowMasks,
  type StructureV5ShadowAnchorDiagnostic,
} from "./structureShadows/structureShadowV5Masks";
import {
  buildStructureV6VerticalShadowMaskDebugData,
  countStructureV6CandidateTrianglesForBucket,
  type StructureV6VerticalShadowMaskDebugData,
} from "./structureShadows/structureShadowV6Slices";
import { drawTexturedTriangle } from "./renderPrimitives/drawTexturedTriangle";
import {
  getDiamondFitCanvas,
  getFlippedOverlayImage,
  getRuntimeIsoDecalCanvas,
  getRuntimeIsoTopCanvas,
} from "./presentationImageTransforms";
import {
  runtimeStructureTriangleCacheStore,
  staticRelightBakeStore,
  structureShadowHybridCacheStore,
  structureShadowV1CacheStore,
  structureShadowV2CacheStore,
  structureShadowV4CacheStore,
} from "./presentationSubsystemStores";
import { buildDebugFrameContext } from "./debug/debugFrameContext";
import { executeDebugPass } from "./debug/renderDebugPass";
import { prepareRenderFrame } from "./frame/prepareRenderFrame";
import { collectFrameDrawables } from "./collection/collectFrameDrawables";
import { executeWorldPasses } from "./passes/executeWorldPasses";
import { renderScreenOverlays } from "./ui/renderScreenOverlays";
import { renderUiPass } from "./ui/renderUiPass";
import { resolveStructureOverlayAdmissionContext } from "./structures/structureOverlayAdmission";
import { collectStructureOverlays } from "./structures/collectStructureOverlays";
import { buildStructureSlices } from "./structures/buildStructureSlices";
import { buildStructureDrawables } from "./structures/buildStructureDrawables";
import { renderStructurePass } from "./structures/renderStructurePass";
import type { StructureDrawablePayload } from "./structures/structurePresentationTypes";

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

// Background mode:
// - "SOLID" = fastest, clean black void
// - "PATTERN" = repeats void tile as canvas pattern (still fast, looks textured)
const VOID_BG_MODE: "SOLID" | "PATTERN" = "SOLID";

let voidBgPattern: CanvasPattern | null = null;
let voidBgPatternImgRef: HTMLImageElement | null = null;

type ScreenPt = { x: number; y: number };

function smoothTowardByHalfLife(current: number, target: number, halfLifeSec: number, dtRealSec: number): number {
  if (!Number.isFinite(current)) return target;
  if (!Number.isFinite(target)) return current;
  if (!Number.isFinite(halfLifeSec) || halfLifeSec <= 0) return target;
  if (!Number.isFinite(dtRealSec) || dtRealSec <= 0) return current;
  const alpha = 1 - Math.pow(0.5, dtRealSec / halfLifeSec);
  return current + (target - current) * alpha;
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
  const debugFrame = buildDebugFrameContext(debug);
  const RENDER_ENTITY_SHADOWS = !renderSettings.entityShadowsDisable;
  const RENDER_ENTITY_ANCHORS = renderSettings.entityAnchorsEnabled;
  const debugFlags = debugFrame.flags;
  const SHOW_ENTITY_ANCHOR_OVERLAY = debugFlags.showEntityAnchorOverlay;
  const SHOW_STRUCTURE_SLICE_DEBUG = debugFlags.showStructureSlices;
  const SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG = debugFlags.showStructureTriangleFootprint;
  const SHADOW_V1_DEBUG_GEOMETRY_MODE = debugFlags.shadowV1DebugGeometryMode;
  const SHADOW_CASTER_MODE = debugFlags.shadowCasterMode;
  const SHADOW_HYBRID_DIAGNOSTIC_MODE = debugFlags.shadowHybridDiagnosticMode;
  const SHADOW_DEBUG_MODE = debugFlags.shadowDebugMode;
  const SHADOW_V5_DEBUG_VIEW = debugFlags.shadowV5DebugView;
  const SHADOW_V5_TRANSFORM_DEBUG_MODE = debugFlags.shadowV5TransformDebugMode;
  const SHADOW_V6_REQUESTED_SEMANTIC_BUCKET = debugFlags.shadowV6RequestedSemanticBucket;
  const SHADOW_V6_PRIMARY_SEMANTIC_BUCKET = debugFlags.shadowV6PrimarySemanticBucket;
  const SHADOW_V6_SECONDARY_SEMANTIC_BUCKET = debugFlags.shadowV6SecondarySemanticBucket;
  const SHADOW_V6_TOP_SEMANTIC_BUCKET = debugFlags.shadowV6TopSemanticBucket;
  const SHADOW_V6_STRUCTURE_INDEX = debugFlags.shadowV6StructureIndex;
  const SHADOW_V6_SLICE_COUNT = debugFlags.shadowV6SliceCount;
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
    enabled: structureTriangleGeometryEnabled,
  });
  const runtimeStructureTriangleContextChanged = runtimeStructureTriangleCacheStore
    .resetIfContextChanged(runtimeStructureTriangleContextKey);
  const structureShadowFrame = buildStructureShadowFrameContext(
    {
      mapId: compiledMap.id,
      structureTriangleGeometryEnabled,
      shadowCasterMode: SHADOW_CASTER_MODE,
      shadowSunTimeHour: debugFlags.shadowSunTimeHour,
    },
    {
      v1: structureShadowV1CacheStore,
      v2: structureShadowV2CacheStore,
      hybrid: structureShadowHybridCacheStore,
      v4: structureShadowV4CacheStore,
    },
  );
  const shadowSunModel = structureShadowFrame.sunModel;
  staticRelightFrame = staticRelight.frame;
  if (runtimeStructureTriangleContextChanged && structureTriangleGeometryEnabled) {
    rebuildRuntimeStructureTriangleCacheForMap(compiledMap, {
      cacheStore: runtimeStructureTriangleCacheStore,
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

  const drawStructureDrawableFn: SliceDrawFn = (payload) => {
    renderStructurePass({
      ctx,
      payload: payload as StructureDrawablePayload,
      showStructureSliceDebug: SHOW_STRUCTURE_SLICE_DEBUG,
      tileWorld: T,
      deferredStructureSliceDebugDraws,
      resolveRelitCanvas: (pieceKey) => {
        if (!pieceKey) return null;
        const bakedEntry = staticRelightBakeStore.get(pieceKey);
        return bakedEntry?.kind === "RELIT" ? bakedEntry.baked : null;
      },
      drawOverlayRenderPiece: drawRenderPiece,
    });
  };

  // ----------------------------
  // Prepass: build all apron slice draws and bucket them by slice.
  // ----------------------------
  // (Underlay prepass removed; faces now render as occluders)

  // ----------------------------
  const renderFrame = prepareRenderFrame({
    w,
    ctx,
    canvas,
    uiCtx,
    uiCanvas,
    viewport,
    renderSettings,
  });

  const collectionResult = collectFrameDrawables({
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
    addToSlice,
    ANCHOR_Y,
    drawRuntimeSidewalkTopFn,
    TILE_ID_OCEAN,
    getAnimatedTileFrame,
    OCEAN_ANIM_TIME_SCALE,
    getTileSpriteById,
    OCEAN_TOP_SCALE,
    STAIR_TOP_SCALE,
    FLOOR_TOP_SCALE,
    OCEAN_BASE_FRAME_PX,
    getRuntimeIsoDecalCanvas,
    T,
    worldToScreen,
    camX,
    camY,
    ELEV_PX,
    STAIR_TOP_DY,
    drawImageTopFn,
    decalsInView,
    viewRect,
    KindOrder,
    drawRuntimeDecalTopFn,
    getZoneTrialObjectiveState,
    compiledMap,
    tileHAtWorld,
    drawZoneObjectiveFn,
    RENDER_ENTITY_SHADOWS,
    getEnemyWorld,
    KENNEY_TILE_WORLD,
    ez,
    getSupportSurfaceAt,
    getEnemySpriteFrame,
    resolveEnemyShadowFootOffset,
    drawEntityShadowFn,
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
    bazookaExhaustAssets,
    BAZOOKA_EXHAUST_OFFSET,
    PRJ_KIND,
    VFX_CLIP_INDEX,
    getPlayerSpriteFrameForDarknessPercent,
    worldLightRegistry,
    drawPendingLightRenderPieceFn,
    DISABLE_WALLS_AND_CURTAINS,
    buildFaceDraws,
    facePieceLayers,
    facePiecesInViewForLayer,
    drawRenderPiece,
    occluderLayers,
    occludersInViewForLayer,
    buildWallDraw,
    CONTAINER_WALL_SORT_BIAS,
    resolveStructureOverlayAdmissionContext,
    strictViewportTileBounds,
    structureTriangleGeometryEnabled,
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
    runtimeStructureTriangleCacheStore,
    getFlippedOverlayImage,
    SHOW_STRUCTURE_SLICE_DEBUG,
    SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
    SHADOW_V1_DEBUG_GEOMETRY_MODE,
    deferredStructureSliceDebugDraws,
    LOG_STRUCTURE_OWNERSHIP_DEBUG,
    loggedStructureOwnershipDebugIds,
    queueStructureShadowTrianglesForBand,
    queueStructureHybridShadowForBand,
    queueStructureV4ShadowForBand,
    queueStructureV5ShadowForBand,
    structureV6ShadowDebugCandidates,
    hybridShadowDiagnosticStats,
    v4ShadowDiagnosticStats,
    v5ShadowDiagnosticStats,
    staticRelight,
    structureShadowV1CacheStore,
    structureShadowV2CacheStore,
    structureShadowHybridCacheStore,
    structureShadowV4CacheStore,
    buildStructureDrawables,
    drawStructureDrawableFn,
    buildStructureV6VerticalShadowFrameResult,
    SHADOW_V6_REQUESTED_SEMANTIC_BUCKET,
    SHADOW_V6_STRUCTURE_INDEX,
    SHADOW_V6_SLICE_COUNT,
    STRUCTURE_SHADOW_V5_LENGTH_PX,
    countStructureV6CandidateTrianglesForBucket,
    resolveStructureV6SelectedCandidateIndex,
    buildStructureV6VerticalShadowMaskDebugData,
    didQueueStructureCutoutDebugRect,
    structureV6VerticalShadowDebugData,
  });

  didQueueStructureCutoutDebugRect = collectionResult.didQueueStructureCutoutDebugRect;
  structureV6VerticalShadowDebugData =
    collectionResult.structureV6VerticalShadowDebugData as StructureV6VerticalShadowMaskDebugData | null;
  const worldPassContext: Record<string, any> = {
    sliceDrawables,
    countRenderSliceKeySort,
    isWorldKindForRenderPass,
    deriveFeetSortYFromKey,
    T,
    toScreenAtZ,
    resolveRenderZBand,
    rampRoadTiles,
    countRenderDrawableSort,
    compareRenderKeys,
    structureShadowTrianglesByBand,
    structureHybridShadowByBand,
    structureV4ShadowByBand,
    structureV5ShadowByBand,
    structureShadowFrame,
    structureV6VerticalShadowDebugData,
    setRenderZBandCount,
    KindOrder,
    isGroundKindForRenderPass,
    setRenderPerfDrawTag,
    drawStructureShadowProjectedTriangles,
    ctx,
    STRUCTURE_SHADOW_V1_MAX_DARKNESS,
    SHADOW_HYBRID_DIAGNOSTIC_MODE,
    hybridMainCanvasDiagnosticPieces,
    countStructureHybridProjectedTriangles,
    hybridShadowDiagnosticStats,
    drawStructureHybridProjectedTrianglesSolid,
    drawStructureHybridShadowProjectedTriangles,
    SHADOW_DEBUG_MODE,
    drawStructureV4ShadowTrianglesSolid,
    drawStructureV4ShadowWarpedTriangles,
    v4ShadowDiagnosticStats,
    drawStructureV5ShadowMasks,
    shadowSunModel,
    SHADOW_V5_DEBUG_VIEW,
    SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
    SHADOW_V5_TRANSFORM_DEBUG_MODE,
    v5ShadowDiagnosticStats,
    v5ShadowAnchorDiagnostic,
    executeDebugPass,
  };
  executeWorldPasses(worldPassContext);
  v5ShadowAnchorDiagnostic = worldPassContext.v5ShadowAnchorDiagnostic;

  renderScreenOverlays({
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
    structureV6ShadowDebugCandidates,
    v5ShadowAnchorDiagnostic,
    shadowSunModel,
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
    hybridShadowDiagnosticStats,
    v4ShadowDiagnosticStats,
    v5ShadowDiagnosticStats,
    endRenderPerfFrame,
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
  });

  renderUiPass({
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
    renderFrame,
  });
}
