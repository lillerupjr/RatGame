export type DynamicRelightLightCandidate = {
  id: string;
  centerX: number;
  centerY: number;
  radiusPx: number;
  yScale?: number;
  intensity: number;
};

export type NearestDynamicRelightResult = {
  lightId: string;
  alpha: number;
  distancePx: number;
  normalizedDistance: number;
};

export type ComputeNearestDynamicRelightAlphaParams = {
  screenX: number;
  screenY: number;
  lights: readonly DynamicRelightLightCandidate[];
  strengthScale: number;
  minAlpha?: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

type NearestCandidate = {
  lightId: string;
  distancePx: number;
  radiusPx: number;
  influence: number;
};

export function computeNearestDynamicRelightAlpha(
  params: ComputeNearestDynamicRelightAlphaParams,
): NearestDynamicRelightResult | null {
  if (params.lights.length === 0) return null;
  const strengthScale = clamp01(params.strengthScale);
  if (strengthScale <= 0) return null;
  const minAlpha = clamp01(params.minAlpha ?? 0.04);

  let nearest: NearestCandidate | null = null;
  for (let i = 0; i < params.lights.length; i++) {
    const light = params.lights[i];
    const intensity = clamp01(light.intensity);
    if (intensity <= 0) continue;
    const radiusPx = Math.max(1, Number(light.radiusPx) || 0);
    const yScale = Math.max(0.1, Math.min(2, Number(light.yScale ?? 1)));

    const dx = params.screenX - light.centerX;
    const dy = (params.screenY - light.centerY) / yScale;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx > radiusPx) continue;

    const falloff = clamp01(1 - distancePx / radiusPx);
    const influence = intensity * falloff;
    if (influence <= 0) continue;

    if (!nearest || distancePx < nearest.distancePx) {
      nearest = {
        lightId: light.id,
        distancePx,
        radiusPx,
        influence,
      };
    }
  }

  if (!nearest) return null;
  const alpha = clamp01(nearest.influence * strengthScale);
  if (alpha < minAlpha) return null;
  return {
    lightId: nearest.lightId,
    alpha,
    distancePx: nearest.distancePx,
    normalizedDistance: clamp01(nearest.distancePx / nearest.radiusPx),
  };
}
