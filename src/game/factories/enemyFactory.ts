// src/game/factories/enemyFactory.ts
import type { World } from "../world";
import { registry } from "../content/registry";
import { ENEMY_TYPE, type EnemyType } from "../content/enemies";

export { ENEMY_TYPE };
export type { EnemyType };

/**
 * Factory: creates one enemy with standardized stats (from registry).
 */
export function spawnEnemy(w: World, type: EnemyType, x: number, y: number) {
    const s = registry.enemy(type);

    const i = w.eAlive.length;
    w.eAlive.push(true);
    w.eType.push(type);
    w.ex.push(x);
    w.ey.push(y);
    w.evx.push(0);
    w.evy.push(0);
    w.eHp.push(s.hp);
    w.eHpMax.push(s.hp);
    w.eR.push(s.radius);
    w.eSpeed.push(s.speed);
    w.eDamage.push(s.damage);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);

    return i;
}
