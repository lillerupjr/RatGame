// @system   ring-progression/system
// @owns     author, validate, index, and expose ring definitions and family talent trees
// @doc      docs/canonical/ring_progression_system.md
// @agents   no equipped ring state, reward offers, or runtime effect collection; see ringState.ts, progressionOffers.ts, and ringEffects.ts

import { PRJ_KIND } from "../../factories/projectileFactory";
import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import type {
  CombatRuleDef,
  DynamicStatModifierDef,
  EffectDef,
  ModOp,
  RewardRuleDef,
  StatMod,
  TriggeredEffectActionDef,
  WeaponFireRuleDef,
} from "../effects/effectTypes";
import {
  HAND_EFFECT_TYPES,
  RING_FAMILY_IDS,
  RING_TIER_IDS,
  type RingDef,
  type RingFamilyTalentTreeDef,
  type RingTalentNodeDef,
} from "./ringTypes";

const VALID_MOD_OPS = new Set<ModOp>(["add", "increased", "decreased", "more", "less"]);
const VALID_TRIGGER_KEYS = new Set([
  "ON_HIT",
  "ON_KILL",
  "ON_CRIT",
  "ON_TICK",
  "ON_DODGE",
  "ON_MOVE",
  "ON_PLAYER_HIT",
  "OTHER",
]);
const VALID_FLOOR_LIFECYCLE_TRIGGERS = new Set(["FLOOR_COMPLETE"]);

export type RingContentValidationIssue = {
  path: string;
  message: string;
};

export type RingContentIndex = {
  ringDefs: RingDef[];
  ringDefsById: Map<string, RingDef>;
  familyTrees: RingFamilyTalentTreeDef[];
  familyTreesById: Map<string, RingFamilyTalentTreeDef>;
  talentNodesById: Map<string, RingTalentNodeDef>;
};

function makeEmptyTree(familyId: RingFamilyTalentTreeDef["familyId"]): RingFamilyTalentTreeDef {
  return { familyId, nodes: [] };
}

function isRingTier(value: unknown): boolean {
  return typeof value === "string" && (RING_TIER_IDS as readonly string[]).includes(value);
}

