import type { World } from "../world";
import { spawnEnemy } from "../factories/enemyFactory";
import type { EnemyType } from "../factories/enemyFactory";
import { floorForIndex, pickFloorEnemyType } from "../content/floors";
import { walkInfo } from "../map/kenneyMap";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";

/**
 * Spawning system:
 * - Executes one-time timeline spawns from the stage definition.
 * - Handles a floor-configurable trickle spawn (cadence, counts, weighted mix).
 *
 * Milestone B:
 * - Spawns must respect tile walk logic (no void, no outside top-face diamond).
 * - Spawns should respect active floor height (avoid popping onto other platforms).
 */
export function spawnSystem(w: World, dt: number) {
  // Floors only (no spawns during boss/transition)
  if (w.runState !== "FLOOR") return;

  const activeH = w.activeFloorH ?? 0;

  // Try to find a valid spawn point near the desired ring position.
  // We keep this intentionally cheap: a few tries + small jitter.
  const findSpawnPoint = (baseX: number, baseY: number, maxTries: number) => {
    for (let t = 0; t < maxTries; t++) {
      // jitter grows slightly with retries (helps escape void seams / cutouts)
      const j = 18 + t * 6;
      const x = baseX + w.rng.range(-j, j);
      const y = baseY + w.rng.range(-j, j);

      const info = walkInfo(x, y, KENNEY_TILE_WORLD);

      // must be walkable
      if (!info.walkable) continue;

      // prefer not to spawn on stairs (usually bad feel)
      if (info.kind === "STAIRS") continue;

      // enforce same-height as active floor
      if (info.h !== activeH) continue;

      return { x, y };
    }
    return null;
  };

  // Run stage timeline spawns once (now validated)
  for (const s of w.stage.spawns) {
    if ((s as any).t === Infinity) continue;

    if (w.phaseTime >= s.t) {
      for (let k = 0; k < s.count; k++) {
        const angle = w.rng.range(0, Math.PI * 2);
        const radius = w.rng.range(s.radius * 0.8, s.radius);
        const baseX = w.px + Math.cos(angle) * radius;
        const baseY = w.py + Math.sin(angle) * radius;

        const p = findSpawnPoint(baseX, baseY, 18);
        if (!p) continue;

        spawnEnemy(w, s.type as EnemyType, p.x, p.y);
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
      const baseX = w.px + Math.cos(angle) * radius;
      const baseY = w.py + Math.sin(angle) * radius;

      const p = findSpawnPoint(baseX, baseY, 18);
      if (!p) continue;

      spawnEnemy(w, type, p.x, p.y);
    }
  }
}
