import { describe, expect, test } from "vitest";
import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import { createInitialRingProgressionState, equipRing } from "../rings/ringState";
import { collectWorldStatMods } from "./worldEffects";

function stubWorld(overrides: Partial<Record<string, unknown>> = {}): any {
  return {
    progression: createInitialRingProgressionState(),
    playerHpMax: 100,
    playerHp: 100,
    ...overrides,
  };
}

function globalDamageIncreasedValues(world: any): number[] {
  return collectWorldStatMods(world)
    .filter((mod) => mod.key === STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED && mod.op === "increased")
    .map((mod) => mod.value);
}

function expectSingleGlobalDamageIncreased(world: any, expected: number): void {
  const values = globalDamageIncreasedValues(world);
  expect(values).toHaveLength(1);
  expect(values[0]).toBeCloseTo(expected);
}

describe("world progression effects", () => {
  test("generates Vital Force damage from maximum life", () => {
    const world = stubWorld({ playerHpMax: 100 });
    equipRing(world, "RING_HEALTH_VITAL_FORCE", "LEFT:0");

    expectSingleGlobalDamageIncreased(world, 0.2);
  });

  test("generates Wounded Fury damage from full missing-life steps", () => {
    const world = stubWorld({ playerHpMax: 100, playerHp: 65 });
    equipRing(world, "RING_HEALTH_WOUNDED_FURY", "LEFT:0");

    expectSingleGlobalDamageIncreased(world, 0.15);
  });

  test("scales dynamic stat modifiers with neighbor amplification", () => {
    const world = stubWorld({ playerHpMax: 100 });
    equipRing(world, "RING_HEALTH_VITAL_FORCE", "LEFT:0");
    equipRing(world, "RING_UTILITY_AMPLIFYING_BAND", "LEFT:1");

    expectSingleGlobalDamageIncreased(world, 0.3);
  });
});
