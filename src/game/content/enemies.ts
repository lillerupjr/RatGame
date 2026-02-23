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

    // Health scaling weight per level (default: 1.0 = normal scaling)
    // Higher = scales more with depth, Lower = scales less
    hpScaleWeight?: number;

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
        hpScaleWeight: 1.0, // Moderate scaling
        color: "#f66",
    },
    [ENEMY_TYPE.RUNNER]: {
        id: ENEMY_TYPE.RUNNER,
        name: "Runner",
        hp: 12,
        radius: 12,
        speed: 130,
        damage: 8,
        hpScaleWeight: 1.2, // Lightest scaling (still squishy)
        color: "#fb8",
    },
    [ENEMY_TYPE.BRUISER]: {
        id: ENEMY_TYPE.BRUISER,
        name: "Bruiser",
        hp: 60,
        radius: 18,
        speed: 70,
        damage: 16,
        hpScaleWeight: 1.5, // Heavy scaling (true tank)
        color: "#f8b",
    },
    [ENEMY_TYPE.BOSS]: {
        id: ENEMY_TYPE.BOSS,
        name: "Boss",
        hp: 400,
        radius: 34,
        speed: 55,
        damage: 22,
        hpScaleWeight: 2.0, // Extreme scaling (endgame challenge)
        color: "#c8f",
    },
};