export const RING_DEFS_V1: RingDef[] = [
  {
    id: "RING_STARTER_STREET_REFLEX",
    name: "Street Reflex",
    description: "On hit, 20% chance to throw an additional knife at a nearby enemy.",
    tier: "t2",
    familyId: "starter",
    tags: ["starter", "trigger", "projectile"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_HIT",
      procChance: 0.2,
      action: {
        kind: "SPAWN_PROJECTILE",
        projectileKind: PRJ_KIND.KNIFE,
        targeting: "NEAREST_ENEMY",
        origin: "PLAYER_AIM",
        rangePx: 260,
        speed: 260,
        ttl: 2,
        radius: 5,
        damageScalar: 1,
        damageType: "MATCH_HIT",
      },
    },
  },
  {
    id: "RING_STARTER_LUCKY_CHAMBER",
    name: "Lucky Chamber",
    description: "Every 5th shot is guaranteed to crit.",
    tier: "t2",
    familyId: "starter",
    tags: ["starter", "crit", "weapon"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "EVERY_NTH_SHOT_CRITS", everyShots: 5 }],
    },
  },
  {
    id: "RING_STARTER_CONTAMINATED_ROUNDS",
    name: "Contaminated Rounds",
    description: "Projectiles pierce poisoned enemies. Poisoned enemies take +20% damage from piercing hits.",
    tier: "t2",
    familyId: "starter",
    tags: ["starter", "projectile", "poison"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [
        { kind: "PIERCE_POISONED_TARGETS" },
        { kind: "PIERCE_HITS_MORE_DAMAGE_TO_POISONED", more: 0.2 },
      ],
    },
  },
  {
    id: "RING_STARTER_POINT_BLANK_CARNAGE",
    name: "Point Blank Carnage",
    description: "Deal up to +50% damage based on proximity. Very close hits knock enemies back.",
    tier: "t2",
    familyId: "starter",
    tags: ["starter", "damage", "close-range"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [
        { kind: "POINT_BLANK_DAMAGE_FALLOFF", maxRangePx: 220, maxMore: 0.5 },
        { kind: "POINT_BLANK_CLOSE_HIT_KNOCKBACK", rangePx: 84, basePushPx: 10, bonusPushPx: 34 },
      ],
    },
  },
  {
    id: "RING_STARTER_THERMAL_STARTER",
    name: "Thermal Starter",
    description: "Deal +15% damage to burning enemies.",
    tier: "t3",
    familyId: "starter",
    tags: ["starter", "ignite", "damage"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "MORE_DAMAGE_TO_BURNING_TARGETS", more: 0.15 }],
    },
  },
  {
    id: "RING_GENERIC_DAMAGE_PERCENT_20",
    name: "20% More Damage",
    description: "20% more damage.",
    tier: "t3",
    familyId: "generic",
    tags: ["generic", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, op: "more", value: 0.2 }],
    },
  },
  {
    id: "RING_GENERIC_DAMAGE_PERCENT_10",
    name: "Small Damage Band",
    description: "Deal 10% more damage.",
    tier: "t3",
    familyId: "generic",
    tags: ["generic", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, op: "more", value: 0.1 }],
    },
  },
  {
    id: "RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30",
    name: "60% More Damage / 30% Less Attack Speed",
    description: "60% more damage. 30% less attack speed.",
    tier: "t2",
    familyId: "generic",
    tags: ["generic", "damage", "attack-speed"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, op: "more", value: 0.6 },
        { key: STAT_KEYS.GLOBAL_ATTACK_SPEED_LESS, op: "less", value: 0.3 },
      ],
    },
  },
  {
    id: "RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30",
    name: "60% More Attack Speed / 30% Less Damage",
    description: "60% more attack speed. 30% less damage.",
    tier: "t2",
    familyId: "generic",
    tags: ["generic", "damage", "attack-speed"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.GLOBAL_ATTACK_SPEED_MORE, op: "more", value: 0.6 },
        { key: STAT_KEYS.GLOBAL_HIT_DAMAGE_LESS, op: "less", value: 0.3 },
      ],
    },
  },
  {
    id: "RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50",
    name: "100% More Damage / 50% Less Maximum Life",
    description: "100% more damage. 50% less maximum life.",
    tier: "t1",
    familyId: "generic",
    tags: ["generic", "damage", "life"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, op: "more", value: 1.0 },
        { key: STAT_KEYS.LIFE_LESS, op: "less", value: 0.5 },
      ],
    },
  },
  {
    id: "RING_GENERIC_MOVE_SPEED_20",
    name: "20% More Movement Speed",
    description: "20% more movement speed.",
    tier: "t3",
    familyId: "generic",
    tags: ["generic", "movement"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.MOVE_SPEED_MORE, op: "more", value: 0.2 }],
    },
  },
  {
    id: "RING_GENERIC_MOVE_SPEED_10",
    name: "Quick Step",
    description: "Gain 10% movement speed.",
    tier: "t3",
    familyId: "generic",
    tags: ["generic", "movement"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.MOVE_SPEED_MORE, op: "more", value: 0.1 }],
    },
  },
  {
    id: "RING_PHYSICAL_DAMAGE_PERCENT_20",
    name: "20% More Physical Damage",
    description: "20% more physical damage.",
    tier: "t3",
    familyId: "physical",
    tags: ["physical", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PHYSICAL_HIT_DAMAGE_MORE, op: "more", value: 0.2 }],
    },
  },
  {
    id: "RING_PHYSICAL_DAMAGE_PERCENT_10",
    name: "Bruiser's Band",
    description: "Deal 10% more physical damage.",
    tier: "t3",
    familyId: "physical",
    tags: ["physical", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PHYSICAL_HIT_DAMAGE_MORE, op: "more", value: 0.1 }],
    },
  },
  {
    id: "RING_PHYSICAL_PURE_FORCE",
    name: "Pure Force",
    description: "Your physical hit damage is increased by 30%, but you deal no non-physical hit damage.",
    tier: "t1",
    familyId: "physical",
    tags: ["physical", "damage", "restriction"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "PHYSICAL_HIT_DAMAGE_INCREASED_NON_PHYSICAL_SUPPRESSED", increased: 0.3 }],
    },
  },
  {
    id: "RING_PHYSICAL_DEVOTION",
    name: "Physical Devotion",
    description: "Deal 20% increased physical hit damage for each equipped physical-family ring.",
    tier: "t1",
    familyId: "physical",
    tags: ["physical", "damage", "family"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [
        {
          kind: "PHYSICAL_HIT_DAMAGE_INCREASED_PER_EQUIPPED_FAMILY_RING",
          familyId: "physical",
          increasedPerRing: 0.2,
        },
      ],
    },
  },
  {
    id: "RING_PROJECTILE_ADDITIONAL_PROJECTILES_1",
    name: "+1 Projectile",
    description: "You gain +1 projectile.",
    tier: "t1",
    familyId: "projectile",
    tags: ["projectile"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1 }],
    },
  },
  {
    id: "RING_PROJECTILE_GAIN_PIERCE_1",
    name: "+1 Pierce",
    description: "Your projectiles gain +1 pierce.",
    tier: "t2",
    familyId: "projectile",
    tags: ["projectile", "pierce"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PIERCE_ADD, op: "add", value: 1 }],
    },
  },
  {
    id: "RING_PROJECTILE_PIERCING_MOMENTUM",
    name: "Piercing Momentum",
    description: "Projectiles gain 30% increased damage for each enemy they have pierced.",
    tier: "t1",
    familyId: "projectile",
    tags: ["projectile", "pierce", "damage"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY", increasedPerEnemy: 0.3 }],
    },
  },
  {
    id: "RING_PROJECTILE_DAMAGE_INCREASED_10",
    name: "Sharpened Tip",
    description: "Projectiles deal 10% increased damage.",
    tier: "t3",
    familyId: "projectile",
    tags: ["projectile", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PROJECTILE_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }],
    },
  },
  {
    id: "RING_PROJECTILE_BOUNCE_ADD_1",
    name: "Ricochet Rounds",
    description: "Projectiles gain +1 bounce.",
    tier: "t1",
    familyId: "projectile",
    tags: ["projectile", "bounce"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PROJECTILE_BOUNCE_ADD, op: "add", value: 1 }],
    },
  },
  {
    id: "RING_PROJECTILE_SCATTER_SHOT",
    name: "Scatter Shot",
    description: "Gain +5 projectiles, but projectiles deal 75% less damage.",
    tier: "t0",
    familyId: "projectile",
    tags: ["projectile", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 5 },
        { key: STAT_KEYS.PROJECTILE_HIT_DAMAGE_LESS, op: "less", value: 0.75 },
      ],
    },
  },
  {
    id: "RING_PROJECTILE_BACKFIRE_SHOT",
    name: "Backfire Shot",
    description: "Also fire a projectile behind you. This projectile is not modified by projectile count.",
    tier: "t0",
    familyId: "projectile",
    tags: ["projectile", "chase", "backfire"],
    mainEffect: {
      kind: "WEAPON_FIRE_RULES",
      rules: [{ kind: "BACKFIRE_PROJECTILE" }],
    },
  },
  {
    id: "RING_PROJECTILE_CLOSE_QUARTERS_GUARD",
    name: "Close Quarters Guard",
    description: "While your projectile has no pierce, hits against enemies within 220px deal 35% increased damage.",
    tier: "t2",
    familyId: "projectile",
    tags: ["projectile", "defense", "damage", "close-range"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "NO_PIERCE_NEARBY_HIT_DAMAGE_INCREASED", rangePx: 220, increased: 0.35 }],
    },
  },
  {
    id: "RING_DOT_DAMAGE_OVER_TIME_MORE_50",
    name: "50% More Damage Over Time",
    description: "Damage over time deals 50% more damage.",
    tier: "t2",
    familyId: "dot",
    tags: ["dot"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.DOT_DAMAGE_MORE, op: "more", value: 0.5 }],
    },
  },
  {
    id: "RING_DOT_SPECIALIST",
    name: "DOT Specialist",
    description: "50% less hit damage. Damage over time deals 200% more damage.",
    tier: "t1",
    familyId: "dot",
    tags: ["dot", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.GLOBAL_HIT_DAMAGE_LESS, op: "less", value: 0.5 },
        { key: STAT_KEYS.DOT_DAMAGE_MORE, op: "more", value: 2.0 },
      ],
    },
  },
  {
    id: "RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS",
    name: "Triggered Hits Can Apply DOTs",
    description: "Damaging hits from triggered effects can apply DOTs.",
    tier: "t1",
    familyId: "dot",
    tags: ["dot", "trigger"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "TRIGGERED_HITS_CAN_APPLY_DOTS" }],
    },
  },
  {
    id: "RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS",
    name: "All Hit Damage Converted to Chaos",
    description: "All hit damage is converted to chaos damage, including triggered effects.",
    tier: "t1",
    familyId: "chaos",
    tags: ["chaos", "conversion"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "CONVERT_ALL_HIT_DAMAGE_TO_CHAOS" }],
    },
  },
  {
    id: "RING_POISON_CHANCE_PERCENT_25",
    name: "+25% Poison Chance",
    description: "Gain +25% poison chance.",
    tier: "t3",
    familyId: "poison",
    tags: ["poison"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.25 }],
    },
  },
  {
    id: "RING_POISON_CHANCE_PERCENT_10",
    name: "Dirty Needle",
    description: "Gain 10% poison chance.",
    tier: "t3",
    familyId: "poison",
    tags: ["poison"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.1 }],
    },
  },
  {
    id: "RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25",
    name: "Poisons Can Add an Extra Stack",
    description: "Poisons have 25% chance to apply an additional stack.",
    tier: "t2",
    familyId: "poison",
    tags: ["poison"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "POISON_EXTRA_STACK_CHANCE", chance: 0.25 }],
    },
  },
  {
    id: "RING_IGNITE_SPREAD_ON_DEATH",
    name: "Ignite Spreads on Death",
    description: "Ignite spreads to nearby enemies on death.",
    tier: "t1",
    familyId: "ignite",
    tags: ["ignite", "trigger"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_KILL",
      action: { kind: "SPREAD_IGNITE_ON_DEATH", radius: 96 },
    },
  },
  {
    id: "RING_IGNITE_CRITS_APPLY_IGNITE",
    name: "Crits Apply Ignite",
    description: "Crits ignite the target for 100% of the hit damage.",
    tier: "t1",
    familyId: "ignite",
    tags: ["ignite", "crit"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_CRIT",
      action: { kind: "APPLY_IGNITE_FROM_HIT", damageScalar: 1.0 },
    },
  },
  {
    id: "RING_IGNITE_CHANCE_PERCENT_10",
    name: "Small Spark",
    description: "Gain 10% ignite chance.",
    tier: "t3",
    familyId: "ignite",
    tags: ["ignite"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.CHANCE_TO_IGNITE_ADD, op: "add", value: 0.1 }],
    },
  },
  {
    id: "RING_CRIT_ROLLS_TWICE",
    name: "Crit Rolls Twice",
    description: "Crit rolls twice.",
    tier: "t1",
    familyId: "crit",
    tags: ["crit"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "CRIT_ROLLS_TWICE" }],
    },
  },
  {
    id: "RING_CRIT_CHANCE_PERCENT_5",
    name: "Lucky Scratch",
    description: "Gain 5% increased crit chance.",
    tier: "t3",
    familyId: "crit",
    tags: ["crit"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.05 }],
    },
  },
  {
    id: "RING_TRIGGER_BAZOOKA_ON_HIT",
    name: "Bazooka on Hit",
    description: "On hit: 10% chance to fire a bazooka dealing 300% of hit damage as physical damage.",
    tier: "t0",
    familyId: "trigger",
    tags: ["trigger", "projectile", "physical"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_HIT",
      procChance: 0.1,
      action: {
        kind: "SPAWN_PROJECTILE",
        projectileKind: PRJ_KIND.MISSILE,
        targeting: "EVENT_ENEMY",
        origin: "PLAYER_AIM",
        speed: 150,
        ttl: 2,
        radius: 5,
        damageScalar: 3.0,
        damageType: "PHYSICAL",
      },
    },
  },
  {
    id: "RING_TRIGGER_LIGHTNING_CHAIN",
    name: "Lightning Chain",
    description: "On hit: 25% chance to chain lightning to up to 3 other targets, dealing 100% of hit damage to each.",
    tier: "t0",
    familyId: "trigger",
    tags: ["trigger", "lightning", "chain"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_HIT",
      procChance: 0.25,
      action: {
        kind: "CHAIN_HIT",
        maxTargets: 3,
        jumpRangePx: 220,
        damageScalar: 1,
        damageType: "MATCH_HIT",
      },
    },
  },
  {
    id: "RING_TRIGGER_SPARK_ON_HIT",
    name: "Spark on Hit",
    description: "On hit: 20% chance to zap the nearest enemy dealing 100% of hit damage as fire damage.",
    tier: "t2",
    familyId: "trigger",
    tags: ["trigger", "projectile", "fire"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_HIT",
      procChance: 0.2,
      action: {
        kind: "SPAWN_PROJECTILE",
        projectileKind: PRJ_KIND.SPARK,
        targeting: "NEAREST_ENEMY",
        origin: "EVENT_POSITION",
        rangePx: 220,
        speed: 300,
        ttl: 3,
        radius: 6,
        damageScalar: 1.0,
        damageType: "FIRE",
        noCollide: true,
      },
    },
  },
  {
    id: "RING_TRIGGER_EXPLODE_ON_KILL",
    name: "Explode on Kill",
    description: "On kill: 20% chance for enemies to explode, dealing 50% of their maximum life as physical damage.",
    tier: "t1",
    familyId: "trigger",
    tags: ["trigger", "physical", "aoe"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_KILL",
      procChance: 0.2,
      action: {
        kind: "EXPLODE_ON_DEATH",
        radius: 128,
        damageScalar: 0.5,
        damageBasis: "TARGET_MAX_LIFE",
        damageType: "PHYSICAL",
      },
    },
  },
  {
    id: "RING_TRIGGER_DAGGER_ON_KILL",
    name: "Dagger on Kill",
    description: "On kill: 50% chance to fire a homing dagger at the nearest enemy dealing 100% of hit damage as physical damage.",
    tier: "t2",
    familyId: "trigger",
    tags: ["trigger", "projectile", "physical"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_KILL",
      procChance: 0.5,
      action: {
        kind: "SPAWN_PROJECTILE",
        projectileKind: PRJ_KIND.DAGGER,
        targeting: "NEAREST_ENEMY",
        origin: "EVENT_POSITION",
        rangePx: 260,
        speed: 190,
        ttl: 6,
        radius: 8,
        damageScalar: 1.0,
        damageType: "PHYSICAL",
      },
    },
  },
  {
    id: "RING_TRIGGER_DOUBLE_TRIGGERS",
    name: "Double Triggers",
    description: "All triggers happen twice.",
    tier: "t0",
    familyId: "trigger",
    tags: ["trigger"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "DOUBLE_TRIGGERS" }],
    },
  },
  {
    id: "RING_TRIGGER_PROC_CHANCE_PERCENT_50",
    name: "+50% Trigger Proc Chance",
    description: "+50% increased trigger chance.",
    tier: "t1",
    familyId: "trigger",
    tags: ["trigger"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "TRIGGER_PROC_CHANCE_INCREASED", increased: 0.5 }],
    },
  },
  {
    id: "RING_TRIGGER_PROC_CHANCE_PERCENT_10",
    name: "Twitchy Mechanism",
    description: "Gain 10% increased trigger proc chance.",
    tier: "t3",
    familyId: "trigger",
    tags: ["trigger"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "TRIGGER_PROC_CHANCE_INCREASED", increased: 0.1 }],
    },
  },
  {
    id: "RING_TRIGGER_RETRY_FAILED_PROCS_ONCE",
    name: "Retry Failed Procs Once",
    description: "Failed procs retry once.",
    tier: "t1",
    familyId: "trigger",
    tags: ["trigger"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "RETRY_FAILED_TRIGGER_PROCS_ONCE" }],
    },
  },
  {
    id: "RING_HEALTH_MAX_LIFE_ADD_10",
    name: "Minor Vitality",
    description: "Gain 10 maximum life.",
    tier: "t3",
    familyId: "health",
    tags: ["health", "life"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 10 }],
    },
  },
  {
    id: "RING_HEALTH_FLOOR_RECOVERY",
    name: "Floor Recovery",
    description: "Heal 10 health after completing a floor.",
    tier: "t3",
    familyId: "health",
    tags: ["health", "recovery"],
    mainEffect: {
      kind: "FLOOR_LIFECYCLE",
      trigger: "FLOOR_COMPLETE",
      action: { kind: "HEAL_PLAYER", amount: 10 },
    },
  },
  {
    id: "RING_HEALTH_VITAL_FORCE",
    name: "Vital Force",
    description: "Deal increased damage equal to 20% of your maximum health.",
    tier: "t1",
    familyId: "health",
    tags: ["health", "damage"],
    mainEffect: {
      kind: "DYNAMIC_STAT_MODIFIERS",
      mods: [{ kind: "GLOBAL_HIT_DAMAGE_INCREASED_FROM_MAX_LIFE", increasedPerMaxLife: 0.002 }],
    },
  },
  {
    id: "RING_HEALTH_WOUNDED_FURY",
    name: "Wounded Fury",
    description: "Deal 5% increased damage for each 10 health missing.",
    tier: "t2",
    familyId: "health",
    tags: ["health", "damage", "missing-life"],
    mainEffect: {
      kind: "DYNAMIC_STAT_MODIFIERS",
      mods: [
        {
          kind: "GLOBAL_HIT_DAMAGE_INCREASED_PER_MISSING_LIFE",
          missingLifeStep: 10,
          increasedPerStep: 0.05,
        },
      ],
    },
  },
  {
    id: "RING_UTILITY_WIDER_SELECTION",
    name: "Wider Selection",
    description: "Ring rewards offer +1 additional option.",
    tier: "t1",
    familyId: "utility",
    tags: ["utility", "reward"],
    mainEffect: {
      kind: "REWARD_RULES",
      rules: [{ kind: "RING_REWARD_OPTION_COUNT_ADD", add: 1 }],
    },
  },
  {
    id: "RING_UTILITY_CURATED_REWARDS",
    name: "Curated Rewards",
    description: "Ring rewards are slightly more likely to contain a family you already have equipped.",
    tier: "t1",
    familyId: "utility",
    tags: ["utility", "reward", "family"],
    mainEffect: {
      kind: "REWARD_RULES",
      rules: [{ kind: "RING_REWARD_EQUIPPED_FAMILY_WEIGHT_MULTIPLIER", multiplier: 2 }],
    },
  },
  {
    id: "RING_UTILITY_SELECTIVE_HAND",
    name: "Selective Hand",
    description: "After each floor, you may reroll ring rewards once.",
    tier: "t1",
    familyId: "utility",
    tags: ["utility", "reward", "reroll"],
    mainEffect: {
      kind: "REWARD_RULES",
      rules: [{ kind: "RING_REWARD_REROLL_ADD", count: 1 }],
    },
  },
  {
    id: "RING_POISON_POISON_TRAIL",
    name: "Poison Trail",
    description: "Leave a poison trail behind you that poisons enemies.",
    tier: "t2",
    familyId: "poison",
    tags: ["poison", "hazard", "trail"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "POISON_TRAIL", radius: 30, poisonDps: 5, tickEvery: 0.5, trailTtl: 3, dropEvery: 0.3 }],
    },
  },
  {
    id: "RING_IGNITE_LASER_EXECUTOR",
    name: "Laser Executor",
    description: "Periodically execute nearby enemies below 15% life.",
    tier: "t1",
    familyId: "ignite",
    tags: ["ignite", "execute", "periodic"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "LASER_EXECUTOR", thresholdFraction: 0.15, rangePx: 200, scanEvery: 1.5 }],
    },
  },
  {
    id: "RING_POISON_PLAGUE_DETONATION",
    name: "Plague Detonation",
    description: "Poisoned enemies explode on death for 50% of their max life as chaos damage.",
    tier: "t0",
    familyId: "poison",
    tags: ["poison", "explosion", "death"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "POISONED_ENEMIES_EXPLODE_ON_DEATH", radius: 100, damageScalar: 0.5, damageType: "CHAOS" }],
    },
  },
  {
    id: "RING_IGNITE_SMOLDERING_DRAG",
    name: "Smoldering Drag",
    description: "Ignited enemies are slowed by 10%.",
    tier: "t3",
    familyId: "ignite",
    tags: ["ignite", "slow", "control"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "BURNING_ENEMIES_MOVE_SPEED_REDUCED", reduced: 0.1 }],
    },
  },
  {
    id: "RING_POISON_WEAKENING_VENOM",
    name: "Weakening Venom",
    description: "Poisoned enemies deal 20% less damage.",
    tier: "t2",
    familyId: "poison",
    tags: ["poison", "defense", "debuff"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "POISONED_ENEMIES_DAMAGE_REDUCED", reduced: 0.2 }],
    },
  },
  {
    id: "RING_PHYSICAL_RETALIATION_BURST",
    name: "Retaliation Burst",
    description: "Taking damage has a 30% chance to trigger an explosion, stunning nearby enemies for 1 second.",
    tier: "t2",
    familyId: "physical",
    tags: ["physical", "stun", "retaliation"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_PLAYER_HIT",
      procChance: 0.3,
      action: { kind: "STUN_EXPLOSION", radius: 120, stunDurationSec: 1 },
    },
  },
  {
    id: "RING_PHYSICAL_STAGGERING_BLOWS",
    name: "Staggering Blows",
    description: "Physical hits have a 5% chance to stun enemies for 0.5 seconds.",
    tier: "t3",
    familyId: "physical",
    tags: ["physical", "stun", "hit"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "PHYSICAL_HIT_STUN_CHANCE", chance: 0.05, stunDurationSec: 0.5 }],
    },
  },
  {
    id: "RING_PHYSICAL_HEAVY_CHAMBER",
    name: "Heavy Chamber",
    description: "Every 4 seconds, empower your next shot to deal 50% increased physical damage.",
    tier: "t2",
    familyId: "physical",
    tags: ["physical", "empower", "timed"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "TIMED_NEXT_SHOT_EMPOWER", chargeEvery: 4, physicalDamageIncreased: 0.5 }],
    },
  },
  {
    id: "RING_GENERIC_KILL_MOMENTUM",
    name: "Kill Momentum",
    description: "Killing an enemy empowers your next shot to deal 20% increased damage.",
    tier: "t2",
    familyId: "generic",
    tags: ["generic", "empower", "kill"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "KILL_EMPOWER_NEXT_SHOT", damageIncreased: 0.2 }],
    },
  },
  {
    id: "RING_CRIT_CRITICAL_SPRINT",
    name: "Critical Sprint",
    description: "Critically striking grants 20% movement speed for 1 second.",
    tier: "t0",
    familyId: "crit",
    tags: ["crit", "movement", "buff"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "CRIT_MOVE_SPEED_BUFF", moveSpeedIncreased: 0.2, durationSec: 1 }],
    },
  },
  {
    id: "RING_UTILITY_MIRROR_BAND",
    name: "Mirror Band",
    description: "Mirrors the effect of the ring to the left of this ring.",
    tier: "t0",
    familyId: "utility",
    tags: ["utility", "mirror", "position"],
    mainEffect: { kind: "MIRROR_LEFT_RING" },
  },
  {
    id: "RING_UTILITY_AMPLIFYING_BAND",
    name: "Amplifying Band",
    description: "Increases the effect of surrounding rings by 50%.",
    tier: "t0",
    familyId: "utility",
    tags: ["utility", "amplify", "position"],
    mainEffect: { kind: "AMPLIFY_NEIGHBORS", increasedEffectBonus: 0.5 },
  },
  {
    id: "RING_IGNITE_LIVING_BOMB",
    name: "Living Bomb",
    description: "Every 20 seconds, mark an enemy with Living Bomb. The marked enemy gains 50% movement speed and explodes on death, dealing 300% of maximum life as fire damage.",
    tier: "t0",
    familyId: "ignite",
    tags: ["ignite", "mark", "explosion", "fire"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "LIVING_BOMB", markEvery: 20, speedIncreased: 0.5, explosionDamageScalar: 3.0, explosionRadius: 150 }],
    },
  },
];

