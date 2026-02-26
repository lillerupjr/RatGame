// src/game/systems/render.ts
import { gridAtPlayer, type World } from "../../../engine/world/world";
import { registry } from "../../content/registry";
import { ZONE_KIND } from "../../factories/zoneFactory";
import { getBossAccent, getFloorVisual } from "../../content/floors";
import { ENEMY_TYPE } from "../../content/enemies";
import { getPlayerSkin, getPlayerSpriteFrame, playerSpritesReady } from "../../../engine/render/sprites/playerSprites";
import { type Dir8 } from "../../../engine/render/sprites/dir8";
import { getEnemySpriteFrame, preloadEnemySprites } from "../../../engine/render/sprites/enemySprites";
import { getVendorNpcSpriteFrame, preloadVendorNpcSprites, vendorNpcSpritesReady } from "../../../engine/render/sprites/vendorSprites";
import { preloadNeutralMobSprites } from "../../../engine/render/sprites/neutralSprites";
import {
  heightAtWorld,
  walkInfo,
  surfacesAtXY,
  facePieceLayers,
  facePiecesInViewForLayer,
  occluderLayers,
  occludersInViewForLayer,
  viewRectFromWorldCenter,
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

import { worldDeltaToScreen, worldToScreen, ISO_X, ISO_Y } from "../../../engine/math/iso";

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
  getRuntimeDecalSprite,
  getTileSpriteById,
} from "../../../engine/render/sprites/renderSprites";
import type { RuntimeDecalSetId } from "../../content/runtimeDecalConfig";
import { roadMarkingDecalScale, shouldPixelSnapRoadMarking } from "../../roads/roadMarkingRender";
import {
  buildRuntimeStructureBandPieces,
} from "../../../engine/render/sprites/runtimeStructureSlicing";
import { orientedDims, seAnchorFromTopLeft } from "../../../engine/render/sprites/structureFootprintOwnership";
import {
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
import { renderLighting, type ProjectedLight } from "./renderLighting";
import { renderEntityShadow, renderEntityShadowMask, type ShadowParams } from "./renderShadow";
import {
  resolveEnemyShadowFootOffset,
  resolveNeutralShadowFootOffset,
  resolvePlayerShadowFootOffset,
  resolveProjectileShadowFootOffset,
  resolveVendorShadowFootOffset,
} from "./shadowFootOffsets";
import { resolveDebugFlags } from "../../../debugSettings";
import { getUserSettings } from "../../../userSettings";
import { getZoneTrialObjectiveState } from "../../objectives/zoneObjectiveSystem";
import { renderZoneObjectives } from "../../render/renderZoneObjectives";
import { resolveActivePaletteId } from "../../render/activePalette";
import { resolveNavArrowTarget } from "../../ui/navArrowTarget";
import { renderNavArrow } from "../../ui/navArrowRender";
import {
  beginRenderPerfFrame,
  countRenderTileLoopIteration,
  countRenderClosureCreated,
  countRenderDrawableSort,
  countRenderSliceKeySort,
  endRenderPerfFrame,
  getRenderPerfSnapshot,
  setRenderPerfCountersEnabled,
  setRenderPerfDrawTag,
  setRenderTileLoopRadius,
} from "./renderPerfCounters";

// ============================================
// RenderKey & KindOrder (Isometric Painter Model)
// ============================================

/** Semantic layer ordering (used as tie-breaker in slice ordering). */
enum KindOrder {
  FLOOR = 0,
  DECAL = 1,
  ZONE_OBJECTIVE = 2,
  SHADOW = 3,
  ENTITY = 4,
  VFX = 5,
  STRUCTURE = 6,
  OCCLUDER = 7,
  OVERLAY = 8,
}

/** Canonical render key for deterministic ordering. */
interface RenderKey {
  slice: number;      // tx + ty (primary: slice ordering, NW -> SE)
  within: number;     // tx (secondary: within-slice ordering)
  baseZ: number;      // surface height (tertiary: occlusion)
  feetSortY?: number; // optional feet-Y sort key for entities
  kindOrder: KindOrder; // semantic layer (quaternary: kind bias)
  stableId: number;   // deterministic tie-breaker (quinary)
}

/** Compare two RenderKeys lexicographically. */
function compareRenderKeys(a: RenderKey, b: RenderKey): number {
  if (a.slice !== b.slice) return a.slice - b.slice;
  if (a.within !== b.within) return a.within - b.within;
  if (a.baseZ !== b.baseZ) return a.baseZ - b.baseZ;
  const ay = a.feetSortY ?? 0;
  const by = b.feetSortY ?? 0;
  if (ay !== by) return ay - by;
  if (a.kindOrder !== b.kindOrder) return a.kindOrder - b.kindOrder;
  return a.stableId - b.stableId;
}

const DEBUG_PLAYER_WEDGE = false;
const HARDCODED_VOID_TOP_SRC = "/assets-runtime/tiles/floor/void.png";

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
let entityShadowMaskScratchCanvas: HTMLCanvasElement | null = null;
let entityShadowMaskScratchCtx: CanvasRenderingContext2D | null = null;
let entitySilhouetteMaskScratchCanvas: HTMLCanvasElement | null = null;
let entitySilhouetteMaskScratchCtx: CanvasRenderingContext2D | null = null;
// NEW: structures layer scratch (used for player cutout)
let structureLayerScratchCanvas: HTMLCanvasElement | null = null;
let structureLayerScratchCtx: CanvasRenderingContext2D | null = null;
let southBuildingMaskScratchCanvas: HTMLCanvasElement | null = null;
let southBuildingMaskScratchCtx: CanvasRenderingContext2D | null = null;
let cutoutVoidScratchCanvas: HTMLCanvasElement | null = null;
let cutoutVoidScratchCtx: CanvasRenderingContext2D | null = null;

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
  camTx: number,
  camTy: number,
  s: number,
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
    // World-locked: pattern origin follows the same camera translation as world rendering.
    // We are in screen space here, so convert world-space translate (camTx/camTy)
    // into device pixels by multiplying with s.
    const ox = Math.round(camTx * s);
    const oy = Math.round(camTy * s);

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

function ensureBuildingMaskCanvas(
  lighting: World["lighting"],
  screenW: number,
  screenH: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  let canvas = lighting.debugBuildingMaskCanvas ?? null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    lighting.debugBuildingMaskCanvas = canvas;
    lighting.debugBuildingMaskCtx = null;
  }
  if (canvas.width !== screenW) canvas.width = screenW;
  if (canvas.height !== screenH) canvas.height = screenH;
  let c2d = lighting.debugBuildingMaskCtx ?? null;
  if (!c2d || c2d.canvas !== canvas) {
    c2d = canvas.getContext("2d");
    if (!c2d) return null;
    lighting.debugBuildingMaskCtx = c2d;
  }
  configurePixelPerfect(c2d);
  return { canvas, ctx: c2d };
}

