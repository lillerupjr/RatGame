import { describe, expect, test } from "vitest";
import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import { collectRingRuntimeEffects } from "./ringEffects";
import { equipRing, createInitialRingProgressionState } from "./ringState";

function stubWorld(): any {
  return {
    progression: createInitialRingProgressionState(),
    playerHpMax: 100,
    playerHp: 70,
  };
}

describe("neighbor-ring resolution", () => {
  test("Mirror Band copies stat modifiers from left neighbor", () => {
    const world = stubWorld();
    equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", "LEFT:0");
    equipRing(world, "RING_UTILITY_MIRROR_BAND", "LEFT:1");

    const effects = collectRingRuntimeEffects(world.progression);
    const mainEffects = effects.filter((e) => e.source.kind === "RING_MAIN");

    expect(mainEffects).toHaveLength(2);
    // The mirror should have copied the stat modifier effect
    const mirrorEffect = mainEffects.find((e) => e.source.slotId === "LEFT:1");
    expect(mirrorEffect).toBeDefined();
    expect(mirrorEffect!.effect).toMatchObject({
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, op: "more", value: 0.2 }],
    });
  });

  test("Mirror Band produces no effect when leftmost slot", () => {
    const world = stubWorld();
    equipRing(world, "RING_UTILITY_MIRROR_BAND", "LEFT:0");

    const effects = collectRingRuntimeEffects(world.progression);
    const mainEffects = effects.filter((e) => e.source.kind === "RING_MAIN");

    expect(mainEffects).toHaveLength(0);
  });

  test("Mirror Band does not copy another Mirror Band", () => {
    const world = stubWorld();
    equipRing(world, "RING_UTILITY_MIRROR_BAND", "LEFT:0");
    equipRing(world, "RING_UTILITY_MIRROR_BAND", "LEFT:1");

    const effects = collectRingRuntimeEffects(world.progression);
    const mainEffects = effects.filter((e) => e.source.kind === "RING_MAIN");

    // First mirror has no left neighbor → removed. Second mirror's left is a mirror → removed.
    expect(mainEffects).toHaveLength(0);
  });

  test("Mirror Band does not copy Amplifying Band", () => {
    const world = stubWorld();
    equipRing(world, "RING_UTILITY_AMPLIFYING_BAND", "LEFT:0");
    equipRing(world, "RING_UTILITY_MIRROR_BAND", "LEFT:1");

    const effects = collectRingRuntimeEffects(world.progression);
    const mainEffects = effects.filter((e) => e.source.kind === "RING_MAIN");

    // Amplifying Band is structural → removed. Mirror can't copy it → removed.
    expect(mainEffects).toHaveLength(0);
  });

  test("Amplifying Band boosts left and right neighbors by 50%", () => {
    const world = stubWorld();
    equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", "LEFT:0");
    equipRing(world, "RING_UTILITY_AMPLIFYING_BAND", "LEFT:1");
    equipRing(world, "RING_GENERIC_MOVE_SPEED_20", "LEFT:2");

    const effects = collectRingRuntimeEffects(world.progression);
    const mainEffects = effects.filter((e) => e.source.kind === "RING_MAIN");

    // The amplify effect itself is removed, leaving the two stat rings
    expect(mainEffects).toHaveLength(2);

    const leftEffect = mainEffects.find((e) => e.source.slotId === "LEFT:0");
    expect(leftEffect?.increasedEffectScalar).toBeCloseTo(0.5);

    const rightEffect = mainEffects.find((e) => e.source.slotId === "LEFT:2");
    expect(rightEffect?.increasedEffectScalar).toBeCloseTo(0.5);
  });

  test("Amplifying Band does not boost Mirror or Amplify neighbors", () => {
    const world = stubWorld();
    equipRing(world, "RING_UTILITY_MIRROR_BAND", "LEFT:0");
    equipRing(world, "RING_UTILITY_AMPLIFYING_BAND", "LEFT:1");
    equipRing(world, "RING_UTILITY_AMPLIFYING_BAND", "LEFT:2");

    const effects = collectRingRuntimeEffects(world.progression);
    const mainEffects = effects.filter((e) => e.source.kind === "RING_MAIN");

    // All structural → all removed
    expect(mainEffects).toHaveLength(0);
  });

  test("Amplifying Band + Mirror Band: mirror copies amplified effect", () => {
    const world = stubWorld();
    equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", "LEFT:0");
    equipRing(world, "RING_UTILITY_AMPLIFYING_BAND", "LEFT:1");
    equipRing(world, "RING_UTILITY_MIRROR_BAND", "LEFT:2");

    const effects = collectRingRuntimeEffects(world.progression);
    const mainEffects = effects.filter((e) => e.source.kind === "RING_MAIN");

    // LEFT:0 → damage ring (amplified by +0.5)
    // LEFT:1 → amplify (removed)
    // LEFT:2 → mirror: left neighbor is amplify (structural) → no copy → removed
    // So only the damage ring remains
    expect(mainEffects).toHaveLength(1);
    expect(mainEffects[0].source.slotId).toBe("LEFT:0");
    expect(mainEffects[0].increasedEffectScalar).toBeCloseTo(0.5);
  });

  test("Multiple Amplifying Bands stack additively on shared neighbor", () => {
    const world = stubWorld();
    equipRing(world, "RING_UTILITY_AMPLIFYING_BAND", "LEFT:0");
    equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", "LEFT:1");
    equipRing(world, "RING_UTILITY_AMPLIFYING_BAND", "LEFT:2");

    const effects = collectRingRuntimeEffects(world.progression);
    const mainEffects = effects.filter((e) => e.source.kind === "RING_MAIN");

    // The damage ring in LEFT:1 should be boosted by both amplifiers: +0.5 + 0.5 = +1.0
    expect(mainEffects).toHaveLength(1);
    expect(mainEffects[0].source.slotId).toBe("LEFT:1");
    expect(mainEffects[0].increasedEffectScalar).toBeCloseTo(1.0);
  });
});