function makeBoonNode(
  familyId: string,
  index: number,
  name: string,
  description: string,
  mods: StatMod[],
): RingTalentNodeDef {
  return {
    id: `BOON_${familyId.toUpperCase()}_${index}`,
    name,
    description,
    requiresNodeIds: [],
    cost: 1,
    effect: { kind: "STAT_MODIFIERS", mods },
  };
}

function makeFamilyTree(familyId: RingFamilyTalentTreeDef["familyId"]): RingFamilyTalentTreeDef {
  switch (familyId) {
    case "starter":
      return makeEmptyTree(familyId);
    case "generic":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Focused Strikes", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 2, "Quick Hands", "+5% attack speed", [{ key: STAT_KEYS.GLOBAL_ATTACK_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 3, "Light Feet", "+5% move speed", [{ key: STAT_KEYS.MOVE_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 4, "Vitality", "+10 life", [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 10 }]),
        ],
      };
    case "physical":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Brute Force", "+15% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.15 }]),
          makeBoonNode(familyId, 2, "Rapid Blows", "+5% attack speed", [{ key: STAT_KEYS.GLOBAL_ATTACK_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 3, "Precision", "+2% crit chance", [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.02 }]),
          makeBoonNode(familyId, 4, "Toughness", "+10 life", [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 10 }]),
        ],
      };
    case "projectile":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Velocity", "+10% projectile speed", [{ key: STAT_KEYS.PROJECTILE_SPEED_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 2, "Impact", "+10% projectile damage", [{ key: STAT_KEYS.PROJECTILE_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 3, "Rapid Fire", "+5% attack speed", [{ key: STAT_KEYS.GLOBAL_ATTACK_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 4, "Sharpness", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
        ],
      };
    case "poison":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Virulence", "+15% poison DoT damage", [{ key: STAT_KEYS.DOT_POISON_DAMAGE_INCREASED, op: "increased", value: 0.15 }]),
          makeBoonNode(familyId, 2, "Lingering Toxin", "+10% DoT duration", [{ key: STAT_KEYS.DOT_DURATION_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 3, "Toxic Touch", "+5% chance to poison", [{ key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.05 }]),
          makeBoonNode(familyId, 4, "Venomous Strikes", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
        ],
      };
    case "ignite":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Inferno", "+15% ignite DoT damage", [{ key: STAT_KEYS.DOT_IGNITE_DAMAGE_INCREASED, op: "increased", value: 0.15 }]),
          makeBoonNode(familyId, 2, "Slow Burn", "+10% DoT duration", [{ key: STAT_KEYS.DOT_DURATION_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 3, "Kindle", "+5% chance to ignite", [{ key: STAT_KEYS.CHANCE_TO_IGNITE_ADD, op: "add", value: 0.05 }]),
          makeBoonNode(familyId, 4, "Burning Strikes", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
        ],
      };
    case "dot":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Poison Mastery", "+15% poison DoT damage", [{ key: STAT_KEYS.DOT_POISON_DAMAGE_INCREASED, op: "increased", value: 0.15 }]),
          makeBoonNode(familyId, 2, "Ignite Mastery", "+15% ignite DoT damage", [{ key: STAT_KEYS.DOT_IGNITE_DAMAGE_INCREASED, op: "increased", value: 0.15 }]),
          makeBoonNode(familyId, 3, "Prolonged Agony", "+15% DoT duration", [{ key: STAT_KEYS.DOT_DURATION_INCREASED, op: "increased", value: 0.15 }]),
          makeBoonNode(familyId, 4, "Affliction Strikes", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
        ],
      };
    case "chaos":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Chaos Strikes", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 2, "Chaotic Speed", "+5% attack speed", [{ key: STAT_KEYS.GLOBAL_ATTACK_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 3, "Entropy", "+5% move speed", [{ key: STAT_KEYS.MOVE_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 4, "Chaos Vitality", "+10 life", [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 10 }]),
        ],
      };
    case "crit":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Keen Eye", "+3% crit chance", [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.03 }]),
          makeBoonNode(familyId, 2, "Devastating Blows", "+15% crit multi", [{ key: STAT_KEYS.CRIT_MULTI_ADD, op: "add", value: 0.15 }]),
          makeBoonNode(familyId, 3, "Critical Force", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 4, "Lethal Tempo", "+5% attack speed", [{ key: STAT_KEYS.GLOBAL_ATTACK_SPEED_INCREASED, op: "increased", value: 0.05 }]),
        ],
      };
    case "trigger":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Trigger Force", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 2, "Trigger Tempo", "+5% attack speed", [{ key: STAT_KEYS.GLOBAL_ATTACK_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 3, "Trigger Agility", "+5% move speed", [{ key: STAT_KEYS.MOVE_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 4, "Trigger Vitality", "+10 life", [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 10 }]),
        ],
      };
    case "health":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Fortitude", "+20 life", [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 20 }]),
          makeBoonNode(familyId, 2, "Constitution", "+10% life increased", [{ key: STAT_KEYS.LIFE_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 3, "Resilience", "+5% damage reduction", [{ key: STAT_KEYS.DAMAGE_REDUCTION_ADD, op: "add", value: 0.05 }]),
          makeBoonNode(familyId, 4, "Life Force", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
        ],
      };
    case "defense":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Hardened", "+15 life", [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 15 }]),
          makeBoonNode(familyId, 2, "Iron Skin", "+5% damage reduction", [{ key: STAT_KEYS.DAMAGE_REDUCTION_ADD, op: "add", value: 0.05 }]),
          makeBoonNode(familyId, 3, "Robust", "+5% life increased", [{ key: STAT_KEYS.LIFE_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 4, "Evasive", "+5% move speed", [{ key: STAT_KEYS.MOVE_SPEED_INCREASED, op: "increased", value: 0.05 }]),
        ],
      };
    case "utility":
      return {
        familyId,
        nodes: [
          makeBoonNode(familyId, 1, "Swiftness", "+5% move speed", [{ key: STAT_KEYS.MOVE_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 2, "Alacrity", "+5% attack speed", [{ key: STAT_KEYS.GLOBAL_ATTACK_SPEED_INCREASED, op: "increased", value: 0.05 }]),
          makeBoonNode(familyId, 3, "Utility Strikes", "+10% hit damage", [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }]),
          makeBoonNode(familyId, 4, "Utility Vitality", "+10 life", [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 10 }]),
        ],
      };
    default:
      return makeEmptyTree(familyId);
  }
}

