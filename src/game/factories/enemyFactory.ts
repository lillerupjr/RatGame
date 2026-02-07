// src/game/factories/enemyFactory.ts
import type { World } from "../../engine/world/world";
import { registry } from "../content/registry";
import { ENEMY_TYPE, type EnemyType } from "../content/enemies";
import { gridToWorld, worldToGrid } from "../coords/grid";
import { anchorFromWorld } from "../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";

export { ENEMY_TYPE };
export type { EnemyType };

/**
 * Factory: creates one enemy with standardized stats (from registry).
 * Applies delve depth scaling to HP and damage, with per-enemy HP weight.
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

    // Apply delve depth scaling
    const scaling = w.delveScaling ?? { hpMult: 1, damageMult: 1 };

    // Apply per-enemy HP scale weight (default 1.0 if not specified)
    const hpWeight = s.hpScaleWeight ?? 1.0;
    const adjustedHpMult = Math.pow(scaling.hpMult, hpWeight);

    const scaledHp = Math.round(s.hp * adjustedHpMult);
    const scaledDamage = Math.round(s.damage * scaling.damageMult);

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
    w.ezVisual.push(0);
    w.ezLogical.push(0);

    return i;
}

/** Spawn an enemy at world coordinates (converted to grid). */
export function spawnEnemy(w: World, type: EnemyType, x: number, y: number) {
    const gp = worldToGrid(x, y, KENNEY_TILE_WORLD);
    return spawnEnemyGrid(w, type, gp.gx, gp.gy, KENNEY_TILE_WORLD);
}
