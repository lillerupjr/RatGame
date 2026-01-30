// src/game/systems/render.ts
import type { World } from "../world";
import { registry } from "../content/registry";
import { ZONE_KIND } from "../factories/zoneFactory";
import { getBossAccent, getFloorVisual } from "../content/floors";
import { ENEMY_TYPE } from "../content/enemies";
import { getPlayerSprite, playerSpritesReady, PLAYER_SPRITE_SCALE, type Dir8, type Frame3 } from "../visual/playerSprites";
import { getEnemySpriteFrame, preloadEnemySprites } from "../visual/enemySprites";
import { getBackground } from "../visual/background";
import {
  getProjectileSpriteByKind,
  preloadProjectileSprites,
  getProjectileDrawScale,
  PROJECTILE_BASE_DRAW_PX,
} from "../visual/projectileSprites";

export async function renderSystem(
    w: World,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
) {
  const ww = canvas.clientWidth;
  const hh = canvas.clientHeight;
  (w as any).viewW = ww;
  (w as any).viewH = hh;

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

  const cx = ww * 0.5 - w.px;
  const cy = hh * 0.5 - w.py;

  // --- Infinite tiled background texture ---
  ctx.globalAlpha = 1;

  const bg = getBackground(w); // should load /assets/background/test.png internally
  if (bg?.ready && bg.img) {
    const tileW = bg.img.width || 1024;
    const tileH = bg.img.height || 1024;

    // Screen top-left in world coords is (-cx, -cy)
    // Find the world-aligned tile start so the texture "sticks" to the world.
    const worldLeft = -cx;
    const worldTop = -cy;

    const startTileX = Math.floor(worldLeft / tileW) * tileW;
    const startTileY = Math.floor(worldTop / tileH) * tileH;

    // Draw enough tiles to cover the viewport (plus one extra tile for safety)
    for (let tx = startTileX; tx < worldLeft + ww + tileW; tx += tileW) {
      for (let ty = startTileY; ty < worldTop + hh + tileH; ty += tileH) {
        const sx = tx + cx; // world -> screen
        const sy = ty + cy;
        ctx.drawImage(bg.img, sx, sy, tileW, tileH);
      }
    }
  } else {
    // Fallback while loading
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, ww, hh);
  }

  ctx.globalAlpha = 1;
  // Zones (auras / ground effects / visuals)
  for (let i = 0; i < w.zAlive.length; i++) {
    if (!w.zAlive[i]) continue;

    const x = w.zx[i] + cx;
    const y = w.zy[i] + cy;
    const r = w.zR[i];
    const kind = w.zKind[i];

    if (kind === ZONE_KIND.AURA) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#7bdcff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (kind === ZONE_KIND.FIRE) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#ff9a3c";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (kind === ZONE_KIND.EXPLOSION) {
      // Old look: hotter core + soft ring
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#ff9a3c";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }else if (kind === ZONE_KIND.TELEGRAPH) {
      // light ring + faint fill
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
    } else if (kind === ZONE_KIND.HAZARD) {
      // stronger fill
      ctx.globalAlpha = 0.20;
      ctx.fillStyle = "#ff4d4d";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = "#ff4d4d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.98, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }

  }
  // Enemies
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const x = w.ex[i] + cx;
    const y = w.ey[i] + cy;

    // Boss gets floor-specific accent to feel different per floor (visual-only for now)
    const def = registry.enemy(w.eType[i] as any);
    // def.color may be optional in your types, so force a safe fallback string
    let baseColor: string = (def as any).color ?? "#f66";

    // Boss gets floor-specific accent to feel different per floor (visual-only for now)
    const isBoss = w.eType[i] === ENEMY_TYPE.BOSS;
    if (isBoss) baseColor = getBossAccent(w) ?? baseColor;

    // Try sprite sheet (fallback to circle if missing/not ready)
    const faceDx = w.px - w.ex[i];
    const faceDy = w.py - w.ey[i];

    // Simple “moving” heuristic (enemies always chase, but let’s not animate if basically stationary)
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

      const dx = x - dw * fr.anchorX;
      const dy = y - dh * fr.anchorY;

      ctx.drawImage(
          fr.img,
          fr.sx, fr.sy, fr.sw, fr.sh,
          dx, dy,
          dw, dh
      );

    } else {
      // fallback: old circle
      ctx.globalAlpha = 1;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(x, y, w.eR[i], 0, Math.PI * 2);
      ctx.fill();
    }


    // Boss “presence”: double ring + pulsing halo
    if (isBoss) {
      const pulse = 0.5 + 0.5 * Math.sin((w.time ?? 0) * 2.5);

      ctx.globalAlpha = 0.18 + pulse * 0.12;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, w.eR[i] * (1.25 + pulse * 0.05), 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, w.eR[i] * 1.55, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }

    // Poison tint overlay (easy to spot)
    const poisonT = (w as any).ePoisonT?.[i] ?? 0;
    if (poisonT > 0) {
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = "#37ff6b";
      ctx.beginPath();
      ctx.arc(x, y, w.eR[i] * 0.92, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#37ff6b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, w.eR[i] * 1.06, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  // Projectiles (sprites; fallback to circles)
  for (let i = 0; i < w.pAlive.length; i++) {
    if (!w.pAlive[i]) continue;

    const x = w.prx[i] + cx;
    const y = w.pry[i] + cy;

    const spr = getProjectileSpriteByKind(w.prjKind[i]);

    // Rotation uses projectile direction (works for both moving + orbitals)
    const dx = w.prDirX[i] ?? 1;
    const dy = w.prDirY[i] ?? 0;
    const ang = Math.atan2(dy, dx); // assumes sprite faces RIGHT by default

    if (spr?.ready && spr.img && spr.img.width > 0 && spr.img.height > 0) {
      // Size: tie sprite size to projectile radius (so upgrades/area feel consistent)
      // Target diameter in px:
      const areaMult = Math.max(0.6, Math.min(2.5, (w.prR[i] ?? 4) / 4));
      const target = PROJECTILE_BASE_DRAW_PX * areaMult * getProjectileDrawScale(w.prjKind[i]);

      const iw = spr.img.width;
      const ih = spr.img.height;

      // Keep aspect ratio, fit to target
      const scale = target / Math.max(iw, ih);
      const dw = iw * scale;
      const dh = ih * scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.drawImage(spr.img, -dw * 0.5, -dh * 0.5, dw, dh);
      ctx.restore();
    } else {
      // fallback circle (old behavior)
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
      ctx.arc(x, y, w.prR[i], 0, Math.PI * 2);
      ctx.fill();
    }
  }


// Pickups (XP + Boss Chest)
  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;

    const x = w.xx[i] + cx;
    const y = w.xy[i] + cy;
    const kind = w.xKind?.[i] ?? 1; // 1=XP, 2=CHEST

    if (kind === 1) {
      // XP gem
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#7df";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Chest
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fdc";
      ctx.fillRect(x - 10, y - 8, 20, 16);

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 10, y - 8, 20, 16);

      ctx.strokeStyle = "#b85";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.stroke();
    }
  }
  // Player (8-dir sprite; fallback circle)
  ctx.globalAlpha = 1;

  const dir = (((w as any)._plDir ?? "S") as Dir8);
  const frame = (((w as any)._plFrame ?? 2) as Frame3);

  const img = playerSpritesReady() ? getPlayerSprite(dir, frame) : null;

  if (img && img.width > 0 && img.height > 0) {
    const sw = img.width * PLAYER_SPRITE_SCALE;
    const sh = img.height * PLAYER_SPRITE_SCALE;

    const x = ww * 0.5 - sw * 0.5;
    const y = hh * 0.5 - sh * 0.5;

    ctx.drawImage(img, x, y, sw, sh);
  } else {
    // fallback
    ctx.fillStyle = "#eaeaf2";
    ctx.beginPath();
    ctx.arc(ww * 0.5, hh * 0.5, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.font = "12px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textBaseline = "top";
  const fps = Math.round((w as any).fps ?? 0);
  ctx.fillText(`FPS: ${fps}`, 8, 8);
  ctx.restore();

  // --- Floating Combat Text ---
  renderFloatingText(w, ctx, cx, cy);
}

/**
 * Render floating combat text (damage numbers).
 */
function renderFloatingText(
  w: World,
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < w.floatTextX.length; i++) {
    const ttl = w.floatTextTtl[i];
    if (ttl <= 0) continue;

    const x = w.floatTextX[i] + cx;
    const y = w.floatTextY[i] + cy;
    const value = w.floatTextValue[i];
    const color = w.floatTextColor[i];
    const isCrit = w.floatTextIsCrit[i];

    // Calculate animation progress (0 = just spawned, 1 = about to disappear)
    const maxTtl = 0.8;
    const progress = 1 - ttl / maxTtl;

    // Float upward over time
    const floatOffset = progress * 30;

    // Fade out in the last 40% of lifetime
    const alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

    // Scale effect for crits (start bigger, shrink to normal)
    const baseSize = isCrit ? 16 : 12;
    const scaleBoost = isCrit ? 1.5 - progress * 0.5 : 1;
    const fontSize = Math.round(baseSize * scaleBoost);

    ctx.globalAlpha = alpha;
    ctx.font = `bold ${fontSize}px monospace`;
    
    // Draw text with outline for visibility
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeText(String(value), x, y - floatOffset);
    
    ctx.fillStyle = isCrit ? "#ffff00" : color; // Crits are yellow!
    ctx.fillText(String(value), x, y - floatOffset);

    // Add "CRIT!" label for critical hits
    if (isCrit && progress < 0.3) {
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#ff4444";
      ctx.strokeText("CRIT!", x, y - floatOffset - 12);
      ctx.fillText("CRIT!", x, y - floatOffset - 12);
    }
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}
