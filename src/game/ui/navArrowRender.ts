import type { NavArrowTarget } from "./navArrowTarget";

export interface ViewportInfo {
  w: number;
  h: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export function isOnScreen(pt: ScreenPoint, vp: ViewportInfo, padPx = 28): boolean {
  return pt.x >= padPx && pt.x <= vp.w - padPx && pt.y >= padPx && pt.y <= vp.h - padPx;
}

export function clampArrowToViewportEdge(
  targetScreen: ScreenPoint,
  vp: ViewportInfo,
  padPx = 28
): { x: number; y: number; angleRad: number } {
  const cx = vp.w * 0.5;
  const cy = vp.h * 0.5;

  const dx = targetScreen.x - cx;
  const dy = targetScreen.y - cy;

  const angle = Math.atan2(dy, dx);

  const minX = padPx;
  const maxX = vp.w - padPx;
  const minY = padPx;
  const maxY = vp.h - padPx;

  const ax = Math.abs(dx) < 1e-6 ? (dx >= 0 ? 1e-6 : -1e-6) : dx;
  const ay = Math.abs(dy) < 1e-6 ? (dy >= 0 ? 1e-6 : -1e-6) : dy;

  const tX = ax > 0 ? (maxX - cx) / ax : (minX - cx) / ax;
  const tY = ay > 0 ? (maxY - cy) / ay : (minY - cy) / ay;

  const t = Math.min(Math.abs(tX), Math.abs(tY));

  const x = cx + dx * t;
  const y = cy + dy * t;

  return { x, y, angleRad: angle };
}

export function drawNavArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angleRad: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  const len = 22;
  const halfW = 10;

  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(-len * 0.6, -halfW);
  ctx.lineTo(-len * 0.6, halfW);
  ctx.closePath();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.stroke();

  ctx.fillStyle = "rgba(240,240,240,0.95)";
  ctx.fill();

  ctx.restore();
}

export function renderNavArrow(
  ctx: CanvasRenderingContext2D,
  target: NavArrowTarget,
  vp: ViewportInfo,
  worldToScreen: (wx: number, wy: number) => ScreenPoint
): void {
  if (!target) return;

  const sp = worldToScreen(target.worldX, target.worldY);
  if (isOnScreen(sp, vp, 28)) return;

  const a = clampArrowToViewportEdge(sp, vp, 28);
  drawNavArrow(ctx, a.x, a.y, a.angleRad);
}
