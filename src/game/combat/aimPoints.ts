import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import type { EnemyType } from "../content/enemies";
import { getEnemyWorld, getPlayerWorld } from "../coords/worldViews";
import { getEnemySpriteFrameMeta } from "../../engine/render/sprites/enemySprites";

const DEFAULT_AIM_Y_FRAC = 0.55;
const FALLBACK_ENEMY_AIM_OFFSET_Y = -12;
const FALLBACK_PLAYER_AIM_OFFSET_Y = -12;

export function getEnemyAimWorld(w: World, enemyIndex: number): { x: number; y: number } {
  const ew = getEnemyWorld(w, enemyIndex, KENNEY_TILE_WORLD);
  const enemyType = w.eType[enemyIndex] as EnemyType;
  const frame = getEnemySpriteFrameMeta(enemyType);
  const spriteH = frame ? frame.h * frame.scale : 0;
  const aimOffsetY = spriteH > 0
    ? -Math.round(spriteH * DEFAULT_AIM_Y_FRAC)
    : FALLBACK_ENEMY_AIM_OFFSET_Y;
  return { x: ew.wx, y: ew.wy + aimOffsetY };
}

export function getPlayerAimWorld(w: World): { x: number; y: number } {
  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  return { x: pw.wx, y: pw.wy + FALLBACK_PLAYER_AIM_OFFSET_Y };
}

export function aimDir(from: { x: number; y: number }, to: { x: number; y: number }): { dx: number; dy: number } {
  return { dx: to.x - from.x, dy: to.y - from.y };
}
