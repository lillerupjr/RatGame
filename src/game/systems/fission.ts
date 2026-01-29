// src/game/systems/fission.ts

import type { World } from "../world";
import { spawnProjectile, PRJ_KIND } from "../factories/projectileFactory";

/**
 * Nuclear Fission system:
 * When two fission-capable projectiles collide with each other,
 * they spawn a 3rd projectile traveling in a perpendicular direction.
 * 
 * This creates exponential chaos as more balls spawn and collide!
 */
export function fissionSystem(w: World, dt: number) {
  // Update fission cooldowns
  for (let p = 0; p < w.pAlive.length; p++) {
    if (!w.pAlive[p]) continue;
    if (w.prFissionCd[p] > 0) {
      w.prFissionCd[p] -= dt;
    }
  }

  // Cap on total fission projectiles to prevent performance death
  const MAX_FISSION_PROJECTILES = 80;
  
  let fissionCount = 0;
  for (let p = 0; p < w.pAlive.length; p++) {
    if (w.pAlive[p] && w.prFission[p]) fissionCount++;
  }

  if (fissionCount >= MAX_FISSION_PROJECTILES) return;

  // Check for fission projectile collisions
  // We'll queue spawns to avoid modifying arrays while iterating
  const spawns: { x: number; y: number; dirX: number; dirY: number; damage: number; speed: number; radius: number }[] = [];

  for (let p1 = 0; p1 < w.pAlive.length; p1++) {
    if (!w.pAlive[p1]) continue;
    if (!w.prFission[p1]) continue;
    if (w.prFissionCd[p1] > 0) continue;

    const x1 = w.prx[p1];
    const y1 = w.pry[p1];
    const r1 = w.prR[p1];

    for (let p2 = p1 + 1; p2 < w.pAlive.length; p2++) {
      if (!w.pAlive[p2]) continue;
      if (!w.prFission[p2]) continue;
      if (w.prFissionCd[p2] > 0) continue;

      const x2 = w.prx[p2];
      const y2 = w.pry[p2];
      const r2 = w.prR[p2];

      // Check collision
      const dx = x2 - x1;
      const dy = y2 - y1;
      const distSq = dx * dx + dy * dy;
      const rr = r1 + r2;

      if (distSq > rr * rr) continue;

      // COLLISION! Spawn a new projectile
      
      // Put both on cooldown so they don't immediately fission again
      w.prFissionCd[p1] = 0.15;
      w.prFissionCd[p2] = 0.15;

      // Spawn point is midway between the two
      const spawnX = (x1 + x2) / 2;
      const spawnY = (y1 + y2) / 2;

      // New projectile direction: perpendicular to the collision axis
      // with some randomness for variety
      const dist = Math.sqrt(distSq) || 0.0001;
      const nx = dx / dist;
      const ny = dy / dist;

      // Perpendicular (rotate 90 degrees), randomly pick one of two perpendiculars
      const sign = w.rng.range(0, 1) > 0.5 ? 1 : -1;
      const perpX = -ny * sign;
      const perpY = nx * sign;

      // Average the properties of the two colliding projectiles
      const avgDamage = (w.prDamage[p1] + w.prDamage[p2]) / 2;
      const avgSpeed = (Math.hypot(w.prvx[p1], w.prvy[p1]) + Math.hypot(w.prvx[p2], w.prvy[p2])) / 2;
      const avgRadius = (r1 + r2) / 2;

      spawns.push({
        x: spawnX,
        y: spawnY,
        dirX: perpX,
        dirY: perpY,
        damage: avgDamage * 0.9, // slight damage falloff to prevent infinite scaling
        speed: avgSpeed,
        radius: avgRadius,
      });

      // Only one fission event per projectile per frame
      break;
    }
  }

  // Spawn the new fission projectiles
  for (const s of spawns) {
    if (fissionCount >= MAX_FISSION_PROJECTILES) break;

    const p = spawnProjectile(w, {
      kind: PRJ_KIND.BOUNCER,
      x: s.x,
      y: s.y,
      dirX: s.dirX,
      dirY: s.dirY,
      speed: s.speed,
      damage: s.damage,
      radius: s.radius,
      pierce: 999,
      ttl: 8.0,
      bounces: 12,
      wallBounce: true,
    });

    // Mark the new projectile as fission-capable too!
    w.prFission[p] = true;
    w.prFissionCd[p] = 0.2; // start with a short cooldown

    fissionCount++;
  }
}