export const RING_FAMILY_TALENT_TREES_V1: RingFamilyTalentTreeDef[] = RING_FAMILY_IDS.map(makeFamilyTree);

function validateTriggeredAction(
  action: TriggeredEffectActionDef,
  path: string,
  issues: RingContentValidationIssue[],
): void {
  if (!action || typeof action !== "object") {
    issues.push({ path, message: "Triggered effect requires action" });
    return;
  }

  switch (action.kind) {
    case "GAIN_ARMOR":
      if (!Number.isFinite(action.amount)) {
        issues.push({ path: `${path}.amount`, message: "GAIN_ARMOR amount must be finite" });
      }
      return;
    case "SPAWN_PROJECTILE":
      if (!Number.isFinite(action.speed) || action.speed < 0) {
        issues.push({ path: `${path}.speed`, message: "Projectile speed must be a non-negative finite number" });
      }
      if (!Number.isFinite(action.ttl) || action.ttl <= 0) {
        issues.push({ path: `${path}.ttl`, message: "Projectile ttl must be a positive finite number" });
      }
      if (!Number.isFinite(action.radius) || action.radius <= 0) {
        issues.push({ path: `${path}.radius`, message: "Projectile radius must be a positive finite number" });
      }
      if (!Number.isFinite(action.damageScalar) || action.damageScalar < 0) {
        issues.push({ path: `${path}.damageScalar`, message: "Projectile damageScalar must be a non-negative finite number" });
      }
      if (action.rangePx !== undefined && (!Number.isFinite(action.rangePx) || action.rangePx < 0)) {
        issues.push({ path: `${path}.rangePx`, message: "Projectile rangePx must be a non-negative finite number" });
      }
      if (action.explodeRadius !== undefined && (!Number.isFinite(action.explodeRadius) || action.explodeRadius < 0)) {
        issues.push({ path: `${path}.explodeRadius`, message: "Projectile explodeRadius must be a non-negative finite number" });
      }
      return;
    case "EXPLODE_ON_DEATH":
      if (!Number.isFinite(action.radius) || action.radius <= 0) {
        issues.push({ path: `${path}.radius`, message: "Explosion radius must be a positive finite number" });
      }
      if (!Number.isFinite(action.damageScalar) || action.damageScalar < 0) {
        issues.push({ path: `${path}.damageScalar`, message: "Explosion damageScalar must be a non-negative finite number" });
      }
      return;
    case "SPREAD_IGNITE_ON_DEATH":
      if (!Number.isFinite(action.radius) || action.radius <= 0) {
        issues.push({ path: `${path}.radius`, message: "Ignite spread radius must be a positive finite number" });
      }
      return;
    case "APPLY_IGNITE_FROM_HIT":
      if (!Number.isFinite(action.damageScalar) || action.damageScalar < 0) {
        issues.push({ path: `${path}.damageScalar`, message: "Ignite damageScalar must be a non-negative finite number" });
      }
      return;
    case "CHAIN_HIT":
      if (!Number.isFinite(action.maxTargets) || action.maxTargets <= 0) {
        issues.push({ path: `${path}.maxTargets`, message: "Chain maxTargets must be a positive finite number" });
      }
      if (!Number.isFinite(action.jumpRangePx) || action.jumpRangePx <= 0) {
        issues.push({ path: `${path}.jumpRangePx`, message: "Chain jumpRangePx must be a positive finite number" });
      }
      if (!Number.isFinite(action.damageScalar) || action.damageScalar < 0) {
        issues.push({ path: `${path}.damageScalar`, message: "Chain damageScalar must be a non-negative finite number" });
      }
      return;
    case "STUN_EXPLOSION":
      if (!Number.isFinite(action.radius) || action.radius <= 0) {
        issues.push({ path: `${path}.radius`, message: "Stun explosion radius must be a positive finite number" });
      }
      if (!Number.isFinite(action.stunDurationSec) || action.stunDurationSec <= 0) {
        issues.push({ path: `${path}.stunDurationSec`, message: "stunDurationSec must be a positive finite number" });
      }
      return;
    default:
      issues.push({ path: `${path}.kind`, message: `Unsupported triggered action: ${String((action as { kind?: unknown }).kind)}` });
  }
}

