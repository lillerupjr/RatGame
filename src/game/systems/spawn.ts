import type { World } from "../world";
import { spawnEnemy } from "../factories/enemyFactory";
import type { EnemyType } from "../factories/enemyFactory";
import { floorForIndex, pickFloorEnemyType } from "../content/floors";

/**
 * Spawning system:
 * - Executes one-time timeline spawns from the stage definition.
 * - Handles a floor-configurable trickle spawn (cadence, counts, weighted mix).
 */
export function spawnSystem(w: World, dt: number) {
  // Floors only (no spawns during boss/transition)
  if (w.runState !== "FLOOR") return;

  // Run stage timeline spawns once
  for (const s of w.stage.spawns) {
    if ((s as any).t === Infinity) continue;

    if (w.phaseTime >= s.t) {
      for (let k = 0; k < s.count; k++) {
        const angle = w.rng.range(0, Math.PI * 2);
        const radius = w.rng.range(s.radius * 0.8, s.radius);
        const x = w.px + Math.cos(angle) * radius;
        const y = w.py + Math.sin(angle) * radius;
        spawnEnemy(w, s.type as EnemyType, x, y);
      }
      (s as any).t = Infinity;
    }
  }

  // Floor-specific trickle spawn
  const floor = floorForIndex(w.floorIndex ?? 0);

  // Apply delve spawn rate scaling
  const spawnRateMult = w.delveScaling?.spawnRateMult ?? 1;
  const cadence = Math.max(0.02, floor.spawns.cadence / spawnRateMult);
  (w as any)._spawnAcc = ((w as any)._spawnAcc ?? 0) + dt;

  while ((w as any)._spawnAcc >= cadence) {
    (w as any)._spawnAcc -= cadence;

    const n = w.rng.int(floor.spawns.perTickMin, floor.spawns.perTickMax);

    for (let i = 0; i < n; i++) {
      const type = pickFloorEnemyType(w);

      const angle = w.rng.range(0, Math.PI * 2);
      const radius = w.rng.range(floor.spawns.ringMin, floor.spawns.ringMax);
      const x = w.px + Math.cos(angle) * radius;
      const y = w.py + Math.sin(angle) * radius;

      spawnEnemy(w, type, x, y);
    }
  }
}
