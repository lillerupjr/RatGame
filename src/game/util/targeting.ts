// src/game/util/targeting.ts

import type { World } from "../world";
import { queryCircle, queryCircleUnique } from "./spatialHash";

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
  /** Target world position X (may differ from enemy position for CLUSTER) */
  x: number;
  /** Target world position Y */
  y: number;
  /** Direction from player to target (normalized) */
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

  // Use spatial hash if range is limited, otherwise scan all
  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, w.px, w.py, maxRange + 50);
    for (const e of nearby) {
      if (!w.eAlive[e]) continue;
      const dx = w.ex[e] - w.px;
      const dy = w.ey[e] - w.py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
  } else {
    for (let e = 0; e < w.eAlive.length; e++) {
      if (!w.eAlive[e]) continue;
      const dx = w.ex[e] - w.px;
      const dy = w.ey[e] - w.py;
      const d2 = dx * dx + dy * dy;
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
  
  // Collect candidates within range
  const candidates: number[] = [];
  
  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, w.px, w.py, maxRange + 50);
    for (const e of nearby) {
      if (!w.eAlive[e]) continue;
      const dx = w.ex[e] - w.px;
      const dy = w.ey[e] - w.py;
      if (dx * dx + dy * dy <= maxR2) {
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
  let bestCenterX = w.ex[candidates[0]];
  let bestCenterY = w.ey[candidates[0]];

  const cr2 = clusterRadius * clusterRadius;

  for (let i = 0; i < candidates.length; i++) {
    const e = candidates[i];
    const ex = w.ex[e];
    const ey = w.ey[e];
    
    let count = 0;
    let sumX = 0;
    let sumY = 0;

    for (let j = 0; j < candidates.length; j++) {
      const other = candidates[j];
      const dx = w.ex[other] - ex;
      const dy = w.ey[other] - ey;
      if (dx * dx + dy * dy <= cr2) {
        count++;
        sumX += w.ex[other];
        sumY += w.ey[other];
      }
    }

    if (count > bestCount) {
      bestCount = count;
      bestCenter = e;
      // Use centroid of the cluster as the target point
      bestCenterX = sumX / count;
      bestCenterY = sumY / count;
    }
  }

  // Return the cluster centroid (not necessarily an enemy position)
  const dx = bestCenterX - w.px;
  const dy = bestCenterY - w.py;
  const dist = Math.hypot(dx, dy) || 0.0001;

  return {
    enemyIndex: bestCenter, // The enemy that anchors the cluster
    x: bestCenterX,
    y: bestCenterY,
    dirX: dx / dist,
    dirY: dy / dist,
    distance: dist,
  };
}

/**
 * Find a random enemy within range.
 */
export function findRandomTarget(w: World, maxRange: number = 0): TargetResult {
  const maxR2 = maxRange > 0 ? maxRange * maxRange : Infinity;
  const candidates: number[] = [];

  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, w.px, w.py, maxRange + 50);
    for (const e of nearby) {
      if (!w.eAlive[e]) continue;
      const dx = w.ex[e] - w.px;
      const dy = w.ey[e] - w.py;
      if (dx * dx + dy * dy <= maxR2) {
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

  const checkEnemy = (e: number) => {
    if (!w.eAlive[e]) return;
    const dx = w.ex[e] - w.px;
    const dy = w.ey[e] - w.py;
    if (maxRange > 0 && dx * dx + dy * dy > maxR2) return;
    
    if (w.eHp[e] > bestHp) {
      bestHp = w.eHp[e];
      best = e;
    }
  };

  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, w.px, w.py, maxRange + 50);
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

  const checkEnemy = (e: number) => {
    if (!w.eAlive[e]) return;
    const dx = w.ex[e] - w.px;
    const dy = w.ey[e] - w.py;
    if (maxRange > 0 && dx * dx + dy * dy > maxR2) return;
    
    if (w.eHp[e] < bestHp) {
      bestHp = w.eHp[e];
      best = e;
    }
  };

  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, w.px, w.py, maxRange + 50);
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

  const checkEnemy = (e: number) => {
    if (!w.eAlive[e]) return;
    const dx = w.ex[e] - w.px;
    const dy = w.ey[e] - w.py;
    const d2 = dx * dx + dy * dy;
    if (maxRange > 0 && d2 > maxR2) return;
    
    if (d2 > bestD2) {
      bestD2 = d2;
      best = e;
    }
  };

  if (maxRange > 0) {
    const nearby = queryCircleUnique(w.enemySpatialHash, w.px, w.py, maxRange + 50);
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
  const dx = w.ex[e] - w.px;
  const dy = w.ey[e] - w.py;
  const dist = Math.hypot(dx, dy) || 0.0001;

  return {
    enemyIndex: e,
    x: w.ex[e],
    y: w.ey[e],
    dirX: dx / dist,
    dirY: dy / dist,
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

  const nearby = queryCircleUnique(w.enemySpatialHash, w.px, w.py, maxRange + 50);
  for (const e of nearby) {
    if (!w.eAlive[e]) continue;
    const dx = w.ex[e] - w.px;
    const dy = w.ey[e] - w.py;
    if (dx * dx + dy * dy <= maxR2) {
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
    const dx = w.ex[e] - x;
    const dy = w.ey[e] - y;
    if (dx * dx + dy * dy <= r2) {
      count++;
    }
  }

  return count;
}
