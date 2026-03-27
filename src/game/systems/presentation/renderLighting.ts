import { configurePixelPerfect } from "../../../engine/render/pixelPerfect";
import { setRenderPerfDrawTag, type DrawTag } from "./renderPerfCounters";

export type ProjectedLight = {
  sx: number;
  sy: number;
  poolSy?: number;
  lightZ?: number;
  intensity: number;
  occlusion: number;
  radiusPx: number;
  shape: "RADIAL" | "STREET_LAMP";
  color: string;
  tintStrength: number;
  flicker: { kind: "NONE" } | { kind: "NOISE"; speed?: number; amount?: number } | { kind: "PULSE"; speed?: number; amount?: number };
  flickerPhase: number;
  pool?: { radiusPx: number; yScale: number };
  cone?: { dirRad: number; angleRad: number; lengthPx: number };
};

type AmbientLightingState = {
  darknessAlpha: number;
  ambientTint?: string;
  ambientTintStrength?: number;
};

function withPerfDrawTag<T>(tag: DrawTag, draw: () => T): T {
  setRenderPerfDrawTag(tag);
  try {
    return draw();
  } finally {
    setRenderPerfDrawTag(null);
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clampGroundYScale(v: number | undefined): number {
  if (!Number.isFinite(v)) return 0.65;
  return Math.max(0.1, Math.min(1, v!));
}

export function resolveLightingGroundYScale(v: number | undefined): number {
  return clampGroundYScale(v);
}

export function resolveAdditionalDarknessAlphaForMax(
  castShadowAlpha: number,
  ambientDarknessAlpha: number,
): number {
  const cast = clamp01(castShadowAlpha);
  const ambient = clamp01(ambientDarknessAlpha);
  if (cast <= ambient) return 0;
  if (ambient >= 1) return 0;
  return clamp01((cast - ambient) / (1 - ambient));
}

function hexToRgba(hex: string, alpha: number): string {
  const a = clamp01(alpha);
  const normalized = hex.trim().replace(/^#/, "");
  const valid = /^[0-9a-fA-F]+$/.test(normalized);
  if (!valid || (normalized.length !== 3 && normalized.length !== 6)) {
    return `rgba(255,255,255,${a})`;
  }
  const full = normalized.length === 3
    ? `${normalized[0]}${normalized[0]}${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}`
    : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ============================================
// Perf: Quantized RGBA + Gradient caches
// ============================================

const RGBA_CACHE = new Map<string, string>();

// Prebaked cutout sprites remove per-frame gradient construction in cutout passes.
const RADIAL_CUTOUT_SPRITE_SIZE = 256;
const CONE_CUTOUT_BASE_LENGTH_PX = 256;
let radialCutoutSprite: HTMLCanvasElement | null = null;
const CONE_CUTOUT_SPRITE_CACHE = new Map<string, HTMLCanvasElement>();
const RADIAL_TINT_SPRITE_SIZE = 256;
const CONE_TINT_BASE_LENGTH_PX = 256;
const RADIAL_TINT_SPRITE_CACHE = new Map<string, HTMLCanvasElement>();
const CONE_TINT_SPRITE_CACHE = new Map<string, HTMLCanvasElement>();
type StreetLampCompositeSprite = { canvas: HTMLCanvasElement; ox: number; oy: number };
const STREET_LAMP_CUTOUT_COMPOSITE_CACHE = new Map<string, StreetLampCompositeSprite>();
const STREET_LAMP_TINT_COMPOSITE_CACHE = new Map<string, StreetLampCompositeSprite>();

function q(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function qAlpha(a: number): number {
  // 32 steps is a good tradeoff: stable cache hits, tiny visual quantization.
  return Math.round(a * 32) / 32;
}

function rgbaCached(hex: string, alpha: number): string {
  const a = qAlpha(alpha);
  const key = `${hex}|${a}`;
  const hit = RGBA_CACHE.get(key);
  if (hit) return hit;
  const v = hexToRgba(hex, a);
  RGBA_CACHE.set(key, v);
  return v;
}

// Simple bounded cache to avoid unbounded growth.
function cacheSetBounded<T>(m: Map<string, T>, key: string, value: T, maxEntries: number): void {
  if (m.size >= maxEntries) {
    // FIFO-ish eviction: delete first inserted key
    const firstKey = m.keys().next().value as string | undefined;
    if (firstKey) m.delete(firstKey);
  }
  m.set(key, value);
}

function getRadialCutoutSprite(): HTMLCanvasElement {
  if (radialCutoutSprite) return radialCutoutSprite;
  return withPerfDrawTag("lighting", () => {
    const c = document.createElement("canvas");
    c.width = RADIAL_CUTOUT_SPRITE_SIZE;
    c.height = RADIAL_CUTOUT_SPRITE_SIZE;
    const g = c.getContext("2d");
    if (!g) throw new Error("radial cutout sprite: no 2d ctx");
    configurePixelPerfect(g);
    const r = RADIAL_CUTOUT_SPRITE_SIZE * 0.5;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.clearRect(0, 0, RADIAL_CUTOUT_SPRITE_SIZE, RADIAL_CUTOUT_SPRITE_SIZE);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
    radialCutoutSprite = c;
    return c;
  });
}

function getStreetLampConeCutoutSprite(angleRad: number): HTMLCanvasElement {
  const angQ = Math.max(0.1, Math.min(1.6, q(angleRad, 0.05)));
  const key = `cone|${angQ}`;
  const hit = CONE_CUTOUT_SPRITE_CACHE.get(key);
  if (hit) return hit;

  const len = CONE_CUTOUT_BASE_LENGTH_PX;
  const halfW = Math.max(1, Math.round(Math.tan(angQ * 0.5) * len));
  const h = Math.max(8, halfW * 2);

  return withPerfDrawTag("lighting", () => {
    const c = document.createElement("canvas");
    c.width = len;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) throw new Error("cone cutout sprite: no 2d ctx");
    configurePixelPerfect(g);
    g.clearRect(0, 0, len, h);

    const grad = g.createLinearGradient(0, h * 0.5, len, h * 0.5);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.18, "rgba(0,0,0,0.85)");
    grad.addColorStop(0.45, "rgba(0,0,0,0.28)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, len, h);

    g.globalCompositeOperation = "destination-in";
    g.beginPath();
    g.moveTo(0, h * 0.5);
    g.lineTo(len, 0);
    g.lineTo(len, h);
    g.closePath();
    g.fillStyle = "#000";
    g.fill();
    g.globalCompositeOperation = "source-over";

    if (CONE_CUTOUT_SPRITE_CACHE.size >= 64) {
      const firstKey = CONE_CUTOUT_SPRITE_CACHE.keys().next().value as string | undefined;
      if (firstKey) CONE_CUTOUT_SPRITE_CACHE.delete(firstKey);
    }
    CONE_CUTOUT_SPRITE_CACHE.set(key, c);
    return c;
  });
}

function normalizeColorKey(color: string): string {
  return color.trim().toLowerCase();
}

function getRadialTintSprite(color: string): HTMLCanvasElement {
  const colorKey = normalizeColorKey(color);
  const key = `radTint|${colorKey}`;
  const hit = RADIAL_TINT_SPRITE_CACHE.get(key);
  if (hit) return hit;

  return withPerfDrawTag("lighting", () => {
    const c = document.createElement("canvas");
    c.width = RADIAL_TINT_SPRITE_SIZE;
    c.height = RADIAL_TINT_SPRITE_SIZE;
    const g = c.getContext("2d");
    if (!g) throw new Error("radial tint sprite: no 2d ctx");
    configurePixelPerfect(g);
    const r = RADIAL_TINT_SPRITE_SIZE * 0.5;
    const stop0 = colorKey.startsWith("#") ? rgbaCached(colorKey, 1) : color;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, stop0);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.clearRect(0, 0, RADIAL_TINT_SPRITE_SIZE, RADIAL_TINT_SPRITE_SIZE);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();

    cacheSetBounded(RADIAL_TINT_SPRITE_CACHE, key, c, 128);
    return c;
  });
}

function getStreetLampConeTintSprite(color: string, angleRad: number): HTMLCanvasElement {
  const colorKey = normalizeColorKey(color);
  const angQ = Math.max(0.1, Math.min(1.6, q(angleRad, 0.05)));
  const key = `coneTint|${colorKey}|${angQ}`;
  const hit = CONE_TINT_SPRITE_CACHE.get(key);
  if (hit) return hit;

  const len = CONE_TINT_BASE_LENGTH_PX;
  const halfW = Math.max(1, Math.round(Math.tan(angQ * 0.5) * len));
  const h = Math.max(8, halfW * 2);
  return withPerfDrawTag("lighting", () => {
    const c = document.createElement("canvas");
    c.width = len;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) throw new Error("cone tint sprite: no 2d ctx");
    configurePixelPerfect(g);
    g.clearRect(0, 0, len, h);

    const c0 = colorKey.startsWith("#") ? rgbaCached(colorKey, 0) : color;
    const c18 = colorKey.startsWith("#") ? rgbaCached(colorKey, 0.24) : color;
    const c45 = colorKey.startsWith("#") ? rgbaCached(colorKey, 0.07) : color;
    const grad = g.createLinearGradient(0, h * 0.5, len, h * 0.5);
    grad.addColorStop(0, c0);
    grad.addColorStop(0.18, c18);
    grad.addColorStop(0.45, c45);
    grad.addColorStop(1, c0);
    g.fillStyle = grad;
    g.fillRect(0, 0, len, h);

    g.globalCompositeOperation = "destination-in";
    g.beginPath();
    g.moveTo(0, h * 0.5);
    g.lineTo(len, 0);
    g.lineTo(len, h);
    g.closePath();
    g.fillStyle = "#000";
    g.fill();
    g.globalCompositeOperation = "source-over";

    cacheSetBounded(CONE_TINT_SPRITE_CACHE, key, c, 256);
    return c;
  });
}

function coneBounds(
  len: number,
  h: number,
  dirRad: number,
  groundYScale: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const cos = Math.cos(dirRad);
  const sin = Math.sin(dirRad);
  const hh = h * 0.5;
  const corners: Array<[number, number]> = [
    [0, -hh],
    [0, hh],
    [len, -hh],
    [len, hh],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < corners.length; i++) {
    const x = corners[i][0];
    const y = corners[i][1];
    const tx = cos * x - sin * y;
    const ty = sin * groundYScale * x + cos * groundYScale * y;
    if (tx < minX) minX = tx;
    if (tx > maxX) maxX = tx;
    if (ty < minY) minY = ty;
    if (ty > maxY) maxY = ty;
  }
  return { minX, minY, maxX, maxY };
}

function buildStreetLampCompositeSprite(
  radialSprite: HTMLCanvasElement,
  coneSprite: HTMLCanvasElement,
  poolR: number,
  poolH: number,
  poolDy: number,
  coneLen: number,
  coneH: number,
  dirRad: number,
  groundYScale: number,
): StreetLampCompositeSprite {
  const cone = coneBounds(coneLen, coneH, dirRad, groundYScale);
  const poolMinX = -poolR;
  const poolMaxX = poolR;
  const poolMinY = poolDy - poolH * 0.5;
  const poolMaxY = poolDy + poolH * 0.5;
  const minX = Math.min(poolMinX, cone.minX);
  const maxX = Math.max(poolMaxX, cone.maxX);
  const minY = Math.min(poolMinY, cone.minY);
  const maxY = Math.max(poolMaxY, cone.maxY);
  const pad = 2;
  const ox = Math.ceil(-minX) + pad;
  const oy = Math.ceil(-minY) + pad;
  const w = Math.max(1, Math.ceil(maxX - minX) + pad * 2);
  const h = Math.max(1, Math.ceil(maxY - minY) + pad * 2);

  return withPerfDrawTag("lighting", () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) throw new Error("street lamp composite: no 2d ctx");
    configurePixelPerfect(g);

    g.drawImage(radialSprite, ox - poolR, oy + poolDy - poolH * 0.5, poolR * 2, poolH);
    const cos = Math.cos(dirRad);
    const sin = Math.sin(dirRad);
    g.setTransform(cos, sin * groundYScale, -sin, cos * groundYScale, ox, oy);
    g.drawImage(coneSprite, 0, -coneH * 0.5, coneLen, coneH);
    g.setTransform(1, 0, 0, 1, 0, 0);

    return { canvas: c, ox, oy };
  });
}

