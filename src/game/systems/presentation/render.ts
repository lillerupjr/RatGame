// src/game/systems/render.ts
import { gridAtPlayer, type World } from "../../../engine/world/world";
import { registry } from "../../content/registry";
import { ZONE_KIND } from "../../factories/zoneFactory";
import { getBossAccent, getFloorVisual } from "../../content/floors";
import { ENEMY_TYPE } from "../../content/enemies";
import { getPlayerSpriteFrame, playerSpritesReady } from "../../../engine/render/sprites/playerSprites";
import { type Dir8 } from "../../../engine/render/sprites/dir8";
import { getEnemySpriteFrame, preloadEnemySprites } from "../../../engine/render/sprites/enemySprites";
import {
  heightAtWorld,
  walkInfo,
  getTile,
  surfacesAtXY,
  facePieceLayers,
  facePiecesInViewForLayer,
  occluderLayers,
  occludersInViewForLayer,
  viewRectFromWorldCenter,
  overlaysInView,
  blockedTilesInView,
  getActiveMap as getActiveCompiledMap,
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
  getTileSpriteById,
  getVoidTop,
} from "../../../engine/render/sprites/renderSprites";
import {
  buildRuntimeStructureBandPieces,
} from "../../../engine/render/sprites/runtimeStructureSlicing";
import { orientedDims, seAnchorFromTopLeft } from "../../../engine/render/sprites/structureFootprintOwnership";
import {
  drawOccluderOverlay,
  drawProjectileFaceOverlay,
  drawRampOverlay,
  drawStructureHeightOverlay,
  drawTriggerOverlay,
  drawWalkMaskOverlay,
  type DebugOverlayContext,
} from "../../../engine/render/debug/renderDebug";
import { configurePixelPerfect, snapPx, snapZoom } from "../../../engine/render/pixelPerfect";
import { renderLighting } from "./renderLighting";

// ============================================
// RenderKey & KindOrder (Isometric Painter Model)
// ============================================

/** Semantic layer ordering (used as tie-breaker in slice ordering). */
enum KindOrder {
  FLOOR = 0,
  ENTITY = 1,
  VFX = 2,
  STRUCTURE = 3,
  OCCLUDER = 4,
  OVERLAY = 5,
}

/** Canonical render key for deterministic ordering. */
interface RenderKey {
  slice: number;      // tx + ty (primary: slice ordering, NW → SE)
  within: number;     // tx (secondary: within-slice ordering)
  baseZ: number;      // surface height (tertiary: occlusion)
  kindOrder: KindOrder; // semantic layer (quaternary: kind bias)
  stableId: number;   // deterministic tie-breaker (quinary)
}

/** Compare two RenderKeys lexicographically. */
function compareRenderKeys(a: RenderKey, b: RenderKey): number {
  if (a.slice !== b.slice) return a.slice - b.slice;
  if (a.within !== b.within) return a.within - b.within;
  if (a.baseZ !== b.baseZ) return a.baseZ - b.baseZ;
  if (a.kindOrder !== b.kindOrder) return a.kindOrder - b.kindOrder;
  return a.stableId - b.stableId;
}

const flippedOverlayImageCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

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

