// src/game/util/targeting.ts

import type { World } from "../../engine/world/world";
import { gridAtPlayer } from "../../engine/world/world";
import { gridToWorld, worldToGrid } from "../coords/grid";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { queryCircle, queryCircleUnique } from "./spatialHash";
import { getEnemyAimWorld, getPlayerAimWorld } from "../combat/aimPoints";

/**
 * Targeting strategies for weapons.
 * Different weapons may want different heuristics for picking targets.
 */
export type TargetingStrategy =
  | "CLOSEST"       // Nearest enemy (default, good for precision weapons)
  | "CLUSTER"       // Center of the largest enemy cluster (good for AoE weapons)
  | "RANDOM"        // Random enemy in range (unpredictable spread)
  | "STRONGEST"     // Highest current HP (focus fire on threats)
  | "WEAKEST"       // Lowest current HP (secure kills)
  | "FARTHEST";     // Farthest enemy in range (sniper-style)

export type TargetResult = {
  /** Enemy index, or -1 if no target found */
  enemyIndex: number;
  /** Target world position X (derived from grid) */
  x: number;
  /** Target world position Y (derived from grid) */
  y: number;
  /** Direction from player to target (grid-space) */
  dirX: number;
  dirY: number;
  /** Distance to target */
  distance: number;
};

const NO_TARGET: TargetResult = {
  enemyIndex: -1,
  x: 0,
  y: 0,
  dirX: 1,
  dirY: 0,
  distance: 0,
};

const TILE_WORLD = KENNEY_TILE_WORLD;

function enemyGrid(w: World, e: number) {
  return { gx: w.egxi[e] + w.egox[e], gy: w.egyi[e] + w.egoy[e] };
}

function worldPosFromGrid(gx: number, gy: number) {
  const wp = gridToWorld(gx, gy, TILE_WORLD);
  return { x: wp.wx, y: wp.wy };
}

function gridPosFromWorld(x: number, y: number) {
  return worldToGrid(x, y, TILE_WORLD);
}

function worldDeltaFromGridDelta(dxg: number, dyg: number) {
  const wp = gridToWorld(dxg, dyg, TILE_WORLD);
  return { dx: wp.wx, dy: wp.wy };
}

function worldDistSqFromGridDelta(dxg: number, dyg: number) {
  const wv = worldDeltaFromGridDelta(dxg, dyg);
  return wv.dx * wv.dx + wv.dy * wv.dy;
}

function worldDistFromGridDelta(dxg: number, dyg: number) {
  return Math.sqrt(worldDistSqFromGridDelta(dxg, dyg));
}

function gridDir(dxg: number, dyg: number) {
  const len = Math.hypot(dxg, dyg) || 0.0001;
  return { dx: dxg / len, dy: dyg / len };
}

/**
 * Finds a target using the specified strategy.
 * 
 * @param w - Game world
 * @param strategy - Targeting heuristic to use
 * @param maxRange - Maximum range to consider enemies (0 = unlimited)
 * @param clusterRadius - For CLUSTER strategy, the radius to consider enemies "grouped"
 * @returns Target result with position and direction
 */
export function findTarget(
  w: World,
  strategy: TargetingStrategy,
  maxRange: number = 0,
  clusterRadius: number = 80
): TargetResult {
  switch (strategy) {
    case "CLOSEST":
      return findClosestTarget(w, maxRange);
    case "CLUSTER":
      return findClusterTarget(w, maxRange, clusterRadius);
    case "RANDOM":
      return findRandomTarget(w, maxRange);
    case "STRONGEST":
      return findStrongestTarget(w, maxRange);
    case "WEAKEST":
      return findWeakestTarget(w, maxRange);
    case "FARTHEST":
      return findFarthestTarget(w, maxRange);
    default:
      return findClosestTarget(w, maxRange);
  }
}

/**
 * Find the closest enemy to the player.
 */
export function findClosestTarget(w: World, maxRange: number = 0): TargetResult {
  let best = -1;
  let bestD2 = maxRange > 0 ? maxRange * maxRange : Infinity;
  const pg = gridAtPlayer(w);
  const pw = worldPosFromGrid(pg.gx, pg.gy);

  // Use spatial hash if range is limited, otherwise scan all
  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, pw.x, pw.y, maxRange + 50);
    for (const e of nearby) {
      if (!w.eAlive[e]) continue;
      const eg = enemyGrid(w, e);
      const dxg = eg.gx - pg.gx;
      const dyg = eg.gy - pg.gy;
      const d2 = worldDistSqFromGridDelta(dxg, dyg);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
  } else {
    for (let e = 0; e < w.eAlive.length; e++) {
      if (!w.eAlive[e]) continue;
      const eg = enemyGrid(w, e);
      const dxg = eg.gx - pg.gx;
      const dyg = eg.gy - pg.gy;
      const d2 = worldDistSqFromGridDelta(dxg, dyg);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
  }

  if (best === -1) return NO_TARGET;

  return makeTargetResult(w, best);
}

