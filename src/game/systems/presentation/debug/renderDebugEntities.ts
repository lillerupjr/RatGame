import {
  drawEnemyAimOverlayForVisibleEnemies,
  drawLootGoblinOverlay,
  type DebugOverlayContext,
} from "../../../../engine/render/debug/renderDebug";
import type { RenderDebugFlags } from "./debugRenderTypes";

export function drawEntityAnchorOverlay(
  ctx: CanvasRenderingContext2D,
  show: boolean,
  feetX: number,
  feetY: number,
  drawX: number,
  drawY: number,
  drawW: number,
  drawH: number,
): void {
  if (!show) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 80, 80, 0.95)";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(drawX), Math.round(drawY), Math.round(drawW), Math.round(drawH));
  ctx.strokeStyle = "rgba(80, 255, 220, 0.95)";
  ctx.beginPath();
  ctx.moveTo(Math.round(feetX - 4), Math.round(feetY));
  ctx.lineTo(Math.round(feetX + 4), Math.round(feetY));
  ctx.moveTo(Math.round(feetX), Math.round(feetY - 4));
  ctx.lineTo(Math.round(feetX), Math.round(feetY + 4));
  ctx.stroke();
  ctx.restore();
}

export function renderDebugEntityOverlays(
  debugContext: DebugOverlayContext,
  flags: RenderDebugFlags,
  isTileInRenderRadius: (tx: number, ty: number) => boolean,
): void {
  drawEnemyAimOverlayForVisibleEnemies(debugContext, flags.showEnemyAimOverlay, isTileInRenderRadius);
  drawLootGoblinOverlay(debugContext, flags.showLootGoblinOverlay);
}
