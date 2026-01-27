// src/game/systems/render.ts
import type { World } from "../world";
import { registry } from "../content/registry";

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

  // Zones (auras / ground effects)
  for (let i = 0; i < w.zAlive.length; i++) {
    if (!w.zAlive[i]) continue;

    const x = w.zx[i] + cx;
    const y = w.zy[i] + cy;

    // Simple styling by kind
    const kind = w.zKind[i];
    ctx.globalAlpha = kind === 2 ? 0.18 : 0.12; // FIRE a bit stronger than AURA
    ctx.fillStyle = kind === 2 ? "#ffb347" : "#7dd3fc"; // orange vs cyan

    ctx.beginPath();
    ctx.arc(x, y, w.zR[i], 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // XP gems
  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;
    const x = w.xx[i] + cx;
    const y = w.xy[i] + cy;
    ctx.fillStyle = "#8bf";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemies
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const x = w.ex[i] + cx;
    const y = w.ey[i] + cy;

    const def = registry.enemy(w.eType[i]);
    ctx.fillStyle =
        def.color ??
        (w.eType[i] === 3 ? "#f8b" : w.eType[i] === 2 ? "#fb8" : "#f66");

    ctx.beginPath();
    ctx.arc(x, y, w.eR[i], 0, Math.PI * 2);
    ctx.fill();
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