function getStreetLampCutoutCompositeSprite(
  poolR: number,
  poolH: number,
  poolDy: number,
  coneLen: number,
  coneH: number,
  angleRad: number,
  dirRad: number,
  groundYScale: number,
): StreetLampCompositeSprite {
  const key = [
    q(poolR, 2),
    q(poolH, 2),
    q(poolDy, 2),
    q(coneLen, 4),
    q(coneH, 2),
    q(angleRad, 0.05),
    q(dirRad, 0.02),
    q(groundYScale, 0.01),
  ].join("|");
  const hit = STREET_LAMP_CUTOUT_COMPOSITE_CACHE.get(key);
  if (hit) return hit;
  const radialSprite = getRadialCutoutSprite();
  const coneSprite = getStreetLampConeCutoutSprite(angleRad);
  const sprite = buildStreetLampCompositeSprite(
    radialSprite,
    coneSprite,
    poolR,
    poolH,
    poolDy,
    coneLen,
    coneH,
    dirRad,
    groundYScale,
  );
  cacheSetBounded(STREET_LAMP_CUTOUT_COMPOSITE_CACHE, key, sprite, 1024);
  return sprite;
}

function getStreetLampTintCompositeSprite(
  color: string,
  poolR: number,
  poolH: number,
  poolDy: number,
  coneLen: number,
  coneH: number,
  angleRad: number,
  dirRad: number,
  groundYScale: number,
): StreetLampCompositeSprite {
  const colorKey = normalizeColorKey(color);
  const key = [
    colorKey,
    q(poolR, 2),
    q(poolH, 2),
    q(poolDy, 2),
    q(coneLen, 4),
    q(coneH, 2),
    q(angleRad, 0.05),
    q(dirRad, 0.02),
    q(groundYScale, 0.01),
  ].join("|");
  const hit = STREET_LAMP_TINT_COMPOSITE_CACHE.get(key);
  if (hit) return hit;
  const radialSprite = getRadialTintSprite(color);
  const coneSprite = getStreetLampConeTintSprite(color, angleRad);
  const sprite = buildStreetLampCompositeSprite(
    radialSprite,
    coneSprite,
    poolR,
    poolH,
    poolDy,
    coneLen,
    coneH,
    dirRad,
    groundYScale,
  );
  cacheSetBounded(STREET_LAMP_TINT_COMPOSITE_CACHE, key, sprite, 2048);
  return sprite;
}

