import { PRJ_KIND } from "../factories/projectileFactory";

export const EnemyId = {
    MINION: 1,
    RUNNER: 2,
    TANK: 3,
    BURSTER: 5,
    SPITTER: 6,
    LOOT_GOBLIN: 7,
    LEAPER1: 8,
    SHARD_RAT: 9,
    BOSS: 99,
} as const;

export type EnemyId = (typeof EnemyId)[keyof typeof EnemyId];

export type EnemyAiType =
    | "contact"
    | "caster"
    | "suicide"
    | "leaper";

export type EnemyStats = {
    baseLife: number;
    contactDamage: number;
};

export type EnemyBodyConfig = {
    radius: number;
    hitHeightProjectile?: number;
    hitHeightContact?: number;
};

export type EnemyRewardsConfig = {
    goldValue?: number;
    goldMultiplier?: number;
    isBoss?: boolean;
};

export type EnemySpriteConfig = {
    skin: string;
    scale: number;
    anchorX: number;
    anchorY: number;
    frameW: number;
    frameH: number;
    runAnim?: string;
    frameCount?: number;
    packRoot?: string;
};

export type EnemyPresentationConfig = {
    color?: string;
    sprite?: EnemySpriteConfig;
    aimScreenOffset?: { x: number; y: number };
    shadowFootOffset?: { x: number; y: number };
};

export type EnemyMovementConfig = {
    mode: "approach_player" | "scripted";
    speed: number;
    desiredRange: number;
    tolerance: number;
    reengageRange: number;
};

export type EnemyProjectileAbilityConfig = {
    kind: "projectile";
    abilityId: string;
    projectileKind: number;
    speed: number;
    damage: number;
    radius: number;
    ttl: number;
    windupSec: number;
    cooldownSec: number;
};

export type EnemyExplodeAbilityConfig = {
    kind: "explode";
    abilityId: string;
    radius: number;
    damage: number;
    windupSec: number;
};

export type EnemyLeapAbilityConfig = {
    kind: "leap";
    abilityId: string;
    damage: number;
    leapSpeed: number;
    windupSec: number;
    cooldownSec: number;
    impactRadius?: number;
};

export type EnemyAbilityConfig =
    | EnemyProjectileAbilityConfig
    | EnemyExplodeAbilityConfig
    | EnemyLeapAbilityConfig;

export type EnemyRadialProjectileDeathEffectConfig = {
    type: "radial_projectiles";
    count: number;
    projectileKind: number;
    speed: number;
    damage: number;
    ttl: number;
};

export type EnemyDeathEffectConfig =
    | EnemyRadialProjectileDeathEffectConfig;

export type EnemyDefinition = {
    id: EnemyId;
    name: string;
    aiType: EnemyAiType;
    stats: EnemyStats;
    body: EnemyBodyConfig;
    rewards?: EnemyRewardsConfig;
    presentation?: EnemyPresentationConfig;
    movement: EnemyMovementConfig;
    ability?: EnemyAbilityConfig | null;
    deathEffects?: EnemyDeathEffectConfig[];
};

function makeEnemyDefinition(def: EnemyDefinition): EnemyDefinition {
    return {
        ...def,
        rewards: def.rewards ?? {},
        presentation: def.presentation ?? {},
        ability: def.ability ?? null,
        deathEffects: def.deathEffects ?? [],
    };
}

