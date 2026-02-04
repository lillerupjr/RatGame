// src/game/systems/render.ts
import type { World } from "../world";
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

import {
  worldToScreen,
  worldDeltaToScreen,
  ISO_X,
  ISO_Y,
  depthKey,
  screenToWorld,
} from "../visual/iso";

import {
  getKenneyGroundTile,
  getKenneyTileBySkin,
  KENNEY_TILE_WORLD,
  KENNEY_TILE_ANCHOR_Y,
  Loaded,
} from "../visual/kenneyTiles";


export async function renderSystem(
    w: World,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
) {
  const ww = canvas.clientWidth;
  const hh = canvas.clientHeight;
  (w as any).viewW = ww;
  (w as any).viewH = hh;

  const PLAYER_R = w.playerR;

  ctx.clearRect(0, 0, ww, hh);

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

  // Isometric camera: project world coords into screen space, then keep player centered
  const p0 = worldToScreen(w.px, w.py);
  const camX = ww * 0.5 - p0.x;
  const camY = hh * 0.5 - p0.y;

  const tileHAtWorld = (x: number, y: number) => {
    return heightAtWorld(x, y, KENNEY_TILE_WORLD);
  };

  // -------------------------------------------------------
  // Phase 3 polish: Snap shadows/decals to the nearest WALKABLE ground point
  // so they don't float over void edges or hang off platform cutouts.
  //
  // We do a cheap expanding-ring probe around (x,y) in world space.
  // -------------------------------------------------------
  const snapToNearestWalkableGround = (x: number, y: number) => {
    const T = KENNEY_TILE_WORLD;

    // If we're already on walkable top-face, keep it.
    const i0 = walkInfo(x, y, T);
    if (i0.walkable) return { x, y, z: i0.z };

    // Probe pattern (world units). Keep this small for perf.
    // This is tuned for your Kenney tile scale (T=128-ish world).
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

    // Fallback: give up and use the original position.
    // (This should be rare unless you're deep over void.)
    return { x, y, z: tileHAtWorld(x, y) };
  };

  // Render all heights by default.
  // You can disable at runtime via: (w as any).renderAllHeights = false
  const RENDER_ALL_HEIGHTS: boolean = (w as any).renderAllHeights ?? true;

  const floorFromZ = (z: number) => Math.floor(z + 1e-6);

  const tileLayer = (tx: number, ty: number) => {
    const t = getTile(tx, ty);
    return t.kind === "STAIRS" ? ((t.h ?? 0) + STAIR_LAYER_OFFSET) : tileHeight(tx, ty);
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

    // lift anything grounded by its map height (ramps included via heightAtWorld)
    const h = tileHAtWorld(x, y);
    const elev = h * ELEV_PX;

    return { x: p.x + camX, y: p.y + camY - elev };
  };

  // --- Kenney-style iso ground tiles (Milestone A: Phase 1 placeholder) ---
  // Draw a real iso tile grid in correct back-to-front order (x+y diagonals).
  // Uses the placeholder tile: landscape_13.png (via getKenneyGroundTile()).

  ctx.globalAlpha = 1;

  const groundTile = getKenneyGroundTile();

  // World-units per tile step (keep in sync with kenneyTiles constants)
  const T = KENNEY_TILE_WORLD;

  // Anchor: tile sprites are usually taller than their footprint.
  const ANCHOR_Y = KENNEY_TILE_ANCHOR_Y;

  // Milestone B: Kenney tile art has a 32px "vertical apron".
  // We keep the LOGIC diamond perfectly tiling (no walk-shape offsets),
  // and instead shift the ART down so the visible top face matches the logical top.
  const TILE_ART_Y_SHIFT_PX = 20;

  // Visual height step in screen pixels per tile-level (tune later).
  const ELEV_PX = 16;

  // Global scale for floor/ground tile sprites (1 = default size).
  const TILE_SCALE = (w as any).tileSpriteScale ?? 1;

  // Optional render-layer offset for stairs (e.g. -1 to render under same-height tiles).
  const STAIR_LAYER_OFFSET = (w as any).stairLayerOffset ?? 0;

  // -------------------------------------------------------
  // DEBUG: Logical walk-mask overlay (matches isWalkableWorld)
  // Toggle at runtime: (w as any).debugWalkMask = true
  // Optimized: cache + throttle + smaller radius.
  // -------------------------------------------------------
  const SHOW_WALK_MASK = !!(w as any).debugWalkMask;

  // Tune these if you want:
  const WALK_MASK_RADIUS_TILES = 10; // only draw within NxN around player
  const WALK_MASK_STEP = 1; // 1 = every tile, 2 = every other tile
  const WALK_MASK_THROTTLE_MS = 120; // redraw ~8 fps (overlay only)

  // cache outlines by "tx,ty"
  const wm = (w as any);
  if (!wm._walkMaskCache) wm._walkMaskCache = new Map<string, any>();
  if (!wm._walkMaskLastMs) wm._walkMaskLastMs = 0;
  if (!wm._walkMaskImg) wm._walkMaskImg = null;

  // Convert tile-local top-face px -> screen position.
  // This inverts worldToTileTopLocalPx mapping in kenneyMap.ts.
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

    // Throttle: only rebuild the overlay image every N ms
    const shouldRebuild = nowMs - lastMs >= WALK_MASK_THROTTLE_MS;

    // If we have a cached overlay image for recent frame, just draw it
    if (!shouldRebuild && wm._walkMaskImg) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(wm._walkMaskImg, 0, 0);
      ctx.restore();
      return;
    }

    // Rebuild overlay into an offscreen canvas (fast to blit)
    wm._walkMaskLastMs = nowMs;

    const off = document.createElement("canvas");
    off.width = ww;
    off.height = hh;
    const octx = off.getContext("2d");
    if (!octx) return;

    octx.globalAlpha = 0.95;
    octx.lineWidth = 2;

    const pcx = Math.floor(w.px / T);
    const pcy = Math.floor(w.py / T);
    const r = WALK_MASK_RADIUS_TILES;

    const activeH = w.activeFloorH ?? 0;

    for (let ty = pcy - r; ty <= pcy + r; ty += WALK_MASK_STEP) {
      for (let tx = pcx - r; tx <= pcx + r; tx += WALK_MASK_STEP) {
        if (isHoleTile(tx, ty)) continue;

        const tdef = getTile(tx, ty);

        if (RENDER_ALL_HEIGHTS && tdef.kind === "STAIRS" && tdef.stairGroupId) continue;

        // Match tile draw rules (now supports "render all heights")
        if (!RENDER_ALL_HEIGHTS) {
          if (tdef.kind !== "STAIRS") {
            const h0 = tileHeight(tx, ty);
            if (h0 !== activeH) continue;
          } else {
            const hs = tdef.h ?? 0;
            if (Math.abs(hs - activeH) > 1) continue;
          }
        }

        // Cache outline per tile coordinate (deterministic map)
        const key = `${tx},${ty}`;
        let o = wm._walkMaskCache.get(key);
        if (!o) {
          o = getWalkOutlineLocalPx(tx, ty);
          wm._walkMaskCache.set(key, o);
        }
        if (o.blocked || !o.pts || o.pts.length === 0) continue;

        // Color coding
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

    // store & blit
    wm._walkMaskImg = off;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  };

  // -------------------------------------------------------
  // DEBUG: Ramp faces overlay (world-space quads + player-in-ramp dot)
  // Toggle at runtime: (w as any).debugRamps = true
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

    // Draw each ramp polygon (use toScreen so it matches elevation)
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

      // Vertex dots + z labels
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

    // Player point-in-ramp indicator
    let insideAny = false;
    let which = -1;
    for (let i = 0; i < ramps.length; i++) {
      const r = ramps[i];
      if (pointInQuad({ x: w.px, y: w.py }, r.poly)) {
        insideAny = true;
        which = i;
        break;
      }
    }

    const pp = toScreen(w.px, w.py);
    ctx.fillStyle = insideAny ? "rgba(0,255,255,0.95)" : "rgba(255,80,80,0.95)";
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = insideAny ? "rgba(0,255,255,0.95)" : "rgba(255,80,80,0.95)";
    ctx.fillText(
        insideAny ? `player in ramp: YES (r${which})` : "player in ramp: NO",
        pp.x + 10,
        pp.y - 18
    );

    // Also print the current queried z (so you can see if heightAtWorld is ramping)
    const hz = heightAtWorld(w.px, w.py, KENNEY_TILE_WORLD);
    ctx.fillText(`heightAtWorld(p): ${hz.toFixed(3)}`, pp.x + 10, pp.y - 4);

    ctx.restore();
  };

  // How many tiles around the player to draw (simple view-based estimate).
  const radius = Math.max(12, Math.ceil(Math.max(ww, hh) / (T * 0.9)));

  const cx = Math.floor(w.px / T);
  const cy = Math.floor(w.py / T);

  const minTx = cx - radius;
  const maxTx = cx + radius;
  const minTy = cy - radius;
  const maxTy = cy + radius;

  const minSum = minTx + minTy;
  const maxSum = maxTx + maxTy;

  const tilesReady =
      groundTile?.ready &&
      groundTile.img &&
      groundTile.img.width > 0 &&
      groundTile.img.height > 0;

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
    const pzAbs = (w as any).pz ?? tileHAtWorld(w.px, w.py);
    const pLayer = entityLayerAt(w.px, w.py, pzAbs);
    minLayer = Math.min(minLayer, pLayer);
    maxLayer = Math.max(maxLayer, pLayer);

    const ez = (w as any).ez as number[] | undefined;
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      const zAbs = ez?.[i] ?? tileHAtWorld(w.ex[i], w.ey[i]);
      const h = entityLayerAt(w.ex[i], w.ey[i], zAbs);
      minLayer = Math.min(minLayer, h);
      maxLayer = Math.max(maxLayer, h);
    }

    for (let i = 0; i < w.pAlive.length; i++) {
      if (!w.pAlive[i]) continue;
      const baseH = tileHAtWorld(w.prx[i], w.pry[i]);
      const zAbs = (w.prZ?.[i] ?? baseH) || 0;
      const h = entityLayerAt(w.prx[i], w.pry[i], zAbs);
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

  type GroundItem =
      | { kind: "pickup"; i: number; depth: number }
      | { kind: "enemy"; i: number; depth: number }
      | { kind: "projectile"; i: number; depth: number; zLift: number }
      | { kind: "player"; depth: number };

  type ZoneDraw = {
    kind: number;
    x: number;
    y: number;
    r: number;
    layer: number;
  };

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

  // Zones (auras / ground effects / visuals) bucketed by floor layer
  for (let i = 0; i < w.zAlive.length; i++) {
    if (!w.zAlive[i]) continue;

    const zx0 = w.zx[i];
    const zy0 = w.zy[i];

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
    const zAbs = tileHAtWorld(w.xx[i], w.xy[i]);
    const h = entityLayerAt(w.xx[i], w.xy[i], zAbs);
    addItem(itemsByLayer, h, { kind: "pickup", i, depth: depthKey(w.xx[i], w.xy[i]) });
  }


  // Enemy Z buffer (written by movementSystem; optional)
  const ez = (w as any).ez as number[] | undefined;

  // Projectiles (depth-sorted + zLift)
  for (let i = 0; i < w.pAlive.length; i++) {
    if (!w.pAlive[i]) continue;
    if (w.prHidden?.[i]) continue; // Phase 3: render-only hiding

    const baseH = tileHAtWorld(w.prx[i], w.pry[i]);
    const pzAbs = (w.prZ?.[i] ?? baseH) || 0;

    const zLift = (pzAbs - baseH) * ELEV_PX;
    const depth = depthKey(w.prx[i], w.pry[i]);

    addItem(itemsByLayer, entityLayerAt(w.prx[i], w.pry[i], pzAbs), { kind: "projectile", i, depth, zLift });

  }

  // Enemies (bucketed by Z floor)
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const zAbs = ez?.[i] ?? tileHAtWorld(w.ex[i], w.ey[i]);
    addItem(itemsByLayer, entityLayerAt(w.ex[i], w.ey[i], zAbs), {
      kind: "enemy",
      i,
      depth: depthKey(w.ex[i], w.ey[i]),
    });

  }

  // Player
  const pzAbs2 = (w as any).pz ?? tileHAtWorld(w.px, w.py);
  addItem(itemsByLayer, entityLayerAt(w.px, w.py, pzAbs2), {
    kind: "player",
    depth: depthKey(w.px, w.py),
  });


  const drawTileAt = (tx: number, ty: number, tdef: any) => {
    // Choose sprite:
    // - STAIRS: use authored tdef.skin (kenneyMapLoader must assign it)
    // - FLOOR/SPAWN: use authored skin if present, else ground
    const useStairs = tdef.kind === "STAIRS";

    let tileRec: Loaded = groundTile;

    if (useStairs) {
      tileRec = tdef.skin ? getKenneyTileBySkin(tdef.skin) : groundTile;
    } else {
      tileRec = tdef.skin ? getKenneyTileBySkin(tdef.skin) : groundTile;
    }

    if (
        !tileRec?.ready ||
        !tileRec.img ||
        tileRec.img.width <= 0 ||
        tileRec.img.height <= 0
    ) {
      return;
    }

    const iw = tileRec.img.width * TILE_SCALE;
    const ih = tileRec.img.height * TILE_SCALE;

    // Tile "center" in world coords (+0.5 centers the tile).
    const wx = (tx + 0.5) * T;
    const wy = (ty + 0.5) * T;

    const p = worldToScreen(wx, wy);
    const dx = p.x + camX - iw * 0.5;

    // Per-tile anchor: stairs art often has different vertical footprint/padding
    const stairsAnchorY = 0.62;

    // Per-direction fine tune (lets you fix ?3 of 4? issues without breaking the good one)
    const STAIRS_DY_BY_DIR: Partial<Record<"N" | "E" | "S" | "W", number>> = {
      N: 16,
      E: 16,
      S: 16,
      W: 16,
    };

    const anchorY = useStairs ? stairsAnchorY : ANCHOR_Y;
    let dy = p.y + camY - ih * anchorY;

    // Apply global art shift so top-face aligns with logic
    dy += TILE_ART_Y_SHIFT_PX;

    // Fine tune after anchoring (stairs only)
    if (useStairs) {
      const d = (tdef.dir as ("N" | "E" | "S" | "W" | undefined)) ?? "N";
      dy += STAIRS_DY_BY_DIR[d] ?? 16;
    }

    // stairs are visually elevated by their own h
    const h = tdef.kind === "STAIRS" ? (tdef.h ?? 0) : tileHeight(tx, ty);
    const elev = h * ELEV_PX;

    dy -= elev;
    ctx.drawImage(tileRec.img, dx, dy, iw, ih);

    // Collect stair occluders for a second pass (drawn AFTER entities/projectiles)
    if (useStairs) {
      const occ = ((w as any)._stairOccluders ??= []);
      occ.push({
        img: tileRec.img,
        dx,
        dy,
        iw,
        ih,
      });
    }
  };

  type StairTileDraw = { tx: number; ty: number; step: number; depth: number };
  type StairGroupDraw = { maxH: number; tiles: StairTileDraw[]; drawn?: boolean };

  const stairGroups = new Map<number, StairGroupDraw>();

  if (RENDER_ALL_HEIGHTS && tilesReady) {
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (isHoleTile(tx, ty)) continue;
        const tdef = getTile(tx, ty);
        if (tdef.kind !== "STAIRS") continue;
        const gid = tdef.stairGroupId;
        if (!gid) continue;

        let g = stairGroups.get(gid);
        if (!g) {
          g = { maxH: (tdef.h ?? 0) + STAIR_LAYER_OFFSET, tiles: [] };
          stairGroups.set(gid, g);
        }

        const h = (tdef.h ?? 0) + STAIR_LAYER_OFFSET;
        if (h > g.maxH) g.maxH = h;

        const wx = (tx + 0.5) * T;
        const wy = (ty + 0.5) * T;
        g.tiles.push({
          tx,
          ty,
          step: tdef.stairStepIndex ?? 0,
          depth: depthKey(wx, wy),
        });
      }
    }
  }

  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];

    if (tilesReady) {
      for (let s = minSum; s <= maxSum; s++) {
        const ty0 = Math.max(minTy, s - maxTx);
        const ty1 = Math.min(maxTy, s - minTx);

        for (let ty = ty1; ty >= ty0; ty--) {
          const tx = s - ty;

          // VOID (shared with collision)
          if (isHoleTile(tx, ty)) continue;

          if (RENDER_ALL_HEIGHTS && tileLayer(tx, ty) !== layer) continue;

          const tdef = getTile(tx, ty);

          // Choose sprite:
          // - STAIRS: use authored tdef.skin (kenneyMapLoader must assign it)
          // - FLOOR/SPAWN: use authored skin if present, else ground
          const useStairs = tdef.kind === "STAIRS";

          let tileRec: Loaded = groundTile;

          if (useStairs) {
            tileRec = tdef.skin ? getKenneyTileBySkin(tdef.skin) : groundTile;
          } else {
            tileRec = tdef.skin ? getKenneyTileBySkin(tdef.skin) : groundTile;
          }

          if (
              !tileRec?.ready ||
              !tileRec.img ||
              tileRec.img.width <= 0 ||
              tileRec.img.height <= 0
          ) {
            continue;
          }

          const iw = tileRec.img.width * TILE_SCALE;
          const ih = tileRec.img.height * TILE_SCALE;

          // Tile "center" in world coords (+0.5 centers the tile).
          const wx = (tx + 0.5) * T;
          const wy = (ty + 0.5) * T;

          const p = worldToScreen(wx, wy);
          const dx = p.x + camX - iw * 0.5;

          // Per-tile anchor: stairs art often has different vertical footprint/padding
          const stairsAnchorY = 0.62;

          // Per-direction fine tune (lets you fix ?3 of 4? issues without breaking the good one)
          const STAIRS_DY_BY_DIR: Partial<Record<"N" | "E" | "S" | "W", number>> = {
            N: 16,
            E: 16,
            S: 16,
            W: 16,
          };

          const anchorY = useStairs ? stairsAnchorY : ANCHOR_Y;
          let dy = p.y + camY - ih * anchorY;

          // Apply global art shift so top-face aligns with logic
          dy += TILE_ART_Y_SHIFT_PX;

          // Fine tune after anchoring (stairs only)
          if (useStairs) {
            const d = (tdef.dir as ("N" | "E" | "S" | "W" | undefined)) ?? "N";
            dy += STAIRS_DY_BY_DIR[d] ?? 16;
          }

          // Milestone B: optionally filter to active floor.
          if (!RENDER_ALL_HEIGHTS) {
            if (tdef.kind !== "STAIRS") {
              const h0 = tileHeight(tx, ty);
              if (h0 !== activeH) continue;
            } else {
              const hs = tdef.h ?? 0;
              if (Math.abs(hs - activeH) > 1) continue;
            }
          }

          // stairs are visually elevated by their own h
          const h = tdef.kind === "STAIRS" ? (tdef.h ?? 0) : tileHeight(tx, ty);
          const elev = h * ELEV_PX;

          dy -= elev;
          ctx.drawImage(tileRec.img, dx, dy, iw, ih);

          // Collect stair occluders for a second pass (drawn AFTER entities/projectiles)
          if (useStairs) {
            const occ = ((w as any)._stairOccluders ??= []);
            occ.push({
              img: tileRec.img,
              dx,
              dy,
              iw,
              ih,
            });
          }
        }
      }
    }


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
    const grounded = itemsByLayer.get(layer);
    if (!grounded || grounded.length === 0) continue;

    // Enforce category order on the SAME layer:
    // pickups -> enemies -> projectiles -> player
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

    // Stable within-category depth
    pickups.sort((a, b) => a.depth - b.depth);
    enemies.sort((a, b) => a.depth - b.depth);
    projectiles.sort((a, b) => a.depth - b.depth);

    // -----------------------------
    // 1) Pickups
    // -----------------------------
    for (const it of pickups) {
      const i = it.i;

      const p = toScreen(w.xx[i], w.xy[i]);
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

    // -----------------------------
    // 2) Enemies
    // -----------------------------
    for (const it of enemies) {
      const i = it.i;

      const p = toScreen(w.ex[i], w.ey[i]);

      const def = registry.enemy(w.eType[i] as any);
      let baseColor: string = (def as any).color ?? "#f66";

      const isBoss = w.eType[i] === ENEMY_TYPE.BOSS;
      if (isBoss) baseColor = getBossAccent(w) ?? baseColor;

      const faceWx = w.px - w.ex[i];
      const faceWy = w.py - w.ey[i];
      const face = worldDeltaToScreen(faceWx, faceWy);

      const moving = (w.eSpeed[i] ?? 0) > 1;

      const fr = getEnemySpriteFrame({
        type: w.eType[i] as any,
        time: w.time ?? 0,
        faceDx: face.dx,
        faceDy: face.dy,
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
        ctx.ellipse(
            p.x,
            p.y,
            (w.eR[i] ?? 10) * ISO_X,
            (w.eR[i] ?? 10) * ISO_Y,
            0,
            0,
            Math.PI * 2
        );
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
        ctx.ellipse(
            p.x,
            p.y,
            (w.eR[i] ?? 10) * 1.55 * ISO_X,
            (w.eR[i] ?? 10) * 1.55 * ISO_Y,
            0,
            0,
            Math.PI * 2
        );
        ctx.stroke();

        ctx.globalAlpha = 1;
      }

      if ((w.ePoisonT?.[i] ?? 0) > 0) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#3dff7a";
        ctx.beginPath();
        ctx.ellipse(
            p.x,
            p.y,
            (w.eR[i] ?? 10) * 1.05 * ISO_X,
            (w.eR[i] ?? 10) * 1.05 * ISO_Y,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // -----------------------------
    // 3) Projectiles
    // -----------------------------
    for (const it of projectiles) {
      const i = it.i;

      const p = toScreen(w.prx[i], w.pry[i]);
      const spr = getProjectileSpriteByKind(w.prjKind[i]);

      const px = p.x;
      const py = p.y - it.zLift;

      // Projectile ground shadow
      {
        const r = w.prR[i] ?? 4;

        const wx0 = w.prx[i];
        const wy0 = w.pry[i];
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
        const target =
            PROJECTILE_BASE_DRAW_PX * areaMult * getProjectileDrawScale(w.prjKind[i]);

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
        ctx.ellipse(
            px,
            py,
            (w.prR[i] ?? 4) * ISO_X,
            (w.prR[i] ?? 4) * ISO_Y,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
      }
    }

    // -----------------------------
    // 4) Player (always last on layer)
    // -----------------------------
    if (hasPlayer) {
      ctx.globalAlpha = 1;

      const dir = ((w as any)._plDir ?? "S") as Dir8;
      const frame = ((w as any)._plFrame ?? 2) as Frame3;
      const img = playerSpritesReady() ? getPlayerSprite(dir, frame) : null;

      const pp = toScreen(w.px, w.py);

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

  // Optional floor tint overlay (keep your existing visual style)
  const floorVis = getFloorVisual(w);
  if (floorVis) {
    ctx.globalAlpha = floorVis.tintAlpha;
    ctx.fillStyle = floorVis.tint;
    ctx.fillRect(0, 0, ww, hh);
    ctx.globalAlpha = 1;
  }

  // Draw walk overlay throttled (it will blit a cached image most frames)
  drawWalkMaskOverlay();

  // Draw ramp overlay ONCE per frame (not inside tile loop)
  drawRampOverlay();

  // -------------------------------------------------------
  // Milestone C: Stairs occlusion pass
  // -------------------------------------------------------
  {
    const occ = ((w as any)._stairOccluders as any[] | undefined) ?? [];
    if (occ.length > 0) {
      const APRON_PX = 0;

      for (const o of occ) {
        const sh = Math.min(APRON_PX, o.ih);
        const sy = o.ih - sh;

        ctx.drawImage(
            o.img,
            0,
            sy,
            o.iw,
            sh, // source rect
            o.dx,
            o.dy + sy,
            o.iw,
            sh // dest rect
        );
      }
    }

    (w as any)._stairOccluders = [];
  }

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