/**
 * Find the center of the largest enemy cluster.
 * Uses grid-based density estimation for efficiency.
 */
export function findClusterTarget(
  w: World,
  maxRange: number = 0,
  clusterRadius: number = 80
): TargetResult {
  const maxR2 = maxRange > 0 ? maxRange * maxRange : Infinity;
  const pg = gridAtPlayer(w);
  const pw = worldPosFromGrid(pg.gx, pg.gy);
  
  // Collect candidates within range
  const candidates: number[] = [];
  
  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, pw.x, pw.y, maxRange + 50);
    for (const e of nearby) {
      if (!w.eAlive[e]) continue;
      const eg = enemyGrid(w, e);
      const dxg = eg.gx - pg.gx;
      const dyg = eg.gy - pg.gy;
      if (worldDistSqFromGridDelta(dxg, dyg) <= maxR2) {
        candidates.push(e);
      }
    }
  } else {
    for (let e = 0; e < w.eAlive.length; e++) {
      if (!w.eAlive[e]) continue;
      candidates.push(e);
    }
  }

  if (candidates.length === 0) return NO_TARGET;
  if (candidates.length === 1) return makeTargetResult(w, candidates[0]);

  // For each candidate, count how many other candidates are within clusterRadius
  // The candidate with the most neighbors defines the cluster center
  let bestCenter = candidates[0];
  let bestCount = 0;
  let bestCenterGx = enemyGrid(w, candidates[0]).gx;
  let bestCenterGy = enemyGrid(w, candidates[0]).gy;

  const cr2 = clusterRadius * clusterRadius;

  for (let i = 0; i < candidates.length; i++) {
    const e = candidates[i];
    const eg = enemyGrid(w, e);
    const exg = eg.gx;
    const eyg = eg.gy;
    
    let count = 0;
    let sumGx = 0;
    let sumGy = 0;

    for (let j = 0; j < candidates.length; j++) {
      const other = candidates[j];
      const og = enemyGrid(w, other);
      const dxg = og.gx - exg;
      const dyg = og.gy - eyg;
      if (worldDistSqFromGridDelta(dxg, dyg) <= cr2) {
        count++;
        sumGx += og.gx;
        sumGy += og.gy;
      }
    }

    if (count > bestCount) {
      bestCount = count;
      bestCenter = e;
      // Use centroid of the cluster as the target point
      bestCenterGx = sumGx / count;
      bestCenterGy = sumGy / count;
    }
  }

  // Return the cluster centroid (not necessarily an enemy position)
  const dxg = bestCenterGx - pg.gx;
  const dyg = bestCenterGy - pg.gy;
  const wpos = worldPosFromGrid(bestCenterGx, bestCenterGy);
  const playerAim = getPlayerAimWorld(w);
  const worldDx = wpos.x - playerAim.x;
  const worldDy = wpos.y - playerAim.y;
  const dist = Math.hypot(worldDx, worldDy) || 0.0001;
  const invDist = 1 / dist;

  return {
    enemyIndex: bestCenter, // The enemy that anchors the cluster
    x: wpos.x,
    y: wpos.y,
    dirX: worldDx * invDist,
    dirY: worldDy * invDist,
    distance: dist,
  };
}

/**
 * Find a random enemy within range.
 */
export function findRandomTarget(w: World, maxRange: number = 0): TargetResult {
  const maxR2 = maxRange > 0 ? maxRange * maxRange : Infinity;
  const candidates: number[] = [];
  const pg = gridAtPlayer(w);
  const pw = worldPosFromGrid(pg.gx, pg.gy);

  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, pw.x, pw.y, maxRange + 50);
    for (const e of nearby) {
      if (!w.eAlive[e]) continue;
      const eg = enemyGrid(w, e);
      const dxg = eg.gx - pg.gx;
      const dyg = eg.gy - pg.gy;
      if (worldDistSqFromGridDelta(dxg, dyg) <= maxR2) {
        candidates.push(e);
      }
    }
  } else {
    for (let e = 0; e < w.eAlive.length; e++) {
      if (!w.eAlive[e]) continue;
      candidates.push(e);
    }
  }

  if (candidates.length === 0) return NO_TARGET;

  const pick = candidates[w.rng.int(0, candidates.length - 1)];
  return makeTargetResult(w, pick);
}

/**
 * Find the enemy with the highest HP within range.
 */
export function findStrongestTarget(w: World, maxRange: number = 0): TargetResult {
  const maxR2 = maxRange > 0 ? maxRange * maxRange : Infinity;
  let best = -1;
  let bestHp = -Infinity;
  const pg = gridAtPlayer(w);
  const pw = worldPosFromGrid(pg.gx, pg.gy);

  const checkEnemy = (e: number) => {
    if (!w.eAlive[e]) return;
    const eg = enemyGrid(w, e);
    const dxg = eg.gx - pg.gx;
    const dyg = eg.gy - pg.gy;
    if (maxRange > 0 && worldDistSqFromGridDelta(dxg, dyg) > maxR2) return;
    
    if (w.eHp[e] > bestHp) {
      bestHp = w.eHp[e];
      best = e;
    }
  };

  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, pw.x, pw.y, maxRange + 50);
    for (const e of nearby) checkEnemy(e);
  } else {
    for (let e = 0; e < w.eAlive.length; e++) checkEnemy(e);
  }

  if (best === -1) return NO_TARGET;
  return makeTargetResult(w, best);
}