let lightingLayer: HTMLCanvasElement | null = null;
let streetLampCutoutLayer: HTMLCanvasElement | null = null;
let tintLayer: HTMLCanvasElement | null = null;
const lightSumLayerByHeight = new Map<number, HTMLCanvasElement>();
const tintSumLayerByHeight = new Map<number, HTMLCanvasElement>();
let tmpMaskedLayer: HTMLCanvasElement | null = null;

function getLayer(
  layer: HTMLCanvasElement | null,
  width: number,
  height: number,
): { layer: HTMLCanvasElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const resolved = layer ?? document.createElement("canvas");
  if (resolved.width !== width) resolved.width = width;
  if (resolved.height !== height) resolved.height = height;
  const layerCtx = resolved.getContext("2d");
  if (!layerCtx) return null;
  configurePixelPerfect(layerCtx);
  return { layer: resolved, canvas: resolved, ctx: layerCtx };
}

function flickerMultiplier(
  light: ProjectedLight,
  timeSec: number,
): number {
  const flicker = light.flicker;
  if (!flicker || flicker.kind === "NONE") return 1;
  const speed = Math.max(0.01, flicker.speed ?? (flicker.kind === "NOISE" ? 9 : 4));
  const amount = clamp01(flicker.amount ?? (flicker.kind === "NOISE" ? 0.25 : 0.2));
  if (flicker.kind === "PULSE") {
    return 1 - amount + amount * (0.5 + 0.5 * Math.sin(timeSec * speed + light.flickerPhase));
  }
  const n = Math.sin(timeSec * speed * 1.17 + light.flickerPhase) * 0.5
    + Math.sin(timeSec * speed * 2.31 + light.flickerPhase * 0.37) * 0.3
    + Math.sin(timeSec * speed * 3.97 + light.flickerPhase * 1.91) * 0.2;
  const normalized = 0.5 + 0.5 * Math.max(-1, Math.min(1, n));
  return 1 - amount + amount * normalized;
}

