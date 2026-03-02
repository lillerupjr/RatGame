import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { ISO_X, ISO_Y } from "../../engine/math/iso";
import type { EnemyType } from "../content/enemies";
import { getEnemyWorld, getPlayerWorld } from "../coords/worldViews";
import { getEnemySpriteFrameMeta } from "../../engine/render/sprites/enemySprites";

const DEFAULT_AIM_Y_FRAC = 0.2;
const FALLBACK_ENEMY_AIM_SCREEN_OFFSET = { x: 0, y: -12 } as const;
const FALLBACK_PLAYER_AIM_SCREEN_OFFSET = { x: 0, y: -12 } as const;

type ScreenOffset = { x: number; y: number };

// Phase 1 tuning scaffold: per-skin additive screen-space offsets (in screen px).
// Keep empty by default to preserve baseline behavior.
export const ENEMY_AIM_SCREEN_OFFSET_BY_SKIN: Partial<Record<string, ScreenOffset>> = {};

export type EnemyAimDebugInfo = {
  skin: string | null;
  spriteFrameHeightPx: number;
  spriteScale: number;
  spriteHeightWorld: number;
  baseScreenOffset: ScreenOffset;
  skinScreenOffset: ScreenOffset;
  effectiveScreenOffset: ScreenOffset;
  effectiveWorldDelta: { dx: number; dy: number };
};

function toWorldDeltaFromScreenOffset(screen: ScreenOffset): { dx: number; dy: number } {
  const dx = 0.5 * (screen.x / ISO_X + screen.y / ISO_Y);
  const dy = 0.5 * (screen.y / ISO_Y - screen.x / ISO_X);
  return { dx, dy };
}

function getSkinScreenOffset(skin: string | null | undefined): ScreenOffset {
  if (!skin) return { x: 0, y: 0 };
  const raw = ENEMY_AIM_SCREEN_OFFSET_BY_SKIN[skin];
  if (!raw) return { x: 0, y: 0 };
  const x = Number.isFinite(raw.x) ? raw.x : 0;
  const y = Number.isFinite(raw.y) ? raw.y : 0;
  return { x, y };
}

function resolveEnemyAimDebugInfo(enemyType: EnemyType): EnemyAimDebugInfo {
  const frame = getEnemySpriteFrameMeta(enemyType);
  const spriteFrameHeightPx = frame?.h ?? 0;
  const spriteScale = frame?.scale ?? 1;
  const spriteHeightWorld = spriteFrameHeightPx * spriteScale;
  const baseScreenOffset: ScreenOffset = {
    x: 0,
    y: spriteHeightWorld > 0
      ? -Math.round(spriteHeightWorld * DEFAULT_AIM_Y_FRAC)
      : FALLBACK_ENEMY_AIM_SCREEN_OFFSET.y,
  };
  const skin = frame?.skin ?? null;
  const skinScreenOffset = getSkinScreenOffset(skin);
  const effectiveScreenOffset: ScreenOffset = {
    x: baseScreenOffset.x + skinScreenOffset.x,
    y: baseScreenOffset.y + skinScreenOffset.y,
  };
  const effectiveWorldDelta = toWorldDeltaFromScreenOffset(effectiveScreenOffset);
  return {
    skin,
    spriteFrameHeightPx,
    spriteScale,
    spriteHeightWorld,
    baseScreenOffset,
    skinScreenOffset,
    effectiveScreenOffset,
    effectiveWorldDelta,
  };
}

export function getEnemyAimWorld(w: World, enemyIndex: number): { x: number; y: number } {
  const ew = getEnemyWorld(w, enemyIndex, KENNEY_TILE_WORLD);
  const enemyType = w.eType[enemyIndex] as EnemyType;
  const info = resolveEnemyAimDebugInfo(enemyType);
  return {
    x: ew.wx + info.effectiveWorldDelta.dx,
    y: ew.wy + info.effectiveWorldDelta.dy,
  };
}

export function getEnemyAimDebugInfo(w: World, enemyIndex: number): EnemyAimDebugInfo {
  const enemyType = w.eType[enemyIndex] as EnemyType;
  return resolveEnemyAimDebugInfo(enemyType);
}

export function getPlayerAimWorld(w: World): { x: number; y: number } {
  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const delta = toWorldDeltaFromScreenOffset(FALLBACK_PLAYER_AIM_SCREEN_OFFSET);
  return { x: pw.wx + delta.dx, y: pw.wy + delta.dy };
}

export function aimDir(from: { x: number; y: number }, to: { x: number; y: number }): { dx: number; dy: number } {
  return { dx: to.x - from.x, dy: to.y - from.y };
}
