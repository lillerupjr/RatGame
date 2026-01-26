// src/game/content/enemies.ts

export const ENEMY_TYPE = {
    CHASER: 1,
    RUNNER: 2,
    BRUISER: 3,
    BOSS: 99,
} as const;

export type EnemyType = (typeof ENEMY_TYPE)[keyof typeof ENEMY_TYPE];

export type EnemyDef = {
    id: EnemyType;
    name: string;
    hp: number;
    radius: number;
    speed: number;
    damage: number;

    // optional: used later for UI/render variants
    color?: string;
};

export const ENEMIES: Record<EnemyType, EnemyDef> = {
    [ENEMY_TYPE.CHASER]: {
        id: ENEMY_TYPE.CHASER,
        name: "Chaser",
        hp: 20,
        radius: 14,
        speed: 90,
        damage: 10,
        color: "#f66",
    },
    [ENEMY_TYPE.RUNNER]: {
        id: ENEMY_TYPE.RUNNER,
        name: "Runner",
        hp: 12,
        radius: 12,
        speed: 130,
        damage: 8,
        color: "#fb8",
    },
    [ENEMY_TYPE.BRUISER]: {
        id: ENEMY_TYPE.BRUISER,
        name: "Bruiser",
        hp: 60,
        radius: 18,
        speed: 70,
        damage: 16,
        color: "#f8b",
    },
    [ENEMY_TYPE.BOSS]: {
        id: ENEMY_TYPE.BOSS,
        name: "Boss",
        hp: 800,
        radius: 34,
        speed: 55,
        damage: 22,
        color: "#c8f",
    },
};
