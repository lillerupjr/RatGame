import { describe, expect, test } from "vitest";
import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import { RING_TIER_IDS, type RingTier } from "./ringTypes";
import {
  RING_DEFS_V1,
  getRingDefById,
  validateRingContent,
} from "./ringContent";

const EXPECTED_RING_IDS = [
  "RING_STARTER_STREET_REFLEX",
  "RING_STARTER_LUCKY_CHAMBER",
  "RING_STARTER_CONTAMINATED_ROUNDS",
  "RING_STARTER_POINT_BLANK_CARNAGE",
  "RING_STARTER_THERMAL_STARTER",
  "RING_GENERIC_DAMAGE_PERCENT_20",
  "RING_GENERIC_DAMAGE_PERCENT_10",
  "RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30",
  "RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30",
  "RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50",
  "RING_GENERIC_MOVE_SPEED_20",
  "RING_GENERIC_MOVE_SPEED_10",
  "RING_PHYSICAL_DAMAGE_PERCENT_20",
  "RING_PHYSICAL_DAMAGE_PERCENT_10",
  "RING_PHYSICAL_PURE_FORCE",
  "RING_PHYSICAL_DEVOTION",
  "RING_PROJECTILE_ADDITIONAL_PROJECTILES_1",
  "RING_PROJECTILE_GAIN_PIERCE_1",
  "RING_PROJECTILE_PIERCING_MOMENTUM",
  "RING_PROJECTILE_DAMAGE_INCREASED_10",
  "RING_PROJECTILE_BOUNCE_ADD_1",
  "RING_PROJECTILE_SCATTER_SHOT",
  "RING_PROJECTILE_BACKFIRE_SHOT",
  "RING_PROJECTILE_CLOSE_QUARTERS_GUARD",
  "RING_DOT_DAMAGE_OVER_TIME_MORE_50",
  "RING_DOT_SPECIALIST",
  "RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS",
  "RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS",
  "RING_POISON_CHANCE_PERCENT_25",
  "RING_POISON_CHANCE_PERCENT_10",
  "RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25",
  "RING_IGNITE_SPREAD_ON_DEATH",
  "RING_IGNITE_CRITS_APPLY_IGNITE",
  "RING_IGNITE_CHANCE_PERCENT_10",
  "RING_CRIT_ROLLS_TWICE",
  "RING_CRIT_CHANCE_PERCENT_5",
  "RING_TRIGGER_BAZOOKA_ON_HIT",
  "RING_TRIGGER_LIGHTNING_CHAIN",
  "RING_TRIGGER_SPARK_ON_HIT",
  "RING_TRIGGER_EXPLODE_ON_KILL",
  "RING_TRIGGER_DAGGER_ON_KILL",
  "RING_TRIGGER_DOUBLE_TRIGGERS",
  "RING_TRIGGER_PROC_CHANCE_PERCENT_50",
  "RING_TRIGGER_PROC_CHANCE_PERCENT_10",
  "RING_TRIGGER_RETRY_FAILED_PROCS_ONCE",
  "RING_HEALTH_MAX_LIFE_ADD_10",
  "RING_HEALTH_FLOOR_RECOVERY",
  "RING_HEALTH_VITAL_FORCE",
  "RING_HEALTH_WOUNDED_FURY",
  "RING_UTILITY_WIDER_SELECTION",
  "RING_UTILITY_CURATED_REWARDS",
  "RING_UTILITY_SELECTIVE_HAND",
  "RING_POISON_POISON_TRAIL",
  "RING_IGNITE_LASER_EXECUTOR",
  "RING_POISON_PLAGUE_DETONATION",
  "RING_IGNITE_SMOLDERING_DRAG",
  "RING_POISON_WEAKENING_VENOM",
  "RING_PHYSICAL_RETALIATION_BURST",
  "RING_PHYSICAL_STAGGERING_BLOWS",
  "RING_PHYSICAL_HEAVY_CHAMBER",
  "RING_GENERIC_KILL_MOMENTUM",
  "RING_CRIT_CRITICAL_SPRINT",
  "RING_UTILITY_MIRROR_BAND",
  "RING_UTILITY_AMPLIFYING_BAND",
  "RING_IGNITE_LIVING_BOMB",
] as const;