export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
    [EnemyId.MINION]: makeEnemyDefinition({
        id: EnemyId.MINION,
        name: "Minion",
        aiType: "contact",
        stats: {
            baseLife: 24,
            contactDamage: 10,
        },
        body: {
            radius: 14,
            hitHeightProjectile: 2,
            hitHeightContact: 1,
        },
        rewards: {},
        presentation: {
            color: "#f66",
            sprite: {
                skin: "enemies/small_rat",
                packRoot: "entities",
                scale: 1.5,
                anchorX: 0.5,
                anchorY: 0.65,
                frameW: 32,
                frameH: 32,
                runAnim: "running-4-frames",
                frameCount: 4,
            },
            shadowFootOffset: { x: 0, y: 0 },
        },
        movement: {
            mode: "approach_player",
            speed: 90,
            desiredRange: 0,
            tolerance: 6,
            reengageRange: 12,
        },
        ability: null,
    }),
    [EnemyId.RUNNER]: makeEnemyDefinition({
        id: EnemyId.RUNNER,
        name: "Runner",
        aiType: "contact",
        stats: {
            baseLife: 16,
            contactDamage: 8,
        },
        body: {
            radius: 12,
            hitHeightProjectile: 3,
            hitHeightContact: 2,
        },
        rewards: {},
        presentation: {
            color: "#fb8",
            sprite: {
                skin: "enemies/brown_rat",
                packRoot: "entities",
                scale: 1.5,
                anchorX: 0.5,
                anchorY: 0.65,
                frameW: 92,
                frameH: 92,
                runAnim: "walk-4-frames",
                frameCount: 4,
            },
            shadowFootOffset: { x: 0, y: 0 },
        },
        movement: {
            mode: "approach_player",
            speed: 130,
            desiredRange: 0,
            tolerance: 6,
            reengageRange: 14,
        },
        ability: null,
    }),
    [EnemyId.TANK]: makeEnemyDefinition({
        id: EnemyId.TANK,
        name: "Tank",
        aiType: "contact",
        stats: {
            baseLife: 64,
            contactDamage: 16,
        },
        body: {
            radius: 18,
            hitHeightProjectile: 4,
            hitHeightContact: 3,
        },
        rewards: {},
        presentation: {
            color: "#f8b",
            sprite: {
                skin: "enemies/guerilla_rat",
                packRoot: "entities",
                scale: 2,
                anchorX: 0.5,
                anchorY: 0.65,
                frameW: 92,
                frameH: 92,
                runAnim: "walk-4-frames",
                frameCount: 4,
            },
            shadowFootOffset: { x: 0, y: 0 },
        },
        movement: {
            mode: "approach_player",
            speed: 70,
            desiredRange: 0,
            tolerance: 8,
            reengageRange: 14,
        },
        ability: null,
    }),
    [EnemyId.BURSTER]: makeEnemyDefinition({
        id: EnemyId.BURSTER,
        name: "Burster",
        aiType: "suicide",
        stats: {
            baseLife: 120,
            contactDamage: 10,
        },
        body: {
            radius: 22,
            hitHeightProjectile: 2,
            hitHeightContact: 1,
        },
        rewards: {},
        presentation: {
            color: "#6a8",
            sprite: {
                skin: "enemies/burster",
                packRoot: "entities",
                scale: 1.8,
                anchorX: 0.5,
                anchorY: 0.65,
                frameW: 148,
                frameH: 148,
                runAnim: "walking-6-frames",
                frameCount: 6,
            },
            shadowFootOffset: { x: 0, y: 0 },
        },
        movement: {
            mode: "approach_player",
            speed: 60,
            desiredRange: 18,
            tolerance: 10,
            reengageRange: 42,
        },
        ability: {
            kind: "explode",
            abilityId: "BURSTER_EXPLODE",
            radius: 92,
            damage: 18,
            windupSec: 0.55,
        },
    }),
    [EnemyId.SPITTER]: makeEnemyDefinition({
        id: EnemyId.SPITTER,
        name: "Spitter",
        aiType: "caster",
        stats: {
            baseLife: 40,
            contactDamage: 10,
        },
        body: {
            radius: 14,
            hitHeightProjectile: 2,
            hitHeightContact: 1,
        },
        rewards: {},
        presentation: {
            color: "#8bf",
            sprite: {
                skin: "enemies/spitter",
                packRoot: "entities",
                scale: 1.1,
                anchorX: 0.5,
                anchorY: 0.65,
                frameW: 128,
                frameH: 128,
                runAnim: "walk",
                frameCount: 6,
            },
            shadowFootOffset: { x: 0, y: 0 },
        },
        movement: {
            mode: "approach_player",
            speed: 80,
            desiredRange: 260,
            tolerance: 24,
            reengageRange: 280,
        },
        ability: {
            kind: "projectile",
            abilityId: "SPITTER_PROJECTILE",
            projectileKind: PRJ_KIND.ACID,
            speed: 120,
            damage: 12,
            radius: 10,
            ttl: 2.5,
            windupSec: 0.35,
            cooldownSec: 1.2,
        },
    }),
    [EnemyId.LOOT_GOBLIN]: makeEnemyDefinition({
        id: EnemyId.LOOT_GOBLIN,
        name: "Loot Goblin",
        aiType: "contact",
        stats: {
            baseLife: 500,
            contactDamage: 0,
        },
        body: {
            radius: 12,
            hitHeightProjectile: 3,
            hitHeightContact: 2,
        },
        rewards: {},
        presentation: {
            color: "#fd7",
            sprite: {
                skin: "lootGoblin",
                scale: 1.5,
                anchorX: 0.5,
                anchorY: 0.65,
                frameW: 92,
                frameH: 92,
                runAnim: "walk",
                frameCount: 6,
            },
            shadowFootOffset: { x: 0, y: 0 },
        },
        movement: {
            mode: "approach_player",
            speed: 130,
            desiredRange: 0,
            tolerance: 6,
            reengageRange: 12,
        },
        ability: null,
    }),
    [EnemyId.LEAPER1]: makeEnemyDefinition({
        id: EnemyId.LEAPER1,
        name: "Leaper1",
        aiType: "leaper",
        stats: {
            baseLife: 80,
            contactDamage: 0,
        },
        body: {
            radius: 20,
            hitHeightProjectile: 2,
            hitHeightContact: 1,
        },
        rewards: {},
        presentation: {
            color: "#a66",
            sprite: {
                skin: "enemies/rhino_rat",
                packRoot: "entities",
                scale: 2,
                anchorX: 0.5,
                anchorY: 0.65,
                frameW: 96,
                frameH: 96,
                runAnim: "walk-6-frames",
                frameCount: 6,
            },
            shadowFootOffset: { x: 0, y: 0 },
        },
        movement: {
            mode: "approach_player",
            speed: 60,
            desiredRange: 180,
            tolerance: 12,
            reengageRange: 300,
        },
        ability: {
            kind: "leap",
            abilityId: "LEAPER1_LEAP",
            damage: 20,
            leapSpeed: 420,
            windupSec: 0.4,
            cooldownSec: 1.0,
            impactRadius: 28,
        },
    }),
    [EnemyId.SHARD_RAT]: makeEnemyDefinition({
        id: EnemyId.SHARD_RAT,
        name: "Shard Rat",
        aiType: "contact",
        stats: {
            baseLife: 52,
            contactDamage: 12,
        },
        body: {
            radius: 16,
            hitHeightProjectile: 3,
            hitHeightContact: 2,
        },
        rewards: {},
        presentation: {
            color: "#dbe3ff",
            sprite: {
                skin: "enemies/shard_rat",
                packRoot: "entities",
                scale: 1.2,
                anchorX: 0.5,
                anchorY: 0.65,
                frameW: 156,
                frameH: 156,
                runAnim: "walk",
                frameCount: 6,
            },
            shadowFootOffset: { x: 0, y: 0 },
        },
        movement: {
            mode: "approach_player",
            speed: 78,
            desiredRange: 0,
            tolerance: 8,
            reengageRange: 14,
        },
        ability: null,
        deathEffects: [
            {
                type: "radial_projectiles",
                count: 8,
                projectileKind: PRJ_KIND.DAGGER,
                speed: 180,
                damage: 8,
                ttl: 1.35,
            },
        ],
    }),
    [EnemyId.BOSS]: makeEnemyDefinition({
        id: EnemyId.BOSS,
        name: "Boss",
        aiType: "contact",
        stats: {
            baseLife: 240,
            contactDamage: 22,
        },
        body: {
            radius: 34,
            hitHeightProjectile: 4,
            hitHeightContact: 3,
        },
        rewards: {
            isBoss: true,
        },
        presentation: {
            color: "#c8f",
            sprite: {
                skin: "infested",
                scale: 2,
                anchorX: 0.5,
                anchorY: 0.65,
                frameW: 92,
                frameH: 92,
                runAnim: "walk",
                frameCount: 4,
            },
            shadowFootOffset: { x: 0, y: 0 },
        },
        movement: {
            mode: "scripted",
            speed: 55,
            desiredRange: 0,
            tolerance: 8,
            reengageRange: 16,
        },
        ability: null,
    }),
};
