import { describe, expect, test } from "vitest";
import {
  beginProgressionReward,
  chooseProgressionReward,
  ensureProgressionRewardState,
  rerollProgressionReward,
} from "./progressionRewardFlow";
import { equipRing } from "../rings/ringState";

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

function sequenceWorld(values: number[]): any {
  const world = stubWorld();
  const remaining = [...values];
  world.rng = {
    next: () => remaining.shift() ?? 0,
  };
  return world;
}

describe("progressionRewardFlow", () => {
  test("ring floor offers three ring options and equips the chosen ring", () => {
    const world = stubWorld();
    beginProgressionReward(world, "RING", "FLOOR_COMPLETION", 3);

    const state = ensureProgressionRewardState(world);
    expect(state.active).toBe(true);
    expect(state.options).toHaveLength(3);

    chooseProgressionReward(world, state.options[0].id);
    expect(state.active).toBe(false);
    expect(Object.keys(world.progression.ringsByInstanceId)).toHaveLength(1);
  });

  test("modifier floor stores a V1 ring token instead of applying an instant effect", () => {
    const world = stubWorld();
    beginProgressionReward(world, "RING_MODIFIER_TOKEN", "FLOOR_COMPLETION", 3);

    const state = ensureProgressionRewardState(world);
    expect(state.options).toHaveLength(3);
    const increasedEffectOption = state.options.find(
      (option) => option.family === "RING_MODIFIER_TOKEN" && option.tokenType === "INCREASED_EFFECT_20",
    );
    expect(increasedEffectOption).toBeTruthy();
    chooseProgressionReward(world, increasedEffectOption!.id);

    expect(world.progression.storedModifierTokens.INCREASED_EFFECT_20).toBe(1);
    expect(Object.keys(world.progression.ringsByInstanceId)).toHaveLength(0);
  });

  test("hand floor applies structural effects immediately", () => {
    const world = stubWorld();
    beginProgressionReward(world, "HAND_EFFECT", "FLOOR_COMPLETION", 3);

    const state = ensureProgressionRewardState(world);
    const addFingerOption = state.options.find(
      (option) => option.family === "HAND_EFFECT" && option.effectType === "ADD_FINGER" && option.handId === "LEFT",
    );
    expect(addFingerOption).toBeTruthy();
    chooseProgressionReward(world, addFingerOption!.id);
    expect(world.progression.hands.LEFT.slots).toHaveLength(5);
  });

  test("Selective Hand gives one floor-completion ring reward reroll", () => {
    const world = sequenceWorld([
      0, 0,
      0.010001, 0,
      0.060001, 0,
      0.310001, 0,
      0.310001, 0,
      0.310001, 0,
    ]);
    equipRing(world, "RING_UTILITY_SELECTIVE_HAND", "LEFT:0");

    beginProgressionReward(world, "RING", "FLOOR_COMPLETION", 3);
    const state = ensureProgressionRewardState(world);
    const beforeIds = state.options.map((option) => option.id);
    const beforeSeq = state.renderSeq;

    expect(state.rerollsRemaining).toBe(1);
    expect(rerollProgressionReward(world)).toBe(true);
    expect(state.rerollsRemaining).toBe(0);
    expect(state.renderSeq).toBeGreaterThan(beforeSeq);
    expect(state.options.map((option) => option.id)).not.toEqual(beforeIds);
    expect(rerollProgressionReward(world)).toBe(false);
  });

  test("Selective Hand does not add rerolls to non-ring or non-floor rewards", () => {
    const tokenWorld = stubWorld();
    equipRing(tokenWorld, "RING_UTILITY_SELECTIVE_HAND", "LEFT:0");
    beginProgressionReward(tokenWorld, "RING_MODIFIER_TOKEN", "FLOOR_COMPLETION", 3);
    expect(ensureProgressionRewardState(tokenWorld).rerollsRemaining).toBe(0);
    expect(rerollProgressionReward(tokenWorld)).toBe(false);

    const handWorld = stubWorld();
    equipRing(handWorld, "RING_UTILITY_SELECTIVE_HAND", "LEFT:0");
    beginProgressionReward(handWorld, "HAND_EFFECT", "FLOOR_COMPLETION", 3);
    expect(ensureProgressionRewardState(handWorld).rerollsRemaining).toBe(0);
    expect(rerollProgressionReward(handWorld)).toBe(false);

    const sideObjectiveWorld = stubWorld();
    equipRing(sideObjectiveWorld, "RING_UTILITY_SELECTIVE_HAND", "LEFT:0");
    beginProgressionReward(sideObjectiveWorld, "RING", "SIDE_OBJECTIVE", 3);
    expect(ensureProgressionRewardState(sideObjectiveWorld).rerollsRemaining).toBe(0);
    expect(rerollProgressionReward(sideObjectiveWorld)).toBe(false);
  });
});