const EXPECTED_RING_TIERS = {
  RING_STARTER_STREET_REFLEX: "t2",
  RING_STARTER_LUCKY_CHAMBER: "t2",
  RING_STARTER_CONTAMINATED_ROUNDS: "t2",
  RING_STARTER_POINT_BLANK_CARNAGE: "t2",
  RING_STARTER_THERMAL_STARTER: "t3",
  RING_GENERIC_DAMAGE_PERCENT_20: "t3",
  RING_GENERIC_DAMAGE_PERCENT_10: "t3",
  RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30: "t2",
  RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30: "t2",
  RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50: "t1",
  RING_GENERIC_MOVE_SPEED_20: "t3",
  RING_GENERIC_MOVE_SPEED_10: "t3",
  RING_PHYSICAL_DAMAGE_PERCENT_20: "t3",
  RING_PHYSICAL_DAMAGE_PERCENT_10: "t3",
  RING_PHYSICAL_PURE_FORCE: "t1",
  RING_PHYSICAL_DEVOTION: "t1",
  RING_PROJECTILE_ADDITIONAL_PROJECTILES_1: "t1",
  RING_PROJECTILE_GAIN_PIERCE_1: "t2",
  RING_PROJECTILE_PIERCING_MOMENTUM: "t1",
  RING_PROJECTILE_DAMAGE_INCREASED_10: "t3",
  RING_PROJECTILE_BOUNCE_ADD_1: "t1",
  RING_PROJECTILE_SCATTER_SHOT: "t0",
  RING_PROJECTILE_BACKFIRE_SHOT: "t0",
  RING_PROJECTILE_CLOSE_QUARTERS_GUARD: "t2",
  RING_DOT_DAMAGE_OVER_TIME_MORE_50: "t2",
  RING_DOT_SPECIALIST: "t1",
  RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS: "t1",
  RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS: "t1",
  RING_POISON_CHANCE_PERCENT_25: "t3",
  RING_POISON_CHANCE_PERCENT_10: "t3",
  RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25: "t2",
  RING_IGNITE_SPREAD_ON_DEATH: "t1",
  RING_IGNITE_CRITS_APPLY_IGNITE: "t1",
  RING_IGNITE_CHANCE_PERCENT_10: "t3",
  RING_CRIT_ROLLS_TWICE: "t1",
  RING_CRIT_CHANCE_PERCENT_5: "t3",
  RING_TRIGGER_BAZOOKA_ON_HIT: "t0",
  RING_TRIGGER_LIGHTNING_CHAIN: "t0",
  RING_TRIGGER_SPARK_ON_HIT: "t2",
  RING_TRIGGER_EXPLODE_ON_KILL: "t1",
  RING_TRIGGER_DAGGER_ON_KILL: "t2",
  RING_TRIGGER_DOUBLE_TRIGGERS: "t0",
  RING_TRIGGER_PROC_CHANCE_PERCENT_50: "t1",
  RING_TRIGGER_PROC_CHANCE_PERCENT_10: "t3",
  RING_TRIGGER_RETRY_FAILED_PROCS_ONCE: "t1",
  RING_HEALTH_MAX_LIFE_ADD_10: "t3",
  RING_HEALTH_FLOOR_RECOVERY: "t3",
  RING_HEALTH_VITAL_FORCE: "t1",
  RING_HEALTH_WOUNDED_FURY: "t2",
  RING_UTILITY_WIDER_SELECTION: "t1",
  RING_UTILITY_CURATED_REWARDS: "t1",
  RING_UTILITY_SELECTIVE_HAND: "t1",
  RING_POISON_POISON_TRAIL: "t2",
  RING_IGNITE_LASER_EXECUTOR: "t1",
  RING_POISON_PLAGUE_DETONATION: "t0",
  RING_IGNITE_SMOLDERING_DRAG: "t3",
  RING_POISON_WEAKENING_VENOM: "t2",
  RING_PHYSICAL_RETALIATION_BURST: "t2",
  RING_PHYSICAL_STAGGERING_BLOWS: "t3",
  RING_PHYSICAL_HEAVY_CHAMBER: "t2",
  RING_GENERIC_KILL_MOMENTUM: "t2",
  RING_CRIT_CRITICAL_SPRINT: "t0",
  RING_UTILITY_MIRROR_BAND: "t0",
  RING_UTILITY_AMPLIFYING_BAND: "t0",
  RING_IGNITE_LIVING_BOMB: "t0",
} satisfies Record<(typeof EXPECTED_RING_IDS)[number], RingTier>;

