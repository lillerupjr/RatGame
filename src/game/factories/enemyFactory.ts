// src/game/factories/enemyFactory.ts
import type { World } from "../../engine/world/world";
import { registry } from "../content/registry";
import { ENEMY_TYPE, type EnemyType } from "../content/enemies";
import { gridToWorld, worldToGrid } from "../coords/grid";
import { anchorFromWorld } from "../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { createEnemyAilmentsState } from "../combat_mods/ailments/enemyAilments";
import { recordEnemySpawnedHp } from "../balance/balanceCsvLogger";

export { ENEMY_TYPE };
export type { EnemyType };

/**
 * Factory: creates one enemy with standardized stats (from registry).
 * HP scaling is controlled only by spawn tuning HP knobs.
 */
/** Spawn an enemy at grid coordinates with scaled stats. */
export function spawnEnemyGrid(
    w: World,
    type: EnemyType,
    gx: number,
    gy: number,
    _tileWorld: number = KENNEY_TILE_WORLD
) {
    const s = registry.enemy(type);

    // Apply delve scaling (damage only)
    const scaling = w.delveScaling ?? { hpMult: 1, damageMult: 1 };

    // Depth (1-based)
    const depth = Math.max(
      1,
      Math.floor((w.currentFloorIntent?.depth ?? (w.floorIndex ?? 0) + 1) as number)
    );

    // Authoritative HP scaling: hpBase * hpPerDepth^(depth-1)
    const tuning = (w as any).balance?.spawnTuning ?? {};
    const hpBase = typeof tuning.hpBase === "number" ? Math.max(0, tuning.hpBase) : 1.0;
    const hpPerDepth = typeof tuning.hpPerDepth === "number" ? Math.max(0.0001, tuning.hpPerDepth) : 1.0;
    const effectiveHpMult = hpBase * Math.pow(hpPerDepth, Math.max(0, depth - 1));

    const scaledHp = Math.max(1, Math.round(s.hp * effectiveHpMult));
    const scaledDamage = Math.round(s.damage * scaling.damageMult);

    // Balance telemetry: record how much HP just entered the world.
    const logger = (w as any).balanceCsvLogger;
    if (logger) recordEnemySpawnedHp(logger, scaledHp);

    const i = w.eAlive.length;
    w.eAlive.push(true);
    w.eType.push(type);
    const wp = gridToWorld(gx, gy, _tileWorld);
    const anchor = anchorFromWorld(wp.wx, wp.wy, _tileWorld);
    w.egxi.push(anchor.gxi);
    w.egyi.push(anchor.gyi);
    w.egox.push(anchor.gox);
    w.egoy.push(anchor.goy);

    w.evx.push(0);
    w.evy.push(0);
    w.eFaceX.push(0);
    w.eFaceY.push(-1);
    w.eHp.push(scaledHp);
    w.eHpMax.push(scaledHp);
    w.eR.push(s.radius);
    w.eSpeed.push(s.speed);
    w.eDamage.push(scaledDamage);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);
    w.eSpawnTriggerId.push(undefined);
    w.eAilments.push(createEnemyAilmentsState());
    w.ezVisual.push(0);
    w.ezLogical.push(0);

    return i;
}

/** Spawn an enemy at world coordinates (converted to grid). */
export function spawnEnemy(w: World, type: EnemyType, x: number, y: number) {
    const gp = worldToGrid(x, y, KENNEY_TILE_WORLD);
    return spawnEnemyGrid(w, type, gp.gx, gp.gy, KENNEY_TILE_WORLD);
}
