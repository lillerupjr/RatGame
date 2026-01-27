import type { World } from "../world";
import { spawnEnemy, ENEMY_TYPE } from "../factories/enemyFactory";
import type { EnemyType } from "../factories/enemyFactory";

/**
 * Spawning system:
 * - Executes one-time timeline spawns from the stage definition.
 * - Handles a simple repeating trickle spawn to maintain pressure.
 */
export function spawnSystem(w: World, dt: number) {
  // Floors only (no spawns during boss/transition)
  if (w.runState !== "FLOOR") return;

  // Run stage timeline spawns once
  for (const s of w.stage.spawns) {
    // Skip if this spawn has already fired
    if ((s as any).t === Infinity) continue;

    if (w.phaseTime >= s.t) {
      // Spawn the specified number of enemies in a ring around the player
      for (let k = 0; k < s.count; k++) {
        const angle = w.rng.range(0, Math.PI * 2);
        const radius = w.rng.range(s.radius * 0.8, s.radius);
        const x = w.px + Math.cos(angle) * radius;
        const y = w.py + Math.sin(angle) * radius;
        spawnEnemy(w, s.type as EnemyType, x, y);
      }
      // Mark this timeline spawn as consumed
      (s as any).t = Infinity;
    }
  }

  // Simple repeating trickle spawn (keeps enemy pressure)
  const cadence = 0.1;
  (w as any)._spawnAcc = ((w as any)._spawnAcc ?? 0) + dt;

  while ((w as any)._spawnAcc >= cadence) {
    (w as any)._spawnAcc -= cadence;

    // Decide enemy type based on phase time and random roll
    const roll = w.rng.next();
    let type: EnemyType = ENEMY_TYPE.CHASER;
    if (w.phaseTime > 60 && roll < 0.35) {
      type = ENEMY_TYPE.RUNNER;
    }
    if (w.phaseTime > 120 && roll < 0.08) {
      type = ENEMY_TYPE.BRUISER;
    }

    // Spawn one enemy at a random point around the player
    const angle = w.rng.range(0, Math.PI * 2);
    const radius = w.rng.range(520, 650);
    const x = w.px + Math.cos(angle) * radius;
    const y = w.py + Math.sin(angle) * radius;
    spawnEnemy(w, type, x, y);
  }
}
