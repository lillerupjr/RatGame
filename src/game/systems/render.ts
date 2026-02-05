// src/game/systems/render.ts
import { gridAtPlayer, type World } from "../world";
import { registry } from "../content/registry";
import { ZONE_KIND } from "../factories/zoneFactory";
import { getBossAccent, getFloorVisual } from "../content/floors";
import { ENEMY_TYPE } from "../content/enemies";
import {
  getPlayerSprite,
  playerSpritesReady,
  PLAYER_SPRITE_SCALE,
  type Dir8,
  type Frame3,
} from "../visual/playerSprites";
import { getEnemySpriteFrame, preloadEnemySprites } from "../visual/enemySprites";
import {
  isHoleTile,
  getTile,
  tileHeight,
  heightAtWorld,
  getWalkOutlineLocalPx,
  walkInfo,
  heightAtWorldOcclusion,
  getRampFacesForDebug,
  pointInQuad,
  rampHeightAt,
} from "../map/kenneyMap";

import {
  getProjectileSpriteByKind,
  preloadProjectileSprites,
  getProjectileDrawScale,
  PROJECTILE_BASE_DRAW_PX,
} from "../visual/projectileSprites";

import { worldDeltaToScreen, worldToScreen, ISO_X, ISO_Y, depthKey } from "../visual/iso";

import { getKenneyGroundTile, KENNEY_TILE_WORLD, KENNEY_TILE_ANCHOR_Y } from "../visual/kenneyTiles";
import {
  getEnemyWorld,
  getPickupWorld,
  getPlayerWorld,
  getProjectileWorld,
  getZoneWorld,
} from "../coords/worldViews";

import {
  preloadCurtainSprites,
  getFloorTop,
  getFloorApron,
  getStairTop,
  getStairApron,
} from "../visual/curtainSprites";

