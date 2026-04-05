// src/game/factories/enemyFactory.ts
import type { World } from "../../engine/world/world";
import { registry } from "../content/registry";
import { EnemyId } from "../content/enemies";
import { worldToGrid } from "../coords/grid";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { createEnemyBrainState } from "../systems/enemies/brain";
import { isNeutralMonsterId } from "../content/neutralMonsters";
import { resolveHostileSpawnHeatHealthMultiplier } from "../systems/spawn/hostileSpawnDirector";
import { spawnHostileActorGrid } from "../hostiles/hostileActorFactory";

export { EnemyId };

/** Spawn an enemy at grid coordinates with scaled stats. */
export function spawnEnemyGrid(
    w: World,
    type: EnemyId,
    gx: number,
    gy: number,
    _tileWorld: number = KENNEY_TILE_WORLD
) {
    if (type === EnemyId.BOSS) {
      throw new Error("Use spawnBossEncounter for canonical boss actors.");
    }
    const s = registry.enemy(type);
    const baseLife = Math.max(1, Math.round(s.stats.baseLife));

    const scaling = w.delveScaling ?? { hpMult: 1, damageMult: 1 };
    const hostileHeatHealthMultiplier =
      !isNeutralMonsterId(type)
        ? resolveHostileSpawnHeatHealthMultiplier(w)
        : 1;
    const scaledHp = Math.max(1, Math.round(baseLife * scaling.hpMult * hostileHeatHealthMultiplier));
    const scaledDamage = Math.round(s.stats.contactDamage * scaling.damageMult);
    return spawnHostileActorGrid(w, {
      actorType: type,
      gx,
      gy,
      tileWorld: _tileWorld,
      stats: s.stats,
      body: s.body,
      movement: s.movement,
      scaledHp,
      scaledDamage,
      brainFactory: () => createEnemyBrainState(s),
    });
}

/** Spawn an enemy at world coordinates (converted to grid). */
export function spawnEnemy(w: World, type: EnemyId, x: number, y: number) {
    const gp = worldToGrid(x, y, KENNEY_TILE_WORLD);
    return spawnEnemyGrid(w, type, gp.gx, gp.gy, KENNEY_TILE_WORLD);
}
