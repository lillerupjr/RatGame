import { hasCompletedAnyObjective } from "./objective";

export const FLOOR_END_COUNTDOWN_SEC = 10;

export function floorEndCountdownKey(world: any): string {
  return `${world.floorIndex ?? 0}:OBJ_COMPLETE`;
}

export function maybeStartFloorEndCountdown(world: any): boolean {
  if (world?.runState !== "FLOOR") return false;
  if (!hasCompletedAnyObjective(world)) return false;

  const key = floorEndCountdownKey(world);
  if (world.floorEndCountdownStartedKey === key) return false;

  world.floorEndCountdownStartedKey = key;
  world.floorEndCountdownActive = true;
  world.floorEndCountdownSec = FLOOR_END_COUNTDOWN_SEC;
  return true;
}

export function tickFloorEndCountdown(world: any, dt: number): void {
  if (!world?.floorEndCountdownActive) return;
  world.floorEndCountdownSec = Math.max(0, (world.floorEndCountdownSec ?? 0) - dt);
}

export function isFloorEndCountdownDone(world: any): boolean {
  return !!world?.floorEndCountdownActive && (world.floorEndCountdownSec ?? 0) <= 0;
}
