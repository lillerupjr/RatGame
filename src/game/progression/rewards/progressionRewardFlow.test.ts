import { describe, expect, test } from "vitest";
import {
  beginProgressionReward,
  chooseProgressionReward,
  ensureProgressionRewardState,
} from "./progressionRewardFlow";

function stubWorld(seed = 1): any {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  return {
    rng: { next },
    basePlayerHpMax: 100,
    playerHpMax: 100,
    playerHp: 100,
    baseMoveSpeed: 100,
    basePickupRadius: 32,
    pSpeed: 100,
    pickupRadius: 32,
    maxArmor: 50,
    currentArmor: 0,
    momentumMax: 20,
    momentumValue: 0,
    dmgMult: 1,
    fireRateMult: 1,
    areaMult: 1,
    durationMult: 1,
    critChanceBonus: 0,
    items: [],
  };
}

describe("progressionRewardFlow", () => {
  test("ring floor offers three ring options and equips the chosen ring", () => {
    const world = stubWorld();
    beginProgressionReward(world, "RING", "FLOOR_COMPLETION", 3);

    const state = ensureProgressionRewardState(world);
    expect(state.active).toBe(true);
    expect(state.options).toHaveLength(3);

    chooseProgressionReward(world, state.options[0]);
    expect(state.active).toBe(false);
    expect(Object.keys(world.progression.ringsByInstanceId)).toHaveLength(1);
  });

  test("modifier floor stores a V1 ring token instead of applying an instant effect", () => {
    const world = stubWorld();
    beginProgressionReward(world, "RING_MODIFIER_TOKEN", "FLOOR_COMPLETION", 3);

    const state = ensureProgressionRewardState(world);
    expect(state.options).toHaveLength(3);
    chooseProgressionReward(world, "INCREASED_EFFECT_20");

    expect(world.progression.storedModifierTokens.INCREASED_EFFECT_20).toBe(1);
    expect(Object.keys(world.progression.ringsByInstanceId)).toHaveLength(0);
  });

  test("hand floor applies structural effects immediately", () => {
    const world = stubWorld();
    beginProgressionReward(world, "HAND_EFFECT", "FLOOR_COMPLETION", 3);

    chooseProgressionReward(world, "HAND:ADD_FINGER:LEFT");
    expect(world.progression.hands.LEFT.slots).toHaveLength(5);
  });
});