/**
 * Find the enemy with the lowest HP within range (easy kills).
 */
export function findWeakestTarget(w: World, maxRange: number = 0): TargetResult {
  const maxR2 = maxRange > 0 ? maxRange * maxRange : Infinity;
  let best = -1;
  let bestHp = Infinity;
  const pg = gridAtPlayer(w);
  const pw = worldPosFromGrid(pg.gx, pg.gy);

  const checkEnemy = (e: number) => {
    if (!w.eAlive[e]) return;
    const eg = enemyGrid(w, e);
    const dxg = eg.gx - pg.gx;
    const dyg = eg.gy - pg.gy;
    if (maxRange > 0 && worldDistSqFromGridDelta(dxg, dyg) > maxR2) return;
    
    if (w.eHp[e] < bestHp) {
      bestHp = w.eHp[e];
      best = e;
    }
  };

  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, pw.x, pw.y, maxRange + 50);
    for (const e of nearby) checkEnemy(e);
  } else {
    for (let e = 0; e < w.eAlive.length; e++) checkEnemy(e);
  }

  if (best === -1) return NO_TARGET;
  return makeTargetResult(w, best);
}

/**
 * Find the farthest enemy within range (sniper-style targeting).
 */
export function findFarthestTarget(w: World, maxRange: number = 0): TargetResult {
  const maxR2 = maxRange > 0 ? maxRange * maxRange : Infinity;
  let best = -1;
  let bestD2 = 0;
  const pg = gridAtPlayer(w);
  const pw = worldPosFromGrid(pg.gx, pg.gy);

  const checkEnemy = (e: number) => {
    if (!w.eAlive[e]) return;
    const eg = enemyGrid(w, e);
    const dxg = eg.gx - pg.gx;
    const dyg = eg.gy - pg.gy;
    const d2 = worldDistSqFromGridDelta(dxg, dyg);
    if (maxRange > 0 && d2 > maxR2) return;
    
    if (d2 > bestD2) {
      bestD2 = d2;
      best = e;
    }
  };

  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, pw.x, pw.y, maxRange + 50);
    for (const e of nearby) checkEnemy(e);
  } else {
    for (let e = 0; e < w.eAlive.length; e++) checkEnemy(e);
  }

  if (best === -1) return NO_TARGET;
  return makeTargetResult(w, best);
}

/**
 * Helper to build a TargetResult from an enemy index.
 */
function makeTargetResult(w: World, e: number): TargetResult {
  const from = getPlayerAimWorld(w);
  const to = getEnemyAimWorld(w, e);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const invDist = 1 / dist;

  return {
    enemyIndex: e,
    x: to.x,
    y: to.y,
    dirX: dx * invDist,
    dirY: dy * invDist,
    distance: dist,
  };
}

/**
 * Gets candidates in range for custom weapon logic.
 * Returns array of enemy indices within maxRange of the player.
 */
export function getEnemiesInRange(w: World, maxRange: number): number[] {
  const maxR2 = maxRange * maxRange;
  const candidates: number[] = [];
  const pg = gridAtPlayer(w);
  const pw = worldPosFromGrid(pg.gx, pg.gy);

  const nearby = queryCircleUnique(w.enemySpatialHash, pw.x, pw.y, maxRange + 50);
  for (const e of nearby) {
    if (!w.eAlive[e]) continue;
    const eg = enemyGrid(w, e);
    const dxg = eg.gx - pg.gx;
    const dyg = eg.gy - pg.gy;
    if (worldDistSqFromGridDelta(dxg, dyg) <= maxR2) {
      candidates.push(e);
    }
  }

  return candidates;
}

/**
 * Counts enemies near a point (useful for evaluating target quality).
 */
export function countEnemiesNear(
  w: World,
  x: number,
  y: number,
  radius: number
): number {
  const r2 = radius * radius;
  let count = 0;

  const nearby = queryCircle(w.enemySpatialHash, x, y, radius + 50);
  const seen = new Set<number>();

  for (let i = 0; i < nearby.length; i++) {
    const e = nearby[i];
    if (seen.has(e)) continue;
    seen.add(e);
    
    if (!w.eAlive[e]) continue;
    const eg = enemyGrid(w, e);
    const tg = gridPosFromWorld(x, y);
    const dxg = eg.gx - tg.gx;
    const dyg = eg.gy - tg.gy;
    if (worldDistSqFromGridDelta(dxg, dyg) <= r2) {
      count++;
    }
  }

  return count;
}
