// src/game/content/enemies.ts

export const ENEMY_TYPE = {
    CHASER: 1,
    RUNNER: 2,
    BRUISER: 3,
    MINOTAUR: 4,
    ABOMINATION: 5,
    RATCHEMIST: 6,
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
        hp: 24,
        radius: 14,
        speed: 90,
        damage: 10,
        color: "#f66",
    },
    [ENEMY_TYPE.RUNNER]: {
        id: ENEMY_TYPE.RUNNER,
        name: "Runner",
        hp: 16,
        radius: 12,
        speed: 130,
        damage: 8,
        color: "#fb8",
    },
    [ENEMY_TYPE.BRUISER]: {
        id: ENEMY_TYPE.BRUISER,
        name: "Bruiser",
        hp: 64,
        radius: 18,
        speed: 70,
        damage: 16,
        color: "#f8b",
    },
    [ENEMY_TYPE.MINOTAUR]: {
        id: ENEMY_TYPE.MINOTAUR,
        name: "Minotaur",
        hp: 80,
        radius: 20,
        speed: 60,
        damage: 20,
        color: "#a66",
    },
    [ENEMY_TYPE.ABOMINATION]: {
        id: ENEMY_TYPE.ABOMINATION,
        name: "Abomination",
        hp: 120,
        radius: 22,
        speed: 50,
        damage: 18,
        color: "#6a8",
    },
    [ENEMY_TYPE.RATCHEMIST]: {
        id: ENEMY_TYPE.RATCHEMIST,
        name: "Ratchemist",
        hp: 40,
        radius: 14,
        speed: 80,
        damage: 12,
        color: "#8bf",
    },
    [ENEMY_TYPE.BOSS]: {
        id: ENEMY_TYPE.BOSS,
        name: "Boss",
        hp: 240,
        radius: 34,
        speed: 55,
        damage: 22,
        color: "#c8f",
    },
};
