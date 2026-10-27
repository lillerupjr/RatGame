import { describe, expect, test } from "vitest";
import { getRingDefById } from "../rings/ringContent";
import { createInitialRingProgressionState, equipRing } from "../rings/ringState";
import {
  generateProgressionOffers,
  generateProgressionRewardOffers,
  progressionRewardOptionView,
  type ProgressionRewardOption,
  type RingRewardOption,
} from "./progressionOffers";

function stubWorld(seed = 1): any {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  return {
    rng: { next },
    progression: createInitialRingProgressionState(),
  };
}

function sequenceWorld(values: number[]): any {
  const remaining = [...values];
  return {
    rng: {
      next: () => remaining.shift() ?? 0,
    },
    progression: createInitialRingProgressionState(),
  };
}

function ringOptions(options: ProgressionRewardOption[]): RingRewardOption[] {
  return options.filter((option): option is RingRewardOption => option.family === "RING");
}

describe("progression offer generation", () => {
  test("generates typed ring and token offers", () => {
    const world = stubWorld();

    const rings = ringOptions(generateProgressionOffers(world, "RING", "FLOOR_COMPLETION", 3));
    expect(rings).toHaveLength(3);
    expect(rings.every((option) => typeof option.ringDefId === "string")).toBe(true);
    expect(rings.every((option) => typeof option.authoredTier === "string" && typeof option.rolledTier === "string")).toBe(true);

    const tokenOptions = generateProgressionOffers(world, "RING_MODIFIER_TOKEN", "LEVEL_UP", 3);
    expect(tokenOptions).toHaveLength(3);
    expect(tokenOptions.filter((option) => option.family === "RING_MODIFIER_TOKEN")).toHaveLength(3);
  });

  test("ring offers exclude starter rings and do not duplicate ring ids", () => {
    const world = stubWorld(7);

    const rings = ringOptions(generateProgressionOffers(world, "RING", "FLOOR_COMPLETION", 20));
    const ringDefIds = rings.map((option) => option.ringDefId);

    expect(rings).toHaveLength(20);
    expect(new Set(ringDefIds).size).toBe(ringDefIds.length);
    expect(rings.every((option) => getRingDefById(option.ringDefId)?.familyId !== "starter")).toBe(true);
  });

  test("base generator ignores reward manipulation while reward-flow generation applies option count", () => {
    const world = stubWorld(11);
    equipRing(world, "RING_UTILITY_WIDER_SELECTION", "LEFT:0");

    const baseRings = ringOptions(generateProgressionOffers(world, "RING", "FLOOR_COMPLETION", 3));
    const rewardRings = ringOptions(generateProgressionRewardOffers(world, "RING", "FLOOR_COMPLETION", 3));
    const rewardRingDefIds = rewardRings.map((option) => option.ringDefId);

    expect(baseRings).toHaveLength(3);
    expect(rewardRings).toHaveLength(4);
    expect(new Set(rewardRingDefIds).size).toBe(rewardRingDefIds.length);
    expect(rewardRings.every((option) => getRingDefById(option.ringDefId)?.familyId !== "starter")).toBe(true);
  });

  test("reward-flow generation gently biases Curated Rewards toward equipped families", () => {
    const world = sequenceWorld([0.5, 0.29]);
    equipRing(world, "RING_UTILITY_CURATED_REWARDS", "LEFT:0");
    equipRing(world, "RING_PHYSICAL_DAMAGE_PERCENT_20", "LEFT:1");

    const [ring] = ringOptions(generateProgressionRewardOffers(world, "RING", "FLOOR_COMPLETION", 1));

    expect(ring).toMatchObject({
      rolledTier: "t3",
      ringDefId: "RING_PHYSICAL_DAMAGE_PERCENT_10",
    });
  });

  test("uses tier-roll boundaries for t0, t1, t2, and t3 ring rewards", () => {
    const world = sequenceWorld([
      0, 0,
      0.010001, 0,
      0.060001, 0,
      0.310001, 0,
    ]);

    const rings = ringOptions(generateProgressionOffers(world, "RING", "FLOOR_COMPLETION", 4));

    expect(rings.map((option) => option.rolledTier)).toEqual(["t0", "t1", "t2", "t3"]);
    expect(rings.map((option) => option.authoredTier)).toEqual(["t0", "t1", "t2", "t3"]);
    expect(rings.map((option) => option.ringDefId)).toEqual([
      "RING_PROJECTILE_SCATTER_SHOT",
      "RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50",
      "RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30",
      "RING_GENERIC_DAMAGE_PERCENT_20",
    ]);
  });

  test("falls back to the full remaining pool when a rolled tier is exhausted", () => {
    const world = sequenceWorld([
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
    ]);

    const rings = ringOptions(generateProgressionOffers(world, "RING", "FLOOR_COMPLETION", 11));

    expect(rings.map((option) => option.rolledTier)).toEqual(["t0", "t0", "t0", "t0", "t0", "t0", "t0", "t0", "t0", "t0", "t0"]);
    expect(rings.map((option) => option.authoredTier)).toEqual(["t0", "t0", "t0", "t0", "t0", "t0", "t0", "t0", "t0", "t0", "t3"]);
    expect(rings.map((option) => option.ringDefId)).toEqual([
      "RING_PROJECTILE_SCATTER_SHOT",
      "RING_PROJECTILE_BACKFIRE_SHOT",
      "RING_TRIGGER_BAZOOKA_ON_HIT",
      "RING_TRIGGER_LIGHTNING_CHAIN",
      "RING_TRIGGER_DOUBLE_TRIGGERS",
      "RING_POISON_PLAGUE_DETONATION",
      "RING_CRIT_CRITICAL_SPRINT",
      "RING_UTILITY_MIRROR_BAND",
      "RING_UTILITY_AMPLIFYING_BAND",
      "RING_IGNITE_LIVING_BOMB",
      "RING_GENERIC_DAMAGE_PERCENT_20",
    ]);
  });

  test("ring reward option views expose authored and rolled tier debug data", () => {
    const world = sequenceWorld([0, 0]);
    const [ring] = ringOptions(generateProgressionOffers(world, "RING", "FLOOR_COMPLETION", 1));

    expect(progressionRewardOptionView(ring)).toMatchObject({
      title: "Scatter Shot",
      subtitle: "t0 projectile ring",
      authoredTier: "t0",
      rolledTier: "t0",
    });
  });

  test("excludes already-equipped ring defs from offers", () => {
    const world = stubWorld(42);
    equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", "LEFT:0");
    equipRing(world, "RING_PHYSICAL_DAMAGE_PERCENT_20", "LEFT:1");

    const rings = ringOptions(generateProgressionOffers(world, "RING", "FLOOR_COMPLETION", 3));
    const ringDefIds = rings.map((option) => option.ringDefId);

    expect(rings).toHaveLength(3);
    expect(ringDefIds).not.toContain("RING_GENERIC_DAMAGE_PERCENT_20");
    expect(ringDefIds).not.toContain("RING_PHYSICAL_DAMAGE_PERCENT_20");
  });

  test("falls back to full pool when too few non-equipped candidates", () => {
    const world = stubWorld(99);
    // Populate ringsByInstanceId directly to simulate many equipped rings
    // without needing valid finger slots for each one
    const helperWorld = stubWorld(1);
    const allRings = ringOptions(generateProgressionOffers(helperWorld, "RING", "FLOOR_COMPLETION", 50));
    const state = world.progression;
    for (let i = 0; i < allRings.length - 1; i++) {
      state.ringsByInstanceId[`fake-${i}`] = {
        instanceId: `fake-${i}`,
        defId: allRings[i].ringDefId,
        slotId: "LEFT:0",
      };
    }

    const rings = ringOptions(generateProgressionOffers(world, "RING", "FLOOR_COMPLETION", 3));

    // Should still produce 3 options by falling back to the full pool
    expect(rings).toHaveLength(3);
  });

  test("hand offers always keep add-finger options visible before empower targets", () => {
    const world = stubWorld();
    equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", "LEFT:0");

    const handOptions = generateProgressionOffers(world, "HAND_EFFECT", "FLOOR_COMPLETION", 3);
    expect(handOptions[0]).toMatchObject({
      family: "HAND_EFFECT",
      effectType: "ADD_FINGER",
      handId: "LEFT",
    });
    expect(handOptions[1]).toMatchObject({
      family: "HAND_EFFECT",
      effectType: "ADD_FINGER",
      handId: "RIGHT",
    });
    expect(handOptions[2].family).toBe("HAND_EFFECT");
  });
});