export function computeProjectedLightIntensity(
  light: ProjectedLight,
  timeSec: number,
): number {
  return clamp01(light.intensity * flickerMultiplier(light, timeSec));
}

export function computeProjectedLightTintAlpha(
  light: ProjectedLight,
  timeSec: number,
): number {
  const intensity = computeProjectedLightIntensity(light, timeSec);
  return intensity * clamp01(light.tintStrength);
}

function drawRadialCutout(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radiusPx: number,
  intensity: number,
): void {
  const rQ = Math.max(1, q(radiusPx, 4));
  const aQ = qAlpha(Math.max(0, intensity));
  if (aQ <= 0) return;
  const sprite = getRadialCutoutSprite();
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * aQ;
  ctx.drawImage(sprite, sx - rQ, sy - rQ, rQ * 2, rQ * 2);
  ctx.globalAlpha = prevA;
}

function withGroundPlane(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  groundYScale: number,
  fn: () => void,
): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, groundYScale);
  ctx.translate(-sx, -sy);
  fn();
  ctx.restore();
}

function conePath(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  dir: number,
  ang: number,
  len: number,
): void {
  const a0 = dir - ang * 0.5;
  const a1 = dir + ang * 0.5;
  const x0 = sx + Math.cos(a0) * len;
  const y0 = sy + Math.sin(a0) * len;
  const x1 = sx + Math.cos(a1) * len;
  const y1 = sy + Math.sin(a1) * len;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.closePath();
}

