// src/game/factories/enemyFactory.ts
import type { World } from "../world";
import { registry } from "../content/registry";
import { ENEMY_TYPE, type EnemyType } from "../content/enemies";
import { worldToGrid } from "../coords/grid";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";

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
    const gxi = Math.floor(gx);
    const gyi = Math.floor(gy);
    w.egxi.push(gxi);
    w.egyi.push(gyi);
    w.egox.push(gx - gxi);
    w.egoy.push(gy - gyi);

    w.evx.push(0);
    w.evy.push(0);
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
