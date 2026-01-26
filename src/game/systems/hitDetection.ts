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
  if (w.prIsmelee[p]) {
    // Melee: cone-based collision in front of aim direction
    const aimX = w.prDirX[p];
    const aimY = w.prDirY[p];
    const toEnemyX = w.ex[e] - w.px;
    const toEnemyY = w.ey[e] - w.py;
    const toEnemyDist = Math.hypot(toEnemyX, toEnemyY);
    const toEnemyNormX = toEnemyX / toEnemyDist;
    const toEnemyNormY = toEnemyY / toEnemyDist;
    const dot = aimX * toEnemyNormX + aimY * toEnemyNormY;
    const angle = Math.acos(dot);
    const meleeCone = w.prCone[p] ?? Math.PI / 6;
    const meleeRange = w.prMeleeRange?.[p] ?? w.prR[p];

    // Check if within cone angle and range
    return angle <= meleeCone && toEnemyDist <= meleeRange + w.eR[e];
  } else {
    // Ranged: simple circular collision
    return dx * dx + dy * dy <= rr * rr;
  }
}
