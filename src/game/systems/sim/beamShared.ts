import type { World } from "../../../engine/world/world";
import { raycast3D } from "./collision3D";

export type BeamGeometry = {
  originX: number;
  originY: number;
  dirX: number;
  dirY: number;
  endX: number;
  endY: number;
  lengthPx: number;
  widthPx: number;
};

export function normalizeBeamDirection(
  dirX: number,
  dirY: number,
  fallbackDirX = 1,
  fallbackDirY = 0,
): { dirX: number; dirY: number } {
  const len = Math.hypot(dirX, dirY);
  if (len > 0.0001) {
    return {
      dirX: dirX / len,
      dirY: dirY / len,
    };
  }
  const fallbackLen = Math.hypot(fallbackDirX, fallbackDirY);
  if (fallbackLen > 0.0001) {
    return {
      dirX: fallbackDirX / fallbackLen,
      dirY: fallbackDirY / fallbackLen,
    };
  }
  return { dirX: 1, dirY: 0 };
}

export function resolveClampedBeamGeometry(
  world: World,
  args: {
    originX: number;
    originY: number;
    originZ: number;
    dirX: number;
    dirY: number;
    maxRangePx: number;
    widthPx: number;
    fallbackDirX?: number;
    fallbackDirY?: number;
  },
): BeamGeometry {
  const { dirX, dirY } = normalizeBeamDirection(
    args.dirX,
    args.dirY,
    args.fallbackDirX ?? 1,
    args.fallbackDirY ?? 0,
  );
  const ray = raycast3D(
    args.originX,
    args.originY,
    args.originZ,
    dirX,
    dirY,
    0,
    args.maxRangePx,
  );
  const lengthPx = ray.hit && ray.hitType === "TILE"
    ? Math.max(0, Math.min(args.maxRangePx, ray.hitDistance))
    : Math.max(0, args.maxRangePx);
  return {
    originX: args.originX,
    originY: args.originY,
    dirX,
    dirY,
    endX: args.originX + dirX * lengthPx,
    endY: args.originY + dirY * lengthPx,
    lengthPx,
    widthPx: Math.max(1, args.widthPx),
  };
}

export function beamIntersectsCircle(
  beam: Pick<BeamGeometry, "originX" | "originY" | "dirX" | "dirY" | "lengthPx" | "widthPx">,
  circleX: number,
  circleY: number,
  circleRadius: number,
): boolean {
  const dx = circleX - beam.originX;
  const dy = circleY - beam.originY;
  const along = dx * beam.dirX + dy * beam.dirY;
  if (along < 0 || along > beam.lengthPx) return false;
  const perpSq = dx * dx + dy * dy - along * along;
  const hitRadius = Math.max(0, circleRadius) + Math.max(0, beam.widthPx) * 0.5;
  return perpSq <= hitRadius * hitRadius;
}
