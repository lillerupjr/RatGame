import type { World } from "../world";

export const ENEMY_TYPE = {
    CHASER: 1,
    RUNNER: 2,
    BRUISER: 3,
    BOSS: 99,
} as const;

export type EnemyType = (typeof ENEMY_TYPE)[keyof typeof ENEMY_TYPE];

type EnemyStats = {
    hp: number;
    radius: number;
    speed: number;
    damage: number;
};

const STATS: Record<number, EnemyStats> = {
    [ENEMY_TYPE.CHASER]: { hp: 20, radius: 14, speed: 90, damage: 10 },
    [ENEMY_TYPE.RUNNER]: { hp: 12, radius: 12, speed: 130, damage: 8 },
    [ENEMY_TYPE.BRUISER]: { hp: 60, radius: 18, speed: 70, damage: 16 },
    [ENEMY_TYPE.BOSS]: { hp: 800, radius: 34, speed: 55, damage: 22 }, // placeholder
};

/**
 * Factory: creates one enemy with standardized stats.
 * Later you can route to content/enemies.ts if you want full data-driven.
 */
export function spawnEnemy(w: World, type: EnemyType, x: number, y: number) {
    const s = STATS[type] ?? STATS[ENEMY_TYPE.CHASER];

    const i = w.eAlive.length;
    w.eAlive.push(true);
    w.eType.push(type);
    w.ex.push(x);
    w.ey.push(y);
    w.evx.push(0);
    w.evy.push(0);
    w.eHp.push(s.hp);
    w.eR.push(s.radius);
    w.eSpeed.push(s.speed);
    w.eDamage.push(s.damage);

    return i;
}
