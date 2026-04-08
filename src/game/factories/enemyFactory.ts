// src/game/factories/enemyFactory.ts
import type { World } from "../../engine/world/world";
import { registry } from "../content/registry";
import { EnemyId } from "../content/enemies";
import { worldToGrid } from "../coords/grid";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { createEnemyBrainState } from "../systems/enemies/brain";
import {
  coerceEnemyVisualScale,
  DEFAULT_ENEMY_SPLIT_STAGE,
  MIN_ENEMY_COLLISION_RADIUS,
  resolveSplitterStageVisualScale,
} from "../systems/enemies/enemyRuntime";
import { isNeutralMonsterId } from "../content/neutralMonsters";
import { resolveHostileSpawnHeatHealthMultiplier } from "../systems/spawn/hostileSpawnDirector";
import { spawnHostileActorGrid } from "../hostiles/hostileActorFactory";

export { EnemyId };

export type EnemySpawnRuntimeOverrides = {
  splitStage?: number;
  visualScale?: number;
  rewardBaseLife?: number;
};

/** Spawn an enemy at grid coordinates with scaled stats. */
export function spawnEnemyGrid(
    w: World,
    type: EnemyId,
    gx: number,
    gy: number,
    _tileWorld: number = KENNEY_TILE_WORLD,
    overrides?: EnemySpawnRuntimeOverrides,
) {
    if (type === EnemyId.BOSS) {
      throw new Error("Use spawnBossEncounter for canonical boss actors.");
    }
    const s = registry.enemy(type);
    const baseLife = Math.max(1, Math.round(s.stats.baseLife));
    const splitStage = Number.isFinite(overrides?.splitStage)
      ? Math.max(0, Math.floor(overrides!.splitStage as number))
      : DEFAULT_ENEMY_SPLIT_STAGE;
    const visualScale = overrides?.visualScale !== undefined
      ? coerceEnemyVisualScale(overrides.visualScale)
      : resolveSplitterStageVisualScale(splitStage);
    const rewardBaseLife = Number.isFinite(overrides?.rewardBaseLife)
      ? Math.max(1, Math.round(overrides!.rewardBaseLife as number))
      : Math.max(1, Math.round(baseLife * visualScale));

    const scaling = w.delveScaling ?? { hpMult: 1, damageMult: 1 };
    const hostileHeatHealthMultiplier =
      !isNeutralMonsterId(type)
        ? resolveHostileSpawnHeatHealthMultiplier(w)
        : 1;
    const scaledHp = Math.max(1, Math.round(baseLife * visualScale * scaling.hpMult * hostileHeatHealthMultiplier));
    const scaledDamage = Math.max(0, Math.round(s.stats.contactDamage * visualScale * scaling.damageMult));
    const radius = Math.max(MIN_ENEMY_COLLISION_RADIUS, s.body.radius * visualScale);
    return spawnHostileActorGrid(w, {
      actorType: type,
      gx,
      gy,
      tileWorld: _tileWorld,
      stats: s.stats,
      body: s.body,
      movement: s.movement,
      baseLife: rewardBaseLife,
      radius,
      splitStage,
      visualScale,
      scaledHp,
      scaledDamage,
      brainFactory: () => createEnemyBrainState(s),
    });
}

/** Spawn an enemy at world coordinates (converted to grid). */
export function spawnEnemy(
  w: World,
  type: EnemyId,
  x: number,
  y: number,
  overrides?: EnemySpawnRuntimeOverrides,
) {
    const gp = worldToGrid(x, y, KENNEY_TILE_WORLD);
    return spawnEnemyGrid(w, type, gp.gx, gp.gy, KENNEY_TILE_WORLD, overrides);
}