function validateCombatRule(
  rule: CombatRuleDef,
  path: string,
  issues: RingContentValidationIssue[],
): void {
  switch (rule.kind) {
    case "EVERY_NTH_SHOT_CRITS":
      if (!Number.isFinite(rule.everyShots) || rule.everyShots <= 0) {
        issues.push({ path: `${path}.everyShots`, message: "everyShots must be a positive finite number" });
      }
      return;
    case "PIERCE_HITS_MORE_DAMAGE_TO_POISONED":
    case "MORE_DAMAGE_TO_BURNING_TARGETS":
      if (!Number.isFinite(rule.more) || rule.more < 0) {
        issues.push({ path: `${path}.more`, message: "more must be a non-negative finite number" });
      }
      return;
    case "POINT_BLANK_DAMAGE_FALLOFF":
      if (!Number.isFinite(rule.maxRangePx) || rule.maxRangePx <= 0) {
        issues.push({ path: `${path}.maxRangePx`, message: "maxRangePx must be a positive finite number" });
      }
      if (!Number.isFinite(rule.maxMore) || rule.maxMore < 0) {
        issues.push({ path: `${path}.maxMore`, message: "maxMore must be a non-negative finite number" });
      }
      return;
    case "POINT_BLANK_CLOSE_HIT_KNOCKBACK":
      if (!Number.isFinite(rule.rangePx) || rule.rangePx <= 0) {
        issues.push({ path: `${path}.rangePx`, message: "rangePx must be a positive finite number" });
      }
      if (!Number.isFinite(rule.basePushPx) || rule.basePushPx < 0) {
        issues.push({ path: `${path}.basePushPx`, message: "basePushPx must be a non-negative finite number" });
      }
      if (!Number.isFinite(rule.bonusPushPx) || rule.bonusPushPx < 0) {
        issues.push({ path: `${path}.bonusPushPx`, message: "bonusPushPx must be a non-negative finite number" });
      }
      return;
    case "NO_PIERCE_NEARBY_HIT_DAMAGE_INCREASED":
      if (!Number.isFinite(rule.rangePx) || rule.rangePx <= 0) {
        issues.push({ path: `${path}.rangePx`, message: "rangePx must be a positive finite number" });
      }
      if (!Number.isFinite(rule.increased) || rule.increased < 0) {
        issues.push({ path: `${path}.increased`, message: "increased must be a non-negative finite number" });
      }
      return;
    case "PHYSICAL_HIT_DAMAGE_INCREASED_NON_PHYSICAL_SUPPRESSED":
      if (!Number.isFinite(rule.increased) || rule.increased < 0) {
        issues.push({ path: `${path}.increased`, message: "increased must be a non-negative finite number" });
      }
      return;
    case "PHYSICAL_HIT_DAMAGE_INCREASED_PER_EQUIPPED_FAMILY_RING":
      if (typeof rule.familyId !== "string" || !(RING_FAMILY_IDS as readonly string[]).includes(rule.familyId)) {
        issues.push({ path: `${path}.familyId`, message: "familyId must be a known ring family" });
      }
      if (!Number.isFinite(rule.increasedPerRing) || rule.increasedPerRing < 0) {
        issues.push({ path: `${path}.increasedPerRing`, message: "increasedPerRing must be a non-negative finite number" });
      }
      return;
    case "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY":
      if (!Number.isFinite(rule.increasedPerEnemy) || rule.increasedPerEnemy < 0) {
        issues.push({ path: `${path}.increasedPerEnemy`, message: "increasedPerEnemy must be a non-negative finite number" });
      }
      return;
    case "POISON_EXTRA_STACK_CHANCE":
      if (!Number.isFinite(rule.chance) || rule.chance < 0 || rule.chance > 1) {
        issues.push({ path: `${path}.chance`, message: "chance must be a finite value between 0 and 1" });
      }
      return;
    case "TRIGGER_PROC_CHANCE_INCREASED":
      if (!Number.isFinite(rule.increased) || rule.increased < 0) {
        issues.push({ path: `${path}.increased`, message: "increased must be a non-negative finite number" });
      }
      return;
    case "POISONED_ENEMIES_EXPLODE_ON_DEATH":
      if (!Number.isFinite(rule.radius) || rule.radius <= 0) {
        issues.push({ path: `${path}.radius`, message: "radius must be a positive finite number" });
      }
      if (!Number.isFinite(rule.damageScalar) || rule.damageScalar <= 0 || rule.damageScalar > 5) {
        issues.push({ path: `${path}.damageScalar`, message: "damageScalar must be a finite number between 0 (exclusive) and 5" });
      }
      return;
    case "BURNING_ENEMIES_MOVE_SPEED_REDUCED":
      if (!Number.isFinite(rule.reduced) || rule.reduced <= 0 || rule.reduced > 1) {
        issues.push({ path: `${path}.reduced`, message: "reduced must be a finite number between 0 (exclusive) and 1" });
      }
      return;
    case "POISONED_ENEMIES_DAMAGE_REDUCED":
      if (!Number.isFinite(rule.reduced) || rule.reduced <= 0 || rule.reduced > 1) {
        issues.push({ path: `${path}.reduced`, message: "reduced must be a finite number between 0 (exclusive) and 1" });
      }
      return;
    case "POISON_TRAIL":
      if (!Number.isFinite(rule.radius) || rule.radius <= 0) {
        issues.push({ path: `${path}.radius`, message: "radius must be a positive finite number" });
      }
      if (!Number.isFinite(rule.poisonDps) || rule.poisonDps <= 0) {
        issues.push({ path: `${path}.poisonDps`, message: "poisonDps must be a positive finite number" });
      }
      if (!Number.isFinite(rule.tickEvery) || rule.tickEvery <= 0) {
        issues.push({ path: `${path}.tickEvery`, message: "tickEvery must be a positive finite number" });
      }
      if (!Number.isFinite(rule.trailTtl) || rule.trailTtl <= 0) {
        issues.push({ path: `${path}.trailTtl`, message: "trailTtl must be a positive finite number" });
      }
      if (!Number.isFinite(rule.dropEvery) || rule.dropEvery <= 0) {
        issues.push({ path: `${path}.dropEvery`, message: "dropEvery must be a positive finite number" });
      }
      return;
    case "LASER_EXECUTOR":
      if (!Number.isFinite(rule.thresholdFraction) || rule.thresholdFraction <= 0 || rule.thresholdFraction >= 1) {
        issues.push({ path: `${path}.thresholdFraction`, message: "thresholdFraction must be a finite number between 0 and 1 (exclusive)" });
      }
      if (!Number.isFinite(rule.rangePx) || rule.rangePx <= 0) {
        issues.push({ path: `${path}.rangePx`, message: "rangePx must be a positive finite number" });
      }
      if (!Number.isFinite(rule.scanEvery) || rule.scanEvery <= 0) {
        issues.push({ path: `${path}.scanEvery`, message: "scanEvery must be a positive finite number" });
      }
      return;
    case "PHYSICAL_HIT_STUN_CHANCE":
      if (!Number.isFinite(rule.chance) || rule.chance <= 0 || rule.chance > 1) {
        issues.push({ path: `${path}.chance`, message: "chance must be a finite value between 0 (exclusive) and 1" });
      }
      if (!Number.isFinite(rule.stunDurationSec) || rule.stunDurationSec <= 0) {
        issues.push({ path: `${path}.stunDurationSec`, message: "stunDurationSec must be a positive finite number" });
      }
      return;
    case "TIMED_NEXT_SHOT_EMPOWER":
      if (!Number.isFinite(rule.chargeEvery) || rule.chargeEvery <= 0) {
        issues.push({ path: `${path}.chargeEvery`, message: "chargeEvery must be a positive finite number" });
      }
      if (!Number.isFinite(rule.physicalDamageIncreased) || rule.physicalDamageIncreased <= 0) {
        issues.push({ path: `${path}.physicalDamageIncreased`, message: "physicalDamageIncreased must be a positive finite number" });
      }
      return;
    case "KILL_EMPOWER_NEXT_SHOT":
      if (!Number.isFinite(rule.damageIncreased) || rule.damageIncreased <= 0) {
        issues.push({ path: `${path}.damageIncreased`, message: "damageIncreased must be a positive finite number" });
      }
      return;
    case "CRIT_MOVE_SPEED_BUFF":
      if (!Number.isFinite(rule.moveSpeedIncreased) || rule.moveSpeedIncreased <= 0) {
        issues.push({ path: `${path}.moveSpeedIncreased`, message: "moveSpeedIncreased must be a positive finite number" });
      }
      if (!Number.isFinite(rule.durationSec) || rule.durationSec <= 0) {
        issues.push({ path: `${path}.durationSec`, message: "durationSec must be a positive finite number" });
      }
      return;
    case "LIVING_BOMB":
      if (!Number.isFinite(rule.markEvery) || rule.markEvery <= 0) {
        issues.push({ path: `${path}.markEvery`, message: "markEvery must be a positive finite number" });
      }
      if (!Number.isFinite(rule.speedIncreased) || rule.speedIncreased <= 0) {
        issues.push({ path: `${path}.speedIncreased`, message: "speedIncreased must be a positive finite number" });
      }
      if (!Number.isFinite(rule.explosionDamageScalar) || rule.explosionDamageScalar <= 0) {
        issues.push({ path: `${path}.explosionDamageScalar`, message: "explosionDamageScalar must be a positive finite number" });
      }
      if (!Number.isFinite(rule.explosionRadius) || rule.explosionRadius <= 0) {
        issues.push({ path: `${path}.explosionRadius`, message: "explosionRadius must be a positive finite number" });
      }
      return;
    case "PIERCE_POISONED_TARGETS":
    case "CRIT_ROLLS_TWICE":
    case "TRIGGERED_HITS_CAN_APPLY_DOTS":
    case "CONVERT_ALL_HIT_DAMAGE_TO_CHAOS":
    case "DOUBLE_TRIGGERS":
    case "RETRY_FAILED_TRIGGER_PROCS_ONCE":
      return;
    default:
      issues.push({ path: `${path}.kind`, message: `Unsupported combat rule: ${String((rule as { kind?: unknown }).kind)}` });
  }
}

