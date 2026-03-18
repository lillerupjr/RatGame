import type { CompiledKenneyMap } from "../../map/compile/kenneyMap";
import { getSupportSurfaceAt } from "../../map/compile/kenneyMap";
import {
  DEFAULT_SHADOW_SUN_V1_TIME_HOUR,
  getShadowSunV1Model,
  type ShadowSunV1Model,
} from "../../../shadowSunV1";

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

const DEFAULT_SUN_MODEL = getShadowSunV1Model(DEFAULT_SHADOW_SUN_V1_TIME_HOUR);
const SHADOW_DIR_X = DEFAULT_SUN_MODEL.projectionDirection.x;
const SHADOW_DIR_Y = DEFAULT_SUN_MODEL.projectionDirection.y;
const SHADOW_FADE_HEIGHT = 4;
const SHADOW_FOOT_OFFSET_X = 0;
const SHADOW_FOOT_OFFSET_Y = 0;

export type ShadowSunModel = ShadowSunV1Model;

export function getShadowSunModel(timeHour: number = DEFAULT_SHADOW_SUN_V1_TIME_HOUR): ShadowSunModel {
  return getShadowSunV1Model(timeHour);
}

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
  projectionDirection?: { x: number; y: number },
): void {
  if (params.castsShadow === false) return;
  const { shadowX, shadowY, radiusX, radiusY, alpha } = computeShadowGeometry(params, compiledMap, projectionDirection);
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

function resolveProjectionDirection(
  projectionDirection: { x: number; y: number } | undefined,
): { x: number; y: number } {
  const x = Number(projectionDirection?.x);
  const y = Number(projectionDirection?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return {
      x: SHADOW_DIR_X,
      y: SHADOW_DIR_Y,
    };
  }
  return { x, y };
}

function computeShadowGeometry(
  params: ShadowParams,
  compiledMap: CompiledKenneyMap,
  projectionDirection: { x: number; y: number } | undefined,
) {
  const support = getSupportSurfaceAt(params.worldX, params.worldY, compiledMap, params.worldZ);
  const hoverZ = Math.max(0, params.worldZ - support.worldZ);
  const t = clamp(hoverZ / SHADOW_FADE_HEIGHT, 0, 1);
  const projection = resolveProjectionDirection(projectionDirection);

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
    hoverZ * projection.x +
    footOffsetX;
  const shadowY =
    support.screenY +
    (params.screenOffsetY ?? 0) +
    hoverZ * projection.y +
    (params.shadowOffsetPx ?? 2) +
    footOffsetY;

  return { shadowX, shadowY, radiusX, radiusY, alpha };
}
