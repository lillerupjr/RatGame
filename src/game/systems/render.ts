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

  // --- Diablo-style Health Orb (bottom-left) ---
  renderHealthOrb(w, ctx, ww, hh);

  // --- Experience Bar (bottom of screen, WoW/PoE style) ---
  renderExperienceBar(w, ctx, ww, hh);

  // --- Boss Health Bar (top of screen, Diablo/PoE style) ---
  renderBossHealthBar(w, ctx, ww, hh);

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

/**
 * Render a Diablo-style health orb in the bottom-left corner.
 */
function renderHealthOrb(
  w: World,
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number
) {
  const orbRadius = 50;
  const orbX = 70;  // distance from left edge
  const orbY = canvasH - 70;  // distance from bottom edge

  const hp = w.playerHp ?? 100;
  const hpMax = w.playerHpMax ?? 100;
  const hpRatio = Math.max(0, Math.min(1, hp / hpMax));

  // Animate low health with a pulse effect
  const lowHealthPulse = hpRatio < 0.3 
    ? 0.15 * Math.sin((w.time ?? 0) * 6) 
    : 0;

  ctx.save();

  // --- Outer stone frame (dark ring) ---
  ctx.beginPath();
  ctx.arc(orbX, orbY, orbRadius + 8, 0, Math.PI * 2);
  const frameGrad = ctx.createRadialGradient(orbX, orbY, orbRadius, orbX, orbY, orbRadius + 10);
  frameGrad.addColorStop(0, "#1a1a1a");
  frameGrad.addColorStop(0.5, "#2d2d2d");
  frameGrad.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = frameGrad;
  ctx.fill();

  // Inner frame ring
  ctx.beginPath();
  ctx.arc(orbX, orbY, orbRadius + 4, 0, Math.PI * 2);
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.stroke();

  // --- Orb background (empty/dark interior) ---
  ctx.beginPath();
  ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#0d0508";
  ctx.fill();
  ctx.clip(); // Clip everything to the orb circle

  // --- Blood/health fill ---
  // The fill rises from the bottom based on health ratio
  const fillHeight = orbRadius * 2 * hpRatio;
  const fillTop = orbY + orbRadius - fillHeight;

  // Animated wave effect on the liquid surface
  const waveTime = (w.time ?? 0) * 2;
  const waveAmplitude = 3 + Math.abs(lowHealthPulse) * 8;

  // Create blood gradient
  const bloodGrad = ctx.createLinearGradient(orbX, fillTop, orbX, orbY + orbRadius);
  const baseRed = Math.min(1, 0.9 + lowHealthPulse);
  bloodGrad.addColorStop(0, `rgba(${Math.floor(220 * baseRed)}, 30, 40, 0.95)`);
  bloodGrad.addColorStop(0.3, `rgba(${Math.floor(180 * baseRed)}, 20, 30, 0.98)`);
  bloodGrad.addColorStop(0.7, `rgba(${Math.floor(140 * baseRed)}, 15, 25, 1)`);
  bloodGrad.addColorStop(1, `rgba(${Math.floor(100 * baseRed)}, 10, 20, 1)`);

  ctx.fillStyle = bloodGrad;

  // Draw the liquid with wavy top surface
  ctx.beginPath();
  ctx.moveTo(orbX - orbRadius - 5, orbY + orbRadius + 5);
  ctx.lineTo(orbX - orbRadius - 5, fillTop);

  // Wavy surface
  for (let x = orbX - orbRadius; x <= orbX + orbRadius; x += 2) {
    const waveOffset = Math.sin(waveTime + x * 0.08) * waveAmplitude;
    ctx.lineTo(x, fillTop + waveOffset);
  }

  ctx.lineTo(orbX + orbRadius + 5, orbY + orbRadius + 5);
  ctx.closePath();
  ctx.fill();

  // Secondary wave layer for depth
  const bloodGrad2 = ctx.createLinearGradient(orbX, fillTop, orbX, orbY + orbRadius);
  bloodGrad2.addColorStop(0, "rgba(255, 60, 70, 0.3)");
  bloodGrad2.addColorStop(1, "rgba(120, 20, 30, 0.2)");
  ctx.fillStyle = bloodGrad2;

  ctx.beginPath();
  ctx.moveTo(orbX - orbRadius - 5, orbY + orbRadius + 5);
  ctx.lineTo(orbX - orbRadius - 5, fillTop + 5);

  for (let x = orbX - orbRadius; x <= orbX + orbRadius; x += 2) {
    const waveOffset = Math.sin(waveTime * 1.3 + x * 0.12 + 1) * (waveAmplitude * 0.7);
    ctx.lineTo(x, fillTop + 5 + waveOffset);
  }

  ctx.lineTo(orbX + orbRadius + 5, orbY + orbRadius + 5);
  ctx.closePath();
  ctx.fill();

  // --- Glass reflection/highlight ---
  ctx.restore(); // Remove clip
  ctx.save();

  // Top-left highlight (glass shine)
  const highlightGrad = ctx.createRadialGradient(
    orbX - orbRadius * 0.35,
    orbY - orbRadius * 0.35,
    0,
    orbX - orbRadius * 0.35,
    orbY - orbRadius * 0.35,
    orbRadius * 0.6
  );
  highlightGrad.addColorStop(0, "rgba(255, 255, 255, 0.35)");
  highlightGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.1)");
  highlightGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.beginPath();
  ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = highlightGrad;
  ctx.fillRect(orbX - orbRadius, orbY - orbRadius, orbRadius * 2, orbRadius * 2);

  // Small specular highlight
  ctx.beginPath();
  ctx.ellipse(
    orbX - orbRadius * 0.3,
    orbY - orbRadius * 0.4,
    orbRadius * 0.15,
    orbRadius * 0.08,
    -Math.PI / 4,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.fill();

  ctx.restore();

  // --- Outer glass rim ---
  ctx.beginPath();
  ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
  const rimGrad = ctx.createRadialGradient(orbX, orbY, orbRadius - 3, orbX, orbY, orbRadius);
  rimGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
  rimGrad.addColorStop(0.7, "rgba(255, 255, 255, 0.05)");
  rimGrad.addColorStop(1, "rgba(255, 255, 255, 0.2)");
  ctx.strokeStyle = rimGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // --- HP text ---
  ctx.save();
  ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Text shadow
  ctx.fillStyle = "#000";
  ctx.fillText(`${Math.ceil(hp)}`, orbX + 1, orbY + 1);

  // Main text
  ctx.fillStyle = hpRatio < 0.3 ? "#ff6666" : "#fff";
  ctx.fillText(`${Math.ceil(hp)}`, orbX, orbY);

  ctx.restore();

  // --- Decorative skull/cross icon above orb (optional thematic element) ---
  ctx.save();
  ctx.font = "16px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(180, 150, 120, 0.7)";
  ctx.fillText("♥", orbX, orbY - orbRadius - 16);
  ctx.restore();

  // Low health warning glow
  if (hpRatio < 0.3) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.abs(lowHealthPulse);
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbRadius + 15, 0, Math.PI * 2);
    const warningGrad = ctx.createRadialGradient(orbX, orbY, orbRadius, orbX, orbY, orbRadius + 20);
    warningGrad.addColorStop(0, "rgba(255, 0, 0, 0.4)");
    warningGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = warningGrad;
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Render a WoW/PoE-style experience bar at the bottom of the screen.
 */