function validateWeaponFireRule(
  rule: WeaponFireRuleDef,
  path: string,
  issues: RingContentValidationIssue[],
): void {
  if (!rule || typeof rule !== "object") {
    issues.push({ path, message: "Weapon fire rule must be an object" });
    return;
  }

  switch (rule.kind) {
    case "BACKFIRE_PROJECTILE":
      return;
    default:
      issues.push({ path: `${path}.kind`, message: `Unsupported weapon fire rule: ${String((rule as { kind?: unknown }).kind)}` });
  }
}

function validateDynamicStatModifier(
  mod: DynamicStatModifierDef,
  path: string,
  issues: RingContentValidationIssue[],
): void {
  if (!mod || typeof mod !== "object") {
    issues.push({ path, message: "Dynamic stat modifier must be an object" });
    return;
  }

  switch (mod.kind) {
    case "GLOBAL_HIT_DAMAGE_INCREASED_FROM_MAX_LIFE":
      if (!Number.isFinite(mod.increasedPerMaxLife) || mod.increasedPerMaxLife < 0) {
        issues.push({
          path: `${path}.increasedPerMaxLife`,
          message: "increasedPerMaxLife must be a non-negative finite number",
        });
      }
      return;
    case "GLOBAL_HIT_DAMAGE_INCREASED_PER_MISSING_LIFE":
      if (!Number.isFinite(mod.missingLifeStep) || mod.missingLifeStep <= 0) {
        issues.push({ path: `${path}.missingLifeStep`, message: "missingLifeStep must be a positive finite number" });
      }
      if (!Number.isFinite(mod.increasedPerStep) || mod.increasedPerStep < 0) {
        issues.push({ path: `${path}.increasedPerStep`, message: "increasedPerStep must be a non-negative finite number" });
      }
      return;
    default:
      issues.push({ path: `${path}.kind`, message: `Unsupported dynamic stat modifier: ${String((mod as { kind?: unknown }).kind)}` });
  }
}

