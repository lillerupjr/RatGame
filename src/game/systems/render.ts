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
import {isHoleTile, isStairsTile, getTile, tileHeight, getWalkOutlineLocalPx} from "../map/kenneyMap";
import { getBackground } from "../visual/background";

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
  getKenneyStairsTile,
  KENNEY_TILE_WORLD,
  KENNEY_TILE_ANCHOR_Y,
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
    const tx = Math.floor(x / KENNEY_TILE_WORLD);
    const ty = Math.floor(y / KENNEY_TILE_WORLD);
    const t = getTile(tx, ty);
    return t.kind === "STAIRS" ? (t.h ?? 0) : tileHeight(tx, ty);
  };

  const isOnActiveFloor = (x: number, y: number) => {
    const tx = Math.floor(x / KENNEY_TILE_WORLD);
    const ty = Math.floor(y / KENNEY_TILE_WORLD);
    const t = getTile(tx, ty);
    if (t.kind === "VOID") return false;
    if (t.kind === "STAIRS") return true; // stairs are always drawable
    return tileHeight(tx, ty) === (w.activeFloorH ?? 0);
  };

  const toScreen = (x: number, y: number) => {
    const p = worldToScreen(x, y);

    // Milestone B: lift anything grounded by its tile height
    const h = tileHAtWorld(x, y);
    const elev = h * ELEV_PX;

    return { x: p.x + camX, y: p.y + camY - elev };
  };


  // --- Kenney-style iso ground tiles (Milestone A: Phase 1 placeholder) ---
  // Draw a real iso tile grid in correct back-to-front order (x+y diagonals).
  // Uses the placeholder tile: landscape_13.png (via getKenneyGroundTile()).

  ctx.globalAlpha = 1;

  const groundTile = getKenneyGroundTile();
  const stairsTile = getKenneyStairsTile();

  // World-units per tile step (keep in sync with kenneyTiles constants)
  const T = KENNEY_TILE_WORLD;

  // Anchor: tile sprites are usually taller than their footprint.
  const ANCHOR_Y = KENNEY_TILE_ANCHOR_Y;

  // Visual height step in screen pixels per tile-level (tune later).
  // This is purely visual right now; gameplay height will come later.
  const ELEV_PX = 16;
  // -------------------------------------------------------
  // DEBUG: Logical walk-mask overlay (matches isWalkableWorld)
  // Toggle at runtime: (w as any).debugWalkMask = true
  // Optimized: cache + throttle + smaller radius.
  // -------------------------------------------------------
  const SHOW_WALK_MASK = !!(w as any).debugWalkMask;

  // Tune these if you want:
  const WALK_MASK_RADIUS_TILES = 10;   // only draw within NxN around player
  const WALK_MASK_STEP = 1;           // 1 = every tile, 2 = every other tile
  const WALK_MASK_THROTTLE_MS = 120;  // redraw ~8 fps (overlay only)

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
    const shouldRebuild = (nowMs - lastMs) >= WALK_MASK_THROTTLE_MS;

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

    const activeH = (w.activeFloorH ?? 0);

    for (let ty = pcy - r; ty <= pcy + r; ty += WALK_MASK_STEP) {
      for (let tx = pcx - r; tx <= pcx + r; tx += WALK_MASK_STEP) {
        if (isHoleTile(tx, ty)) continue;

        const tdef = getTile(tx, ty);

        // Match your tile draw rules: only draw current active floor,
        // but keep stairs near it visible.
        if (tdef.kind !== "STAIRS") {
          const h0 = tileHeight(tx, ty);
          if (h0 !== activeH) continue;
        } else {
          const hs = (tdef.h ?? 0);
          if (Math.abs(hs - activeH) > 1) continue;
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

  if (tilesReady) {
    for (let s = minSum; s <= maxSum; s++) {
      const tx0 = Math.max(minTx, s - maxTy);
      const tx1 = Math.min(maxTx, s - minTy);

      for (let tx = tx0; tx <= tx1; tx++) {
        const ty = s - tx;

        // VOID (shared with collision)
        if (isHoleTile(tx, ty)) continue;

        const tdef = getTile(tx, ty);

        // Choose sprite: STAIRS uses landscape_20.png, FLOOR uses landscape_13.png
        const useStairs = tdef.kind === "STAIRS" || isStairsTile(tx, ty);
        const tileRec = useStairs && stairsTile?.ready ? stairsTile : groundTile;

        if (!tileRec?.ready || !tileRec.img || tileRec.img.width <= 0 || tileRec.img.height <= 0) {
          // If stairs tile missing, skip (ground still renders elsewhere)
          continue;
        }

        const iw = tileRec.img.width;
        const ih = tileRec.img.height;

        // Tile "center" in world coords (+0.5 centers the tile).
        const wx = (tx + 0.5) * T;
        const wy = (ty + 0.5) * T;

        const p = worldToScreen(wx, wy);

        const dx = p.x + camX - iw * 0.5;

        // Per-tile anchor: stairs art often has different vertical footprint/padding
        const stairsAnchorY = 0.62;
        const STAIRS_DY_PX = 16// tweak: try -12..+12

        const anchorY = useStairs ? stairsAnchorY : ANCHOR_Y;
        let dy = p.y + camY - ih * anchorY;

        // Fine tune after anchoring (stairs only)
        if (useStairs) dy += STAIRS_DY_PX;

        // Elevation:
        // - FLOOR uses integer tileHeight
        // Milestone B: only render the active floor.
        // Always allow drawing STAIRS near the active floor so transitions read well.
        const activeH = (w.activeFloorH ?? 0);

        if (tdef.kind !== "STAIRS") {
          const h0 = tileHeight(tx, ty);
          if (h0 !== activeH) continue;
        } else {
          const hs = (tdef.h ?? 0);
          if (Math.abs(hs - activeH) > 1) continue; // keep nearby stair steps visible
        }

        // stairs are visually elevated by their own h
        const h = tdef.kind === "STAIRS" ? (tdef.h ?? 0) : tileHeight(tx, ty);
        const elev = h * ELEV_PX;
        drawWalkMaskOverlay();


        dy -= elev;
        ctx.drawImage(tileRec.img, dx, dy, iw, ih);
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

  // Zones (auras / ground effects / visuals) — rendered on the ground plane (iso)
  for (let i = 0; i < w.zAlive.length; i++) {
    if (!w.zAlive[i]) continue;

    const p = toScreen(w.zx[i], w.zy[i]);
    const r = w.zR[i];
    const kind = w.zKind[i];

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
      // Your code had EXPLOSION colored like molotov; keep the same look for now.
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

  // -------------------------
  // Grounded draw list + depth sorting (iso-friendly)
  // Sort by depthKey(x,y) ~ (x+y)
  // -------------------------
  type GroundItem =
      | { kind: "pickup"; i: number; depth: number }
      | { kind: "enemy"; i: number; depth: number }
      | { kind: "player"; depth: number };

  const grounded: GroundItem[] = [];

  // Pickups
  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;
    grounded.push({ kind: "pickup", i, depth: depthKey(w.xx[i], w.xy[i]) });
  }

  // Enemies
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;
    grounded.push({ kind: "enemy", i, depth: depthKey(w.ex[i], w.ey[i]) });
  }

  // Player
  grounded.push({ kind: "player", depth: depthKey(w.px, w.py) });

  // back -> front
  grounded.sort((a, b) => a.depth - b.depth);

  // Draw them
  for (const it of grounded) {
    if (it.kind === "pickup") {
      const i = it.i;

      // Milestone B: don't draw pickups not on active floor (stairs ok)
      if (!isOnActiveFloor(w.xx[i], w.xy[i])) continue;

      const p = toScreen(w.xx[i], w.xy[i]);
      const kind = w.xKind?.[i] ?? 1; // 1=XP, 2=CHEST

      if (kind === 1) {
        // XP gem
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#7df";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Chest
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
      continue;
    }

    if (it.kind === "enemy") {
      const i = it.i;

      // Milestone B: don't draw enemies that are not on the active floor (stairs ok)
      if (!isOnActiveFloor(w.ex[i], w.ey[i])) continue;

      const p = toScreen(w.ex[i], w.ey[i]);


      const def = registry.enemy(w.eType[i] as any);
      let baseColor: string = (def as any).color ?? "#f66";

      const isBoss = w.eType[i] === ENEMY_TYPE.BOSS;
      if (isBoss) baseColor = getBossAccent(w) ?? baseColor;

      // Face vector: use screen-projected delta so facing matches iso view
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
        // fallback: ellipse on ground plane
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

      continue;
    }

    // Player (8-dir sprite; fallback ellipse)
    {
      ctx.globalAlpha = 1;

      const dir = (((w as any)._plDir ?? "S") as Dir8);
      const frame = (((w as any)._plFrame ?? 2) as Frame3);
      const img = playerSpritesReady() ? getPlayerSprite(dir, frame) : null;

      const pp = toScreen(w.px, w.py);

      if (img && img.width > 0 && img.height > 0) {
        const sw = img.width * PLAYER_SPRITE_SCALE;
        const sh = img.height * PLAYER_SPRITE_SCALE;

        const x = pp.x - sw * 0.5;
        const y = pp.y - sh * 0.5;

        ctx.drawImage(img, x, y, sw, sh);
      } else {
        ctx.fillStyle = "#eaeaf2";
        ctx.beginPath();
        ctx.ellipse(pp.x, pp.y, PLAYER_R * ISO_X, PLAYER_R * ISO_Y, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Projectiles (sprites; fallback to ellipses)
  for (let i = 0; i < w.pAlive.length; i++) {
    if (!w.pAlive[i]) continue;

    const p = toScreen(w.prx[i], w.pry[i]);
    const spr = getProjectileSpriteByKind(w.prjKind[i]);

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
      ctx.translate(p.x, p.y);
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
      ctx.ellipse(p.x, p.y, (w.prR[i] ?? 4) * ISO_X, (w.prR[i] ?? 4) * ISO_Y, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // FPS
  ctx.save();
  ctx.font = "12px monospace";
  ctx.fillStyle = "#fff";
  const fps = Math.round((w as any).fps ?? 0);
  ctx.fillText(`FPS: ${fps}`, 8, 14);
  ctx.restore();

  // --- Diablo-style Health Orb (bottom-left) ---
  renderHealthOrb(w, ctx, ww, hh);

  // --- Experience Bar (bottom of screen, WoW/PoE style) ---
  renderExperienceBar(w, ctx, ww, hh);

  // --- Boss Health Bar (top of screen, Diablo/PoE style) ---
  renderBossHealthBar(w, ctx, ww, hh);

  // --- Floating Combat Text ---
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

  // Orb frame
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(x, y, r + 6, 0, Math.PI * 2);
  ctx.fill();

  // Health fill
  const hp = Math.max(0, Math.min(1, w.playerHp / w.playerHpMax));
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#c33";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Empty overlay
  ctx.globalAlpha = 1 - hp;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Text
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
  // Find boss
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

  // Back
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, barW, barH);

  // Fill
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, barW * t, barH);

  // Frame
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barW, barH);

  // Text
  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`BOSS  ${Math.ceil(hp)} / ${Math.ceil(max)}`, x + barW * 0.5, y + barH * 0.5);

  ctx.restore();
}