function ensureLightingMaskCanvas(
  lighting: World["lighting"],
  kind: "SOURCE_OCC" | "INVERSE_BUILDING" | "COMBINED_OCC",
  screenW: number,
  screenH: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  let canvas: HTMLCanvasElement | null = null;
  let c2d: CanvasRenderingContext2D | null = null;
  if (kind === "SOURCE_OCC") {
    canvas = lighting.occlusionMaskCanvas ?? null;
    c2d = lighting.occlusionMaskCtx ?? null;
  } else if (kind === "INVERSE_BUILDING") {
    canvas = lighting.inverseBuildingSliceMaskCanvas ?? null;
    c2d = lighting.inverseBuildingSliceMaskCtx ?? null;
  } else {
    canvas = lighting.combinedOcclusionMaskCanvas ?? null;
    c2d = lighting.combinedOcclusionMaskCtx ?? null;
  }
  if (!canvas) {
    canvas = document.createElement("canvas");
    if (kind === "SOURCE_OCC") lighting.occlusionMaskCanvas = canvas;
    else if (kind === "INVERSE_BUILDING") lighting.inverseBuildingSliceMaskCanvas = canvas;
    else lighting.combinedOcclusionMaskCanvas = canvas;
    c2d = null;
  }
  if (canvas.width !== screenW) canvas.width = screenW;
  if (canvas.height !== screenH) canvas.height = screenH;
  if (!c2d || c2d.canvas !== canvas) {
    c2d = canvas.getContext("2d");
    if (!c2d) return null;
    if (kind === "SOURCE_OCC") lighting.occlusionMaskCtx = c2d;
    else if (kind === "INVERSE_BUILDING") lighting.inverseBuildingSliceMaskCtx = c2d;
    else lighting.combinedOcclusionMaskCtx = c2d;
  }
  configurePixelPerfect(c2d);
  return { canvas, ctx: c2d };
}

function drawAilmentPips(
  ctx: CanvasRenderingContext2D,
  w: World,
  e: number,
  sx: number,
  sy: number,
): void {
  const st = w.eAilments?.[e];
  if (!st) return;

  const poisonStacks = st.poison?.length ?? 0;
  const hasPoison = poisonStacks > 0;
  const hasIgnite = !!st.ignite;
  if (!hasPoison && !hasIgnite) return;

  const baseX = Math.round(sx);
  const baseY = Math.round(sy - 24);
  const pipSize = 16;
  const spacing = 8;
  const poisonPips = hasPoison ? Math.min(3, 1 + Math.floor((poisonStacks - 1) / 5)) : 0;

  ctx.save();
  ctx.globalAlpha = 0.9;

  if (poisonPips > 0) {
    const totalWidth = (poisonPips - 1) * spacing + pipSize;
    const startX = baseX - Math.floor(totalWidth / 2);
    ctx.fillStyle = "#45d26a";
    for (let i = 0; i < poisonPips; i++) {
      const x = startX + i * spacing;
      ctx.fillRect(x, baseY, pipSize, pipSize);
    }
  }

  if (hasIgnite) {
    ctx.fillStyle = "#ff9b2f";
    const igniteY = baseY - 9;
    ctx.fillRect(baseX - Math.floor(pipSize / 2), igniteY, pipSize, pipSize);
  }

  ctx.restore();
}

function ensureScratchMaskCanvas(
  canvas: HTMLCanvasElement | null,
  c2d: CanvasRenderingContext2D | null,
  screenW: number,
  screenH: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const resolvedCanvas = canvas ?? document.createElement("canvas");
  if (resolvedCanvas.width !== screenW) resolvedCanvas.width = screenW;
  if (resolvedCanvas.height !== screenH) resolvedCanvas.height = screenH;
  let resolvedCtx = c2d;
  if (!resolvedCtx || resolvedCtx.canvas !== resolvedCanvas) {
    resolvedCtx = resolvedCanvas.getContext("2d");
    if (!resolvedCtx) return null;
  }
  configurePixelPerfect(resolvedCtx);
  return { canvas: resolvedCanvas, ctx: resolvedCtx };
}

function withGroundPlaneScreen(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  groundYScale: number,
  fn: () => void,
): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, groundYScale);
  ctx.translate(-sx, -sy);
  fn();
  ctx.restore();
}

function drawStreetLampFootprintMaskScreen(
  ctx: CanvasRenderingContext2D,
  light: ProjectedLight,
  alpha: number,
  groundYScale: number,
): void {
  const a = Math.max(0, Math.min(1, alpha));
  if (a <= 0) return;
  const pool = light.pool ?? { radiusPx: Math.max(1, light.radiusPx * 0.7), yScale: 1 };
  const cone = light.cone ?? { dirRad: Math.PI * 0.5, angleRad: 0.9, lengthPx: Math.max(light.radiusPx, 160) };
  const poolSy = Number.isFinite(light.poolSy) ? (light.poolSy as number) : light.sy;
  const poolRadiusPx = Math.max(1, pool.radiusPx);
  const coneLengthPx = Math.max(1, cone.lengthPx);
  const fill = `rgba(0,0,0,${a})`;
  withGroundPlaneScreen(ctx, light.sx, poolSy, groundYScale, () => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(light.sx, poolSy, poolRadiusPx, 0, Math.PI * 2);
    ctx.fill();
  });
  withGroundPlaneScreen(ctx, light.sx, light.sy, groundYScale, () => {
    const a0 = cone.dirRad - cone.angleRad * 0.5;
    const a1 = cone.dirRad + cone.angleRad * 0.5;
    const x0 = light.sx + Math.cos(a0) * coneLengthPx;
    const y0 = light.sy + Math.sin(a0) * coneLengthPx;
    const x1 = light.sx + Math.cos(a1) * coneLengthPx;
    const y1 = light.sy + Math.sin(a1) * coneLengthPx;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(light.sx, light.sy);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.closePath();
    ctx.fill();
  });
}

