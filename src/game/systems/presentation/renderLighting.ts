import { configurePixelPerfect } from "../../../engine/render/pixelPerfect";

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
