import type { CompiledKenneyMap } from "../../map/compile/kenneyMap";
import { getSupportSurfaceAt } from "../../map/compile/kenneyMap";

export interface Entity {
  worldX: number;
  worldY: number;
  worldZ: number;
  spriteWidth: number;
  shadowRadiusX?: number;
  shadowRadiusY?: number;
  castsShadow?: boolean;
  screenOffsetX?: number;
  screenOffsetY?: number;
  shadowOffsetPx?: number;
  shadowFootOffsetX?: number;
  shadowFootOffsetY?: number;
}

const SHADOW_DIR_X = -0.6;
const SHADOW_DIR_Y = 0.8;
const SHADOW_FADE_HEIGHT = 4;
const SHADOW_FOOT_OFFSET_X = 0;
const SHADOW_FOOT_OFFSET_Y = 0;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function renderEntityShadow(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  compiledMap: CompiledKenneyMap,
): void {
  if (entity.castsShadow === false) return;

  const support = getSupportSurfaceAt(entity.worldX, entity.worldY, compiledMap);
  const hoverZ = Math.max(0, entity.worldZ - support.worldZ);
  const t = clamp(hoverZ / SHADOW_FADE_HEIGHT, 0, 1);

  const baseRadiusX = entity.shadowRadiusX ?? Math.max(6, entity.spriteWidth * 0.18);
  const baseRadiusY = entity.shadowRadiusY ?? Math.max(3, entity.spriteWidth * 0.1);

  const rawRadiusX = baseRadiusX * lerp(1.0, 0.65, t);
  const rawRadiusY = baseRadiusY * lerp(1.0, 0.65, t);
  const radiusY = rawRadiusY;
  const radiusX = Math.max(rawRadiusX, radiusY + 0.01);
  const alpha = lerp(0.35, 0.12, t);

  const footOffsetX = entity.shadowFootOffsetX ?? SHADOW_FOOT_OFFSET_X;
  const footOffsetY = entity.shadowFootOffsetY ?? SHADOW_FOOT_OFFSET_Y;

  const shadowX =
    support.screenX +
    (entity.screenOffsetX ?? 0) +
    hoverZ * SHADOW_DIR_X +
    footOffsetX;
  const shadowY =
    support.screenY +
    (entity.screenOffsetY ?? 0) +
    hoverZ * SHADOW_DIR_Y +
    (entity.shadowOffsetPx ?? 2) +
    footOffsetY;

  ctx.save();
  ctx.translate(shadowX, shadowY);
  ctx.scale(radiusX, radiusY);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0.0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.5, `rgba(0,0,0,${alpha})`);
  g.addColorStop(1.0, `rgba(0,0,0,0)`);

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