/** Render tiles, entities, overlays, and debug layers. */
export async function renderSystem(w: World, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const ww = canvas.clientWidth;
  const hh = canvas.clientHeight;
  (w as any).viewW = ww;
  (w as any).viewH = hh;

  const PLAYER_R = w.playerR;

  ctx.clearRect(0, 0, ww, hh);

  const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const px = pWorld.wx;
  const py = pWorld.wy;

  const playerGrid = gridAtPlayer(w);

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

  // one-time curtain/top sprite preload
  if (!(w as any)._curtainSpritesPreloaded) {
    (w as any)._curtainSpritesPreloaded = true;
    preloadCurtainSprites();
  }

  // Isometric camera: project world coords into screen space, then keep player centered
  const p0 = worldToScreen(px, py);
  const camX = ww * 0.5 - p0.x;
  const camY = hh * 0.5 - p0.y;

  // World-units per tile step (keep in sync with kenneyTiles constants)
  const T = KENNEY_TILE_WORLD;

  // Anchor: tile sprites are usually taller than their footprint.
  const ANCHOR_Y = KENNEY_TILE_ANCHOR_Y;

  // Global shift so top-face aligns with logic (tune later)
  const TILE_ART_Y_SHIFT_PX = 20;

  // Visual height step in screen pixels per tile-level (tune later).
  const ELEV_PX = 16;

  // Global scale for tile sprites (1 = default size).
  const TILE_SCALE = (w as any).tileSpriteScale ?? 1;

  // Optional render-layer offset for stairs.
  const STAIR_LAYER_OFFSET = (w as any).stairLayerOffset ?? 0;

  // Enable floor curtains too
  const FLOOR_CURTAINS: boolean = (w as any).floorCurtains ?? true;

  // Edge-only floor curtains (prevents interior seams)
  const FLOOR_CURTAIN_EDGES_ONLY: boolean = (w as any).floorCurtainEdgesOnly ?? true;

  // Adjust how tightly apron joins the top (helps remove visible seam)
  const APRON_JOIN_PX = (w as any).apronJoinPx ?? 0;

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

  const floorFromZ = (z: number) => Math.floor(z + 1e-6);

  const tileLayer = (tx: number, ty: number) => {
    const t = getTile(tx, ty);
    return t.kind === "STAIRS" ? (t.h ?? 0) + STAIR_LAYER_OFFSET : tileHeight(tx, ty);
  };

  const entityLayerAt = (x: number, y: number, zAbs: number) => {
    const tx = Math.floor(x / T);
    const ty = Math.floor(y / T);
    const tl = tileLayer(tx, ty);
    const zl = floorFromZ(zAbs);
    return Math.max(zl, tl);
  };

  const toScreen = (x: number, y: number) => {
    const p = worldToScreen(x, y);
    const h = tileHAtWorld(x, y);
    const elev = h * ELEV_PX;
    return { x: p.x + camX, y: p.y + camY - elev };
  };

  // Decide if a floor tile should emit a curtain (edge-only)
  const shouldEmitFloorCurtain = (tx: number, ty: number) => {
    if (!FLOOR_CURTAIN_EDGES_ONLY) return true;

    const here = getTile(tx, ty);
    if (here.kind === "STAIRS") return false;

    const hHere = tileHeight(tx, ty);

    const neigh: Array<[number, number]> = [
      [0, 1], // S
      [1, 1], // SE
      [-1, 1], // SW
    ];

    for (const [dx, dy] of neigh) {
      const nx = tx + dx;
      const ny = ty + dy;

      if (isHoleTile(nx, ny)) return true;

      const n = getTile(nx, ny);
      if (n.kind === "STAIRS") continue;

      const hN = tileHeight(nx, ny);
      if (hN < hHere) return true;
    }

    return false;
  };

  type CurtainDraw = {
    img: HTMLImageElement; // apron-only sprite
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    depth: number;
    flipX?: boolean;
  };

  const curtainsByLayer = new Map<number, CurtainDraw[]>();
  const addCurtain = (layer: number, c: CurtainDraw) => {
    const list = curtainsByLayer.get(layer);
    if (list) list.push(c);
    else curtainsByLayer.set(layer, [c]);
  };

  // -------------------------------------------------------
  // DEBUG: Logical walk-mask overlay
  // -------------------------------------------------------
  const SHOW_WALK_MASK = !!(w as any).debugWalkMask;
  const WALK_MASK_RADIUS_TILES = 10;
  const WALK_MASK_STEP = 1;
  const WALK_MASK_THROTTLE_MS = 120;

  const wm = w as any;
  if (!wm._walkMaskCache) wm._walkMaskCache = new Map<string, any>();
  if (!wm._walkMaskLastMs) wm._walkMaskLastMs = 0;
  if (!wm._walkMaskImg) wm._walkMaskImg = null;
  if (wm._walkMaskCamX === undefined) wm._walkMaskCamX = NaN;
  if (wm._walkMaskCamY === undefined) wm._walkMaskCamY = NaN;

  const tileLocalPxToScreen = (tx: number, ty: number, lx: number, ly: number) => {
    const wx = (tx + 0.5) * T;
    const wy = (ty + 0.5) * T;

    const sdx = ((lx - 64) / 64) * T;
    const sdy = ((ly - 32) / 32) * (T * 0.5);

    const p = worldToScreen(wx, wy);
    const h = tileHAtWorld(wx, wy);
    const elev = h * ELEV_PX;

    return { x: p.x + camX + sdx, y: p.y + camY + sdy - elev };
  };

  const drawWalkMaskOverlay = () => {
    if (!SHOW_WALK_MASK) return;

    const nowMs = performance.now();
    const lastMs = wm._walkMaskLastMs as number;
    const lastCamX = wm._walkMaskCamX as number;
    const lastCamY = wm._walkMaskCamY as number;
    const camMoved = Math.abs(camX - lastCamX) > 0.01 || Math.abs(camY - lastCamY) > 0.01;

    const shouldRebuild = camMoved || nowMs - lastMs >= WALK_MASK_THROTTLE_MS;

    if (!shouldRebuild && wm._walkMaskImg) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(wm._walkMaskImg, 0, 0);
      ctx.restore();
      return;
    }

    wm._walkMaskLastMs = nowMs;
    wm._walkMaskCamX = camX;
    wm._walkMaskCamY = camY;

    const off = document.createElement("canvas");
    off.width = ww;
    off.height = hh;
    const octx = off.getContext("2d");
    if (!octx) return;

    octx.globalAlpha = 0.95;
    octx.lineWidth = 2;

    const pcx = Math.floor(px / T);
    const pcy = Math.floor(py / T);
    const r = WALK_MASK_RADIUS_TILES;

    const activeH = w.activeFloorH ?? 0;

    for (let ty = pcy - r; ty <= pcy + r; ty += WALK_MASK_STEP) {
      for (let tx = pcx - r; tx <= pcx + r; tx += WALK_MASK_STEP) {
        if (isHoleTile(tx, ty)) continue;

        const tdef = getTile(tx, ty);

        // match tile draw rules
        if (!RENDER_ALL_HEIGHTS) {
          if (tdef.kind !== "STAIRS") {
            const h0 = tileHeight(tx, ty);
            if (h0 !== activeH) continue;
          } else {
            const hs = tdef.h ?? 0;
            if (Math.abs(hs - activeH) > 1) continue;
          }
        }

        const key = `${tx},${ty}`;
        let o = wm._walkMaskCache.get(key);
        if (!o) {
          o = getWalkOutlineLocalPx(tx, ty);
          wm._walkMaskCache.set(key, o);
        }
        if (o.blocked || !o.pts || o.pts.length === 0) continue;

        octx.strokeStyle =
            tdef.kind === "STAIRS"
                ? "rgba(255,220,120,0.95)"
                : o.shape === "TOP_CUT_16"
                    ? "rgba(255,140,140,0.95)"
                    : "rgba(120,220,255,0.95)";

        octx.beginPath();
        for (let i = 0; i < o.pts.length; i++) {
          const p = o.pts[i];
          const sp = tileLocalPxToScreen(tx, ty, p.x, p.y);
          if (i === 0) octx.moveTo(sp.x, sp.y);
          else octx.lineTo(sp.x, sp.y);
        }
        octx.closePath();
        octx.stroke();
      }
    }

    wm._walkMaskImg = off;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  };

  // -------------------------------------------------------
  // DEBUG: Ramp faces overlay
  // -------------------------------------------------------
  const SHOW_RAMPS = !!(w as any).debugRamps;

  const drawRampOverlay = () => {
    if (!SHOW_RAMPS) return;
    const ramps = getRampFacesForDebug(KENNEY_TILE_WORLD);
    if (!ramps || ramps.length === 0) return;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (let i = 0; i < ramps.length; i++) {
      const r = ramps[i];
      const poly = r.poly;
      if (!poly || poly.length < 3) continue;

      ctx.strokeStyle = "rgba(0,255,255,0.95)";
      ctx.beginPath();
      for (let k = 0; k < poly.length; k++) {
        const wp = poly[k];
        const sp = toScreen(wp.x, wp.y);
        if (k === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.closePath();
      ctx.stroke();

      for (let k = 0; k < poly.length; k++) {
        const wp = poly[k];
        const sp = toScreen(wp.x, wp.y);
        const z = rampHeightAt(r, { x: wp.x, y: wp.y });

        ctx.fillStyle = "rgba(0,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(0,255,255,0.85)";
        ctx.fillText(`r${i} v${k} z=${z.toFixed(2)}`, sp.x + 6, sp.y + 6);
      }
    }

    let insideAny = false;
    let which = -1;
    for (let i = 0; i < ramps.length; i++) {
      const r = ramps[i];
      if (pointInQuad({ x: px, y: py }, r.poly)) {
        insideAny = true;
        which = i;
        break;
      }
    }

    const pp = toScreen(px, py);
    ctx.fillStyle = insideAny ? "rgba(0,255,255,0.95)" : "rgba(255,80,80,0.95)";
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = insideAny ? "rgba(0,255,255,0.95)" : "rgba(255,80,80,0.95)";
    ctx.fillText(insideAny ? `player in ramp: YES (r${which})` : "player in ramp: NO", pp.x + 10, pp.y - 18);

    const hz = heightAtWorld(px, py, KENNEY_TILE_WORLD);
    ctx.fillText(`heightAtWorld(p): ${hz.toFixed(3)}`, pp.x + 10, pp.y - 4);

    ctx.restore();
  };

  // ----------------------------
  // Tile range / diagonals
  // ----------------------------
  const radius = Math.max(12, Math.ceil(Math.max(ww, hh) / (T * 0.9)));
  const cx = Math.floor(px / T);
  const cy = Math.floor(py / T);

  const minTx = cx - radius;
  const maxTx = cx + radius;
  const minTy = cy - radius;
  const maxTy = cy + radius;

  const minSum = minTx + minTy;
  const maxSum = maxTx + maxTy;

  // We only use this to decide if the fallback ground tile is ready.
  const groundTile = getKenneyGroundTile();
  const tilesReady =
      groundTile?.ready && groundTile.img && groundTile.img.width > 0 && groundTile.img.height > 0;

  const activeH = w.activeFloorH ?? 0;

  let minLayer = activeH;
  let maxLayer = activeH;

  if (RENDER_ALL_HEIGHTS && tilesReady) {
    minLayer = Infinity;
    maxLayer = -Infinity;

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (isHoleTile(tx, ty)) continue;
        const h = tileLayer(tx, ty);
        if (h < minLayer) minLayer = h;
        if (h > maxLayer) maxLayer = h;
      }
    }

    if (!Number.isFinite(minLayer) || !Number.isFinite(maxLayer)) {
      minLayer = activeH;
      maxLayer = activeH;
    }
  }

  if (RENDER_ALL_HEIGHTS) {
    const pzAbs = (w as any).pz ?? tileHAtWorld(px, py);
    const pLayer = entityLayerAt(px, py, pzAbs);
    const pRenderLayer = pLayer + 1;
    minLayer = Math.min(minLayer, pRenderLayer);
    maxLayer = Math.max(maxLayer, pRenderLayer);

    const ez = (w as any).ez as number[] | undefined;
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
      const zAbs = ez?.[i] ?? tileHAtWorld(ew.wx, ew.wy);
      const h = entityLayerAt(ew.wx, ew.wy, zAbs);
      minLayer = Math.min(minLayer, h);
      maxLayer = Math.max(maxLayer, h);
    }

    for (let i = 0; i < w.pAlive.length; i++) {
      if (!w.pAlive[i]) continue;
      const pp = getProjectileWorld(w, i, KENNEY_TILE_WORLD);
      const baseH = tileHAtWorld(pp.wx, pp.wy);
      const zAbs = (w.prZ?.[i] ?? baseH) || 0;
      const h = entityLayerAt(pp.wx, pp.wy, zAbs);
      minLayer = Math.min(minLayer, h);
      maxLayer = Math.max(maxLayer, h);
    }
  }

  const layers: number[] = [];
  if (RENDER_ALL_HEIGHTS) {
    for (let h = minLayer; h <= maxLayer; h++) layers.push(h);
  } else {
    layers.push(activeH);
  }

  // ----------------------------
  // Buckets: zones/items by layer
  // ----------------------------
  type GroundItem =
      | { kind: "pickup"; i: number; depth: number }
      | { kind: "enemy"; i: number; depth: number }
      | { kind: "projectile"; i: number; depth: number; zLift: number }
      | { kind: "player"; depth: number };

  type ZoneDraw = { kind: number; x: number; y: number; r: number; layer: number };

  const addItem = (map: Map<number, GroundItem[]>, layer: number, item: GroundItem) => {
    const list = map.get(layer);
    if (list) list.push(item);
    else map.set(layer, [item]);
  };

  const addZone = (map: Map<number, ZoneDraw[]>, layer: number, z: ZoneDraw) => {
    const list = map.get(layer);
    if (list) list.push(z);
    else map.set(layer, [z]);
  };

  const zonesByLayer = new Map<number, ZoneDraw[]>();
  const itemsByLayer = new Map<number, GroundItem[]>();

  // Zones
  for (let i = 0; i < w.zAlive.length; i++) {
    if (!w.zAlive[i]) continue;

    const zp0 = getZoneWorld(w, i, KENNEY_TILE_WORLD);
    const zx0 = zp0.wx;
    const zy0 = zp0.wy;

    const sn = snapToNearestWalkableGround(zx0, zy0);
    const zx = sn.x;
    const zy = sn.y;

    const groundZ = sn.z;
    const occZ = heightAtWorldOcclusion(zx, zy, KENNEY_TILE_WORLD);

    const DECAL_OCCLUSION_EPS = 0.05;
    if (groundZ < occZ - DECAL_OCCLUSION_EPS) continue;

    addZone(zonesByLayer, floorFromZ(groundZ), {
      kind: w.zKind[i],
      x: zx,
      y: zy,
      r: w.zR[i],
      layer: floorFromZ(groundZ),
    });
  }

  // Pickups
  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;
    const xp = getPickupWorld(w, i, KENNEY_TILE_WORLD);
    const zAbs = tileHAtWorld(xp.wx, xp.wy);
    const h = entityLayerAt(xp.wx, xp.wy, zAbs);
    addItem(itemsByLayer, h, { kind: "pickup", i, depth: depthKey(xp.wx, xp.wy) });
  }

  // Enemy Z buffer (optional)
  const ez = (w as any).ez as number[] | undefined;

  // Projectiles
  for (let i = 0; i < w.pAlive.length; i++) {
    if (!w.pAlive[i]) continue;
    if (w.prHidden?.[i]) continue;

    const pp = getProjectileWorld(w, i, KENNEY_TILE_WORLD);
    const baseH = tileHAtWorld(pp.wx, pp.wy);
    const pzAbs = (w.prZ?.[i] ?? baseH) || 0;

    const zLift = (pzAbs - baseH) * ELEV_PX;
    const depth = depthKey(pp.wx, pp.wy);

    addItem(itemsByLayer, entityLayerAt(pp.wx, pp.wy, pzAbs), {
      kind: "projectile",
      i,
      depth,
      zLift,
    });
  }

  // Enemies
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
    const zAbs = ez?.[i] ?? tileHAtWorld(ew.wx, ew.wy);
    addItem(itemsByLayer, entityLayerAt(ew.wx, ew.wy, zAbs), {
      kind: "enemy",
      i,
      depth: depthKey(ew.wx, ew.wy),
    });
  }

  // Player
  const pzAbs2 = (w as any).pz ?? tileHAtWorld(px, py);
  const pBaseLayer = entityLayerAt(px, py, pzAbs2);
  const pRenderLayer = RENDER_ALL_HEIGHTS ? pBaseLayer + 1 : pBaseLayer;

  addItem(itemsByLayer, pRenderLayer, {
    kind: "player",
    depth: depthKey(px, py),
  });

  // ----------------------------
  // Main render loop: per-layer
  // ----------------------------
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];

    // 1) TOPS (surfaces) + queue APRONS
    for (let s = minSum; s <= maxSum; s++) {
      const ty0 = Math.max(minTy, s - maxTx);
      const ty1 = Math.min(maxTy, s - minTx);

      for (let ty = ty1; ty >= ty0; ty--) {
        const tx = s - ty;

        if (isHoleTile(tx, ty)) continue;
        if (RENDER_ALL_HEIGHTS && tileLayer(tx, ty) !== layer) continue;

        const tdef = getTile(tx, ty);
        const useStairs = tdef.kind === "STAIRS";

        // Optional filter to active floor when not rendering all
        if (!RENDER_ALL_HEIGHTS) {
          if (!useStairs) {
            const h0 = tileHeight(tx, ty);
            if (h0 !== activeH) continue;
          } else {
            const hs = tdef.h ?? 0;
            if (Math.abs(hs - activeH) > 1) continue;
          }
        }

        const dir4 = ((tdef.dir as ("N" | "E" | "S" | "W" | undefined)) ?? "N");

        const topRec = useStairs ? getStairTop(dir4) : getFloorTop();
        if (!topRec?.ready || !topRec.img || topRec.img.width <= 0 || topRec.img.height <= 0) continue;

        const topImg = topRec.img;
        const topW = topImg.width * TILE_SCALE;
        const topH = topImg.height * TILE_SCALE;

        const wx = (tx + 0.5) * T;
        const wy = (ty + 0.5) * T;

        const p = worldToScreen(wx, wy);
        const dx = p.x + camX - topW * 0.5;

        const stairsAnchorY = 0.62;
        const anchorY = useStairs ? stairsAnchorY : ANCHOR_Y;

        let dy = p.y + camY - topH * anchorY;
        dy += TILE_ART_Y_SHIFT_PX;

        // keep your current per-dir tweak hook (tune later)
        const STAIRS_DY_BY_DIR: Partial<Record<"N" | "E" | "S" | "W", number>> = {
          N: 24,
          E: 16,
          S: 16,
          W: 24,
        };
        if (useStairs) dy += STAIRS_DY_BY_DIR[dir4] ?? 16;

        const h = useStairs ? (tdef.h ?? 0) : tileHeight(tx, ty);
        dy -= h * ELEV_PX;

        // Draw TOP
        ctx.globalAlpha = 1;
        ctx.drawImage(topImg, dx, dy, topW, topH);

        // Queue APRON
        const queueApron = (apronImg: HTMLImageElement, flipX: boolean) => {
          if (!apronImg || apronImg.width <= 0 || apronImg.height <= 0) return;

          const aw = apronImg.width * TILE_SCALE;
          const ah = apronImg.height * TILE_SCALE;

          const ax = dx + (topW - aw) * 0.5;
          const ay = dy + topH - APRON_JOIN_PX;

          addCurtain(layer, {
            img: apronImg,
            dx: ax,
            dy: ay,
            dw: aw,
            dh: ah,
            depth: depthKey(wx, wy),
            flipX,
          });
        };

        if (useStairs) {
          const a = getStairApron(dir4);
          if (a?.rec?.ready && a.rec.img && a.rec.img.width > 0 && a.rec.img.height > 0) {
            queueApron(a.rec.img, !!a.flipX);
          }
        } else if (FLOOR_CURTAINS && shouldEmitFloorCurtain(tx, ty)) {
          let apronKind: "S" | "DIAG" = "S";
          let flipX = false;

          const hHere = tileHeight(tx, ty);

          const checkDrop = (nx: number, ny: number) => {
            if (isHoleTile(nx, ny)) return true;
            const n = getTile(nx, ny);
            if (n.kind === "STAIRS") return false;
            return tileHeight(nx, ny) < hHere;
          };

          if (checkDrop(tx, ty + 1)) {
            apronKind = "S";
            flipX = false;
          } else if (checkDrop(tx + 1, ty + 1)) {
            apronKind = "DIAG";
            flipX = false; // SE
          } else if (checkDrop(tx - 1, ty + 1)) {
            apronKind = "DIAG";
            flipX = true; // SW mirror
          }

          const fr = getFloorApron(apronKind);
          if (fr?.ready && fr.img && fr.img.width > 0 && fr.img.height > 0) {
            // Compensate for apron art anchor differences (tune if assets change).
            const FLOOR_APRON_DY_BY_KIND: Record<"S" | "DIAG", number> = {
              S: -100,
              DIAG: -100,
            };
            const dyOffset = FLOOR_APRON_DY_BY_KIND[apronKind] ?? 0;
            if (dyOffset !== 0) {
              // Requeue with adjusted Y without touching queueApron signature.
              const aw = fr.img.width * TILE_SCALE;
              const ah = fr.img.height * TILE_SCALE;
              const ax = dx + (topW - aw) * 0.5;
              const ay = dy + topH - APRON_JOIN_PX + dyOffset;
              addCurtain(layer, {
                img: fr.img,
                dx: ax,
                dy: ay,
                dw: aw,
                dh: ah,
                depth: depthKey(wx, wy),
                flipX,
              });
            } else {
              queueApron(fr.img, flipX);
            }
          }
        }
      }
    }

    // 2) Zones (same as your version)
    const zoneLayer = zonesByLayer.get(layer);
    if (zoneLayer) {
      for (let zi = 0; zi < zoneLayer.length; zi++) {
        const z = zoneLayer[zi];
        const p = toScreen(z.x, z.y);

        const rx = z.r * ISO_X;
        const ry = z.r * ISO_Y;

        if (z.kind === ZONE_KIND.AURA) {
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
        } else if (z.kind === ZONE_KIND.EXPLOSION) {
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
      }
    }

    // 3) Entities on this layer
    const grounded = itemsByLayer.get(layer);
    if (grounded && grounded.length > 0) {
      const pickups: Array<{ kind: "pickup"; i: number; depth: number }> = [];
      const enemies: Array<{ kind: "enemy"; i: number; depth: number }> = [];
      const projectiles: Array<{ kind: "projectile"; i: number; depth: number; zLift: number }> = [];
      let hasPlayer = false;

      for (const it of grounded) {
        if (it.kind === "pickup") pickups.push(it);
        else if (it.kind === "enemy") enemies.push(it);
        else if (it.kind === "projectile") projectiles.push(it);
        else if (it.kind === "player") hasPlayer = true;
      }

      pickups.sort((a, b) => a.depth - b.depth);
      enemies.sort((a, b) => a.depth - b.depth);
      projectiles.sort((a, b) => a.depth - b.depth);

      // Pickups
      for (const it of pickups) {
        const i = it.i;
        const xp = getPickupWorld(w, i, KENNEY_TILE_WORLD);
        const p = toScreen(xp.wx, xp.wy);
        const kind = w.xKind?.[i] ?? 1; // 1=XP, 2=CHEST

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
      }

      // Enemies
      for (const it of enemies) {
        const i = it.i;
        const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
        const p = toScreen(ew.wx, ew.wy);

        const def = registry.enemy(w.eType[i] as any);
        let baseColor: string = (def as any).color ?? "#f66";

        const isBoss = w.eType[i] === ENEMY_TYPE.BOSS;
        if (isBoss) baseColor = getBossAccent(w) ?? baseColor;

        const egx = w.egxi[i] + w.egox[i];
        const egy = w.egyi[i] + w.egoy[i];
        const enemyGrid = { gx: egx, gy: egy };
        const faceDx = playerGrid.gx - enemyGrid.gx;
        const faceDy = playerGrid.gy - enemyGrid.gy;

        const moving = (w.eSpeed[i] ?? 0) > 1;

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

          ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, dx, dy, dw, dh);
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
      }

      // Projectiles
      for (const it of projectiles) {
        const i = it.i;

        const pp = getProjectileWorld(w, i, KENNEY_TILE_WORLD);
        const p = toScreen(pp.wx, pp.wy);
        const spr = getProjectileSpriteByKind(w.prjKind[i]);

        const px = p.x;
        const py = p.y - it.zLift;

        // shadow
        {
          const r = w.prR[i] ?? 4;

          const wx0 = pp.wx;
          const wy0 = pp.wy;
          const sn = snapToNearestWalkableGround(wx0, wy0);

          const sx = sn.x;
          const sy = sn.y;
          const groundZ = sn.z;

          const occZ = heightAtWorldOcclusion(sx, sy, KENNEY_TILE_WORLD);
          const SHADOW_OCCLUSION_EPS = 0.05;
          const shadowOccluded = groundZ < occZ - SHADOW_OCCLUSION_EPS;

          if (!shadowOccluded) {
            const sp = toScreen(sx, sy);

            const lift = Math.max(0, it.zLift || 0);
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
          ctx.translate(px, py);
          ctx.rotate(ang);
          ctx.drawImage(spr.img, -dw * 0.5, -dh * 0.5, dw, dh);
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
      }

      // Player
      if (hasPlayer) {
        ctx.globalAlpha = 1;

        const dir = ((w as any)._plDir ?? "N") as Dir8;
        const frame = ((w as any)._plFrame ?? 2) as Frame3;
        const img = playerSpritesReady() ? getPlayerSprite(dir, frame) : null;

        const pp = toScreen(px, py);

        if (img && img.width > 0 && img.height > 0) {
          const sw = img.width * PLAYER_SPRITE_SCALE;
          const sh = img.height * PLAYER_SPRITE_SCALE;

          const x = pp.x - sw * 0.5;
          const y = pp.y - sh * 0.5 - 32;

          ctx.drawImage(img, x, y, sw, sh);
        } else {
          ctx.fillStyle = "#eaeaf2";
          ctx.beginPath();
          ctx.ellipse(pp.x, pp.y, PLAYER_R * ISO_X, PLAYER_R * ISO_Y, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 4) Curtains (aprons) AFTER entities
    const curtains = curtainsByLayer.get(layer);
    if (curtains && curtains.length > 0) {
      curtains.sort((a, b) => a.depth - b.depth);

      for (const c of curtains) {
        const img = c.img;
        if (!img || img.width <= 0 || img.height <= 0) continue;

        if (c.flipX) {
          ctx.save();
          ctx.translate(c.dx + c.dw * 0.5, c.dy + c.dh * 0.5);
          ctx.scale(-1, 1);
          ctx.drawImage(img, -c.dw * 0.5, -c.dh * 0.5, c.dw, c.dh);
          ctx.restore();
        } else {
          ctx.drawImage(img, c.dx, c.dy, c.dw, c.dh);
        }
      }
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

  drawWalkMaskOverlay();
  drawRampOverlay();

  // FPS
  ctx.save();
  ctx.font = "12px monospace";
  ctx.fillStyle = "#fff";
  const fps = Math.round((w as any).fps ?? 0);
  ctx.fillText(`FPS: ${fps}`, 8, 14);
  ctx.restore();

  // --- UI ---
  renderHealthOrb(w, ctx, ww, hh);
  renderExperienceBar(w, ctx, ww, hh);
  renderBossHealthBar(w, ctx, ww, hh);
  renderDPSMeter(w, ctx, ww, hh);
  renderFloatingText(w, ctx, toScreen);
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