function drawStreetLampCutout(
  ctx: CanvasRenderingContext2D,
  light: ProjectedLight,
  intensity: number,
  groundYScale: number,
): void {
  const pool = light.pool ?? { radiusPx: Math.max(1, light.radiusPx * 0.7), yScale: 1 };
  const cone = light.cone ?? { dirRad: Math.PI * 0.5, angleRad: 0.9, lengthPx: Math.max(light.radiusPx, 160) };
  const poolSy = Number.isFinite(light.poolSy) ? (light.poolSy as number) : light.sy;
  const poolRadiusPx = Math.max(1, pool.radiusPx);
  const coneLengthPx = Math.max(1, cone.lengthPx);
  const aQ = qAlpha(Math.max(0, intensity));
  if (aQ <= 0) return;
  const poolR = Math.max(1, q(poolRadiusPx, 4));
  const poolH = Math.max(1, q(poolR * 2 * groundYScale, 2));
  const poolDy = q(poolSy - light.sy, 2);
  const coneLen = Math.max(1, q(coneLengthPx, 4));
  const coneSprite = getStreetLampConeCutoutSprite(cone.angleRad);
  const coneLenScale = coneLen / CONE_CUTOUT_BASE_LENGTH_PX;
  const coneH = Math.max(1, q(coneSprite.height * coneLenScale, 2));
  const composite = getStreetLampCutoutCompositeSprite(
    poolR,
    poolH,
    poolDy,
    coneLen,
    coneH,
    cone.angleRad,
    cone.dirRad,
    groundYScale,
  );
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * aQ;
  ctx.drawImage(composite.canvas, light.sx - composite.ox, light.sy - composite.oy);
  ctx.globalAlpha = prevA;
}

