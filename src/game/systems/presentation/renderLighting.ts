import type { WorldLightingState } from "../../../engine/world/world";
import { configurePixelPerfect } from "../../../engine/render/pixelPerfect";

export type ProjectedLight = {
  sx: number;
  sy: number;
  poolSy?: number;
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

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clampGroundYScale(v: number | undefined): number {
  if (!Number.isFinite(v)) return 0.65;
  return Math.max(0.1, Math.min(1, v!));
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

let lightingLayer: HTMLCanvasElement | null = null;
let streetLampCutoutLayer: HTMLCanvasElement | null = null;
let tintLayer: HTMLCanvasElement | null = null;
let streetLampTintLayer: HTMLCanvasElement | null = null;

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

function drawRadialCutout(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radiusPx: number,
  intensity: number,
): void {
  const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radiusPx);
  gradient.addColorStop(0, `rgba(0,0,0,${intensity})`);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(sx, sy, radiusPx, 0, Math.PI * 2);
  ctx.fill();
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
  withGroundPlane(ctx, light.sx, poolSy, groundYScale, () => {
    const poolGradient = ctx.createRadialGradient(light.sx, poolSy, 0, light.sx, poolSy, poolRadiusPx);
    poolGradient.addColorStop(0, `rgba(0,0,0,${Math.max(0, intensity)})`);
    poolGradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = poolGradient;
    ctx.beginPath();
    ctx.arc(light.sx, poolSy, poolRadiusPx, 0, Math.PI * 2);
    ctx.fill();
  });
  withGroundPlane(ctx, light.sx, light.sy, groundYScale, () => {
    const ex = light.sx + Math.cos(cone.dirRad) * coneLengthPx;
    const ey = light.sy + Math.sin(cone.dirRad) * coneLengthPx;
    const coneGradient = ctx.createLinearGradient(light.sx, light.sy, ex, ey);
    coneGradient.addColorStop(0, "rgba(0,0,0,0)");
    coneGradient.addColorStop(0.18, `rgba(0,0,0,${Math.max(0, intensity * 0.85)})`);
    coneGradient.addColorStop(0.45, `rgba(0,0,0,${Math.max(0, intensity * 0.28)})`);
    coneGradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = coneGradient;
    conePath(ctx, light.sx, light.sy, cone.dirRad, cone.angleRad, coneLengthPx);
    ctx.fill();
  });
}

function drawRadialTint(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radiusPx: number,
  color: string,
  alpha: number,
): void {
  const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radiusPx);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(sx, sy, radiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawStreetLampTint(
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
  withGroundPlane(ctx, light.sx, poolSy, groundYScale, () => {
    const poolGradient = ctx.createRadialGradient(light.sx, poolSy, 0, light.sx, poolSy, poolRadiusPx);
    poolGradient.addColorStop(0, hexToRgba(color, alpha));
    poolGradient.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = poolGradient;
    ctx.beginPath();
    ctx.arc(light.sx, poolSy, poolRadiusPx, 0, Math.PI * 2);
    ctx.fill();
  });
  withGroundPlane(ctx, light.sx, light.sy, groundYScale, () => {
    const ex = light.sx + Math.cos(cone.dirRad) * coneLengthPx;
    const ey = light.sy + Math.sin(cone.dirRad) * coneLengthPx;
    const coneGradient = ctx.createLinearGradient(light.sx, light.sy, ex, ey);
    coneGradient.addColorStop(0, hexToRgba(color, 0));
    coneGradient.addColorStop(0.18, hexToRgba(color, 0.24 * alpha));
    coneGradient.addColorStop(0.45, hexToRgba(color, 0.07 * alpha));
    coneGradient.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = coneGradient;
    conePath(ctx, light.sx, light.sy, cone.dirRad, cone.angleRad, coneLengthPx);
    ctx.fill();
  });
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

export function renderLighting(
  ctx: CanvasRenderingContext2D,
  state: WorldLightingState,
  projectedLights: ProjectedLight[],
  viewW: number,
  viewH: number,
  timeSec: number = 0,
): void {
  const darknessAlpha = clamp01(state.darknessAlpha);
  if (darknessAlpha <= 0 && projectedLights.length === 0) return;

  const baseLayer = getLayer(lightingLayer, viewW, viewH);
  const lampCutout = getLayer(streetLampCutoutLayer, viewW, viewH);
  const tintBase = getLayer(tintLayer, viewW, viewH);
  const lampTint = getLayer(streetLampTintLayer, viewW, viewH);
  if (!baseLayer || !lampCutout || !tintBase || !lampTint) return;
  lightingLayer = baseLayer.layer;
  streetLampCutoutLayer = lampCutout.layer;
  tintLayer = tintBase.layer;
  streetLampTintLayer = lampTint.layer;

  const lctx = baseLayer.ctx;
  const lampCutCtx = lampCutout.ctx;
  const tintCtx = tintBase.ctx;
  const lampTintCtx = lampTint.ctx;
  const groundYScale = clampGroundYScale(state.groundYScale ?? 0.65);

  lctx.save();
  lctx.globalCompositeOperation = "source-over";
  lctx.clearRect(0, 0, viewW, viewH);

  if (darknessAlpha > 0) {
    const tintColor = state.ambientTint ?? "#000000";
    const tintStrength = clamp01(state.ambientTintStrength ?? 0);
    if (tintStrength > 0) {
      lctx.fillStyle = `rgba(0,0,0,${darknessAlpha})`;
      lctx.fillRect(0, 0, viewW, viewH);
      lctx.fillStyle = tintColor;
      lctx.globalAlpha = darknessAlpha * tintStrength;
      lctx.fillRect(0, 0, viewW, viewH);
      lctx.globalAlpha = 1;
    } else {
      lctx.fillStyle = `rgba(0,0,0,${darknessAlpha})`;
      lctx.fillRect(0, 0, viewW, viewH);
    }
  }

  if (projectedLights.length > 0) {
    lampCutCtx.save();
    lampCutCtx.globalCompositeOperation = "source-over";
    lampCutCtx.clearRect(0, 0, viewW, viewH);

    lctx.globalCompositeOperation = "destination-out";
    let hasStreetLampCutouts = false;
    for (let i = 0; i < projectedLights.length; i++) {
      const light = projectedLights[i];
      const radiusPx = Math.max(1, light.radiusPx);
      const intensity = clamp01(light.intensity * flickerMultiplier(light, timeSec));
      if (intensity <= 0) continue;
      if (light.shape === "STREET_LAMP") {
        drawStreetLampCutout(lampCutCtx, light, intensity, groundYScale);
        hasStreetLampCutouts = true;
      } else {
        drawRadialCutout(lctx, light.sx, light.sy, radiusPx, intensity);
      }
    }
    if (hasStreetLampCutouts) {
      lampCutCtx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < projectedLights.length; i++) {
        const light = projectedLights[i];
        if (light.shape !== "STREET_LAMP") continue;
        const maskAlpha = clamp01(light.occlusion);
        if (maskAlpha <= 0) continue;
        drawStreetLampFootprintMask(lampCutCtx, light, maskAlpha, groundYScale);
      }
      lampCutCtx.globalCompositeOperation = "source-over";
      lctx.drawImage(lampCutout.canvas, 0, 0);
    }
    lampCutCtx.restore();
  }
  lctx.restore();

  tintCtx.save();
  tintCtx.globalCompositeOperation = "source-over";
  tintCtx.clearRect(0, 0, viewW, viewH);
  lampTintCtx.save();
  lampTintCtx.globalCompositeOperation = "source-over";
  lampTintCtx.clearRect(0, 0, viewW, viewH);

  if (projectedLights.length > 0) {
    let hasStreetLampTints = false;
    for (let i = 0; i < projectedLights.length; i++) {
      const light = projectedLights[i];
      const tintStrength = clamp01(light.tintStrength);
      if (tintStrength <= 0) continue;
      const alpha = clamp01(light.intensity * flickerMultiplier(light, timeSec)) * tintStrength;
      if (alpha <= 0) continue;
      if (light.shape === "STREET_LAMP") {
        drawStreetLampTint(lampTintCtx, light, light.color, alpha, groundYScale);
        hasStreetLampTints = true;
      } else {
        drawRadialTint(tintCtx, light.sx, light.sy, Math.max(1, light.radiusPx), light.color, alpha);
      }
    }
    if (hasStreetLampTints) {
      lampTintCtx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < projectedLights.length; i++) {
        const light = projectedLights[i];
        if (light.shape !== "STREET_LAMP") continue;
        const maskAlpha = clamp01(light.occlusion);
        if (maskAlpha <= 0) continue;
        drawStreetLampFootprintMask(lampTintCtx, light, maskAlpha, groundYScale);
      }
      lampTintCtx.globalCompositeOperation = "source-over";
      tintCtx.globalCompositeOperation = "lighter";
      tintCtx.drawImage(lampTint.canvas, 0, 0);
    }
  }
  lampTintCtx.restore();
  tintCtx.restore();

  ctx.save();
  configurePixelPerfect(ctx);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(baseLayer.canvas, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(tintBase.canvas, 0, 0);
  ctx.restore();
}

export function renderStreetLampMaskDebugOverlay(
  ctx: CanvasRenderingContext2D,
  state: WorldLightingState,
  projectedLights: ProjectedLight[],
  timeSec: number = 0,
): void {
  if (!state.occlusionEnabled) return;
  const groundYScale = clampGroundYScale(state.groundYScale ?? 0.65);
  ctx.save();
  configurePixelPerfect(ctx);
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < projectedLights.length; i++) {
    const light = projectedLights[i];
    if (light.shape !== "STREET_LAMP") continue;
    const maskAlpha = clamp01(light.occlusion);
    if (maskAlpha <= 0) continue;
    const pulse = 0.28 + 0.14 * (0.5 + 0.5 * Math.sin(timeSec * 5 + light.flickerPhase));
    drawStreetLampTint(ctx, light, "#00F5FF", clamp01(maskAlpha * pulse), groundYScale);
  }
  ctx.restore();
}
