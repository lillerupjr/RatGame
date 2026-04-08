import { gridAtPlayer, type World } from "../../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { getPlayerWorld } from "../../../coords/worldViews";
import { decalsInView, roadAreaWidthAt } from "../../../map/compile/kenneyMap";
import {
  drawOccluderOverlay,
  drawProjectileFaceOverlay,
  drawRampOverlay,
  drawRoadSemanticOverlay,
  drawStructureHeightOverlay,
  drawTileHeightMapOverlay,
  drawTriggerOverlay,
  drawWalkMaskOverlay,
} from "../../../../engine/render/debug/renderDebug";
import type { RenderDebugWorldPassInput } from "./debugRenderTypes";

export function renderDebugWorldOverlays(input: RenderDebugWorldPassInput): void {
  const {
    ctx,
    debugContext,
    viewRect,
    toScreen,
    tileWorld,
    isTileInRenderRadius,
    flags,
  } = input;

  drawWalkMaskOverlay(debugContext, flags.showWalkMask);
  drawRampOverlay(debugContext, flags.showRamps);
  drawOccluderOverlay(debugContext, flags.showOccluders, viewRect);

  if (flags.showDecals) {
    const decals = decalsInView(viewRect);
    if (decals.length > 0) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.font = "10px monospace";
      for (let i = 0; i < decals.length; i++) {
        const d = decals[i];
        if (!isTileInRenderRadius(d.tx, d.ty)) continue;
        const p0 = toScreen(d.tx * tileWorld, d.ty * tileWorld);
        const p1 = toScreen((d.tx + 1) * tileWorld, d.ty * tileWorld);
        const p2 = toScreen((d.tx + 1) * tileWorld, (d.ty + 1) * tileWorld);
        const p3 = toScreen(d.tx * tileWorld, (d.ty + 1) * tileWorld);
        const color = d.setId === "sidewalk" ? "rgba(40,220,255,0.95)" : "rgba(255,170,40,0.95)";
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(d.setId, p0.x + 4, p0.y + 10);
      }
      ctx.restore();
    }
  }

  drawProjectileFaceOverlay(debugContext, flags.showProjectileFaces, viewRect);
  drawStructureHeightOverlay(debugContext, flags.showStructureHeights, viewRect);
  drawTileHeightMapOverlay(debugContext, flags.showTileHeightMap, viewRect);
  drawTriggerOverlay(debugContext, flags.showTriggers);
  drawRoadSemanticOverlay(debugContext, flags.showRoadSemantic, viewRect);
}

export function renderTileGridCompass(w: World, ctx: CanvasRenderingContext2D, ww: number, hh: number): void {
  const enabled = ((w as any).tileCompassEnabled ?? true) as boolean;
  if (!enabled) return;

  const pad = 12;
  const size = 120;

  const x0 = Math.round(ww * 0.5 - size * 0.5);
  const y0 = pad;

  const cx = x0 + size * 0.5;
  const cy = y0 + size * 0.5;

  const radius = size * 0.36;

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#111";
  ctx.fillRect(x0, y0, size, size);

  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, size, size);

  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  const drawArrow = (dx: number, dy: number, label: string) => {
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const x1 = cx + ux * radius;
    const y1 = cy + uy * radius;

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    const headL = 10;
    const headW = 6;
    const px = -uy;
    const py = ux;
    const hx0 = x1 - ux * headL;
    const hy0 = y1 - uy * headL;
    const hxL = hx0 + px * headW;
    const hyL = hy0 + py * headW;
    const hxR = hx0 - px * headW;
    const hyR = hy0 - py * headW;

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(hxL, hyL);
    ctx.lineTo(hxR, hyR);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx + ux * (radius + 18), cy + uy * (radius + 18));
  };

  drawArrow(+1, -1, "N");
  drawArrow(+1, +1, "E");
  drawArrow(-1, +1, "S");
  drawArrow(-1, -1, "W");

  const g = gridAtPlayer(w);
  const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const ptx = Math.floor(pWorld.wx / KENNEY_TILE_WORLD);
  const pty = Math.floor(pWorld.wy / KENNEY_TILE_WORLD);
  const roadW = roadAreaWidthAt(ptx, pty);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`gx:${g.gx.toFixed(2)} gy:${g.gy.toFixed(2)}`, x0 + 8, y0 + size - 8);
  ctx.fillText(`roadW:${roadW}`, x0 + 8, y0 + size - 20);

  ctx.restore();
}