function buildCombinedOcclusionMask(
  lighting: World["lighting"],
  blockerMaskCanvas: HTMLCanvasElement,
  screenW: number,
  screenH: number,
  occlusionEnabled: boolean,
): void {
  const combined = ensureLightingMaskCanvas(lighting, "COMBINED_OCC", screenW, screenH);
  if (!combined) return;
  const cctx = combined.ctx;
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.globalCompositeOperation = "source-over";
  cctx.clearRect(0, 0, screenW, screenH);
  cctx.fillStyle = "#ffffff";
  cctx.fillRect(0, 0, screenW, screenH);
  if (occlusionEnabled) {
    cctx.globalCompositeOperation = "destination-out";
    cctx.drawImage(blockerMaskCanvas, 0, 0);
  }
  cctx.globalCompositeOperation = "source-over";
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
export async function renderSystem(w: World, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const cssW = Math.max(1, canvas.clientWidth);
  const cssH = Math.max(1, canvas.clientHeight);
  const screenW = cssW;
  const screenH = cssH;
  const devW = Math.max(1, canvas.width);
  const devH = Math.max(1, canvas.height);
  const dpr = Math.max(1, devW / cssW);
  const pixelScale = Math.max(1, Math.floor(Number(canvas.dataset.pixelScale ?? 1) || 1));
  const ww = Math.max(1, Math.floor(cssW / pixelScale));
  const hh = Math.max(1, Math.floor(cssH / pixelScale));
  configurePixelPerfect(ctx);
  const renderPerfCountersEnabled = getUserSettings().render.renderPerfCountersEnabled;
  setRenderPerfCountersEnabled(renderPerfCountersEnabled);
  beginRenderPerfFrame(devW, devH);
  (w as any).viewW = ww;
  (w as any).viewH = hh;

  const PLAYER_R = w.playerR;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, devW, devH);

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
  (w as any).cameraX = p0.x;
  (w as any).cameraY = p0.y;

  const s = dpr * pixelScale;
  const viewCenterX = snapPx(ww * 0.5);
  const viewCenterY = snapPx(hh * 0.5);
  const camXRaw = viewCenterX - p0.x;
  const camYRaw = viewCenterY - p0.y;
  const camTx = Math.round(camXRaw);
  const camTy = Math.round(camYRaw);
  // NEW: draw background once, world-locked to the camera
  drawVoidBackgroundOnce(ctx, devW, devH, camTx, camTy, s);
  const camX = 0;
  const camY = 0;
  const worldToScreenPx = (xWorld: number, yWorld: number) => ({ x: (xWorld + camTx) * s, y: (yWorld + camTy) * s });
  const drawAlignmentDot = (target: CanvasRenderingContext2D, color: string) => {
    target.save();
    target.fillStyle = color;
    target.fillRect(Math.round(p0.x) - 1, Math.round(p0.y) - 1, 3, 3);
    target.restore();
  };

  ctx.save();
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.translate(camTx, camTy);
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

  // ------------------------------------------------------------
  // Wedge-only structure masking (tile-space)
  // Rule: include a slice iff its OWNER/ANCHOR tile is inside the
  // SE→SW wedge (25% region) relative to the player tile.
  // Pure tile coordinates, no screen math.
  // ------------------------------------------------------------
  const isOwnerTileInPlayerWedge = (ownerTx: number, ownerTy: number) => {
    const dx = ownerTx - playerTx;
    const dy = ownerTy - playerTy;

    // Exclude the player tile itself (optional, keeps behavior stable)
    if (dx === 0 && dy === 0) return false;

    const sum = dx + dy;
    if (sum <= 0) return false;

    const diff = Math.abs(dx - dy);
    return diff <= sum;
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
  const buildingMaskDraws: MaskDraw[] = [];
  const southBuildingMaskDraws: MaskDraw[] = [];
  const southBuildingBaseMaskDraws: MaskDraw[] = [];
  const entitySilhouetteMaskDraws: MaskDraw[] = [];

    // --- Hot path: avoid save/restore per draw ---
    // We rely on setTransform to restore to identity quickly.
    // IMPORTANT: caller must not depend on ctx state persisting across calls.
    const drawRenderPieceTo = (() => {
      // Track last applied transform per target context to avoid stale cross-canvas state.
      const lastKeyByTarget = new WeakMap<CanvasRenderingContext2D, string>();
      return (target: CanvasRenderingContext2D, c: RenderPieceDraw) => {
        const img = c.img;
        if (!img || img.width <= 0 || img.height <= 0) return;

        const scale = c.scale ?? 1;

        // Build transform: translate(dx,dy) * scale(scale) * optional flipX
        // We draw at (0,0) in local space.
        const dx = snapPx(c.dx);
        const dy = snapPx(c.dy);

        // Base: [a c e; b d f] in Canvas setTransform(a,b,c,d,e,f)
        // scale => a=d=scale
        let a = scale, b = 0, cc = 0, d = scale, e = dx, f = dy;

        // flipX: multiply by translate(dw,0) then scale(-1,1) in local space
        // Equivalent local transform: x' = -scale*x + (dx + scale*dw)
        if (c.flipX) {
          a = -scale;
          e = dx + scale * c.dw;
        }

        const key = `${a},${d},${e},${f}`;
        const lastKey = lastKeyByTarget.get(target) ?? "";
        if (key !== lastKey) {
          target.setTransform(a, b, cc, d, e, f);
          lastKeyByTarget.set(target, key);
        }

        target.drawImage(img, 0, 0, c.dw, c.dh);
      };
    })();
    // Default draw to main ctx (unchanged behavior for most pieces)
    const drawRenderPiece = (c: RenderPieceDraw) => drawRenderPieceTo(ctx, c);

    const addRenderPieceMask = (c: RenderPieceDraw) => {
      buildingMaskDraws.push((maskCtx) => {
        drawRenderPieceTo(maskCtx, c);
      });
    };
    const addSouthRenderPieceMask = (c: RenderPieceDraw) => {
      southBuildingMaskDraws.push((maskCtx) => {
        drawRenderPieceTo(maskCtx, c);
      });
    };
    const addGroundTileMask = (target: MaskDraw[], tx: number, ty: number) => {
      target.push((maskCtx) => {
        const p0 = worldToScreen(tx * T, ty * T);
        const p1 = worldToScreen((tx + 1) * T, ty * T);
        const p2 = worldToScreen((tx + 1) * T, (ty + 1) * T);
        const p3 = worldToScreen(tx * T, (ty + 1) * T);
        maskCtx.save();
        maskCtx.globalCompositeOperation = "source-over";
        maskCtx.fillStyle = "rgba(255,255,255,1)";
        maskCtx.beginPath();
        maskCtx.moveTo(p0.x + camX, p0.y + camY);
        maskCtx.lineTo(p1.x + camX, p1.y + camY);
        maskCtx.lineTo(p2.x + camX, p2.y + camY);
        maskCtx.lineTo(p3.x + camX, p3.y + camY);
        maskCtx.closePath();
        maskCtx.fill();
        maskCtx.restore();
      });
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

      const baked = getRuntimeIsoTopCanvas(src.img, rotationQuarterTurns);
      if (!baked) return;

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

      ctx.drawImage(baked, snapPx(dx), snapPx(dy));

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

      const dx = centerX - baked.width * 0.5;
      const dy = centerY - baked.height * 0.5;
      const drawX = shouldSnapRoadMarking ? Math.round(dx) : snapPx(dx);
      const drawY = shouldSnapRoadMarking ? Math.round(dy) : snapPx(dy);
      ctx.drawImage(baked, drawX, drawY);
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

  const settings = getUserSettings();
  const debug = settings.debug;
  const renderSettings = settings.render;
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
  const buildingMaskDebugView = debugFlags.buildingMaskDebugView;
  const SHOW_BUILDING_MASK_DEBUG = debugFlags.showBuildingMaskDebug;
  const SHOW_ZONE_OBJECTIVE_BOUNDS = !!debug.objectives?.showZoneBounds;

  // Enemy Z buffer (optional visual override)
  const ez = w.ezVisual;

  // ----------------------------
  // Tile range / diagonals
  // ----------------------------
  const configuredRadius = Number(renderSettings.tileRenderRadius);
  const radius = Math.max(1, Math.min(32, Number.isFinite(configuredRadius) ? Math.round(configuredRadius) : 12));
  setRenderTileLoopRadius(radius);
  const cx = Math.floor(px / T);
  const cy = Math.floor(py / T);
  const radiusSq = radius * radius;
  const isTileInRenderRadius = (tx: number, ty: number): boolean => {
    const dx = tx - cx;
    const dy = ty - cy;
    return dx * dx + dy * dy <= radiusSq;
  };
  const isTileInRenderRadiusPadded = (tx: number, ty: number, padTiles: number): boolean => {
    const r = Math.max(0, radius + padTiles);
    const dx = tx - cx;
    const dy = ty - cy;
    return dx * dx + dy * dy <= r * r;
  };
  const tileRectIntersectsRenderRadius = (
    minRectTx: number,
    maxRectTx: number,
    minRectTy: number,
    maxRectTy: number,
  ): boolean => {
    const nx = Math.max(minRectTx, Math.min(cx, maxRectTx));
    const ny = Math.max(minRectTy, Math.min(cy, maxRectTy));
    const dx = nx - cx;
    const dy = ny - cy;
    return dx * dx + dy * dy <= radiusSq;
  };

  const minTx = cx - radius;
  const maxTx = cx + radius;
  const minTy = cy - radius;
  const maxTy = cy + radius;

  const minSum = minTx + minTy;
  const maxSum = maxTx + maxTy;

  const viewRect = viewRectFromWorldCenter(px, py, T, radius);
  const activeH = w.activeFloorH ?? 0;
  const compiledMap = getActiveCompiledMap();

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
  const deferredStructureSliceDebugDraws: Array<() => void> = [];
  let hasStructureLayerDraw = false;

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
      img: HTMLImageElement;
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
    renderEntityShadow(ctx, payload as ShadowParams, compiledMap);
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
          const topRec = surface.spriteIdTop ? getTileSpriteById(surface.spriteIdTop) : null;
          if (!topRec?.ready || !topRec.img || topRec.img.width <= 0 || topRec.img.height <= 0) continue;

          const topScale = isStairTop ? STAIR_TOP_SCALE : FLOOR_TOP_SCALE;
          const topImg = topRec.img;
          const topW = topImg.width * topScale;
          const topH = topImg.height * topScale;

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
  const entityShadowMaskParams: ShadowParams[] = [];
  if (RENDER_ENTITY_SHADOWS) {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
      const zAbs = ez?.[i] ?? tileHAtWorld(ew.wx, ew.wy);
      const support = getSupportSurfaceAt(ew.wx, ew.wy, compiledMap);
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
      entityShadowMaskParams.push(shadowParams);
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
      const support = getSupportSurfaceAt(npc.wx, npc.wy, compiledMap);
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
      entityShadowMaskParams.push(shadowParams);
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
      const support = getSupportSurfaceAt(mob.pos.wx, mob.pos.wy, compiledMap);
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
      entityShadowMaskParams.push(shadowParams);
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
      const support = getSupportSurfaceAt(px, py, compiledMap);
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
      entityShadowMaskParams.push(shadowParams);
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
          const pulse = 0.85 + 0.15 * Math.sin((w.time ?? 0) * 7 + i * 0.37);

          ctx.globalAlpha = 0.26 * pulse;
          ctx.fillStyle = "#ff3a2e";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = 0.42 * pulse;
          ctx.strokeStyle = "#ff7f45";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx * 0.96, ry * 0.96, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.globalAlpha = 0.62 * pulse;
          ctx.strokeStyle = "#ffd27a";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx * 0.74, ry * 0.74, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.globalAlpha = 1;
        } else if (kind === ZONE_KIND.EXPLOSION) {
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = "#ff7a18";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = "#ffcf9a";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx * 0.98, ry * 0.98, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.globalAlpha = 1;
        }
      };

      addToSlice(zSlice, renderKey, drawClosure);
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
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#ffd84a";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
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

        const fr = getEnemySpriteFrame({
          type: w.eType[i] as any,
          time: w.time ?? 0,
          faceDx,
          faceDy,
          moving,
        });

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

        if ((w.ePoisonT?.[i] ?? 0) > 0) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#3dff7a";
          ctx.beginPath();
          ctx.ellipse(feet.screenX, feet.screenY, (w.eR[i] ?? 10) * 1.05 * ISO_X, (w.eR[i] ?? 10) * 1.05 * ISO_Y, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        drawAilmentPips(ctx, w, i, feet.screenX, feet.screenY);
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
      // Projectiles visually pop early at strict radius due to fast motion and sprite footprint.
      // Keep a small pad so projectile draw distance matches the tile field better.
      if (!isTileInRenderRadiusPadded(ptx, pty, 2)) continue;
      const baseH = tileHAtWorld(pp.wx, pp.wy);
      const pzAbs = (w.prZVisual?.[i] ?? w.prZ?.[i] ?? baseH) || 0;
      const support = getSupportSurfaceAt(pp.wx, pp.wy, compiledMap);
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
          const sctx = structureLayerScratchCtx;
          const isStructureish = renderKey.kindOrder === KindOrder.STRUCTURE || renderKey.kindOrder === KindOrder.OVERLAY;

          // Owner tile for face pieces is (face.tx, face.ty)
          const ownerInWedge = isOwnerTileInPlayerWedge(face.tx, face.ty);

          if (isStructureish && sctx && ownerInWedge) {
            hasStructureLayerDraw = true;
            drawRenderPieceTo(sctx, d);
          } else drawRenderPiece(d);
        });

        // Full building mask stays intact for lighting occlusion.
        if (face.layerRole === "STRUCTURE") {
          addRenderPieceMask(d);
          if (isOwnerTileInPlayerWedge(face.tx, face.ty)) {
            addSouthRenderPieceMask(d);
            addGroundTileMask(southBuildingBaseMaskDraws, face.tx, face.ty);
          }
        }
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
        const sctx = structureLayerScratchCtx;
        const isStructureish = renderKey.kindOrder === KindOrder.STRUCTURE || renderKey.kindOrder === KindOrder.OVERLAY;

        // Owner tile for walls is (occ.tx, occ.ty)
        const ownerInWedge = isOwnerTileInPlayerWedge(occ.tx, occ.ty);

        if (isStructureish && sctx && ownerInWedge) {
          hasStructureLayerDraw = true;
          drawRenderPieceTo(sctx, draw);
        } else drawRenderPiece(draw);
      });

      // Full building mask stays intact for lighting occlusion.
      addRenderPieceMask(draw);
      if (isOwnerTileInPlayerWedge(occ.tx, occ.ty)) {
        addSouthRenderPieceMask(draw);
        addGroundTileMask(southBuildingBaseMaskDraws, occ.tx, occ.ty);
      }
    }
  }

    // ----------------------------
    // Collect OVERLAYS (roofs + props) into slices
    // ----------------------------
    if (debugFlags.showMapOverlays) {
      const ovs = overlaysInView(viewRect);
      for (let i = 0; i < ovs.length; i++) {
        const o = ovs[i];
        if (!tileRectIntersectsRenderRadius(o.tx, o.tx + o.w - 1, o.ty, o.ty + o.h - 1)) continue;
        if ((o.kind ?? "ROOF") === "ROOF" && shouldCullBuildingAt(o.tx, o.ty, o.w, o.h)) continue;
        const draw = buildOverlayDraw(o);
        if (!draw) continue;
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
              stableId: band.renderKey.stableId,
            };
            addToSlice(band.renderKey.slice, overlayKey, () => {
              const sctx = structureLayerScratchCtx;

              // Owner tile for a band piece is derived from its renderKey.
              const ownerInWedge = isOwnerTileInPlayerWedge(ownerTx, ownerTy);

              const wantsStructureTarget =
                (overlayKey.kindOrder === KindOrder.STRUCTURE || overlayKey.kindOrder === KindOrder.OVERLAY);

              // Route to structure scratch ONLY if wedge-owned; otherwise draw to main ctx.
              const target = wantsStructureTarget && sctx && ownerInWedge ? sctx : ctx;
              if (target === sctx) hasStructureLayerDraw = true;
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
              target.imageSmoothingEnabled = false;
              target.drawImage(
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
              if (SHOW_STRUCTURE_SLICE_DEBUG) {
                const ownerTile = {
                  tx: band.renderKey.within,
                  ty: ownerTy,
                };
                deferredStructureSliceDebugDraws.push(() => {
                  ctx.save();
                  ctx.strokeStyle = "#00ffd5";
                  ctx.lineWidth = 1;
                  ctx.strokeRect(band.dstRect.x, band.dstRect.y, band.dstRect.w, band.dstRect.h);
                  ctx.fillStyle = "#00ffd5";
                  ctx.font = "10px monospace";
                  const topY = band.dstRect.y + 12;
                  const bottomY = Math.max(topY + 10, band.dstRect.y + band.dstRect.h - 4);
                  ctx.fillText(`#${band.index}`, band.dstRect.x + 2, topY);
                  ctx.fillText(`t:${ownerTile.tx},${ownerTile.ty}`, band.dstRect.x + 2, bottomY);
                  ctx.restore();
                });
              }
            });

            // Full building mask stays intact for lighting occlusion.
            if (o.layerRole === "STRUCTURE" || (o.kind ?? "ROOF") === "ROOF") {
              buildingMaskDraws.push((maskCtx) => {
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
                const prevOp = maskCtx.globalCompositeOperation;
                const prevSmoothing = maskCtx.imageSmoothingEnabled;
                maskCtx.globalCompositeOperation = "source-over";
                maskCtx.imageSmoothingEnabled = false;
                maskCtx.drawImage(
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
                maskCtx.globalCompositeOperation = prevOp;
                maskCtx.imageSmoothingEnabled = prevSmoothing;
              });
              if (isOwnerTileInPlayerWedge(band.renderKey.within, ownerTy)) {
                southBuildingMaskDraws.push((maskCtx) => {
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
                  const prevOp = maskCtx.globalCompositeOperation;
                  const prevSmoothing = maskCtx.imageSmoothingEnabled;
                  maskCtx.globalCompositeOperation = "source-over";
                  maskCtx.imageSmoothingEnabled = false;
                  maskCtx.drawImage(
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
                  maskCtx.globalCompositeOperation = prevOp;
                  maskCtx.imageSmoothingEnabled = prevSmoothing;
                });
              }
            }
          }
          {
            const ownerTx = (o.anchorTx ?? (o.tx + o.w - 1));
            const ownerTy = (o.anchorTy ?? (o.ty + o.h - 1));
            if ((o.layerRole === "STRUCTURE" || (o.kind ?? "ROOF") === "ROOF") && isOwnerTileInPlayerWedge(ownerTx, ownerTy)) {
              for (let fy = 0; fy < o.h; fy++) {
                for (let fx = 0; fx < o.w; fx++) {
                  const tx = o.tx + fx;
                  const ty = o.ty + fy;
                  if (!isTileInRenderRadius(tx, ty)) continue;
                  addGroundTileMask(southBuildingBaseMaskDraws, tx, ty);
                }
              }
            }
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
            const sctx = structureLayerScratchCtx;
            const isStructureish = overlayKey.kindOrder === KindOrder.STRUCTURE || overlayKey.kindOrder === KindOrder.OVERLAY;

            // Owner tile for overlays is their anchor tile (used for slice/placement)
            const ownerTx = (o.anchorTx ?? (o.tx + o.w - 1));
            const ownerTy = (o.anchorTy ?? (o.ty + o.h - 1));
            const ownerInWedge = isOwnerTileInPlayerWedge(ownerTx, ownerTy);

            if (isStructureish && sctx && ownerInWedge) {
              hasStructureLayerDraw = true;
              drawRenderPieceTo(sctx, draw);
            } else drawRenderPiece(draw);
          });

          // Full building mask stays intact for lighting occlusion.
          {
            const ownerTx = (o.anchorTx ?? (o.tx + o.w - 1));
            const ownerTy = (o.anchorTy ?? (o.ty + o.h - 1));
            if (o.layerRole === "STRUCTURE" || (o.kind ?? "ROOF") === "ROOF") {
              addRenderPieceMask(draw);
              if (isOwnerTileInPlayerWedge(ownerTx, ownerTy)) {
                addSouthRenderPieceMask(draw);
                for (let fy = 0; fy < o.h; fy++) {
                  for (let fx = 0; fx < o.w; fx++) {
                    addGroundTileMask(southBuildingBaseMaskDraws, o.tx + fx, o.ty + fy);
                  }
                }
              }
            }
          }
        }
      }
    }

  // ============================================
  // FINAL RENDER PASS: Execute by zBand with ground/depth phases
  // ============================================
  const sliceKeys = Array.from(sliceDrawables.keys());
  countRenderSliceKeySort();
  sliceKeys.sort((a, b) => a - b);

  // Sort once per slice and collect all zBands.
  const zBands = new Set<number>();
  for (let i = 0; i < sliceKeys.length; i++) {
    const drawables = sliceDrawables.get(sliceKeys[i])!;
    countRenderDrawableSort();
    drawables.sort((a, b) => compareRenderKeys(a.key, b.key));
    for (let j = 0; j < drawables.length; j++) {
      zBands.add(Math.floor(drawables[j].key.baseZ));
    }
  }

  const zBandKeys = Array.from(zBands);
  zBandKeys.sort((a, b) => a - b);

  const isGroundKind = (kind: KindOrder) =>
    kind === KindOrder.FLOOR || kind === KindOrder.DECAL;
  const kindToDrawTag = (kind: KindOrder): "floors" | "decals" | "entities" | "structures" => {
    if (kind === KindOrder.FLOOR) return "floors";
    if (kind === KindOrder.DECAL) return "decals";
    if (
      kind === KindOrder.ENTITY
      || kind === KindOrder.VFX
      || kind === KindOrder.ZONE_OBJECTIVE
      || kind === KindOrder.SHADOW
    ) return "entities";
    return "structures";
  };

  // ============================================
  // STRUCTURE LAYER (for player cutout) — Milestone 1: hard hole
  // ============================================
  const structureLayer = ensureScratchMaskCanvas(
    structureLayerScratchCanvas,
    structureLayerScratchCtx,
    devW,
    devH,
  );
  if (structureLayer) {
    structureLayerScratchCanvas = structureLayer.canvas;
    structureLayerScratchCtx = structureLayer.ctx;

    const sctx = structureLayer.ctx;
    // Clear in screen space
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = "source-over";
    sctx.clearRect(0, 0, devW, devH);

    // IMPORTANT: match the WORLD camera transform (exactly like lighting masks)
    sctx.save();
    configurePixelPerfect(sctx);
    sctx.setTransform(s, 0, 0, s, 0, 0);
    sctx.translate(camTx, camTy);
    drawAlignmentDot(sctx, "rgba(255,128,0,0.9)"); // structure
  } else {
    structureLayerScratchCanvas = null;
    structureLayerScratchCtx = null;
  }

  let cutoutVoidCanvas: HTMLCanvasElement | null = null;
  if (southBuildingBaseMaskDraws.length > 0) {
    const southMaskLayer = ensureScratchMaskCanvas(
      southBuildingMaskScratchCanvas,
      southBuildingMaskScratchCtx,
      devW,
      devH,
    );
    const voidLayer = ensureScratchMaskCanvas(
      cutoutVoidScratchCanvas,
      cutoutVoidScratchCtx,
      devW,
      devH,
    );
    if (southMaskLayer && voidLayer) {
      southBuildingMaskScratchCanvas = southMaskLayer.canvas;
      southBuildingMaskScratchCtx = southMaskLayer.ctx;
      cutoutVoidScratchCanvas = voidLayer.canvas;
      cutoutVoidScratchCtx = voidLayer.ctx;

      const southCtx = southMaskLayer.ctx;
      const vctx = voidLayer.ctx;

      southCtx.setTransform(1, 0, 0, 1, 0, 0);
      southCtx.clearRect(0, 0, devW, devH);
      southCtx.save();
      configurePixelPerfect(southCtx);
      southCtx.setTransform(s, 0, 0, s, 0, 0);
      southCtx.translate(camTx, camTy);
      drawAlignmentDot(southCtx, "rgba(0,255,255,0.9)"); // south base mask
      southCtx.globalCompositeOperation = "source-over";
      for (let i = 0; i < southBuildingBaseMaskDraws.length; i++) {
        southBuildingBaseMaskDraws[i](southCtx);
      }
      southCtx.restore();

      const pzAbs = w.pzVisual ?? w.pz ?? tileHAtWorld(px, py);
      const feet = getEntityFeetPos(px, py, pzAbs);
      const sp = worldToScreenPx(feet.screenX, feet.screenY);
      const playerSx = sp.x;
      const playerSy = sp.y;
      const radiusWorld = 150;
      const radiusPx = radiusWorld * s;
      const outerR = radiusPx * 1.35;
      const innerR = Math.max(1, outerR * 0.72);

      southCtx.save();
      southCtx.setTransform(1, 0, 0, 1, 0, 0);
      southCtx.globalCompositeOperation = "destination-in";
      const g = southCtx.createRadialGradient(playerSx, playerSy, innerR, playerSx, playerSy, outerR);
      g.addColorStop(0.0, "rgba(0,0,0,1)");
      g.addColorStop(1.0, "rgba(0,0,0,0)");
      southCtx.fillStyle = g;
      southCtx.beginPath();
      southCtx.arc(playerSx, playerSy, outerR, 0, Math.PI * 2);
      southCtx.fill();
      southCtx.restore();

      vctx.setTransform(1, 0, 0, 1, 0, 0);
      vctx.globalCompositeOperation = "source-over";
      vctx.clearRect(0, 0, devW, devH);
      setRenderPerfDrawTag("cutoutVoid");
      drawVoidBackgroundOnce(vctx, devW, devH, camTx, camTy, s);
      setRenderPerfDrawTag(null);

      vctx.globalCompositeOperation = "destination-in";
      setRenderPerfDrawTag("cutoutVoid");
      vctx.drawImage(southMaskLayer.canvas, 0, 0);
      setRenderPerfDrawTag(null);
      vctx.globalCompositeOperation = "source-over";

      cutoutVoidCanvas = voidLayer.canvas;
    }
  }

  for (let zi = 0; zi < zBandKeys.length; zi++) {
    const zb = zBandKeys[zi];

    // Ground phase: FLOOR + DECAL only.
    for (let si = 0; si < sliceKeys.length; si++) {
      const drawables = sliceDrawables.get(sliceKeys[si])!;
      for (let di = 0; di < drawables.length; di++) {
        const drawable = drawables[di];
        if (Math.floor(drawable.key.baseZ) !== zb) continue;
        if (!isGroundKind(drawable.key.kindOrder)) continue;
        setRenderPerfDrawTag(kindToDrawTag(drawable.key.kindOrder));
        drawable.drawFn(drawable.payload);
      }
    }

    // Reveal VOID only inside the player cutout.
    // This visually "turns the floor into void" only where the cutout mask is active.
    if (zi === 0 && typeof cutoutVoidCanvas !== "undefined" && cutoutVoidCanvas) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      setRenderPerfDrawTag("cutoutVoid");
      ctx.drawImage(cutoutVoidCanvas, 0, 0);
      setRenderPerfDrawTag(null);
      ctx.restore();
    }

    // Depth phase: everything else.
    for (let si = 0; si < sliceKeys.length; si++) {
      const drawables = sliceDrawables.get(sliceKeys[si])!;
      for (let di = 0; di < drawables.length; di++) {
        const drawable = drawables[di];
        if (Math.floor(drawable.key.baseZ) !== zb) continue;
        if (isGroundKind(drawable.key.kindOrder)) continue;
        setRenderPerfDrawTag(kindToDrawTag(drawable.key.kindOrder));
        drawable.drawFn(drawable.payload);
      }
    }
  }
  setRenderPerfDrawTag(null);

  // ============================================
  // STRUCTURE CUTOUT COMPOSITE (Milestone 1: hard circle)
  // ============================================
  if (hasStructureLayerDraw && structureLayerScratchCanvas && structureLayerScratchCtx) {
    const sctx = structureLayerScratchCtx;

    // End the structure-layer world transform so we can punch hole in screen-space
    sctx.restore();

    const pzAbs = w.pzVisual ?? w.pz ?? tileHAtWorld(px, py);
    const feet = getEntityFeetPos(px, py, pzAbs);
    const sp = worldToScreenPx(feet.screenX, feet.screenY);
    const playerSx = sp.x;
    const playerSy = sp.y;
    const radiusWorld = 150;
    const radiusPx = radiusWorld * s;

    // Soft edge hole using destination-out + radial gradient.
    // Center is fully erased; edge fades to no erase.
    sctx.save();
    sctx.globalCompositeOperation = "destination-out";

    // Bigger radius (tune these defaults)
    const outerR = radiusPx * 1.35;
    const innerR = Math.max(1, outerR * 0.72);

    // Radial gradient: alpha=1 in center (erase), alpha=0 at edge (no erase)
    const g = sctx.createRadialGradient(playerSx, playerSy, innerR, playerSx, playerSy, outerR);
    g.addColorStop(0.0, "rgba(0,0,0,1)");
    g.addColorStop(1.0, "rgba(0,0,0,0)");

    sctx.fillStyle = g;
    sctx.beginPath();
    sctx.arc(playerSx, playerSy, outerR, 0, Math.PI * 2);
    sctx.fill();

    sctx.restore();
    sctx.globalCompositeOperation = "source-over";

    // Composite structures over the already-rendered scene.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    configurePixelPerfect(ctx);
    ctx.globalCompositeOperation = "source-over";
    setRenderPerfDrawTag("structures");
    ctx.drawImage(structureLayerScratchCanvas, 0, 0);
    setRenderPerfDrawTag(null);
    ctx.restore();
  }

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

  const occlusionEnabled = debugFlags.lightingOcclusionEnabled && w.lighting.occlusionEnabled;
  const occlusionHasContent = (
    buildingMaskDraws.length > 0
    || entityShadowMaskParams.length > 0
    || southBuildingMaskDraws.length > 0
  );
  const inverseMaskLayer = occlusionEnabled
    ? (occlusionHasContent ? ensureLightingMaskCanvas(w.lighting, "INVERSE_BUILDING", devW, devH) : null)
    : null;
  if (inverseMaskLayer && occlusionEnabled) {
    const inverseCtx = inverseMaskLayer.ctx;
    const southBuildingMaskLayer = ensureScratchMaskCanvas(
      southBuildingMaskScratchCanvas,
      southBuildingMaskScratchCtx,
      devW,
      devH,
    );
    if (southBuildingMaskLayer) {
      southBuildingMaskScratchCanvas = southBuildingMaskLayer.canvas;
      southBuildingMaskScratchCtx = southBuildingMaskLayer.ctx;
    }
    const shadowMaskLayer = ensureScratchMaskCanvas(
      entityShadowMaskScratchCanvas,
      entityShadowMaskScratchCtx,
      devW,
      devH,
    );
    if (shadowMaskLayer) {
      entityShadowMaskScratchCanvas = shadowMaskLayer.canvas;
      entityShadowMaskScratchCtx = shadowMaskLayer.ctx;
    }
    const silhouetteMaskLayer = ensureScratchMaskCanvas(
      entitySilhouetteMaskScratchCanvas,
      entitySilhouetteMaskScratchCtx,
      devW,
      devH,
    );
    if (silhouetteMaskLayer) {
      entitySilhouetteMaskScratchCanvas = silhouetteMaskLayer.canvas;
      entitySilhouetteMaskScratchCtx = silhouetteMaskLayer.ctx;
    }
    inverseCtx.setTransform(1, 0, 0, 1, 0, 0);
    inverseCtx.clearRect(0, 0, devW, devH);
    inverseCtx.save();
    configurePixelPerfect(inverseCtx);
    inverseCtx.setTransform(s, 0, 0, s, 0, 0);
    inverseCtx.translate(camTx, camTy);
    drawAlignmentDot(inverseCtx, "rgba(0,255,0,0.9)"); // inverse mask
    inverseCtx.globalCompositeOperation = "source-over";
    setRenderPerfDrawTag("mask:building");
    for (let i = 0; i < buildingMaskDraws.length; i++) {
      buildingMaskDraws[i](inverseCtx);
    }
    setRenderPerfDrawTag(null);
    inverseCtx.restore();

    if (shadowMaskLayer && silhouetteMaskLayer && entityShadowMaskParams.length > 0) {
      const shadowCtx = shadowMaskLayer.ctx;
      const silhouetteCtx = silhouetteMaskLayer.ctx;

      shadowCtx.setTransform(1, 0, 0, 1, 0, 0);
      shadowCtx.clearRect(0, 0, devW, devH);
      silhouetteCtx.setTransform(1, 0, 0, 1, 0, 0);
      silhouetteCtx.clearRect(0, 0, devW, devH);

      shadowCtx.save();
      configurePixelPerfect(shadowCtx);
      shadowCtx.setTransform(s, 0, 0, s, 0, 0);
      shadowCtx.translate(camTx, camTy);
      drawAlignmentDot(shadowCtx, "rgba(255,64,64,0.9)"); // shadow mask
      setRenderPerfDrawTag("mask:shadow");
      for (let i = 0; i < entityShadowMaskParams.length; i++) {
        renderEntityShadowMask(shadowCtx, entityShadowMaskParams[i], compiledMap);
      }
      setRenderPerfDrawTag(null);
      shadowCtx.restore();

      if (entitySilhouetteMaskDraws.length > 0) {
        silhouetteCtx.save();
        configurePixelPerfect(silhouetteCtx);
        silhouetteCtx.setTransform(s, 0, 0, s, 0, 0);
        silhouetteCtx.translate(camTx, camTy);
        drawAlignmentDot(silhouetteCtx, "rgba(64,128,255,0.9)"); // silhouette mask
        for (let i = 0; i < entitySilhouetteMaskDraws.length; i++) {
          entitySilhouetteMaskDraws[i](silhouetteCtx);
        }
        silhouetteCtx.restore();

        shadowCtx.globalCompositeOperation = "destination-out";
        setRenderPerfDrawTag("mask:shadow");
        shadowCtx.drawImage(silhouetteMaskLayer.canvas, 0, 0);
        shadowCtx.globalCompositeOperation = "source-over";
      }

      inverseCtx.globalCompositeOperation = "source-over";
      inverseCtx.drawImage(shadowMaskLayer.canvas, 0, 0);
      setRenderPerfDrawTag(null);
    }
    // Keep lighting occlusion based on full building mask.
    // Apply player hole as: fullBuildingMask - (southBuildingMask ∩ playerCircleGradient).
    if (southBuildingMaskLayer && southBuildingMaskDraws.length > 0) {
      const southCtx = southBuildingMaskLayer.ctx;
      southCtx.setTransform(1, 0, 0, 1, 0, 0);
      southCtx.clearRect(0, 0, devW, devH);
      southCtx.save();
      configurePixelPerfect(southCtx);
      southCtx.setTransform(s, 0, 0, s, 0, 0);
      southCtx.translate(camTx, camTy);
      drawAlignmentDot(southCtx, "rgba(255,255,255,0.9)"); // south occlusion mask
      southCtx.globalCompositeOperation = "source-over";
      setRenderPerfDrawTag("mask:south");
      for (let i = 0; i < southBuildingMaskDraws.length; i++) {
        southBuildingMaskDraws[i](southCtx);
      }
      setRenderPerfDrawTag(null);
      southCtx.restore();

      // Use player feet position (world-render coords)
      const pzAbs = w.pzVisual ?? w.pz ?? tileHAtWorld(px, py);
      const feet = getEntityFeetPos(px, py, pzAbs);
      const sp = worldToScreenPx(feet.screenX, feet.screenY);
      const playerSx = sp.x;
      const playerSy = sp.y;

      // Keep this consistent with your visual structure cutout
      const radiusWorld = 150;
      const radiusPx = radiusWorld * s;
      const outerR = radiusPx * 1.35;
      const innerR = Math.max(1, outerR * 0.72);

      // southBuildingMask ∩ playerCircleGradient
      southCtx.save();
      southCtx.setTransform(1, 0, 0, 1, 0, 0);
      southCtx.globalCompositeOperation = "destination-in";
      const g = southCtx.createRadialGradient(playerSx, playerSy, innerR, playerSx, playerSy, outerR);
      g.addColorStop(0.0, "rgba(0,0,0,1)");
      g.addColorStop(1.0, "rgba(0,0,0,0)");
      southCtx.fillStyle = g;
      southCtx.beginPath();
      southCtx.arc(playerSx, playerSy, outerR, 0, Math.PI * 2);
      southCtx.fill();
      southCtx.restore();

      // fullBuildingMask - (southBuildingMask ∩ playerCircleGradient)
      inverseCtx.save();
      inverseCtx.setTransform(1, 0, 0, 1, 0, 0);
      inverseCtx.globalCompositeOperation = "destination-out";
      setRenderPerfDrawTag("mask:south");
      inverseCtx.drawImage(southBuildingMaskLayer.canvas, 0, 0);
      inverseCtx.restore();
      inverseCtx.globalCompositeOperation = "source-over";
      setRenderPerfDrawTag(null);
    }
    inverseCtx.globalCompositeOperation = "source-in";
    inverseCtx.fillStyle = "rgba(0,0,0,1)";
    inverseCtx.fillRect(0, 0, devW, devH);
    inverseCtx.globalCompositeOperation = "source-over";
  }

  // Floating combat text: world pass (same camera transform as world content)
  renderFloatingText(w, ctx, toScreen);

  // Restore camera transform before drawing screen-space overlays / HUD.
  ctx.restore();

  const lightDefs = compiledMap.lightDefs;
  const projectedLights: ProjectedLight[] = [];
  for (let i = 0; i < lightDefs.length; i++) {
    const ld = lightDefs[i];
    const ltx = Math.floor(ld.worldX / T);
    const lty = Math.floor(ld.worldY / T);
    if (!isTileInRenderRadius(ltx, lty)) continue;

    const isStreetLamp = (ld.shape ?? "RADIAL") === "STREET_LAMP";
    const occlusion = isStreetLamp
      ? ((debugFlags.lightingOcclusionEnabled && w.lighting.occlusionEnabled) ? 1 : 0)
      : 0;
    const p = worldToScreen(ld.worldX, ld.worldY);
    const screenOffsetX = (ld.screenOffsetPx?.x ?? 0) * s;
    const screenOffsetY = (ld.screenOffsetPx?.y ?? 0) * s;
    const sx = (p.x + camTx) * s + screenOffsetX;
    const sy = (p.y + camTy - ld.heightUnits * ELEV_PX) * s + screenOffsetY;
    const poolSy = sy - (ld.poolHeightOffsetUnits ?? 0) * ELEV_PX * s;
    const flickerPhase = (Math.sin(ld.worldX * 0.013 + ld.worldY * 0.007) * 43758.5453) % (Math.PI * 2);
    projectedLights.push({
      sx,
      sy,
      poolSy,
      radiusPx: ld.radiusPx * s,
      intensity: ld.intensity,
      occlusion,
      shape: ld.shape ?? "RADIAL",
      color: ld.color ?? "#FFFFFF",
      tintStrength: ld.tintStrength ?? 0.35,
      flicker: ld.flicker ?? { kind: "NONE" },
      flickerPhase,
      pool: ld.pool
        ? { radiusPx: ld.pool.radiusPx * s, yScale: ld.pool.yScale ?? 1 }
        : undefined,
      cone: ld.cone
        ? { dirRad: ld.cone.dirRad, angleRad: ld.cone.angleRad, lengthPx: ld.cone.lengthPx * s }
        : undefined,
    });
  }

  if (inverseMaskLayer && occlusionEnabled && occlusionHasContent) {
      buildCombinedOcclusionMask(
        w.lighting,
        inverseMaskLayer.canvas,
        devW,
        devH,
        true,
      );
  } else {
    w.lighting.combinedOcclusionMaskCanvas = null;
    w.lighting.combinedOcclusionMaskCtx = null;
  }

  // PASS 8: final screen-space lighting
  setRenderPerfDrawTag("lighting");
  renderLighting(ctx, w.lighting, projectedLights, devW, devH, w.time ?? 0);
  setRenderPerfDrawTag(null);
  // Building-mask debug overlay draw disabled to avoid full-canvas mask artifacts.


  // FPS
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = "12px monospace";
  ctx.fillStyle = "#fff";
  const fps = Math.round((w as any).fps ?? 0);
  const perf = getRenderPerfSnapshot();
  ctx.fillText(`FPS: ${fps}`, 8, 14);
  ctx.fillText(`Palette: ${resolveActivePaletteId()}`, 8, 46);
  if (renderPerfCountersEnabled) {
    const tag = perf.drawImageByTagPerFrame;
    const saveTag = perf.saveByTagPerFrame;
    const restoreTag = perf.restoreByTagPerFrame;
    const perfLines = [
      `drawImage/frame: ${perf.drawImageCallsPerFrame.toFixed(1)}`,
      `tag void:${tag.void.toFixed(1)} floors:${tag.floors.toFixed(1)} decals:${tag.decals.toFixed(1)} ent:${tag.entities.toFixed(1)}`,
      `tag struct:${tag.structures.toFixed(1)} m:bld:${tag["mask:building"].toFixed(1)} m:sh:${tag["mask:shadow"].toFixed(1)} m:s:${tag["mask:south"].toFixed(1)}`,
      `tag cutoutVoid:${tag.cutoutVoid.toFixed(1)} lighting:${tag.lighting.toFixed(1)} untagged:${tag.untagged.toFixed(1)}`,
      `gradientCreate/frame: ${perf.gradientCreateCallsPerFrame.toFixed(1)} addColorStop/frame: ${perf.addColorStopCallsPerFrame.toFixed(1)}`,
      `save/frame: ${perf.saveCallsPerFrame.toFixed(1)} restore/frame: ${perf.restoreCallsPerFrame.toFixed(1)}`,
      `saveTag fl:${saveTag.floors.toFixed(1)} de:${saveTag.decals.toFixed(1)} li:${saveTag.lighting.toFixed(1)} un:${saveTag.untagged.toFixed(1)}`,
      `saveTag m:bld:${saveTag["mask:building"].toFixed(1)} m:sh:${saveTag["mask:shadow"].toFixed(1)} m:s:${saveTag["mask:south"].toFixed(1)} struct:${saveTag.structures.toFixed(1)}`,
      `restoreTag fl:${restoreTag.floors.toFixed(1)} de:${restoreTag.decals.toFixed(1)} li:${restoreTag.lighting.toFixed(1)} un:${restoreTag.untagged.toFixed(1)}`,
      `restoreTag m:bld:${restoreTag["mask:building"].toFixed(1)} m:sh:${restoreTag["mask:shadow"].toFixed(1)} m:s:${restoreTag["mask:south"].toFixed(1)} struct:${restoreTag.structures.toFixed(1)}`,
      `closures/frame: ${perf.closuresCreatedPerFrame.toFixed(1)}`,
      `sliceSorts/frame: ${perf.sliceKeySortsPerFrame.toFixed(1)} drawableSorts/frame: ${perf.drawableSortsPerFrame.toFixed(1)}`,
      `fullCanvasBlits/frame: ${perf.fullCanvasBlitsPerFrame.toFixed(1)}`,
      `tileRadius: ${perf.tileLoopRadius.toFixed(0)} tileLoopIters/frame: ${perf.tileLoopIterationsPerFrame.toFixed(1)}`,
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
  if (SHOW_ROAD_SEMANTIC) {
    const roadWPlayer = roadAreaWidthAt(playerTx, playerTy);
    ctx.fillText(`roadW(player): ${roadWPlayer}`, 8, 30);
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (w.state === "RUN" && w.runState === "FLOOR") {
    const target = resolveNavArrowTarget(w);
    renderNavArrow(
      ctx,
      target,
      { w: screenW, h: screenH },
      (wx, wy) => {
        const p = worldToScreen(wx, wy);
        return { x: p.x + camTx, y: p.y + camTy };
      }
    );
  }
  if (debugFlags.showGrid) renderTileGridCompass(w, ctx, screenW, screenH); // tile-grid N/E/S/W (matches in-game tests)

  renderHealthOrb(w, ctx, screenW, screenH);
  renderBossHealthBar(w, ctx, screenW, screenH);
  renderDPSMeter(w, ctx, screenW, screenH);
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
    const isCrit = w.floatTextIsCrit[i];

    const maxTtl = 0.8;
    const progress = 1 - ttl / maxTtl;

    const rise = progress * 0.35;
    const alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

    const baseSize = isCrit ? 16 : 12;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `${baseSize}px monospace`;
    ctx.fillText(`${value}`, x, y - rise);
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

function renderBossHealthBar(w: World, ctx: CanvasRenderingContext2D, ww: number, hh: number) {
  let bossIdx = -1;
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;
    if (w.eType[i] === ENEMY_TYPE.BOSS) {
      bossIdx = i;
      break;
    }
  }
  if (bossIdx < 0) return;

  const hp = w.eHp[bossIdx];
  const max = w.eHpMax[bossIdx] || 1;
  const t = Math.max(0, Math.min(1, hp / max));

  const barW = Math.min(680, ww * 0.72);
  const barH = 18;
  const x = ww * 0.5 - barW * 0.5;
  const y = 18;

  const accent = getBossAccent(w) ?? "#f66";

  ctx.save();

  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, barW, barH);

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, barW * t, barH);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barW, barH);

  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`BOSS  ${Math.ceil(hp)} / ${Math.ceil(max)}`, x + barW * 0.5, y + barH * 0.5);

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
