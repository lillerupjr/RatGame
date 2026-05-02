import { describe, expect, test } from "vitest";
import { createInitialRingProgressionState, equipRing } from "../rings/ringState";
import {
  applyFloorLifecycleEffects,
  collectFloorLifecycleEffectsFromRuntimeEffects,
} from "./floorLifecycleEffects";
import { collectWorldRuntimeEffects } from "./worldEffects";

function stubWorld(overrides: Partial<Record<string, unknown>> = {}): any {
  return {
    progression: createInitialRingProgressionState(),
    playerHpMax: 100,
    playerHp: 50,
    ...overrides,
  };
}

describe("floor lifecycle effects", () => {
  test("collects floor-complete runtime effects", () => {
    const world = stubWorld();
    equipRing(world, "RING_HEALTH_FLOOR_RECOVERY", "LEFT:0");

    expect(
      collectFloorLifecycleEffectsFromRuntimeEffects(collectWorldRuntimeEffects(world), "FLOOR_COMPLETE"),
    ).toMatchObject([
      {
        effect: {
          kind: "FLOOR_LIFECYCLE",
          trigger: "FLOOR_COMPLETE",
          action: { kind: "HEAL_PLAYER", amount: 10 },
        },
      },
    ]);
  });

  test("heals after floor completion", () => {
    const world = stubWorld();
    equipRing(world, "RING_HEALTH_FLOOR_RECOVERY", "LEFT:0");

    applyFloorLifecycleEffects(world, "FLOOR_COMPLETE");

    expect(world.playerHp).toBe(60);
  });

  test("clamps floor recovery at maximum life", () => {
    const world = stubWorld({ playerHp: 95 });
    equipRing(world, "RING_HEALTH_FLOOR_RECOVERY", "LEFT:0");

    applyFloorLifecycleEffects(world, "FLOOR_COMPLETE");

    expect(world.playerHp).toBe(100);
  });

  test("scales floor recovery with increased ring effect", () => {
    const world = stubWorld();
    const instance = equipRing(world, "RING_HEALTH_FLOOR_RECOVERY", "LEFT:0");
    instance.increasedEffectScalar = 0.5;

    applyFloorLifecycleEffects(world, "FLOOR_COMPLETE");

    expect(world.playerHp).toBe(65);
  });
});
