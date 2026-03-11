import { type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import {
  getEnemyWorld,
  getPlayerWorld,
  getProjectileWorld,
} from "../../coords/worldViews";
import { ENEMY_TYPE } from "../../content/enemies";
import { isPoeEnemyDormant } from "../../objectives/poeMapObjectiveSystem";

/**
 * Determines if a projectile hits an enemy based on whether it's melee or ranged.
 *
 * For melee: checks if enemy is within a cone in front of the aim direction.
 * For ranged: checks if enemy is within circular collision radius.
 *
 * @param w - The game world
 * @param p - Projectile index
 * @param e - Enemy index
 * @param dx - X distance between projectile and enemy (ex[e] - prx[p])
 * @param dy - Y distance between projectile and enemy (ey[e] - pry[p])
 * @param rr - Combined radius (enemy radius + projectile radius)
 * @returns true if the projectile hits the enemy, false otherwise
 */
/** Return true if a projectile hits an enemy. */
export function isEnemyHit(
    w: World,
    p: number,
    e: number,
    dx: number,
    dy: number,
    rr: number
): boolean {
  // -----------------------------------------
  // Milestone C: symmetric height-aware hits
  // -----------------------------------------
  const PROJECTILE_Z_RADIUS = 0.25; // projectile vertical thickness

  // Enemy vertical height depends on enemy type (Milestone C)
// Enemy vertical height depends on enemy type (Milestone C)
  const et = (w.eType?.[e] ?? ENEMY_TYPE.CHASER) | 0;
  const HIT_HEIGHT_Z =
      et === ENEMY_TYPE.CHASER ? 2 :
          et === ENEMY_TYPE.RUNNER || et === ENEMY_TYPE.LOOT_GOBLIN ? 3 :
              et === ENEMY_TYPE.BRUISER || et === ENEMY_TYPE.BOSS ? 4 :
                  2;


  const ezFeet = w.ezVisual?.[e] ?? 0; // stored by movement on stairs
  const ezMin = ezFeet;
  const ezMax = ezFeet + HIT_HEIGHT_Z;


  const pz = w.prZVisual?.[p] ?? w.prZ?.[p] ?? w.pzVisual ?? w.pz ?? 0;

  // vertical overlap test (symmetric)
  const zHit = pz >= (ezMin - PROJECTILE_Z_RADIUS) && pz <= (ezMax + PROJECTILE_Z_RADIUS);
  if (!zHit) return false;

  // -----------------------------------------
  // Existing XY logic
  // -----------------------------------------
  if (w.prIsmelee[p]) {
    // Melee: cone-based collision in front of aim direction
    const aimX = w.prDirX[p];
    const aimY = w.prDirY[p];
    const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
    const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
    const toEnemyX = ew.wx - pw.wx;
    const toEnemyY = ew.wy - pw.wy;
    const toEnemyDist = Math.hypot(toEnemyX, toEnemyY);

    // Guard against NaNs
    if (toEnemyDist < 0.0001) return true;

    const toEnemyNormX = toEnemyX / toEnemyDist;
    const toEnemyNormY = toEnemyY / toEnemyDist;
    const dot = aimX * toEnemyNormX + aimY * toEnemyNormY;
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const angle = Math.acos(clampedDot);

    const meleeCone = w.prCone[p] ?? Math.PI / 6;
    const meleeRange = w.prMeleeRange?.[p] ?? w.prR[p];

    // Check if within cone angle and range
    return angle <= meleeCone && toEnemyDist <= meleeRange + w.eR[e];
  } else {
    // Ranged: simple circular collision
    return dx * dx + dy * dy <= rr * rr;
  }
}


/**
 * Determines if the player is hit by an enemy via simple circular overlap.
 *
 * @param w - The game world
 * @param e - Enemy index
 * @param playerR - Player collision radius
 * @returns true if enemy overlaps player radius, false otherwise
 */
/** Return true if the player overlaps an enemy. */
export function isPlayerHit(w: World, e: number, playerR: number): boolean {
  if (isPoeEnemyDormant(w, e)) return false;
  // -----------------------------------------
  // Milestone C: height-aware contact hits
  // Player and enemy only collide if their vertical ranges overlap.
  // -----------------------------------------
  const PLAYER_HIT_HEIGHT_Z = 0.9;

  const et = (w.eType?.[e] ?? ENEMY_TYPE.CHASER) | 0;
  const ENEMY_HIT_HEIGHT_Z =
      et === ENEMY_TYPE.CHASER ? 1 :
          et === ENEMY_TYPE.RUNNER || et === ENEMY_TYPE.LOOT_GOBLIN ? 2 :
              et === ENEMY_TYPE.BRUISER || et === ENEMY_TYPE.BOSS ? 3 :
                  1;

  const pzFeet = w.pzVisual ?? w.pz ?? 0;
  const ezFeet = w.ezVisual?.[e] ?? 0;

  const pzMin = pzFeet;
  const pzMax = pzFeet + PLAYER_HIT_HEIGHT_Z;

  const ezMin = ezFeet;
  const ezMax = ezFeet + ENEMY_HIT_HEIGHT_Z;


  const zOverlap = pzMax >= ezMin && ezMax >= pzMin;
  if (!zOverlap) return false;

  // Existing XY overlap
  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
  const dx = ew.wx - pw.wx;
  const dy = ew.wy - pw.wy;
  const rr = w.eR[e] + playerR;
  return dx * dx + dy * dy <= rr * rr;
}

/**
 * Projectile -> Player hit test (height-aware).
 * Uses player's vertical range and projectile's Z "thickness".
 */
export function isPlayerProjectileHit(w: World, p: number, playerR: number): boolean {
  const PLAYER_HIT_HEIGHT_Z = 0.9;
  const PROJECTILE_Z_RADIUS = 0.25;

  const pzFeet = w.pzVisual ?? w.pz ?? 0;
  const pzMin = pzFeet;
  const pzMax = pzFeet + PLAYER_HIT_HEIGHT_Z;

  const projZ = w.prZVisual?.[p] ?? w.prZ?.[p] ?? pzFeet;

  // symmetric overlap: projectile z within player's range (with thickness)
  const zHit = projZ >= (pzMin - PROJECTILE_Z_RADIUS) && projZ <= (pzMax + PROJECTILE_Z_RADIUS);
  if (!zHit) return false;

  const pp = getProjectileWorld(w as any, p, KENNEY_TILE_WORLD);
  const pw = getPlayerWorld(w as any, KENNEY_TILE_WORLD);
  const dx = pp.wx - pw.wx;
  const dy = pp.wy - pw.wy;
  const rr = ((w as any).prR[p] ?? 0) + playerR;

  return dx * dx + dy * dy <= rr * rr;
}


/** Return true if distance-squared is within radius-squared. */
export function isCircleHit(dx: number, dy: number, rr: number): boolean {
  return dx * dx + dy * dy <= rr * rr;
}

/**
 * Enemy inside a circle centered at (cx, cy).
 * Includes enemy radius so it "feels" correct.
 */
export function isEnemyInCircle(w: World, e: number, cx: number, cy: number, radius: number): boolean {
  const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
  const dx = ew.wx - cx;
  const dy = ew.wy - cy;
  const rr = radius + w.eR[e];
  return isCircleHit(dx, dy, rr);
}