function renderExperienceBar(
  w: World,
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number
) {
  const barHeight = 20;
  const barMargin = 140; // Space for health orb on left side
  const barY = canvasH - barHeight - 8;
  const barX = barMargin;
  const barWidth = canvasW - barMargin * 2;

  const xp = w.xp ?? 0;
  const xpToNext = w.xpToNext ?? 100;
  const level = w.level ?? 1;
  const xpRatio = Math.max(0, Math.min(1, xp / xpToNext));

  ctx.save();

  // --- Outer frame (dark border with bevel) ---
  // Bottom shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  roundRect(ctx, barX - 2, barY + 2, barWidth + 4, barHeight + 4, 4);
  ctx.fill();

  // Main frame
  const frameGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
  frameGrad.addColorStop(0, "#1a1a1a");
  frameGrad.addColorStop(0.3, "#2d2d2d");
  frameGrad.addColorStop(0.7, "#1f1f1f");
  frameGrad.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = frameGrad;
  roundRect(ctx, barX - 3, barY - 3, barWidth + 6, barHeight + 6, 5);
  ctx.fill();

  // Inner border
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  roundRect(ctx, barX - 1, barY - 1, barWidth + 2, barHeight + 2, 3);
  ctx.stroke();

  // --- Bar background (empty state) ---
  ctx.fillStyle = "#0a0812";
  roundRect(ctx, barX, barY, barWidth, barHeight, 2);
  ctx.fill();

  // --- XP fill ---
  if (xpRatio > 0) {
    const fillWidth = barWidth * xpRatio;

    // Clip to rounded rect
    ctx.save();
    roundRect(ctx, barX, barY, barWidth, barHeight, 2);
    ctx.clip();

    // Main XP gradient (purple/blue like PoE/WoW)
    const xpGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    xpGrad.addColorStop(0, "#9966ff");
    xpGrad.addColorStop(0.3, "#7744dd");
    xpGrad.addColorStop(0.5, "#6633cc");
    xpGrad.addColorStop(0.7, "#5522aa");
    xpGrad.addColorStop(1, "#441199");
    ctx.fillStyle = xpGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    // Shimmer effect (animated highlight)
    const shimmerTime = (w.time ?? 0) * 0.5;
    const shimmerX = barX + ((shimmerTime * barWidth) % (barWidth + 100)) - 50;
    const shimmerGrad = ctx.createLinearGradient(shimmerX, barY, shimmerX + 80, barY);
    shimmerGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
    shimmerGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.15)");
    shimmerGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    // Top highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(barX, barY, fillWidth, barHeight * 0.35);

    ctx.restore();

    // Glow at the fill edge
    if (fillWidth > 5) {
      const glowX = barX + fillWidth;
      const edgeGlow = ctx.createRadialGradient(glowX, barY + barHeight / 2, 0, glowX, barY + barHeight / 2, 15);
      edgeGlow.addColorStop(0, "rgba(153, 102, 255, 0.6)");
      edgeGlow.addColorStop(1, "rgba(153, 102, 255, 0)");
      ctx.fillStyle = edgeGlow;
      ctx.fillRect(glowX - 15, barY - 5, 30, barHeight + 10);
    }
  }

  // --- Tick marks (10 segments like WoW) ---
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const tickX = barX + (barWidth / 10) * i;
    ctx.beginPath();
    ctx.moveTo(tickX, barY);
    ctx.lineTo(tickX, barY + barHeight);
    ctx.stroke();
  }

  // --- Level badge (left side) ---
  const badgeX = barX - 20;
  const badgeY = barY + barHeight / 2;
  const badgeR = 16;

  // Badge background
  const badgeGrad = ctx.createRadialGradient(badgeX, badgeY, 0, badgeX, badgeY, badgeR);
  badgeGrad.addColorStop(0, "#3d2a5c");
  badgeGrad.addColorStop(0.7, "#2a1a4a");
  badgeGrad.addColorStop(1, "#1a0a2a");
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  // Badge border
  ctx.strokeStyle = "#6644aa";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Level text
  ctx.font = "bold 12px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ddc8ff";
  ctx.fillText(`${level}`, badgeX, badgeY);

  // --- XP text (center) ---
  ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText(`${xp} / ${xpToNext} XP`, barX + barWidth / 2, barY + barHeight / 2 + 1);

  ctx.restore();
}

