import type { World } from "../../engine/world/world";
import type { ZoneObjective } from "../objectives/zoneObjectiveTypes";

type ToScreenFn = (wx: number, wy: number) => { x: number; y: number };

function drawTileOverlay(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreenFn,
  tileX: number,
  tileY: number,
  tileWorld: number,
  completed: boolean,
): void {
  const p0 = toScreen(tileX * tileWorld, tileY * tileWorld);
  const p1 = toScreen((tileX + 1) * tileWorld, tileY * tileWorld);
  const p2 = toScreen((tileX + 1) * tileWorld, (tileY + 1) * tileWorld);
  const p3 = toScreen(tileX * tileWorld, (tileY + 1) * tileWorld);

  ctx.fillStyle = completed ? "rgba(60, 255, 60, 0.15)" : "rgba(255, 60, 60, 0.20)";
  ctx.strokeStyle = completed ? "rgba(60, 255, 60, 0.8)" : "rgba(255, 60, 60, 0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawZoneBounds(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreenFn,
  zone: ZoneObjective,
  tileWorld: number,
): void {
  const p0 = toScreen(zone.tileX * tileWorld, zone.tileY * tileWorld);
  const p1 = toScreen((zone.tileX + zone.tileW) * tileWorld, zone.tileY * tileWorld);
  const p2 = toScreen((zone.tileX + zone.tileW) * tileWorld, (zone.tileY + zone.tileH) * tileWorld);
  const p3 = toScreen(zone.tileX * tileWorld, (zone.tileY + zone.tileH) * tileWorld);

  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.stroke();
}

type RenderZoneObjectivesArgs = {
  zone: ZoneObjective;
  mapOriginTx: number;
  mapOriginTy: number;
  tileWorld: number;
  toScreen: ToScreenFn;
  showZoneBounds: boolean;
};

export function renderZoneObjectives(
  ctx: CanvasRenderingContext2D,
  _world: World,
  args: RenderZoneObjectivesArgs,
): void {
  const { zone, mapOriginTx, mapOriginTy, tileWorld, toScreen, showZoneBounds } = args;

  const absZoneX = mapOriginTx + zone.tileX;
  const absZoneY = mapOriginTy + zone.tileY;

  for (let dy = 0; dy < zone.tileH; dy++) {
    for (let dx = 0; dx < zone.tileW; dx++) {
      drawTileOverlay(
        ctx,
        toScreen,
        absZoneX + dx,
        absZoneY + dy,
        tileWorld,
        zone.completed,
      );
    }
  }

  if (showZoneBounds) {
    drawZoneBounds(
      ctx,
      toScreen,
      { ...zone, tileX: absZoneX, tileY: absZoneY },
      tileWorld,
    );
  }

  const centerWx = (absZoneX + zone.tileW * 0.5) * tileWorld;
  const centerWy = (absZoneY + zone.tileH * 0.5) * tileWorld;
  const center = toScreen(centerWx, centerWy);
  const label = `${zone.killCount} / ${zone.killTarget}`;

  ctx.save();
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.strokeText(label, center.x, center.y);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, center.x, center.y);
  ctx.restore();
}
