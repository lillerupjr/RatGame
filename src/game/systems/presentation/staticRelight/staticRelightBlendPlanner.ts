import {
  planPieceLocalRelight,
  type PieceLocalRelightPlan,
} from "../staticRelightPoc";
import { type StaticRelightFrameContext } from "./staticRelightTypes";

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function planStaticRelightBlendForPiece(
  staticRelightFrame: StaticRelightFrameContext,
  pieceTileX: number,
  pieceTileY: number,
  pieceX: number,
  pieceY: number,
  pieceW: number,
  pieceH: number,
): PieceLocalRelightPlan | null {
  const planned = planPieceLocalRelight({
    baseDarknessBucket: staticRelightFrame.baseDarknessBucket,
    pieceTileX,
    pieceTileY,
    pieceScreenRect: {
      x: pieceX,
      y: pieceY,
      width: pieceW,
      height: pieceH,
    },
    lights: staticRelightFrame.lights,
    maxLights: staticRelightFrame.maxLights,
    tileInfluenceRadius: staticRelightFrame.tileInfluenceRadius,
    minBlendAlpha: staticRelightFrame.minBlendAlpha,
  });
  if (!planned) return null;
  const targetDarknessBucket = staticRelightFrame.targetDarknessBucket < staticRelightFrame.baseDarknessBucket
    ? staticRelightFrame.targetDarknessBucket
    : planned.targetDarknessBucket;
  const strengthBlendAlpha = clamp01(staticRelightFrame.strengthScale);
  if (strengthBlendAlpha < staticRelightFrame.minBlendAlpha) return null;
  return {
    ...planned,
    targetDarknessBucket,
    blendAlpha: strengthBlendAlpha,
  };
}

export function hasNearbyStaticRelightTileLight(
  staticRelightFrame: StaticRelightFrameContext,
  tileX: number,
  tileY: number,
): boolean {
  const radius = Math.max(0.01, staticRelightFrame.tileInfluenceRadius);
  for (let i = 0; i < staticRelightFrame.lights.length; i++) {
    const light = staticRelightFrame.lights[i];
    const dx = light.tileX - tileX;
    const dy = light.tileY - tileY;
    if (Math.hypot(dx, dy) <= radius) return true;
  }
  return false;
}
