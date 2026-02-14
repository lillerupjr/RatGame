import type { WorldLightingState } from "../../../engine/world/world";
import { configurePixelPerfect } from "../../../engine/render/pixelPerfect";

export type ProjectedLight = {
  sx: number;
  sy: number;
  intensity: number;
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

let lightingLayer: HTMLCanvasElement | null = null;

function getLightingLayer(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!lightingLayer) lightingLayer = document.createElement("canvas");
  if (lightingLayer.width !== width) lightingLayer.width = width;
  if (lightingLayer.height !== height) lightingLayer.height = height;
  const layerCtx = lightingLayer.getContext("2d");
  if (!layerCtx) return null;
  configurePixelPerfect(layerCtx);
  return { canvas: lightingLayer, ctx: layerCtx };
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

function drawStreetLampCutout(
  ctx: CanvasRenderingContext2D,
  light: ProjectedLight,
  intensity: number,
): void {
  const pool = light.pool ?? { radiusPx: Math.max(1, light.radiusPx * 0.7), yScale: 0.65 };
  const cone = light.cone ?? { dirRad: Math.PI * 0.5, angleRad: 0.9, lengthPx: Math.max(light.radiusPx, 160) };

  ctx.save();
  ctx.translate(light.sx, light.sy);
  ctx.scale(1, Math.max(0.1, pool.yScale));
  drawRadialCutout(ctx, 0, 0, Math.max(1, pool.radiusPx), intensity);
  ctx.restore();

  const start = cone.dirRad - cone.angleRad * 0.5;
  const end = cone.dirRad + cone.angleRad * 0.5;
  const coneGradient = ctx.createRadialGradient(light.sx, light.sy, 0, light.sx, light.sy, cone.lengthPx);
  coneGradient.addColorStop(0, `rgba(0,0,0,${Math.max(0, intensity * 0.85)})`);
  coneGradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = coneGradient;
  ctx.beginPath();
  ctx.moveTo(light.sx, light.sy);
  ctx.arc(light.sx, light.sy, Math.max(1, cone.lengthPx), start, end);
  ctx.closePath();
  ctx.fill();
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
): void {
  const pool = light.pool ?? { radiusPx: Math.max(1, light.radiusPx * 0.7), yScale: 0.65 };
  const cone = light.cone ?? { dirRad: Math.PI * 0.5, angleRad: 0.9, lengthPx: Math.max(light.radiusPx, 160) };

  ctx.save();
  ctx.translate(light.sx, light.sy);
  ctx.scale(1, Math.max(0.1, pool.yScale));
  drawRadialTint(ctx, 0, 0, Math.max(1, pool.radiusPx), color, alpha);
  ctx.restore();

  const start = cone.dirRad - cone.angleRad * 0.5;
  const end = cone.dirRad + cone.angleRad * 0.5;
  const coneGradient = ctx.createRadialGradient(light.sx, light.sy, 0, light.sx, light.sy, cone.lengthPx);
  coneGradient.addColorStop(0, color);
  coneGradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = coneGradient;
  ctx.beginPath();
  ctx.moveTo(light.sx, light.sy);
  ctx.arc(light.sx, light.sy, Math.max(1, cone.lengthPx), start, end);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
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

  const layer = getLightingLayer(viewW, viewH);
  if (!layer) return;
  const lctx = layer.ctx;
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
    lctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < projectedLights.length; i++) {
      const light = projectedLights[i];
      const radiusPx = Math.max(1, light.radiusPx);
      const intensity = clamp01(light.intensity * flickerMultiplier(light, timeSec));
      if (intensity <= 0) continue;
      if (light.shape === "STREET_LAMP") {
        drawStreetLampCutout(lctx, light, intensity);
      } else {
        drawRadialCutout(lctx, light.sx, light.sy, radiusPx, intensity);
      }
    }
  }
  lctx.restore();

  ctx.save();
  configurePixelPerfect(ctx);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(layer.canvas, 0, 0);
  if (projectedLights.length > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < projectedLights.length; i++) {
      const light = projectedLights[i];
      const tintStrength = clamp01(light.tintStrength);
      if (tintStrength <= 0) continue;
      const alpha = clamp01(light.intensity * flickerMultiplier(light, timeSec)) * tintStrength;
      if (alpha <= 0) continue;
      if (light.shape === "STREET_LAMP") {
        drawStreetLampTint(ctx, light, light.color, alpha);
      } else {
        drawRadialTint(ctx, light.sx, light.sy, Math.max(1, light.radiusPx), light.color, alpha);
      }
    }
  }
  ctx.restore();
}
