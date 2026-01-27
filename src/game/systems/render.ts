// src/game/systems/render.ts
import type { World } from "../world";
import { registry } from "../content/registry";
import {ZONE_KIND} from "../factories/zoneFactory";

export function renderSystem(
    w: World,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
) {
  const ww = canvas.clientWidth;
  const hh = canvas.clientHeight;

  ctx.clearRect(0, 0, ww, hh);

  const cx = ww * 0.5 - w.px;
  const cy = hh * 0.5 - w.py;

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0b0b0f";
  ctx.fillRect(0, 0, ww, hh);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;

  const cell = 64;
  const startX = ((-cx) / cell) | 0;
  const startY = ((-cy) / cell) | 0;

  const gridStartX = startX * cell - cell * 2;
  const gridStartY = startY * cell - cell * 2;

  for (let x = gridStartX; x < -cx + ww + cell * 2; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x + cx, 0);
    ctx.lineTo(x + cx, hh);
    ctx.stroke();
  }
  for (let y = gridStartY; y < -cy + hh + cell * 2; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y + cy);
    ctx.lineTo(ww, y + cy);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // Zones (auras / ground effects / visuals)
  for (let i = 0; i < w.zAlive.length; i++) {
    if (!w.zAlive[i]) continue;

    const x = w.zx[i] + cx;
    const y = w.zy[i] + cy;
    const r = w.zR[i];

    const kind = w.zKind[i];

    if (kind === ZONE_KIND.EXPLOSION) {
      // Purple explosion ring (clarity > style for now)
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = "#a855f7"; // clear purple
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Optional inner glow
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      continue;
    }

    if (kind === 4 /* TELEGRAPH */) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (kind === 5 /* HAZARD */) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#f66";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#f66";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Existing zone rendering (AURA / FIRE)
    ctx.globalAlpha = kind === ZONE_KIND.FIRE ? 0.18 : 0.12;
    ctx.fillStyle = kind === ZONE_KIND.FIRE ? "#ffb347" : "#7dd3fc";

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

// Pickups (XP + Boss Chest)
  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;

    const x = w.xx[i] + cx;
    const y = w.xy[i] + cy;
    const kind = (w as any).xKind?.[i] ?? 1;

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

  // Enemies
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const x = w.ex[i] + cx;
    const y = w.ey[i] + cy;

    const def = registry.enemy(w.eType[i]);
    const baseColor =
        def.color ??
        (w.eType[i] === 3 ? "#f8b" : w.eType[i] === 2 ? "#fb8" : "#f66");

    // Base enemy body
    ctx.globalAlpha = 1;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(x, y, w.eR[i], 0, Math.PI * 2);
    ctx.fill();

    // Poison tint overlay (easy to spot)
    // Requires: w.ePoisonT[] exists and is kept > 0 while poisoned
    const poisonT = (w as any).ePoisonT?.[i] ?? 0;
    if (poisonT > 0) {
      // Strong but readable tint — keeps silhouette and base color visible
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = "#37ff6b";
      ctx.beginPath();
      ctx.arc(x, y, w.eR[i] * 0.92, 0, Math.PI * 2);
      ctx.fill();

      // Optional: subtle ring to really pop
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#37ff6b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, w.eR[i] * 1.06, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }


  // Projectiles
  for (let i = 0; i < w.pAlive.length; i++) {
    if (!w.pAlive[i]) continue;

    const x = w.prx[i] + cx;
    const y = w.pry[i] + cy;

    const src = registry.projectileSourceFromKind(w.prjKind[i]);
    ctx.fillStyle =
        src === "KNIFE" ? "#fff"
            : src === "PISTOL" ? "#9f9"
                : src === "KNUCKLES" ? "#fc6"
                    : "#bbb";

    ctx.beginPath();
    ctx.arc(x, y, w.prR[i], 0, Math.PI * 2);
    ctx.fill();
  }

  // Player
  ctx.fillStyle = "#eaeaf2";
  ctx.beginPath();
  ctx.arc(ww * 0.5, hh * 0.5, 14, 0, Math.PI * 2);
  ctx.fill();
}