export function drawRadialTint(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radiusPx: number,
  color: string,
  alpha: number,
): void {
  const rQ = Math.max(1, q(radiusPx, 4));
  const aQ = qAlpha(alpha);
  if (aQ <= 0) return;
  const sprite = getRadialTintSprite(color);
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * aQ;
  ctx.drawImage(sprite, sx - rQ, sy - rQ, rQ * 2, rQ * 2);
  ctx.globalAlpha = prevA;
}

export function drawStreetLampTint(
  ctx: CanvasRenderingContext2D,
  light: ProjectedLight,
  color: string,
  alpha: number,
  groundYScale: number,
): void {
  const pool = light.pool ?? { radiusPx: Math.max(1, light.radiusPx * 0.7), yScale: 1 };
  const cone = light.cone ?? { dirRad: Math.PI * 0.5, angleRad: 0.9, lengthPx: Math.max(light.radiusPx, 160) };
  const poolSy = Number.isFinite(light.poolSy) ? (light.poolSy as number) : light.sy;
  const poolRadiusPx = Math.max(1, pool.radiusPx);
  const coneLengthPx = Math.max(1, cone.lengthPx);
  const aQ = qAlpha(alpha);
  if (aQ <= 0) return;
  const poolR = Math.max(1, q(poolRadiusPx, 4));
  const poolH = Math.max(1, q(poolR * 2 * groundYScale, 2));
  const poolDy = q(poolSy - light.sy, 2);
  const coneLen = Math.max(1, q(coneLengthPx, 4));
  const coneSprite = getStreetLampConeTintSprite(color, cone.angleRad);
  const coneLenScale = coneLen / CONE_TINT_BASE_LENGTH_PX;
  const coneH = Math.max(1, q(coneSprite.height * coneLenScale, 2));
  const composite = getStreetLampTintCompositeSprite(
    color,
    poolR,
    poolH,
    poolDy,
    coneLen,
    coneH,
    cone.angleRad,
    cone.dirRad,
    groundYScale,
  );
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * aQ;
  ctx.drawImage(composite.canvas, light.sx - composite.ox, light.sy - composite.oy);
  ctx.globalAlpha = prevA;
}

export type ProjectedLightTintSprite = {
  image: HTMLCanvasElement;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  alpha: number;
  blendMode: "additive";
};

export function resolveProjectedLightTintSprite(
  light: ProjectedLight,
  timeSec: number,
  groundYScaleInput: number | undefined,
): ProjectedLightTintSprite | null {
  const intensity = computeProjectedLightIntensity(light, timeSec);
  if (intensity <= 0) return null;
  const tintAlpha = intensity * clamp01(light.tintStrength);
  if (tintAlpha <= 0) return null;
  const groundYScale = clampGroundYScale(groundYScaleInput);
  const aQ = qAlpha(tintAlpha);
  if (aQ <= 0) return null;

  if (light.shape === "STREET_LAMP") {
    const pool = light.pool ?? { radiusPx: Math.max(1, light.radiusPx * 0.7), yScale: 1 };
    const cone = light.cone ?? { dirRad: Math.PI * 0.5, angleRad: 0.9, lengthPx: Math.max(light.radiusPx, 160) };
    const poolSy = Number.isFinite(light.poolSy) ? (light.poolSy as number) : light.sy;
    const poolRadiusPx = Math.max(1, pool.radiusPx);
    const coneLengthPx = Math.max(1, cone.lengthPx);
    const poolR = Math.max(1, q(poolRadiusPx, 4));
    const poolH = Math.max(1, q(poolR * 2 * groundYScale, 2));
    const poolDy = q(poolSy - light.sy, 2);
    const coneLen = Math.max(1, q(coneLengthPx, 4));
    const coneSprite = getStreetLampConeTintSprite(light.color, cone.angleRad);
    const coneLenScale = coneLen / CONE_TINT_BASE_LENGTH_PX;
    const coneH = Math.max(1, q(coneSprite.height * coneLenScale, 2));
    const composite = getStreetLampTintCompositeSprite(
      light.color,
      poolR,
      poolH,
      poolDy,
      coneLen,
      coneH,
      cone.angleRad,
      cone.dirRad,
      groundYScale,
    );
    return {
      image: composite.canvas,
      dx: light.sx - composite.ox,
      dy: light.sy - composite.oy,
      dw: composite.canvas.width,
      dh: composite.canvas.height,
      alpha: aQ,
      blendMode: "additive",
    };
  }

  const rQ = Math.max(1, q(Math.max(1, light.radiusPx), 4));
  return {
    image: getRadialTintSprite(light.color),
    dx: light.sx - rQ,
    dy: light.sy - rQ,
    dw: rQ * 2,
    dh: rQ * 2,
    alpha: aQ,
    blendMode: "additive",
  };
}

