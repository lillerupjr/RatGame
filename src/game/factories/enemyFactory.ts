// src/game/factories/enemyFactory.ts
import type { World } from "../world";
import { registry } from "../content/registry";
import { ENEMY_TYPE, type EnemyType } from "../content/enemies";

export { ENEMY_TYPE };
export type { EnemyType };

/**
 * Factory: creates one enemy with standardized stats (from registry).
 * Applies delve depth scaling to HP and damage.
 */
export function spawnEnemy(w: World, type: EnemyType, x: number, y: number) {
    const s = registry.enemy(type);

    // Apply delve depth scaling
    const scaling = w.delveScaling ?? { hpMult: 1, damageMult: 1 };
    const scaledHp = Math.round(s.hp * scaling.hpMult);
    const scaledDamage = Math.round(s.damage * scaling.damageMult);

    const i = w.eAlive.length;
    w.eAlive.push(true);
    w.eType.push(type);
    w.ex.push(x);
    w.ey.push(y);
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

    return i;
}