function validateRewardRule(
  rule: RewardRuleDef,
  path: string,
  issues: RingContentValidationIssue[],
): void {
  if (!rule || typeof rule !== "object") {
    issues.push({ path, message: "Reward rule must be an object" });
    return;
  }

  switch (rule.kind) {
    case "RING_REWARD_OPTION_COUNT_ADD":
      if (!Number.isFinite(rule.add) || rule.add < 0) {
        issues.push({ path: `${path}.add`, message: "add must be a non-negative finite number" });
      }
      return;
    case "RING_REWARD_EQUIPPED_FAMILY_WEIGHT_MULTIPLIER":
      if (!Number.isFinite(rule.multiplier) || rule.multiplier < 1) {
        issues.push({ path: `${path}.multiplier`, message: "multiplier must be a finite number greater than or equal to 1" });
      }
      return;
    case "RING_REWARD_REROLL_ADD":
      if (!Number.isFinite(rule.count) || rule.count < 0) {
        issues.push({ path: `${path}.count`, message: "count must be a non-negative finite number" });
      }
      return;
    default:
      issues.push({ path: `${path}.kind`, message: `Unsupported reward rule: ${String((rule as { kind?: unknown }).kind)}` });
  }
}

function validateEffectDef(effect: EffectDef, path: string, issues: RingContentValidationIssue[]): void {
  if (!effect || typeof effect !== "object") {
    issues.push({ path, message: "Effect must be an object" });
    return;
  }
  if (effect.kind === "STAT_MODIFIERS") {
    if (!Array.isArray(effect.mods)) {
      issues.push({ path, message: "STAT_MODIFIERS requires mods[]" });
      return;
    }
    for (let i = 0; i < effect.mods.length; i++) {
      const mod = effect.mods[i];
      const modPath = `${path}.mods[${i}]`;
      if (!mod || typeof mod !== "object") {
        issues.push({ path: modPath, message: "Modifier must be an object" });
        continue;
      }
      if (typeof mod.key !== "string" || mod.key.length <= 0) {
        issues.push({ path: `${modPath}.key`, message: "Modifier key must be a non-empty string" });
      }
      if (!VALID_MOD_OPS.has(mod.op)) {
        issues.push({ path: `${modPath}.op`, message: `Unsupported modifier op: ${String(mod.op)}` });
      }
      if (!Number.isFinite(mod.value)) {
        issues.push({ path: `${modPath}.value`, message: "Modifier value must be finite" });
      }
    }
    return;
  }

  if (effect.kind === "DYNAMIC_STAT_MODIFIERS") {
    if (!Array.isArray(effect.mods) || effect.mods.length <= 0) {
      issues.push({ path: `${path}.mods`, message: "DYNAMIC_STAT_MODIFIERS requires a non-empty mods[]" });
      return;
    }
    for (let i = 0; i < effect.mods.length; i++) {
      validateDynamicStatModifier(effect.mods[i], `${path}.mods[${i}]`, issues);
    }
    return;
  }

  if (effect.kind === "FLOOR_LIFECYCLE") {
    if (!VALID_FLOOR_LIFECYCLE_TRIGGERS.has(effect.trigger)) {
      issues.push({ path: `${path}.trigger`, message: `Unknown floor lifecycle trigger: ${String(effect.trigger)}` });
    }
    const action = effect.action as { kind?: unknown; amount?: unknown } | undefined;
    if (!action || typeof action !== "object") {
      issues.push({ path: `${path}.action`, message: "FLOOR_LIFECYCLE requires action" });
      return;
    }
    if (action.kind !== "HEAL_PLAYER") {
      issues.push({ path: `${path}.action.kind`, message: `Unsupported floor lifecycle action: ${String(action.kind)}` });
    } else if (!Number.isFinite(action.amount) || Number(action.amount) < 0) {
      issues.push({ path: `${path}.action.amount`, message: "HEAL_PLAYER amount must be a non-negative finite number" });
    }
    return;
  }

  if (effect.kind === "REWARD_RULES") {
    if (!Array.isArray(effect.rules) || effect.rules.length <= 0) {
      issues.push({ path: `${path}.rules`, message: "REWARD_RULES requires a non-empty rules[]" });
      return;
    }
    for (let i = 0; i < effect.rules.length; i++) {
      validateRewardRule(effect.rules[i], `${path}.rules[${i}]`, issues);
    }
    return;
  }

  if (effect.kind === "WEAPON_FIRE_RULES") {
    if (!Array.isArray(effect.rules) || effect.rules.length <= 0) {
      issues.push({ path: `${path}.rules`, message: "WEAPON_FIRE_RULES requires a non-empty rules[]" });
      return;
    }
    for (let i = 0; i < effect.rules.length; i++) {
      validateWeaponFireRule(effect.rules[i], `${path}.rules[${i}]`, issues);
    }
    return;
  }

  if (effect.kind === "TRIGGERED") {
    if (!VALID_TRIGGER_KEYS.has(effect.triggerKey)) {
      issues.push({ path: `${path}.triggerKey`, message: `Unknown trigger key: ${String(effect.triggerKey)}` });
    }
    if (effect.procChance !== undefined && (!Number.isFinite(effect.procChance) || effect.procChance < 0 || effect.procChance > 1)) {
      issues.push({ path: `${path}.procChance`, message: "procChance must be a finite value between 0 and 1" });
    }
    validateTriggeredAction(effect.action, `${path}.action`, issues);
    return;
  }

  if (effect.kind === "COMBAT_RULES") {
    if (!Array.isArray(effect.rules) || effect.rules.length <= 0) {
      issues.push({ path: `${path}.rules`, message: "COMBAT_RULES requires a non-empty rules[]" });
      return;
    }
    for (let i = 0; i < effect.rules.length; i++) {
      validateCombatRule(effect.rules[i], `${path}.rules[${i}]`, issues);
    }
    return;
  }

  if (effect.kind === "HAND_STRUCTURE") {
    if (!HAND_EFFECT_TYPES.includes(effect.effectType)) {
      issues.push({ path: `${path}.effectType`, message: `Unknown hand effect type: ${String(effect.effectType)}` });
    }
    return;
  }

  if (effect.kind === "MIRROR_LEFT_RING") {
    return;
  }

  if (effect.kind === "AMPLIFY_NEIGHBORS") {
    if (!Number.isFinite(effect.increasedEffectBonus) || effect.increasedEffectBonus <= 0) {
      issues.push({ path: `${path}.increasedEffectBonus`, message: "increasedEffectBonus must be a positive finite number" });
    }
    return;
  }

  issues.push({ path: `${path}.kind`, message: `Unsupported effect kind: ${String((effect as { kind?: unknown }).kind)}` });
}

