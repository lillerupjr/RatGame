import type { World } from "../../../../engine/world/world";

export interface CameraBootstrapInput {
  world: World;
  projectedPlayerX: number;
  projectedPlayerY: number;
  snapshotViewerCamera: { x?: unknown; y?: unknown } | null;
  cameraSmoothingEnabled: boolean;
  dtReal: number;
  followHalfLifeDefaultSec: number;
  followSnapDistanceSq: number;
  smoothingIntensityScale: number;
}

export interface CameraBootstrapResult {
  cameraProjectedX: number;
  cameraProjectedY: number;
}

function smoothTowardByHalfLife(current: number, target: number, halfLifeSec: number, dtRealSec: number): number {
  if (!Number.isFinite(current)) return target;
  if (!Number.isFinite(target)) return current;
  if (!Number.isFinite(halfLifeSec) || halfLifeSec <= 0) return target;
  if (!Number.isFinite(dtRealSec) || dtRealSec <= 0) return current;
  const alpha = 1 - Math.pow(0.5, dtRealSec / halfLifeSec);
  return current + (target - current) * alpha;
}

export function resolveCameraBootstrap(input: CameraBootstrapInput): CameraBootstrapResult {
  const {
    world,
    projectedPlayerX,
    projectedPlayerY,
    snapshotViewerCamera,
    cameraSmoothingEnabled,
    dtReal,
    followHalfLifeDefaultSec,
    followSnapDistanceSq,
    smoothingIntensityScale,
  } = input;

  const cameraState = (world as any).camera as
    | {
      posX: number;
      posY: number;
      targetX: number;
      targetY: number;
      followHalfLifeSec: number;
    }
    | undefined;

  let cameraProjectedX = projectedPlayerX;
  let cameraProjectedY = projectedPlayerY;

  const hasSnapshotCameraOverride =
    Number.isFinite(Number(snapshotViewerCamera?.x))
    && Number.isFinite(Number(snapshotViewerCamera?.y));

  if (hasSnapshotCameraOverride) {
    cameraProjectedX = Number(snapshotViewerCamera?.x);
    cameraProjectedY = Number(snapshotViewerCamera?.y);
    if (cameraState) {
      cameraState.targetX = cameraProjectedX;
      cameraState.targetY = cameraProjectedY;
      cameraState.posX = cameraProjectedX;
      cameraState.posY = cameraProjectedY;
    }
  } else if (cameraState) {
    const wasUninitialized = cameraState.targetX === 0
      && cameraState.targetY === 0
      && cameraState.posX === 0
      && cameraState.posY === 0;
    cameraState.targetX = projectedPlayerX;
    cameraState.targetY = projectedPlayerY;
    const hasValidPos = Number.isFinite(cameraState.posX) && Number.isFinite(cameraState.posY);
    const dx = (cameraState.posX ?? projectedPlayerX) - projectedPlayerX;
    const dy = (cameraState.posY ?? projectedPlayerY) - projectedPlayerY;
    const shouldSnap = !cameraSmoothingEnabled
      || !hasValidPos
      || wasUninitialized
      || (dx * dx + dy * dy > followSnapDistanceSq);
    if (shouldSnap) {
      cameraState.posX = projectedPlayerX;
      cameraState.posY = projectedPlayerY;
    } else {
      const halfLifeSec = Number.isFinite(cameraState.followHalfLifeSec) && cameraState.followHalfLifeSec > 0
        ? cameraState.followHalfLifeSec
        : followHalfLifeDefaultSec;
      const tunedHalfLifeSec = Math.max(0.001, halfLifeSec * smoothingIntensityScale);
      cameraState.posX = smoothTowardByHalfLife(cameraState.posX, projectedPlayerX, tunedHalfLifeSec, dtReal);
      cameraState.posY = smoothTowardByHalfLife(cameraState.posY, projectedPlayerY, tunedHalfLifeSec, dtReal);
    }
    cameraProjectedX = cameraState.posX;
    cameraProjectedY = cameraState.posY;
  }

  return { cameraProjectedX, cameraProjectedY };
}