describe("ring content validation", () => {
  test("accepts the tiered V1 ring catalog and exact ring id set", () => {
    expect(validateRingContent(RING_DEFS_V1)).toEqual([]);
    expect(RING_DEFS_V1.map((def) => def.id)).toEqual(EXPECTED_RING_IDS);
  });

  test("assigns authored tiers from the tiering sheet", () => {
    expect(RING_TIER_IDS).toEqual(["t0", "t1", "t2", "t3"]);
    for (const def of RING_DEFS_V1) {
      const expectedTier = EXPECTED_RING_TIERS[def.id as keyof typeof EXPECTED_RING_TIERS];
      expect(expectedTier).toBeDefined();
      expect(def.tier).toBe(expectedTier);
    }
  });

  test("accepts every valid authored tier string", () => {
    for (const tier of RING_TIER_IDS) {
      const issues = validateRingContent(
        [{ ...RING_DEFS_V1[0], id: `RING_VALID_TIER_${tier}`, tier }],
      );

      expect(issues.filter((issue) => issue.path.endsWith(".tier"))).toEqual([]);
    }
  });

  test("keeps recovered starter names and descriptions from git history", () => {
    expect(getRingDefById("RING_STARTER_STREET_REFLEX")).toMatchObject({
      name: "Street Reflex",
      description: "On hit, 20% chance to throw an additional knife at a nearby enemy.",
      tier: "t2",
    });
    expect(getRingDefById("RING_STARTER_LUCKY_CHAMBER")).toMatchObject({
      name: "Lucky Chamber",
      description: "Every 5th shot is guaranteed to crit.",
      tier: "t2",
    });
    expect(getRingDefById("RING_STARTER_CONTAMINATED_ROUNDS")).toMatchObject({
      name: "Contaminated Rounds",
      description: "Projectiles pierce poisoned enemies. Poisoned enemies take +20% damage from piercing hits.",
      tier: "t2",
    });
    expect(getRingDefById("RING_STARTER_POINT_BLANK_CARNAGE")).toMatchObject({
      name: "Point Blank Carnage",
      description: "Deal up to +50% damage based on proximity. Very close hits knock enemies back.",
      tier: "t2",
    });
    expect(getRingDefById("RING_STARTER_THERMAL_STARTER")).toMatchObject({
      name: "Thermal Starter",
      description: "Deal +15% damage to burning enemies.",
      tier: "t3",
    });
  });

  test("records deliberate V1 value overrides where requested", () => {
    expect(getRingDefById("RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30")?.description).toBe(
      "60% more damage. 30% less attack speed.",
    );
    expect(getRingDefById("RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30")?.description).toBe(
      "60% more attack speed. 30% less damage.",
    );
    expect(getRingDefById("RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50")?.description).toBe(
      "100% more damage. 50% less maximum life.",
    );
    expect(getRingDefById("RING_TRIGGER_BAZOOKA_ON_HIT")?.description).toBe(
      "On hit: 10% chance to fire a bazooka dealing 300% of hit damage as physical damage.",
    );
  });

  test("includes content-only expansion rings with exact effects", () => {
    expect(getRingDefById("RING_GENERIC_DAMAGE_PERCENT_10")).toMatchObject({
      name: "Small Damage Band",
      description: "Deal 10% more damage.",
      familyId: "generic",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, op: "more", value: 0.1 }],
      },
    });
    expect(getRingDefById("RING_GENERIC_MOVE_SPEED_10")).toMatchObject({
      name: "Quick Step",
      description: "Gain 10% movement speed.",
      familyId: "generic",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [{ key: STAT_KEYS.MOVE_SPEED_MORE, op: "more", value: 0.1 }],
      },
    });
    expect(getRingDefById("RING_PHYSICAL_DAMAGE_PERCENT_10")).toMatchObject({
      name: "Bruiser's Band",
      description: "Deal 10% more physical damage.",
      familyId: "physical",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [{ key: STAT_KEYS.PHYSICAL_HIT_DAMAGE_MORE, op: "more", value: 0.1 }],
      },
    });
    expect(getRingDefById("RING_POISON_CHANCE_PERCENT_10")).toMatchObject({
      name: "Dirty Needle",
      description: "Gain 10% poison chance.",
      familyId: "poison",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [{ key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.1 }],
      },
    });
    expect(getRingDefById("RING_IGNITE_CHANCE_PERCENT_10")).toMatchObject({
      name: "Small Spark",
      description: "Gain 10% ignite chance.",
      familyId: "ignite",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [{ key: STAT_KEYS.CHANCE_TO_IGNITE_ADD, op: "add", value: 0.1 }],
      },
    });
    expect(getRingDefById("RING_CRIT_CHANCE_PERCENT_5")).toMatchObject({
      name: "Lucky Scratch",
      description: "Gain 5% increased crit chance.",
      familyId: "crit",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.05 }],
      },
    });
    expect(getRingDefById("RING_TRIGGER_PROC_CHANCE_PERCENT_10")).toMatchObject({
      name: "Twitchy Mechanism",
      description: "Gain 10% increased trigger proc chance.",
      familyId: "trigger",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "TRIGGER_PROC_CHANCE_INCREASED", increased: 0.1 }],
      },
    });
    expect(getRingDefById("RING_HEALTH_MAX_LIFE_ADD_10")).toMatchObject({
      name: "Minor Vitality",
      description: "Gain 10 maximum life.",
      familyId: "health",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 10 }],
      },
    });
  });

  test("includes projectile stat expansion rings with exact effects", () => {
    expect(getRingDefById("RING_PROJECTILE_DAMAGE_INCREASED_10")).toMatchObject({
      name: "Sharpened Tip",
      description: "Projectiles deal 10% increased damage.",
      tier: "t3",
      familyId: "projectile",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [{ key: STAT_KEYS.PROJECTILE_HIT_DAMAGE_INCREASED, op: "increased", value: 0.1 }],
      },
    });
    expect(getRingDefById("RING_PROJECTILE_BOUNCE_ADD_1")).toMatchObject({
      name: "Ricochet Rounds",
      description: "Projectiles gain +1 bounce.",
      tier: "t1",
      familyId: "projectile",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [{ key: STAT_KEYS.PROJECTILE_BOUNCE_ADD, op: "add", value: 1 }],
      },
    });
    expect(getRingDefById("RING_PROJECTILE_SCATTER_SHOT")).toMatchObject({
      name: "Scatter Shot",
      description: "Gain +5 projectiles, but projectiles deal 75% less damage.",
      tier: "t0",
      familyId: "projectile",
      mainEffect: {
        kind: "STAT_MODIFIERS",
        mods: [
          { key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 5 },
          { key: STAT_KEYS.PROJECTILE_HIT_DAMAGE_LESS, op: "less", value: 0.75 },
        ],
      },
    });
  });

  test("includes conditional combat-rule mini-batch rings with exact effects", () => {
    expect(getRingDefById("RING_PHYSICAL_PURE_FORCE")).toMatchObject({
      name: "Pure Force",
      description: "Your physical hit damage is increased by 30%, but you deal no non-physical hit damage.",
      tier: "t1",
      familyId: "physical",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "PHYSICAL_HIT_DAMAGE_INCREASED_NON_PHYSICAL_SUPPRESSED", increased: 0.3 }],
      },
    });
    expect(getRingDefById("RING_PHYSICAL_DEVOTION")).toMatchObject({
      name: "Physical Devotion",
      description: "Deal 20% increased physical hit damage for each equipped physical-family ring.",
      tier: "t1",
      familyId: "physical",
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
    });
    expect(getRingDefById("RING_PROJECTILE_CLOSE_QUARTERS_GUARD")).toMatchObject({
      name: "Close Quarters Guard",
      description: "While your projectile has no pierce, hits against enemies within 220px deal 35% increased damage.",
      tier: "t2",
      familyId: "projectile",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "NO_PIERCE_NEARBY_HIT_DAMAGE_INCREASED", rangePx: 220, increased: 0.35 }],
      },
    });
  });

  test("includes projectile/trigger mechanics mini-batch rings with exact effects", () => {
    expect(getRingDefById("RING_PROJECTILE_PIERCING_MOMENTUM")).toMatchObject({
      name: "Piercing Momentum",
      description: "Projectiles gain 30% increased damage for each enemy they have pierced.",
      tier: "t1",
      familyId: "projectile",
      tags: ["projectile", "pierce", "damage"],
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY", increasedPerEnemy: 0.3 }],
      },
    });
    expect(getRingDefById("RING_PROJECTILE_BACKFIRE_SHOT")).toMatchObject({
      name: "Backfire Shot",
      description: "Also fire a projectile behind you. This projectile is not modified by projectile count.",
      tier: "t0",
      familyId: "projectile",
      tags: ["projectile", "chase", "backfire"],
      mainEffect: {
        kind: "WEAPON_FIRE_RULES",
        rules: [{ kind: "BACKFIRE_PROJECTILE" }],
      },
    });
    expect(getRingDefById("RING_TRIGGER_LIGHTNING_CHAIN")).toMatchObject({
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
    });
  });

  test("includes health floor lifecycle mini-batch rings with exact effects", () => {
    expect(getRingDefById("RING_HEALTH_FLOOR_RECOVERY")).toMatchObject({
      name: "Floor Recovery",
      description: "Heal 10 health after completing a floor.",
      tier: "t3",
      familyId: "health",
      mainEffect: {
        kind: "FLOOR_LIFECYCLE",
        trigger: "FLOOR_COMPLETE",
        action: { kind: "HEAL_PLAYER", amount: 10 },
      },
    });
    expect(getRingDefById("RING_HEALTH_VITAL_FORCE")).toMatchObject({
      name: "Vital Force",
      description: "Deal increased damage equal to 20% of your maximum health.",
      tier: "t1",
      familyId: "health",
      mainEffect: {
        kind: "DYNAMIC_STAT_MODIFIERS",
        mods: [{ kind: "GLOBAL_HIT_DAMAGE_INCREASED_FROM_MAX_LIFE", increasedPerMaxLife: 0.002 }],
      },
    });
    expect(getRingDefById("RING_HEALTH_WOUNDED_FURY")).toMatchObject({
      name: "Wounded Fury",
      description: "Deal 5% increased damage for each 10 health missing.",
      tier: "t2",
      familyId: "health",
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
    });
  });

  test("includes reward manipulation mini-batch rings with exact effects", () => {
    expect(getRingDefById("RING_UTILITY_WIDER_SELECTION")).toMatchObject({
      name: "Wider Selection",
      description: "Ring rewards offer +1 additional option.",
      tier: "t1",
      familyId: "utility",
      mainEffect: {
        kind: "REWARD_RULES",
        rules: [{ kind: "RING_REWARD_OPTION_COUNT_ADD", add: 1 }],
      },
    });
    expect(getRingDefById("RING_UTILITY_CURATED_REWARDS")).toMatchObject({
      name: "Curated Rewards",
      description: "Ring rewards are slightly more likely to contain a family you already have equipped.",
      tier: "t1",
      familyId: "utility",
      mainEffect: {
        kind: "REWARD_RULES",
        rules: [{ kind: "RING_REWARD_EQUIPPED_FAMILY_WEIGHT_MULTIPLIER", multiplier: 2 }],
      },
    });
    expect(getRingDefById("RING_UTILITY_SELECTIVE_HAND")).toMatchObject({
      name: "Selective Hand",
      description: "After each floor, you may reroll ring rewards once.",
      tier: "t1",
      familyId: "utility",
      mainEffect: {
        kind: "REWARD_RULES",
        rules: [{ kind: "RING_REWARD_REROLL_ADD", count: 1 }],
      },
    });
  });

  test("includes poison/ignite hazard mini-batch rings with exact effects", () => {
    expect(getRingDefById("RING_POISON_POISON_TRAIL")).toMatchObject({
      name: "Poison Trail",
      description: "Leave a poison trail behind you that poisons enemies.",
      tier: "t2",
      familyId: "poison",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "POISON_TRAIL", radius: 30, poisonDps: 5, tickEvery: 0.5, trailTtl: 3, dropEvery: 0.3 }],
      },
    });
    expect(getRingDefById("RING_IGNITE_LASER_EXECUTOR")).toMatchObject({
      name: "Laser Executor",
      description: "Periodically execute nearby enemies below 15% life.",
      tier: "t1",
      familyId: "ignite",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "LASER_EXECUTOR", thresholdFraction: 0.15, rangePx: 200, scanEvery: 1.5 }],
      },
    });
    expect(getRingDefById("RING_POISON_PLAGUE_DETONATION")).toMatchObject({
      name: "Plague Detonation",
      description: "Poisoned enemies explode on death for 50% of their max life as chaos damage.",
      tier: "t0",
      familyId: "poison",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "POISONED_ENEMIES_EXPLODE_ON_DEATH", radius: 100, damageScalar: 0.5, damageType: "CHAOS" }],
      },
    });
    expect(getRingDefById("RING_IGNITE_SMOLDERING_DRAG")).toMatchObject({
      name: "Smoldering Drag",
      description: "Ignited enemies are slowed by 10%.",
      tier: "t3",
      familyId: "ignite",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "BURNING_ENEMIES_MOVE_SPEED_REDUCED", reduced: 0.1 }],
      },
    });
    expect(getRingDefById("RING_POISON_WEAKENING_VENOM")).toMatchObject({
      name: "Weakening Venom",
      description: "Poisoned enemies deal 20% less damage.",
      tier: "t2",
      familyId: "poison",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "POISONED_ENEMIES_DAMAGE_REDUCED", reduced: 0.2 }],
      },
    });
  });

  test("includes physical control/empower mini-batch rings with exact effects", () => {
    expect(getRingDefById("RING_PHYSICAL_RETALIATION_BURST")).toMatchObject({
      name: "Retaliation Burst",
      description: "Taking damage has a 30% chance to trigger an explosion, stunning nearby enemies for 1 second.",
      tier: "t2",
      familyId: "physical",
      mainEffect: {
        kind: "TRIGGERED",
        triggerKey: "ON_PLAYER_HIT",
        procChance: 0.3,
        action: { kind: "STUN_EXPLOSION", radius: 120, stunDurationSec: 1 },
      },
    });
    expect(getRingDefById("RING_PHYSICAL_STAGGERING_BLOWS")).toMatchObject({
      name: "Staggering Blows",
      description: "Physical hits have a 5% chance to stun enemies for 0.5 seconds.",
      tier: "t3",
      familyId: "physical",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "PHYSICAL_HIT_STUN_CHANCE", chance: 0.05, stunDurationSec: 0.5 }],
      },
    });
    expect(getRingDefById("RING_PHYSICAL_HEAVY_CHAMBER")).toMatchObject({
      name: "Heavy Chamber",
      description: "Every 4 seconds, empower your next shot to deal 50% increased physical damage.",
      tier: "t2",
      familyId: "physical",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "TIMED_NEXT_SHOT_EMPOWER", chargeEvery: 4, physicalDamageIncreased: 0.5 }],
      },
    });
    expect(getRingDefById("RING_GENERIC_KILL_MOMENTUM")).toMatchObject({
      name: "Kill Momentum",
      description: "Killing an enemy empowers your next shot to deal 20% increased damage.",
      tier: "t2",
      familyId: "generic",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "KILL_EMPOWER_NEXT_SHOT", damageIncreased: 0.2 }],
      },
    });
    expect(getRingDefById("RING_CRIT_CRITICAL_SPRINT")).toMatchObject({
      name: "Critical Sprint",
      description: "Critically striking grants 20% movement speed for 1 second.",
      tier: "t0",
      familyId: "crit",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "CRIT_MOVE_SPEED_BUFF", moveSpeedIncreased: 0.2, durationSec: 1 }],
      },
    });
  });

  test("includes phase 5-6 rings: Mirror Band, Amplifying Band, Living Bomb", () => {
    expect(getRingDefById("RING_UTILITY_MIRROR_BAND")).toMatchObject({
      name: "Mirror Band",
      description: "Mirrors the effect of the ring to the left of this ring.",
      tier: "t0",
      familyId: "utility",
      mainEffect: { kind: "MIRROR_LEFT_RING" },
    });
    expect(getRingDefById("RING_UTILITY_AMPLIFYING_BAND")).toMatchObject({
      name: "Amplifying Band",
      description: "Increases the effect of surrounding rings by 50%.",
      tier: "t0",
      familyId: "utility",
      mainEffect: { kind: "AMPLIFY_NEIGHBORS", increasedEffectBonus: 0.5 },
    });
    expect(getRingDefById("RING_IGNITE_LIVING_BOMB")).toMatchObject({
      name: "Living Bomb",
      tier: "t0",
      familyId: "ignite",
      mainEffect: {
        kind: "COMBAT_RULES",
        rules: [{ kind: "LIVING_BOMB", markEvery: 20, speedIncreased: 0.5, explosionDamageScalar: 3.0, explosionRadius: 150 }],
      },
    });
  });

  test("rejects missing descriptions and bad tiers", () => {
    const issues = validateRingContent(
      [
        ...RING_DEFS_V1,
        {
          ...RING_DEFS_V1[0],
          id: "RING_BAD",
          description: "",
          tier: "t9" as RingTier,
        },
      ],
    );

    expect(issues.some((issue) => issue.message.includes("Ring description"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Ring tier must be one of"))).toBe(true);
  });

  test("rejects invalid triggered and combat-rule effect defs", () => {
    const issues = validateRingContent(
      [
        ...RING_DEFS_V1,
        {
          ...RING_DEFS_V1[0],
          id: "RING_INVALID_TRIGGER",
          mainEffect: {
            kind: "TRIGGERED",
            triggerKey: "ON_NOT_REAL",
            procChance: 2,
            action: { kind: "NOT_REAL" },
          },
        },
        {
          ...RING_DEFS_V1[0],
          id: "RING_INVALID_RULE",
          mainEffect: {
            kind: "COMBAT_RULES",
            rules: [
              { kind: "POISON_EXTRA_STACK_CHANCE", chance: 2 },
              { kind: "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY", increasedPerEnemy: -1 },
            ],
          },
        },
        {
          ...RING_DEFS_V1[0],
          id: "RING_INVALID_CHAIN_HIT",
          mainEffect: {
            kind: "TRIGGERED",
            triggerKey: "ON_HIT",
            action: {
              kind: "CHAIN_HIT",
              maxTargets: 0,
              jumpRangePx: -1,
              damageScalar: -1,
              damageType: "MATCH_HIT",
            },
          },
        },
      ] as any,
    );

    expect(issues.some((issue) => issue.message.includes("Unknown trigger key"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("procChance"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Unsupported triggered action"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("chance must be"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("increasedPerEnemy"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Chain maxTargets"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Chain jumpRangePx"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Chain damageScalar"))).toBe(true);
  });

  test("rejects invalid dynamic stat and floor lifecycle effect defs", () => {
    const issues = validateRingContent(
      [
        ...RING_DEFS_V1,
        {
          ...RING_DEFS_V1[0],
          id: "RING_INVALID_DYNAMIC_STAT",
          mainEffect: {
            kind: "DYNAMIC_STAT_MODIFIERS",
            mods: [
              { kind: "GLOBAL_HIT_DAMAGE_INCREASED_FROM_MAX_LIFE", increasedPerMaxLife: Number.NaN },
              {
                kind: "GLOBAL_HIT_DAMAGE_INCREASED_PER_MISSING_LIFE",
                missingLifeStep: 0,
                increasedPerStep: -1,
              },
              { kind: "NOT_REAL" },
            ],
          },
        },
        {
          ...RING_DEFS_V1[0],
          id: "RING_INVALID_FLOOR_LIFECYCLE",
          mainEffect: {
            kind: "FLOOR_LIFECYCLE",
            trigger: "NOT_REAL",
            action: { kind: "HEAL_PLAYER", amount: -1 },
          },
        },
      ] as any,
    );

    expect(issues.some((issue) => issue.message.includes("increasedPerMaxLife"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("missingLifeStep"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("increasedPerStep"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Unsupported dynamic stat modifier"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Unknown floor lifecycle trigger"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("HEAL_PLAYER amount"))).toBe(true);
  });

  test("rejects invalid reward rule effect defs", () => {
    const issues = validateRingContent(
      [
        ...RING_DEFS_V1,
        {
          ...RING_DEFS_V1[0],
          id: "RING_INVALID_REWARD_RULES",
          mainEffect: {
            kind: "REWARD_RULES",
            rules: [
              { kind: "RING_REWARD_OPTION_COUNT_ADD", add: -1 },
              { kind: "RING_REWARD_EQUIPPED_FAMILY_WEIGHT_MULTIPLIER", multiplier: 0 },
              { kind: "RING_REWARD_REROLL_ADD", count: Number.NaN },
              { kind: "NOT_REAL" },
            ],
          },
        },
      ] as any,
    );

    expect(issues.some((issue) => issue.message.includes("add must be"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("multiplier must be"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("count must be"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Unsupported reward rule"))).toBe(true);
  });

  test("rejects invalid weapon fire rule effect defs", () => {
    const issues = validateRingContent(
      [
        ...RING_DEFS_V1,
        {
          ...RING_DEFS_V1[0],
          id: "RING_INVALID_WEAPON_FIRE_RULES",
          mainEffect: {
            kind: "WEAPON_FIRE_RULES",
            rules: [{ kind: "NOT_REAL" }],
          },
        },
      ] as any,
    );

    expect(issues.some((issue) => issue.message.includes("Unsupported weapon fire rule"))).toBe(true);
  });
});
