import type { CompiledKenneyMap } from "../../map/compile/kenneyMap";
import { getSupportSurfaceAt } from "../../map/compile/kenneyMap";

export interface ShadowParams {
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

export type Entity = ShadowParams;

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
  params: ShadowParams,
  compiledMap: CompiledKenneyMap,
): void {
  if (params.castsShadow === false) return;
  const { shadowX, shadowY, radiusX, radiusY, alpha } = computeShadowGeometry(params, compiledMap);
  ctx.save();
  ctx.translate(shadowX, shadowY);
  ctx.scale(radiusX, radiusY);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0.0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.5, `rgba(0,0,0,${alpha})`);
  g.addColorStop(1.0, "rgba(0,0,0,0)");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function renderEntityShadowMask(
  ctx: CanvasRenderingContext2D,
  params: ShadowParams,
  compiledMap: CompiledKenneyMap,
): void {
  if (params.castsShadow === false) return;
  const { shadowX, shadowY, radiusX, radiusY } = computeShadowGeometry(params, compiledMap);

  ctx.save();
  ctx.translate(shadowX, shadowY);
  ctx.scale(radiusX, radiusY);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function computeShadowGeometry(params: ShadowParams, compiledMap: CompiledKenneyMap) {
  const support = getSupportSurfaceAt(params.worldX, params.worldY, compiledMap, params.worldZ);
  const hoverZ = Math.max(0, params.worldZ - support.worldZ);
  const t = clamp(hoverZ / SHADOW_FADE_HEIGHT, 0, 1);

  const baseRadiusX = params.shadowRadiusX ?? Math.max(6, params.spriteWidth * 0.18);
  const baseRadiusY = params.shadowRadiusY ?? Math.max(3, params.spriteWidth * 0.1);

  const rawRadiusX = baseRadiusX * lerp(1.0, 0.65, t);
  const rawRadiusY = baseRadiusY * lerp(1.0, 0.65, t);
  const radiusY = rawRadiusY;
  const radiusX = Math.max(rawRadiusX, radiusY + 0.01);
  const alpha = lerp(0.35, 0.12, t);

  const footOffsetX = params.shadowFootOffsetX ?? SHADOW_FOOT_OFFSET_X;
  const footOffsetY = params.shadowFootOffsetY ?? SHADOW_FOOT_OFFSET_Y;

  const shadowX =
    support.screenX +
    (params.screenOffsetX ?? 0) +
    hoverZ * SHADOW_DIR_X +
    footOffsetX;
  const shadowY =
    support.screenY +
    (params.screenOffsetY ?? 0) +
    hoverZ * SHADOW_DIR_Y +
    (params.shadowOffsetPx ?? 2) +
    footOffsetY;

  return { shadowX, shadowY, radiusX, radiusY, alpha };
}