export function drawProjectedLightAdditive(
  ctx: CanvasRenderingContext2D,
  light: ProjectedLight,
  timeSec: number,
  groundYScaleInput: number | undefined,
): void {
  const intensity = computeProjectedLightIntensity(light, timeSec);
  if (intensity <= 0) return;
  const tintAlpha = intensity * clamp01(light.tintStrength);
  if (tintAlpha <= 0) return;
  const groundYScale = clampGroundYScale(groundYScaleInput);
  const radiusPx = Math.max(1, light.radiusPx);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (light.shape === "STREET_LAMP") {
    drawStreetLampTint(ctx, light, light.color, tintAlpha, groundYScale);
  } else {
    drawRadialTint(ctx, light.sx, light.sy, radiusPx, light.color, tintAlpha);
  }
  ctx.restore();
}

function drawStreetLampFootprintMask(
  ctx: CanvasRenderingContext2D,
  light: ProjectedLight,
  alpha: number,
  groundYScale: number,
): void {
  const maskAlpha = clamp01(alpha);
  if (maskAlpha <= 0) return;
  const pool = light.pool ?? { radiusPx: Math.max(1, light.radiusPx * 0.7), yScale: 1 };
  const cone = light.cone ?? { dirRad: Math.PI * 0.5, angleRad: 0.9, lengthPx: Math.max(light.radiusPx, 160) };
  const poolSy = Number.isFinite(light.poolSy) ? (light.poolSy as number) : light.sy;
  const poolRadiusPx = Math.max(1, pool.radiusPx);
  const coneLengthPx = Math.max(1, cone.lengthPx);
  const fill = `rgba(0,0,0,${maskAlpha})`;
  withGroundPlane(ctx, light.sx, poolSy, groundYScale, () => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(light.sx, poolSy, poolRadiusPx, 0, Math.PI * 2);
    ctx.fill();
  });
  withGroundPlane(ctx, light.sx, light.sy, groundYScale, () => {
    ctx.fillStyle = fill;
    conePath(ctx, light.sx, light.sy, cone.dirRad, cone.angleRad, coneLengthPx);
    ctx.fill();
  });
}

export function renderAmbientDarknessOverlay(
  ctx: CanvasRenderingContext2D,
  state: AmbientLightingState,
  viewW: number,
  viewH: number,
): void {
  const darknessAlpha = clamp01(state.darknessAlpha);
  if (darknessAlpha <= 0) return;
  const tintColor = state.ambientTint ?? "#000000";
  const tintStrength = clamp01(state.ambientTintStrength ?? 0);

  ctx.save();
  configurePixelPerfect(ctx);
  ctx.globalCompositeOperation = "source-over";
  if (tintStrength > 0) {
    ctx.fillStyle = `rgba(0,0,0,${darknessAlpha})`;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = tintColor;
    ctx.globalAlpha = darknessAlpha * tintStrength;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = `rgba(0,0,0,${darknessAlpha})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
  ctx.restore();
}