/**
 * Render a Diablo/PoE-style boss health bar at the top of the screen.
 */
function renderBossHealthBar(
  w: World,
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number
) {
  // Find active boss
  let bossIndex = -1;
  for (let i = 0; i < w.eAlive.length; i++) {
    if (w.eAlive[i] && w.eType[i] === ENEMY_TYPE.BOSS) {
      bossIndex = i;
      break;
    }
  }

  if (bossIndex === -1) return; // No boss active

  const bossHp = w.eHp[bossIndex] ?? 0;
  const bossHpMax = w.eHpMax[bossIndex] ?? 1;
  const hpRatio = Math.max(0, Math.min(1, bossHp / bossHpMax));

  // Smooth health bar animation (store previous ratio)
  const prevRatioKey = "_bossHpRatioDisplay";
  const prevRatio = (w as any)[prevRatioKey] ?? hpRatio;
  const displayRatio = prevRatio + (hpRatio - prevRatio) * 0.1; // Smooth lerp
  (w as any)[prevRatioKey] = displayRatio;

  const barWidth = Math.min(500, canvasW * 0.5);
  const barHeight = 28;
  const barX = (canvasW - barWidth) / 2;
  const barY = 50;

  ctx.save();

  // --- Dramatic background panel ---
  const panelPadding = 15;
  const panelGrad = ctx.createLinearGradient(barX - panelPadding, barY - 30, barX - panelPadding, barY + barHeight + 20);
  panelGrad.addColorStop(0, "rgba(0, 0, 0, 0.7)");
  panelGrad.addColorStop(0.5, "rgba(20, 10, 10, 0.8)");
  panelGrad.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  ctx.fillStyle = panelGrad;
  roundRect(ctx, barX - panelPadding, barY - 25, barWidth + panelPadding * 2, barHeight + 45, 8);
  ctx.fill();

  // Panel border
  ctx.strokeStyle = "rgba(139, 69, 69, 0.6)";
  ctx.lineWidth = 2;
  roundRect(ctx, barX - panelPadding, barY - 25, barWidth + panelPadding * 2, barHeight + 45, 8);
  ctx.stroke();

  // --- Boss name ---
  ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ff9966";
  ctx.fillText("⚔ BOSS ⚔", canvasW / 2, barY - 10);

  // --- Outer ornate frame ---
  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  roundRect(ctx, barX - 2, barY + 3, barWidth + 4, barHeight + 4, 4);
  ctx.fill();

  // Frame gradient (metallic look)
  const frameGrad = ctx.createLinearGradient(barX, barY - 4, barX, barY + barHeight + 4);
  frameGrad.addColorStop(0, "#2a1515");
  frameGrad.addColorStop(0.2, "#4a2020");
  frameGrad.addColorStop(0.5, "#3a1818");
  frameGrad.addColorStop(0.8, "#2a1010");
  frameGrad.addColorStop(1, "#1a0808");
  ctx.fillStyle = frameGrad;
  roundRect(ctx, barX - 4, barY - 4, barWidth + 8, barHeight + 8, 6);
  ctx.fill();

  // Inner metallic border
  ctx.strokeStyle = "#8b4545";
  ctx.lineWidth = 2;
  roundRect(ctx, barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
  ctx.stroke();

  // --- Bar background ---
  ctx.fillStyle = "#0d0505";
  roundRect(ctx, barX, barY, barWidth, barHeight, 3);
  ctx.fill();

  // --- Health fill ---
  if (displayRatio > 0) {
    const fillWidth = barWidth * displayRatio;

    ctx.save();
    roundRect(ctx, barX, barY, barWidth, barHeight, 3);
    ctx.clip();

    // Main health gradient (deep red, Diablo-style)
    const hpGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    hpGrad.addColorStop(0, "#ff3333");
    hpGrad.addColorStop(0.2, "#cc2222");
    hpGrad.addColorStop(0.5, "#aa1111");
    hpGrad.addColorStop(0.8, "#880808");
    hpGrad.addColorStop(1, "#660000");
    ctx.fillStyle = hpGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    // Animated pulse when low health
    if (hpRatio < 0.3) {
      const pulse = 0.1 + 0.1 * Math.sin((w.time ?? 0) * 8);
      ctx.fillStyle = `rgba(255, 100, 100, ${pulse})`;
      ctx.fillRect(barX, barY, fillWidth, barHeight);
    }

    // Top highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(barX, barY, fillWidth, barHeight * 0.3);

    // Inner glow at fill edge
    if (fillWidth > 5) {
      const glowX = barX + fillWidth;
      const edgeGlow = ctx.createRadialGradient(glowX, barY + barHeight / 2, 0, glowX, barY + barHeight / 2, 20);
      edgeGlow.addColorStop(0, "rgba(255, 100, 80, 0.5)");
      edgeGlow.addColorStop(1, "rgba(255, 50, 50, 0)");
      ctx.fillStyle = edgeGlow;
      ctx.fillRect(glowX - 20, barY, 40, barHeight);
    }

    ctx.restore();
  }

  // --- Damage flash effect (recent damage indicator) ---
  // Shows where health used to be vs current
  if (displayRatio < 1 && Math.abs(displayRatio - hpRatio) > 0.01) {
    const flashStart = barX + barWidth * displayRatio;
    const flashWidth = barWidth * (prevRatio - displayRatio);
    if (flashWidth > 0) {
      ctx.fillStyle = "rgba(255, 200, 150, 0.4)";
      ctx.fillRect(flashStart, barY, flashWidth, barHeight);
    }
  }

  // --- Skull decorations on sides ---
  ctx.font = "18px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#8b5555";
  ctx.fillText("💀", barX - 25, barY + barHeight / 2);
  ctx.fillText("💀", barX + barWidth + 25, barY + barHeight / 2);

  // --- HP percentage text ---
  ctx.font = "bold 13px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Text shadow
  ctx.fillStyle = "#000";
  ctx.fillText(`${Math.ceil(hpRatio * 100)}%`, canvasW / 2 + 1, barY + barHeight / 2 + 1);

  // Main text
  ctx.fillStyle = hpRatio < 0.3 ? "#ffaaaa" : "#ffffff";
  ctx.fillText(`${Math.ceil(hpRatio * 100)}%`, canvasW / 2, barY + barHeight / 2);

  // --- Outer glow effect for dramatic presence ---
  ctx.globalAlpha = 0.15 + 0.05 * Math.sin((w.time ?? 0) * 2);
  const outerGlow = ctx.createRadialGradient(canvasW / 2, barY + barHeight / 2, barWidth * 0.3, canvasW / 2, barY + barHeight / 2, barWidth * 0.7);
  outerGlow.addColorStop(0, "rgba(255, 50, 50, 0.3)");
  outerGlow.addColorStop(1, "rgba(255, 0, 0, 0)");
  ctx.fillStyle = outerGlow;
  ctx.fillRect(barX - 50, barY - 30, barWidth + 100, barHeight + 60);

  ctx.restore();
}

/**
 * Helper function to draw rounded rectangles.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}