/** Render tiles, entities, overlays, and debug layers. */
export async function renderSystem(w: World, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const screenW = canvas.clientWidth;
  const screenH = canvas.clientHeight;
  const pixelScale = Math.max(1, Math.floor(Number(canvas.dataset.pixelScale ?? 1) || 1));
  const ww = Math.max(1, Math.floor(screenW / pixelScale));
  const hh = Math.max(1, Math.floor(screenH / pixelScale));
  configurePixelPerfect(ctx);

  // Camera zoom ("distance"):
  //   > 1 = closer (zoom in)
  //   < 1 = farther (zoom out)
  const camZoom = snapZoom((w as any).cameraZoom ?? 1);

  // Many systems use viewW/viewH as "world view extents".
  // Make them zoom-aware so "screen-relative" ranges track what you actually see.
  (w as any).viewW = ww / camZoom;
  (w as any).viewH = hh / camZoom;

  const PLAYER_R = w.playerR;

  ctx.clearRect(0, 0, screenW, screenH);

  // Apply zoom around screen center for WORLD rendering only.
  // We'll ctx.restore() before FPS/HUD/UI so UI stays crisp and unscaled.
  ctx.save();
  ctx.scale(pixelScale, pixelScale);
  const viewCenterX = snapPx(ww * 0.5);
  const viewCenterY = snapPx(hh * 0.5);
  ctx.translate(viewCenterX, viewCenterY);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-viewCenterX, -viewCenterY);


  const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const px = pWorld.wx;
  const py = pWorld.wy;

  // one-time enemy sprite preload
  if (!(w as any)._enemySpritesPreloaded) {
    (w as any)._enemySpritesPreloaded = true;
    preloadEnemySprites();
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
  const camX = (viewCenterX - p0.x);
  const camY = (viewCenterY - p0.y);


  // World-units per tile step (keep in sync with kenneyTiles constants)
  const T = KENNEY_TILE_WORLD;
  const playerTx = Math.floor(px / T);
  const playerTy = Math.floor(py / T);

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

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
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

  const maxNonStairSurfaceZ = (tx: number, ty: number): number | null => {
    const surfaces = surfacesAtXY(tx, ty);
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


    const drawRenderPiece = (c: RenderPieceDraw) => {
      const img = c.img;
      if (!img || img.width <= 0 || img.height <= 0) return;
      const scale = c.scale ?? 1;

      ctx.save();
      ctx.translate(snapPx(c.dx), snapPx(c.dy));
      ctx.scale(scale, scale);
      if (c.flipX) {
        ctx.translate(c.dw, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, 0, 0, c.dw, c.dh);
      ctx.restore();
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

      const wx = (tx + 0.5) * T;
      const wy = (ty + 0.5) * T;
      const p = worldToScreen(wx, wy);
      const centerX = snapPx(p.x + camX);
      const centerY = snapPx(
        p.y + camY - zBase * ELEV_PX - SIDEWALK_ISO_HEIGHT * (renderAnchorY - 0.5),
      );

      ctx.save();
      ctx.translate(centerX, centerY);
      // 2:1 iso projection from square space (128x128 source => 128x64 footprint).
      ctx.transform(0.5, 0.25, -0.5, 0.25, 0, 0);
      ctx.rotate(rotationQuarterTurns * (Math.PI * 0.5));
      ctx.translate(-(SIDEWALK_SRC_SIZE * 0.5), -(SIDEWALK_SRC_SIZE * 0.5));
      ctx.drawImage(src.img, 0, 0, SIDEWALK_SRC_SIZE, SIDEWALK_SRC_SIZE);

      if (SHOW_SIDEWALK_VARIANT_DEBUG) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#00ffd5";
        ctx.font = "9px monospace";
        ctx.fillText(`${variantIndex} r${rotationQuarterTurns}`, centerX + 4, centerY - 4);
      }
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
      const surfaces = surfacesAtXY(nTx, nTy);
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
    const dx = p.x + camX - ow * scale * 0.5 + (o.drawDxOffset ?? 0) + footprintAnchorAdjustX;
    const dy = p.y + camY - oh * scale - o.z * ELEV_PX - (o.drawDyOffset ?? 0);
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

  const SHOW_WALK_MASK = false;
  const SHOW_RAMPS = false;
  const SHOW_OCCLUDER_DEBUG = false;
  const SHOW_PROJECTILE_FACES = false;
  const SHOW_TRIGGER_ZONES = false;
  const SHOW_STRUCTURE_HEIGHTS = false;
  const SHOW_STRUCTURE_COLLISION_DEBUG = (w as any).structureCollisionDebug ?? false;
  const SHOW_STRUCTURE_SLICE_DEBUG = (w as any).runtimeStructureSliceDebug ?? false;

  // Enemy Z buffer (optional visual override)
  const ez = w.ezVisual;

  // ----------------------------
  // Tile range / diagonals (zoom-aware)
  // ----------------------------
  const radius = Math.max(12, Math.ceil(Math.max(ww / camZoom, hh / camZoom) / (T * 0.9)));
  const cx = Math.floor(px / T);
  const cy = Math.floor(py / T);

  const minTx = cx - radius;
  const maxTx = cx + radius;
  const minTy = cy - radius;
  const maxTy = cy + radius;

  const minSum = minTx + minTy;
  const maxSum = maxTx + maxTy;

  const viewRect = viewRectFromWorldCenter(px, py, T, radius);
  const activeH = w.activeFloorH ?? 0;

  // ----------------------------
  // Void green_water.png (draw once per frame)
  // ----------------------------
  {
    const voidRec = getVoidTop();
    if (voidRec?.ready && voidRec.img && voidRec.img.width > 0 && voidRec.img.height > 0) {
      const topImg = voidRec.img;
      const topW = topImg.width * VOID_TOP_SCALE;
      const topH = topImg.height * VOID_TOP_SCALE;

      for (let s = minSum; s <= maxSum; s++) {
        const ty0 = Math.max(minTy, s - maxTx);
        const ty1 = Math.min(maxTy, s - minTx);

        for (let ty = ty1; ty >= ty0; ty--) {
          const tx = s - ty;
          const tile = getTile(tx, ty);
          if (tile.kind !== "VOID") continue;

          const wx = (tx + 0.5) * T;
          const wy = (ty + 0.5) * T;

          const p = worldToScreen(wx, wy);
          const dx = p.x + camX - topW * 0.5;

          const anchorY = ANCHOR_Y;

            let dy = p.y + camY - topH * anchorY;
            dy += 2 * ELEV_PX;

            ctx.drawImage(topImg, snapPx(dx), snapPx(dy), topW, topH);
        }
      }
    }
  }
  // ============================================
  // SLICE-BUCKETED COLLECTION AND DRAWING
  // ============================================
  // Drawable descriptor for any render element
  type SliceDrawable = {
    key: RenderKey;
    draw: () => void;  // closure that executes the draw
  };

  // Map from slice -> array of drawables for that slice
  const sliceDrawables = new Map<number, SliceDrawable[]>();
  const deferredStructureSliceDebugDraws: Array<() => void> = [];

  const addToSlice = (slice: number, key: RenderKey, draw: () => void) => {
    let bucket = sliceDrawables.get(slice);
    if (!bucket) {
      bucket = [];
      sliceDrawables.set(slice, bucket);
    }
    bucket.push({ key, draw });
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

        const surfaces = surfacesAtXY(tx, ty);
        if (surfaces.length === 0) continue;

        for (let si = 0; si < surfaces.length; si++) {
          const surface = surfaces[si];
          const tdef = surface.tile;
          const isStairTop = surface.renderTopKind === "STAIR";

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
            const drawClosure = () => {
              drawRuntimeSidewalkTop(
                tx,
                ty,
                surface.zBase,
                surface.renderAnchorY ?? ANCHOR_Y,
                runtimeTop.family,
                runtimeTop.variantIndex,
                runtimeTop.rotationQuarterTurns,
              );
            };
            addToSlice(tx + ty, renderKey, drawClosure);
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

          const drawClosure = () => {
            ctx.drawImage(topImg, snapPx(dx), snapPx(dy), topW, topH);
          };

          addToSlice(tx + ty, renderKey, drawClosure);
        }
      }
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

      const xp = getPickupWorld(w, i, KENNEY_TILE_WORLD);
      const xtx = Math.floor(xp.wx / T);
      const xty = Math.floor(xp.wy / T);
      const zAbs = tileHAtWorld(xp.wx, xp.wy);

      const renderKey: RenderKey = {
        slice: xtx + xty,
        within: xtx,
        baseZ: zAbs,
        kindOrder: KindOrder.ENTITY,
        stableId: 110000 + i,
      };

      const kind = w.xKind?.[i] ?? 1;
      const p = toScreen(xp.wx, xp.wy);

      const drawClosure = () => {
        if (kind === 1) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#7df";
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
      const zAbs = ez?.[i] ?? tileHAtWorld(ew.wx, ew.wy);

      const renderKey: RenderKey = {
        slice: etx + ety,
        within: etx,
        baseZ: zAbs,
        kindOrder: KindOrder.ENTITY,
        stableId: 120000 + i,
      };

      const def = registry.enemy(w.eType[i] as any);
      let baseColor: string = (def as any).color ?? "#f66";

      const isBoss = w.eType[i] === ENEMY_TYPE.BOSS;
      if (isBoss) baseColor = getBossAccent(w) ?? baseColor;

      const p = toScreen(ew.wx, ew.wy);

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

          const dx = p.x - dw * fr.anchorX;
          const dy = p.y - dh * fr.anchorY;

          ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, snapPx(dx), snapPx(dy), dw, dh);
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = baseColor;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, (w.eR[i] ?? 10) * ISO_X, (w.eR[i] ?? 10) * ISO_Y, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        if (isBoss) {
          const pulse = 0.5 + 0.5 * Math.sin((w.time ?? 0) * 2.5);

          ctx.globalAlpha = 0.18 + pulse * 0.12;
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(
              p.x,
              p.y,
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
          ctx.ellipse(p.x, p.y, (w.eR[i] ?? 10) * 1.55 * ISO_X, (w.eR[i] ?? 10) * 1.55 * ISO_Y, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.globalAlpha = 1;
        }

        if ((w.ePoisonT?.[i] ?? 0) > 0) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#3dff7a";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, (w.eR[i] ?? 10) * 1.05 * ISO_X, (w.eR[i] ?? 10) * 1.05 * ISO_Y, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      };

      addToSlice(etx + ety, renderKey, drawClosure);
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
      const baseH = tileHAtWorld(pp.wx, pp.wy);
      const pzAbs = (w.prZVisual?.[i] ?? w.prZ?.[i] ?? baseH) || 0;

      const renderKey: RenderKey = {
        slice: ptx + pty,
        within: ptx,
        baseZ: pzAbs,
        kindOrder: KindOrder.VFX,  // Projectiles are now VFX, not hidden under platforms
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

          const lift = Math.max(0, zLift || 0);
          const t = Math.max(0, Math.min(1, 1 - lift / 70));

          const rx = r * ISO_X * (0.95 + 0.15 * t);
          const ry = r * ISO_Y * (0.85 + 0.1 * t);

          ctx.save();
          ctx.globalAlpha = 0.18 * t;
          ctx.fillStyle = "#000";
          ctx.beginPath();
          ctx.ellipse(sp.x, sp.y, rx, ry, 0, 0, Math.PI * 2);
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
    const ptx = Math.floor(px / T);
    const pty = Math.floor(py / T);

    const renderKey: RenderKey = {
      slice: ptx + pty,
      within: ptx,
      baseZ: pzAbs2,
      kindOrder: KindOrder.ENTITY,
      stableId: 0,
    };

    const pp = toScreen(px, py);

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

        const dx = Math.round(pp.x - fr.anchorX * fr.sw * fr.scale);
        const dy = Math.round(pp.y - fr.anchorY * fr.sh * fr.scale);

        ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#eaeaf2";
        ctx.beginPath();
        ctx.ellipse(pp.x, pp.y, PLAYER_R * ISO_X, PLAYER_R * ISO_Y, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    addToSlice(ptx + pty, renderKey, drawClosure);
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
        addToSlice(face.tx + face.ty, renderKey, () => drawRenderPiece(d));
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
      addToSlice(occ.tx + occ.ty, renderKey, () => drawRenderPiece(draw));
    }
  }

    // ----------------------------
    // Collect OVERLAYS (roofs + props) into slices
    // ----------------------------
    {
      const ovs = overlaysInView(viewRect);
      for (let i = 0; i < ovs.length; i++) {
        const o = ovs[i];
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
            const overlayKey: RenderKey = {
              slice: band.renderKey.slice,
              within: band.renderKey.within,
              baseZ: band.renderKey.baseZ,
              kindOrder: KindOrder.STRUCTURE,
              stableId: band.renderKey.stableId,
            };
            addToSlice(band.renderKey.slice, overlayKey, () => {
              const img = draw.img;
              if (!img) return;
              const sourceImg: CanvasImageSource = draw.flipX ? getFlippedOverlayImage(img) : img;
              ctx.drawImage(
                sourceImg,
                band.srcRect.x,
                band.srcRect.y,
                band.srcRect.w,
                band.srcRect.h,
                snapPx(band.dstRect.x),
                snapPx(band.dstRect.y),
                band.dstRect.w,
                band.dstRect.h,
              );
              if (SHOW_STRUCTURE_SLICE_DEBUG) {
                const ownerTile = {
                  tx: band.renderKey.within,
                  ty: band.renderKey.slice - band.renderKey.within,
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
          addToSlice(slice, overlayKey, () => drawRenderPiece(draw));
        }
      }
    }

  // ============================================
  // FINAL RENDER PASS: Execute all slices in order
  // ============================================
  const sliceKeys = Array.from(sliceDrawables.keys());
  sliceKeys.sort((a, b) => a - b);

  for (const slice of sliceKeys) {
    const drawables = sliceDrawables.get(slice)!;

    // Sort drawables within this slice lexicographically by RenderKey
    drawables.sort((a, b) => compareRenderKeys(a.key, b.key));

    // Execute all draws for this slice
    for (const drawable of drawables) {
      drawable.draw();
    }
  }

  // Optional floor tint overlay
  const floorVis = getFloorVisual(w);
  if (floorVis) {
    ctx.globalAlpha = floorVis.tintAlpha;
    ctx.fillStyle = floorVis.tint;
    ctx.fillRect(0, 0, ww, hh);
    ctx.globalAlpha = 1;
  }

  const GLOBAL_SCREEN_TINT_ALPHA = (w.lighting.darknessAlpha ?? 0) > 0 ? 0 : 0.3;
  if (GLOBAL_SCREEN_TINT_ALPHA > 0) {
    ctx.globalAlpha = GLOBAL_SCREEN_TINT_ALPHA;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ww, hh);
    ctx.globalAlpha = 1;
  }

  drawWalkMaskOverlay(debugContext, SHOW_WALK_MASK);
  drawRampOverlay(debugContext, SHOW_RAMPS);
  drawOccluderOverlay(debugContext, SHOW_OCCLUDER_DEBUG, viewRect);
  drawProjectileFaceOverlay(debugContext, SHOW_PROJECTILE_FACES, viewRect);
  drawStructureHeightOverlay(debugContext, SHOW_STRUCTURE_HEIGHTS, viewRect);
  drawTriggerOverlay(debugContext, SHOW_TRIGGER_ZONES);
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

  // Restore (undo camera zoom) before drawing screen-space overlays / HUD
  ctx.restore();

  const lightDefs = getActiveCompiledMap().lightDefs;
  const projectedLights = new Array(lightDefs.length);
  for (let i = 0; i < lightDefs.length; i++) {
    const ld = lightDefs[i];
    const p = worldToScreen(ld.worldX, ld.worldY);
    const screenOffsetX = (ld.screenOffsetPx?.x ?? 0) * pixelScale;
    const screenOffsetY = (ld.screenOffsetPx?.y ?? 0) * pixelScale;
    const flickerPhase = (Math.sin(ld.worldX * 0.013 + ld.worldY * 0.007) * 43758.5453) % (Math.PI * 2);
    projectedLights[i] = {
      sx: (p.x + camX) * pixelScale + screenOffsetX,
      sy: (p.y + camY - ld.heightUnits * ELEV_PX) * pixelScale + screenOffsetY,
      radiusPx: ld.radiusPx * pixelScale,
      intensity: ld.intensity,
      shape: ld.shape ?? "RADIAL",
      color: ld.color ?? "#FFFFFF",
      tintStrength: ld.tintStrength ?? 0.35,
      flicker: ld.flicker ?? { kind: "NONE" },
      flickerPhase,
      pool: ld.pool
        ? { radiusPx: ld.pool.radiusPx * pixelScale, yScale: ld.pool.yScale ?? 1 }
        : undefined,
      cone: ld.cone
        ? { dirRad: ld.cone.dirRad, angleRad: ld.cone.angleRad, lengthPx: ld.cone.lengthPx * pixelScale }
        : undefined,
    };
  }
  // PASS 8: final screen-space lighting
  renderLighting(ctx, w.lighting, projectedLights, screenW, screenH, w.time ?? 0);

  // FPS
  ctx.save();
  ctx.font = "12px monospace";
  ctx.fillStyle = "#fff";
  const fps = Math.round((w as any).fps ?? 0);
  ctx.fillText(`FPS: ${fps}`, 8, 14);
  ctx.restore();

  // --- UI ---
  renderTileGridCompass(w, ctx, screenW, screenH); // tile-grid N/E/S/W (matches in-game tests)

  renderHealthOrb(w, ctx, screenW, screenH);
  renderExperienceBar(w, ctx, screenW, screenH);
  renderBossHealthBar(w, ctx, screenW, screenH);
  renderDPSMeter(w, ctx, screenW, screenH);
  renderFloatingText(w, ctx, toScreen);

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
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`gx:${g.gx.toFixed(2)} gy:${g.gy.toFixed(2)}`, x0 + 8, y0 + size - 8);

  ctx.restore();
}
/**
 * Render floating combat text (damage numbers).
 */
function renderFloatingText(
    w: World,
    ctx: CanvasRenderingContext2D,
    toScreen: (x: number, y: number) => { x: number; y: number }
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < w.floatTextX.length; i++) {
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

    const floatOffset = progress * 30;
    const alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

    const baseSize = isCrit ? 16 : 12;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `${baseSize}px monospace`;
    ctx.fillText(`${value}`, x, y - floatOffset);
    ctx.restore();
  }
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

function renderExperienceBar(w: World, ctx: CanvasRenderingContext2D, ww: number, hh: number) {
  const pad = 18;
  const barH = 14;
  const x = pad;
  const y = hh - pad - barH;
  const wBar = ww - pad * 2;

  const xp = w.xp ?? 0;
  const need = w.xpToNext ?? 1;
  const t = Math.max(0, Math.min(1, xp / need));

  ctx.save();

  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, wBar, barH);

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#48f";
  ctx.fillRect(x, y, wBar * t, barH);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, wBar, barH);

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`XP ${xp} / ${need}`, x + wBar * 0.5, y + barH * 0.5);

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
