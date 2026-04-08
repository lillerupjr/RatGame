import type { World } from "../../../engine/world/world";

export const SPLITTER_STAGE_VISUAL_SCALES = [1, 0.5, 0.25] as const;
export const DEFAULT_ENEMY_SPLIT_STAGE = 0;
export const DEFAULT_ENEMY_VISUAL_SCALE = 1;
export const MIN_ENEMY_VISUAL_SCALE = 0.1;
export const MIN_ENEMY_COLLISION_RADIUS = 6;
// Player projectiles travel at shooter feet + 1 by default, so tiny enemies need
// a small authored floor to remain hittable on flat ground with the 0.25 Z radius.
export const MIN_ENEMY_HIT_HEIGHT = 0.75;

function clampFinite(value: unknown, fallback: number, min: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, value as number);
}

export function resolveSplitterStageVisualScale(stage: number): number {
  const normalizedStage = Number.isFinite(stage) ? Math.max(0, Math.floor(stage)) : DEFAULT_ENEMY_SPLIT_STAGE;
  return SPLITTER_STAGE_VISUAL_SCALES[normalizedStage] ?? SPLITTER_STAGE_VISUAL_SCALES[SPLITTER_STAGE_VISUAL_SCALES.length - 1];
}

export function resolveEnemySplitStage(world: Pick<World, "eSplitStage">, enemyIndex: number): number {
  const rawStage = world.eSplitStage?.[enemyIndex];
  return Number.isFinite(rawStage) ? Math.max(0, Math.floor(rawStage as number)) : DEFAULT_ENEMY_SPLIT_STAGE;
}

export function resolveEnemyVisualScale(world: Pick<World, "eVisualScale">, enemyIndex: number): number {
  return clampFinite(world.eVisualScale?.[enemyIndex], DEFAULT_ENEMY_VISUAL_SCALE, MIN_ENEMY_VISUAL_SCALE);
}

export function coerceEnemyVisualScale(value: unknown): number {
  return clampFinite(value, DEFAULT_ENEMY_VISUAL_SCALE, MIN_ENEMY_VISUAL_SCALE);
}

export function scaleEnemyHitHeight(baseHeight: number, visualScale: number): number {
  const height = Number.isFinite(baseHeight) ? Math.max(0, baseHeight) : 0;
  return Math.max(MIN_ENEMY_HIT_HEIGHT, height * coerceEnemyVisualScale(visualScale));
}
