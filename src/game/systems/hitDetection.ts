import { World } from "../world";

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
  const HIT_HEIGHT_Z = 0.9;        // enemy vertical size (zFeet..zFeet+H)
  const PROJECTILE_Z_RADIUS = 0.25; // projectile vertical thickness

  const ezFeet = (w as any).ez?.[e] ?? 0;         // stored by movement on stairs
  const ezMin = ezFeet;
  const ezMax = ezFeet + HIT_HEIGHT_Z;

  const pz = (w as any).prz?.[p] ?? (w as any).pz ?? 0;

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
    const toEnemyX = w.ex[e] - w.px;
    const toEnemyY = w.ey[e] - w.py;
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
export function isPlayerHit(w: World, e: number, playerR: number): boolean {
  const dx = w.ex[e] - w.px;
  const dy = w.ey[e] - w.py;
  const rr = w.eR[e] + playerR;
  return dx * dx + dy * dy <= rr * rr;
}

export function isCircleHit(dx: number, dy: number, rr: number): boolean {
  return dx * dx + dy * dy <= rr * rr;
}

/**
 * Enemy inside a circle centered at (cx, cy).
 * Includes enemy radius so it "feels" correct.
 */
export function isEnemyInCircle(w: World, e: number, cx: number, cy: number, radius: number): boolean {
  const dx = w.ex[e] - cx;
  const dy = w.ey[e] - cy;
  const rr = radius + w.eR[e];
  return isCircleHit(dx, dy, rr);
}