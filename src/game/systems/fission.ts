// src/game/systems/fission.ts

import type { World } from "../world";
import { spawnProjectileGrid, PRJ_KIND } from "../factories/projectileFactory";
import { gridToWorld, worldToGrid } from "../coords/grid";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";

/**
 * Nuclear Fission system:
 * When two fission-capable projectiles collide with each other,
 * they spawn 2 NEW projectiles traveling perpendicular to the collision.
 * 
 * NO CAPS, NO LIMITS - true exponential chaos!
 * The only natural limit is TTL/bounces running out.
 */
export function fissionSystem(w: World, dt: number) {
  // Update fission cooldowns
  for (let p = 0; p < w.pAlive.length; p++) {
    if (!w.pAlive[p]) continue;
    if (w.prFissionCd[p] > 0) {
      w.prFissionCd[p] -= dt;
    }
  }

  // Count current fission projectiles for logging
  let fissionCount = 0;
  for (let p = 0; p < w.pAlive.length; p++) {
    if (w.pAlive[p] && w.prFission[p]) fissionCount++;
  }

  // Hard cap to prevent performance issues (but high enough for chaos)
  const MAX_FISSION = 300;
  if (fissionCount >= MAX_FISSION) {
    return; // Stop spawning new ones
  }

  // Check for fission projectile collisions
  // We'll queue spawns to avoid modifying arrays while iterating
  const spawns: { x: number; y: number; vx1: number; vy1: number; vx2: number; vy2: number; damage: number; speed: number; radius: number }[] = [];

  // Track pairs that have already collided this frame (not individual projectiles!)
  const collidedPairs = new Set<string>();

  // Collect all fission-capable projectiles that are off cooldown
  const fissionProjectiles: number[] = [];
  for (let p = 0; p < w.pAlive.length; p++) {
    if (w.pAlive[p] && w.prFission[p] && w.prFissionCd[p] <= 0) {
      fissionProjectiles.push(p);
    }
  }

  // Check each pair of fission projectiles
  for (let i = 0; i < fissionProjectiles.length; i++) {
    const p1 = fissionProjectiles[i];
    
    const p1w = projectileWorld(w, p1, KENNEY_TILE_WORLD);
    const x1 = p1w.wx;
    const y1 = p1w.wy;
    const r1 = w.prR[p1];
    const vx1 = w.prvx[p1];
    const vy1 = w.prvy[p1];

    for (let j = i + 1; j < fissionProjectiles.length; j++) {
      const p2 = fissionProjectiles[j];
      
      // Create unique pair key
      const pairKey = `${Math.min(p1, p2)}_${Math.max(p1, p2)}`;
      if (collidedPairs.has(pairKey)) continue;

      const p2w = projectileWorld(w, p2, KENNEY_TILE_WORLD);
      const x2 = p2w.wx;
      const y2 = p2w.wy;
      const r2 = w.prR[p2];
      const vx2 = w.prvx[p2];
      const vy2 = w.prvy[p2];

      // Check collision - generous collision radius
      const dx = x2 - x1;
      const dy = y2 - y1;
      const distSq = dx * dx + dy * dy;
      const collisionDist = (r1 + r2) * 3; // 3x radius for generous detection

      if (distSq > collisionDist * collisionDist) continue;

      // COLLISION DETECTED!
      collidedPairs.add(pairKey);
      
      // Short cooldown - just enough to prevent same-frame spam
      w.prFissionCd[p1] = 0.06;
      w.prFissionCd[p2] = 0.06;

      // Spawn point is at collision midpoint
      const spawnX = (x1 + x2) / 2;
      const spawnY = (y1 + y2) / 2;

      // Calculate perpendicular directions to collision axis
      const dist = Math.sqrt(distSq) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      
      // Perpendicular vectors (both directions)
      const perpX = -ny;
      const perpY = nx;

      // Use average speed of the two balls
      const speed1 = Math.hypot(vx1, vy1);
      const speed2 = Math.hypot(vx2, vy2);
      const avgSpeed = Math.max((speed1 + speed2) / 2, 300); // minimum 300 speed

      // Average properties
      const avgDamage = (w.prDamage[p1] + w.prDamage[p2]) / 2;
      const avgRadius = (r1 + r2) / 2;

      spawns.push({
        x: spawnX,
        y: spawnY,
        vx1: perpX * avgSpeed,  // First new ball goes one perpendicular direction
        vy1: perpY * avgSpeed,
        vx2: -perpX * avgSpeed, // Second new ball goes opposite perpendicular
        vy2: -perpY * avgSpeed,
        damage: avgDamage,
        speed: avgSpeed,
        radius: avgRadius,
      });
      
      // DON'T break - allow this projectile to collide with others too!
    }
  }

  // Spawn the new fission projectiles (2 per collision for exponential growth!)
  for (const s of spawns) {
    // Spawn BOTH perpendicular directions
    for (const [vx, vy] of [[s.vx1, s.vy1], [s.vx2, s.vy2]]) {
      if (fissionCount >= MAX_FISSION) break;
      
      const gp = worldToGrid(s.x, s.y, KENNEY_TILE_WORLD);
      const gd = worldToGrid(vx, vy, KENNEY_TILE_WORLD);
      const p = spawnProjectileGrid(w, {
        kind: PRJ_KIND.BOUNCER,
        gx: gp.gx,
        gy: gp.gy,
        dirGx: gd.gx,
        dirGy: gd.gy,
        speed: s.speed,
        damage: s.damage,
        radius: s.radius,
        pierce: 999,
        ttl: 9999,       // effectively infinite
        bounces: 9999,   // effectively infinite
        wallBounce: true,
      });
      w.prFission[p] = true;
      w.prFissionCd[p] = 0.04; // tiny cooldown
      fissionCount++;
    }
  }
}

function projectileWorld(w: World, i: number, tileWorld: number) {
  const gx = w.prgxi[i] + w.prgox[i];
  const gy = w.prgyi[i] + w.prgoy[i];
  return gridToWorld(gx, gy, tileWorld);
}
