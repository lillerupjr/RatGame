import { describe, expect, test } from "vitest";
import { RING_FAMILY_IDS } from "./ringTypes";
import {
  RING_DEFS_V1,
  RING_FAMILY_TALENT_TREES_V1,
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
  "RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30",
  "RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30",
  "RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50",
  "RING_GENERIC_MOVE_SPEED_20",
  "RING_PHYSICAL_DAMAGE_PERCENT_20",
  "RING_PROJECTILE_ADDITIONAL_PROJECTILES_1",
  "RING_PROJECTILE_GAIN_PIERCE_1",
  "RING_DOT_DAMAGE_OVER_TIME_MORE_50",
  "RING_DOT_SPECIALIST",
  "RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS",
  "RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS",
  "RING_POISON_CHANCE_PERCENT_25",
  "RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25",
  "RING_IGNITE_SPREAD_ON_DEATH",
  "RING_IGNITE_CRITS_APPLY_IGNITE",
  "RING_CRIT_ROLLS_TWICE",
  "RING_TRIGGER_BAZOOKA_ON_HIT",
  "RING_TRIGGER_SPARK_ON_HIT",
  "RING_TRIGGER_EXPLODE_ON_KILL",
  "RING_TRIGGER_DAGGER_ON_KILL",
  "RING_TRIGGER_DOUBLE_TRIGGERS",
  "RING_TRIGGER_PROC_CHANCE_PERCENT_50",
  "RING_TRIGGER_RETRY_FAILED_PROCS_ONCE",
] as const;

describe("ring content validation", () => {
  test("accepts the locked V1 ring catalog and exact ring id set", () => {
    expect(validateRingContent(RING_DEFS_V1, RING_FAMILY_TALENT_TREES_V1)).toEqual([]);
    expect(RING_DEFS_V1.map((def) => def.id)).toEqual(EXPECTED_RING_IDS);
  });

  test("ships empty family trees for every V1 family", () => {
    expect(RING_FAMILY_TALENT_TREES_V1.map((tree) => tree.familyId)).toEqual([...RING_FAMILY_IDS]);
    expect(RING_FAMILY_TALENT_TREES_V1.every((tree) => tree.nodes.length === 0)).toBe(true);
  });

  test("keeps recovered starter names and descriptions from git history", () => {
    expect(getRingDefById("RING_STARTER_STREET_REFLEX")).toMatchObject({
      name: "Street Reflex",
      description: "On hit, 20% chance to throw an additional knife at a nearby enemy.",
      tier: 1,
    });
    expect(getRingDefById("RING_STARTER_LUCKY_CHAMBER")).toMatchObject({
      name: "Lucky Chamber",
      description: "Every 5th shot is guaranteed to crit.",
      tier: 1,
    });
    expect(getRingDefById("RING_STARTER_CONTAMINATED_ROUNDS")).toMatchObject({
      name: "Contaminated Rounds",
      description: "Projectiles pierce poisoned enemies. Poisoned enemies take +20% damage from piercing hits.",
      tier: 1,
    });
    expect(getRingDefById("RING_STARTER_POINT_BLANK_CARNAGE")).toMatchObject({
      name: "Point Blank Carnage",
      description: "Deal up to +50% damage based on proximity. Very close hits knock enemies back.",
      tier: 1,
    });
    expect(getRingDefById("RING_STARTER_THERMAL_STARTER")).toMatchObject({
      name: "Thermal Starter",
      description: "Deal +15% damage to burning enemies.",
      tier: 1,
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

  test("rejects missing descriptions, bad tiers, missing family trees, and authored nodes", () => {
    const issues = validateRingContent(
      [
        ...RING_DEFS_V1,
        {
          ...RING_DEFS_V1[0],
          id: "RING_BAD",
          description: "",
          tier: 2 as 1,
        },
      ],
      RING_FAMILY_TALENT_TREES_V1.filter((tree) => tree.familyId !== "utility").map((tree) =>
        tree.familyId !== "starter"
          ? tree
          : {
              ...tree,
              nodes: [
                {
                  id: "starter-bad-node",
                  name: "Bad",
                  description: "Bad",
                  requiresNodeIds: [],
                  cost: 1,
                  effect: { kind: "STAT_MODIFIERS", mods: [] },
                },
              ],
            },
      ) as any,
    );

    expect(issues.some((issue) => issue.message.includes("Ring description"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("tier 1"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Missing family talent tree"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("must not author talent nodes"))).toBe(true);
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
            rules: [{ kind: "POISON_EXTRA_STACK_CHANCE", chance: 2 }],
          },
        },
      ] as any,
      RING_FAMILY_TALENT_TREES_V1,
    );

    expect(issues.some((issue) => issue.message.includes("Unknown trigger key"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("procChance"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Unsupported triggered action"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("chance must be"))).toBe(true);
  });
});
