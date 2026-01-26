// src/game/systems/render.ts
import { World } from "../world";
import { registry } from "../content/registry";

export function renderSystem(
    w: World,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
) {
  const ww = canvas.clientWidth;
  const hh = canvas.clientHeight;

  // Clear
  ctx.clearRect(0, 0, ww, hh);

  // Camera: center on player
  const cx = ww * 0.5 - w.px;
  const cy = hh * 0.5 - w.py;

  // Background
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0b0b0f";
  ctx.fillRect(0, 0, ww, hh);

  // Subtle grid
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

  // Enemies (color from registry if present; fallback by type)
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


  // Projectiles (source mapping from registry; stable as you add more kinds)
  for (let i = 0; i < w.pAlive.length; i++) {
    if (!w.pAlive[i]) continue;

    const x = w.prx[i] + cx;
    const y = w.pry[i] + cy;

    // Melee projectiles render as a forward-facing slash wedge
    if (w.prIsmelee[i]) {
      const baseAng = Math.atan2(w.prDirY[i], w.prDirX[i]);
      const half = (w.prCone[i] ?? Math.PI / 6) * 0.5; // must stay in sync with hitDetection cone
      const r = w.prMeleeRange?.[i] ?? w.prR[i];

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(baseAng);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -half, half);
      ctx.closePath();
      ctx.fillStyle = "rgba(250, 180, 255, 0.35)";
      ctx.strokeStyle = "#f5b";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      continue;
    }

    // Ranged projectiles: simple circles
    const src = registry.projectileSourceFromKind(w.prjKind[i]);
    ctx.fillStyle = src === "KNIFE" ? "#fff" : src === "PISTOL" ? "#9f9" : "#bbb";
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