function validateFamilyTreeCycles(tree: RingFamilyTalentTreeDef, issues: RingContentValidationIssue[]): void {
  const nodesById = new Map<string, RingTalentNodeDef>();
  for (const node of tree.nodes) {
    nodesById.set(node.id, node);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string, chain: string[]): void => {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      issues.push({
        path: `familyTrees.${tree.familyId}.nodes.${nodeId}`,
        message: `Cycle detected in prerequisites: ${[...chain, nodeId].join(" -> ")}`,
      });
      return;
    }

    const node = nodesById.get(nodeId);
    if (!node) return;

    visiting.add(nodeId);
    for (const requiredId of node.requiresNodeIds) {
      if (!nodesById.has(requiredId)) continue;
      visit(requiredId, [...chain, nodeId]);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const node of tree.nodes) {
    visit(node.id, []);
  }
}

export function validateRingContent(
  ringDefs: readonly RingDef[],
  familyTrees: readonly RingFamilyTalentTreeDef[],
): RingContentValidationIssue[] {
  const issues: RingContentValidationIssue[] = [];
  const ringIds = new Set<string>();
  const familyIds = new Set<string>();
  const nodeIds = new Set<string>();

  for (let i = 0; i < familyTrees.length; i++) {
    const tree = familyTrees[i];
    const treePath = `familyTrees[${i}]`;
    if (!RING_FAMILY_IDS.includes(tree.familyId)) {
      issues.push({ path: `${treePath}.familyId`, message: `Unknown ring family: ${String(tree.familyId)}` });
    }
    if (familyIds.has(tree.familyId)) {
      issues.push({ path: `${treePath}.familyId`, message: `Duplicate family tree: ${tree.familyId}` });
    }
    familyIds.add(tree.familyId);

    const localNodeIds = new Set<string>();
    for (let j = 0; j < tree.nodes.length; j++) {
      const node = tree.nodes[j];
      const nodePath = `${treePath}.nodes[${j}]`;
      if (localNodeIds.has(node.id)) {
        issues.push({ path: `${nodePath}.id`, message: `Duplicate node id in family ${tree.familyId}: ${node.id}` });
      }
      if (nodeIds.has(node.id)) {
        issues.push({ path: `${nodePath}.id`, message: `Duplicate node id across families: ${node.id}` });
      }
      localNodeIds.add(node.id);
      nodeIds.add(node.id);

      if (!Number.isFinite(node.cost) || node.cost <= 0) {
        issues.push({ path: `${nodePath}.cost`, message: "Talent node cost must be a positive finite number" });
      }
      for (const requiredId of node.requiresNodeIds) {
        if (!tree.nodes.some((candidate) => candidate.id === requiredId)) {
          issues.push({
            path: `${nodePath}.requiresNodeIds`,
            message: `Missing prerequisite node "${requiredId}" in family ${tree.familyId}`,
          });
        }
      }
      validateEffectDef(node.effect, `${nodePath}.effect`, issues);
    }

    validateFamilyTreeCycles(tree, issues);
  }

  for (const familyId of RING_FAMILY_IDS) {
    if (!familyIds.has(familyId)) {
      issues.push({ path: "familyTrees", message: `Missing family talent tree for ${familyId}` });
    }
  }

  for (let i = 0; i < ringDefs.length; i++) {
    const def = ringDefs[i];
    const defPath = `ringDefs[${i}]`;
    if (ringIds.has(def.id)) {
      issues.push({ path: `${defPath}.id`, message: `Duplicate ring id: ${def.id}` });
    }
    ringIds.add(def.id);
    if (!RING_FAMILY_IDS.includes(def.familyId)) {
      issues.push({ path: `${defPath}.familyId`, message: `Unknown ring family: ${String(def.familyId)}` });
    }
    if (!familyIds.has(def.familyId)) {
      issues.push({ path: `${defPath}.familyId`, message: `Missing family talent tree for ${def.familyId}` });
    }
    if (typeof def.name !== "string" || def.name.trim().length <= 0) {
      issues.push({ path: `${defPath}.name`, message: "Ring name must be a non-empty string" });
    }
    if (typeof def.description !== "string" || def.description.trim().length <= 0) {
      issues.push({ path: `${defPath}.description`, message: "Ring description must be a non-empty string" });
    }
    if (!isRingTier(def.tier)) {
      issues.push({
        path: `${defPath}.tier`,
        message: `Ring tier must be one of ${RING_TIER_IDS.join(", ")}`,
      });
    }
    validateEffectDef(def.mainEffect, `${defPath}.mainEffect`, issues);
  }

  return issues;
}

export function createRingContentIndex(
  ringDefs: readonly RingDef[],
  familyTrees: readonly RingFamilyTalentTreeDef[],
): RingContentIndex {
  const issues = validateRingContent(ringDefs, familyTrees);
  if (issues.length > 0) {
    throw new Error(
      [
        "Invalid ring content:",
        ...issues.map((issue) => `- ${issue.path}: ${issue.message}`),
      ].join("\n"),
    );
  }

  const ringDefsById = new Map<string, RingDef>();
  for (const def of ringDefs) {
    ringDefsById.set(def.id, def);
  }

  const familyTreesById = new Map<string, RingFamilyTalentTreeDef>();
  const talentNodesById = new Map<string, RingTalentNodeDef>();
  for (const tree of familyTrees) {
    familyTreesById.set(tree.familyId, tree);
    for (const node of tree.nodes) {
      talentNodesById.set(node.id, node);
    }
  }

  return {
    ringDefs: [...ringDefs],
    ringDefsById,
    familyTrees: [...familyTrees],
    familyTreesById,
    talentNodesById,
  };
}

const RING_CONTENT_V1 = createRingContentIndex(RING_DEFS_V1, RING_FAMILY_TALENT_TREES_V1);

export function assertProgressionContentValid(): void {
  void RING_CONTENT_V1;
}

export function getAllRingDefs(): RingDef[] {
  return [...RING_CONTENT_V1.ringDefs];
}

export function getAllRingFamilyTalentTrees(): RingFamilyTalentTreeDef[] {
  return [...RING_CONTENT_V1.familyTrees];
}

export function getRingDefById(id: string): RingDef | undefined {
  return RING_CONTENT_V1.ringDefsById.get(id);
}

export function getRingFamilyTalentTreeById(familyId: string): RingFamilyTalentTreeDef | undefined {
  return RING_CONTENT_V1.familyTreesById.get(familyId);
}

export function getRingTalentNodeById(nodeId: string): RingTalentNodeDef | undefined {
  return RING_CONTENT_V1.talentNodesById.get(nodeId);
}
