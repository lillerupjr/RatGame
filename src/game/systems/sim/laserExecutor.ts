// @system   core-simulation/combat-runtime
// @owns     periodic scan-and-execute for low-life enemies within range
// @doc      docs/canonical/core_simulation_combat_runtime.md
// @agents   no combat rule collection; see combatRules.ts

import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getPlayerWorld, getEnemyWorld } from "../../coords/worldViews";
import { queryCircle } from "../../util/spatialHash";
import { isEnemyInCircle } from "./hitDetection";
import { finalizeEnemyDeath } from "../enemies/finalize";
import { makePlayerTriggerHitMeta } from "../../combat/damageMeta";
import type { CombatRulesSnapshot } from "../../progression/effects/combatRules";

/**
 * Periodically scan for nearby low-life enemies and execute them.
 * Called once per sim frame.
 */
export function tickLaserExecutor(w: World, dt: number, combatRules: CombatRulesSnapshot): void {
  if (!combatRules.laserExecutor) return;

  const { thresholdFraction, rangePx, scanEvery } = combatRules.laserExecutor;
  const lastScan: number = (w as any)._laserExecutorLastScan ?? 0;
  const elapsed = lastScan + dt;

  if (elapsed < scanEvery) {
    (w as any)._laserExecutorLastScan = elapsed;
    return;
  }

  (w as any)._laserExecutorLastScan = elapsed % scanEvery;

  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const px = pw.wx;
  const py = pw.wy;

  const nearby = queryCircle(w.enemySpatialHash, px, py, rangePx + 50);
  const meta = makePlayerTriggerHitMeta("RING_IGNITE_LASER_EXECUTOR", {
    category: "HIT",
    instigatorId: "player",
    isProcDamage: true,
  });

  for (let i = 0; i < nearby.length; i++) {
    const e = nearby[i];
    if (!w.eAlive[e]) continue;
    if (!isEnemyInCircle(w, e, px, py, rangePx)) continue;

    const hp = w.eHp[e];
    const maxHp = w.eHpMax?.[e] ?? hp;
    if (maxHp <= 0) continue;
    if (hp / maxHp > thresholdFraction) continue;

    // Execute: deal remaining HP as damage
    const executeDamage = Math.max(0, hp);
    w.eHp[e] = 0;

    const enemyPos = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
    emitEvent(w, { type: "VFX", id: "LASER_EXECUTE", x: enemyPos.wx, y: enemyPos.wy });
    emitEvent(w, {
      type: "ENEMY_HIT",
      enemyIndex: e,
      damage: executeDamage,
      dmgPhys: 0,
      dmgFire: executeDamage,
      dmgChaos: 0,
      x: enemyPos.wx,
      y: enemyPos.wy,
      isCrit: false,
      damageMeta: meta,
      source: "OTHER",
    });

    finalizeEnemyDeath(w, e, {
      damageMeta: meta,
      source: "OTHER",
      damage: executeDamage,
      dmgPhys: 0,
      dmgFire: executeDamage,
      dmgChaos: 0,
      isCrit: false,
      x: enemyPos.wx,
      y: enemyPos.wy,
    });
  }
}
