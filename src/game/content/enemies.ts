import { PRJ_KIND } from "../factories/projectileFactory";
import type {
    HostileBodyConfig,
    HostileDeathEffectConfig,
    HostileMovementConfig,
    HostilePresentationConfig,
    HostileRewardsConfig,
    HostileStatsConfig,
} from "../hostiles/hostileTypes";

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

export type EnemyBodyConfig = HostileBodyConfig;

export type EnemyRewardsConfig = HostileRewardsConfig;

export type EnemySpawnRole =
    | "baseline_chaser"
    | "fast_chaser"
    | "tank"
    | "ranged"
    | "suicide"
    | "leaper"
    | "special";

export type EnemySpawnConfig = {
    power: number;
    role: EnemySpawnRole;
    unlockTimeSec: number;
    unlockDepth: number;
    weight: number;
    minGroupSize: number;
    maxGroupSize: number;
    maxAlive: number;
    burstWeight?: number;
};

export type EnemyPresentationConfig = HostilePresentationConfig;

export type EnemyMovementConfig = HostileMovementConfig;

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

export type EnemyDeathEffectConfig = HostileDeathEffectConfig;

export type EnemyDefinition = {
    id: EnemyId;
    name: string;
    aiType: EnemyAiType;
    spawn: EnemySpawnConfig;
    stats: HostileStatsConfig;
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

export const ENEMIES: Partial<Record<EnemyId, EnemyDefinition>> = {
    [EnemyId.MINION]: makeEnemyDefinition({
        id: EnemyId.MINION,
        name: "Minion",
        aiType: "contact",
        spawn: {
            power: 1.0,
            role: "baseline_chaser",
            unlockTimeSec: 0,
            unlockDepth: 0,
            weight: 1.0,
            minGroupSize: 2,
            maxGroupSize: 5,
            maxAlive: 28,
            burstWeight: 1.2,
        },
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
        spawn: {
            power: 0.9,
            role: "fast_chaser",
            unlockTimeSec: 20,
            unlockDepth: 0,
            weight: 0.8,
            minGroupSize: 2,
            maxGroupSize: 4,
            maxAlive: 20,
            burstWeight: 1.1,
        },
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
        spawn: {
            power: 2.1,
            role: "tank",
            unlockTimeSec: 45,
            unlockDepth: 0,
            weight: 0.45,
            minGroupSize: 1,
            maxGroupSize: 3,
            maxAlive: 10,
            burstWeight: 0.5,
        },
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
        spawn: {
            power: 2.7,
            role: "suicide",
            unlockTimeSec: 75,
            unlockDepth: 0,
            weight: 0.35,
            minGroupSize: 1,
            maxGroupSize: 2,
            maxAlive: 6,
            burstWeight: 0.7,
        },
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
        spawn: {
            power: 1.6,
            role: "ranged",
            unlockTimeSec: 35,
            unlockDepth: 0,
            weight: 0.5,
            minGroupSize: 1,
            maxGroupSize: 3,
            maxAlive: 8,
            burstWeight: 0.6,
        },
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
        spawn: {
            power: 3.5,
            role: "special",
            unlockTimeSec: 90,
            unlockDepth: 0,
            weight: 0.05,
            minGroupSize: 1,
            maxGroupSize: 1,
            maxAlive: 1,
        },
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
        spawn: {
            power: 2.4,
            role: "leaper",
            unlockTimeSec: 65,
            unlockDepth: 0,
            weight: 0.3,
            minGroupSize: 1,
            maxGroupSize: 2,
            maxAlive: 5,
            burstWeight: 0.55,
        },
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
        spawn: {
            power: 1.7,
            role: "special",
            unlockTimeSec: 55,
            unlockDepth: 0,
            weight: 0.4,
            minGroupSize: 1,
            maxGroupSize: 3,
            maxAlive: 8,
            burstWeight: 0.75,
        },
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
};
