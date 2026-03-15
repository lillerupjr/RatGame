export type StaticRelightDarknessBucket = 0 | 25 | 50 | 75 | 100;

export type StaticRelightPieceScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StaticRelightLightCandidate = {
  id: string;
  tileX: number;
  tileY: number;
  centerX: number;
  centerY: number;
  radiusPx: number;
  intensity: number;
};

export type StaticRelightMask = {
  lightId: string;
  centerX: number;
  centerY: number;
  radiusPx: number;
  alpha: number;
};

export type PieceLocalRelightPlan = {
  targetDarknessBucket: StaticRelightDarknessBucket;
  blendAlpha: number;
  localBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  masks: StaticRelightMask[];
};

export type PlanPieceLocalRelightParams = {
  baseDarknessBucket: StaticRelightDarknessBucket;
  pieceTileX: number;
  pieceTileY: number;
  pieceScreenRect: StaticRelightPieceScreenRect;
  lights: readonly StaticRelightLightCandidate[];
  maxLights?: number;
  tileInfluenceRadius?: number;
  minBlendAlpha?: number;
};

type ScoredLight = {
  lightId: string;
  score: number;
  centerX: number;
  centerY: number;
  radiusPx: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function nextLighterBucket(
  base: StaticRelightDarknessBucket,
): StaticRelightDarknessBucket | null {
  if (base === 100) return 75;
  if (base === 75) return 50;
  if (base === 50) return 25;
  if (base === 25) return 0;
  return null;
}

export function planPieceLocalRelight(
  params: PlanPieceLocalRelightParams,
): PieceLocalRelightPlan | null {
  const targetDarknessBucket = nextLighterBucket(params.baseDarknessBucket);
  if (targetDarknessBucket == null) return null;

  const pieceRect = params.pieceScreenRect;
  const pieceW = Number(pieceRect.width);
  const pieceH = Number(pieceRect.height);
  if (!(pieceW > 0) || !(pieceH > 0)) return null;

  const maxLights = Math.max(1, Math.floor(params.maxLights ?? 2));
  const tileInfluenceRadius = Math.max(0.01, Number(params.tileInfluenceRadius ?? 6));
  const minBlendAlpha = clamp01(params.minBlendAlpha ?? 0.04);

  const pieceCenterX = pieceRect.x + pieceW * 0.5;
  const pieceCenterY = pieceRect.y + pieceH * 0.5;

  const scored: ScoredLight[] = [];
  for (let i = 0; i < params.lights.length; i++) {
    const light = params.lights[i];
    const tileDx = light.tileX - params.pieceTileX;
    const tileDy = light.tileY - params.pieceTileY;
    const tileDistance = Math.hypot(tileDx, tileDy);
    if (tileDistance > tileInfluenceRadius) continue;

    const radiusPx = Math.max(8, Number(light.radiusPx) || 0);
    const pixelDistance = Math.hypot(pieceCenterX - light.centerX, pieceCenterY - light.centerY);
    const pixelFactor = clamp01(1 - pixelDistance / radiusPx);
    if (pixelFactor <= 0) continue;

    const tileFactor = clamp01(1 - tileDistance / tileInfluenceRadius);
    const score = pixelFactor * tileFactor * clamp01(light.intensity);
    if (score <= 0.01) continue;

    scored.push({
      lightId: light.id,
      score,
      centerX: light.centerX,
      centerY: light.centerY,
      radiusPx,
    });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, maxLights);

  let scoreSum = 0;
  let maxScore = 0;
  for (let i = 0; i < selected.length; i++) {
    scoreSum += selected[i].score;
    if (selected[i].score > maxScore) maxScore = selected[i].score;
  }
  if (scoreSum <= 0 || maxScore <= 0) return null;

  const blendAlpha = clamp01(scoreSum * 1.2);
  if (blendAlpha < minBlendAlpha) return null;

  const masks: StaticRelightMask[] = selected.map((light) => ({
    lightId: light.lightId,
    centerX: light.centerX - pieceRect.x,
    centerY: light.centerY - pieceRect.y,
    radiusPx: light.radiusPx,
    alpha: clamp01(light.score / maxScore),
  }));

  if (masks.length === 0) return null;

  return {
    targetDarknessBucket,
    blendAlpha,
    localBounds: {
      x: 0,
      y: 0,
      width: pieceW,
      height: pieceH,
    },
    masks,
  };
}
