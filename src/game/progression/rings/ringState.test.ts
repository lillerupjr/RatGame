import { describe, expect, test } from "vitest";
import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import { collectWorldRingStatMods } from "./ringEffects";
import {
  applyHandEffect,
  applyModifierTokenToRing,
  canApplyHandEffect,
  canEquipRing,
  createInitialRingProgressionState,
  ensureRingProgressionState,
  equipRing,
  grantModifierToken,
  resolveRingEquipTargetSlotId,
  unequipRing,
} from "./ringState";

function stubWorld(): any {
  return {
    progression: createInitialRingProgressionState(),
  };
}

describe("ring progression state", () => {
  test("starts with eight baseline finger slots and no inventory", () => {
    const world = stubWorld();
    const left = world.progression.hands.LEFT.slots;
    const right = world.progression.hands.RIGHT.slots;

    expect(left).toHaveLength(4);
    expect(right).toHaveLength(4);
    expect(Object.keys(world.progression.ringsByInstanceId)).toEqual([]);
  });

  test("equips a ring into a finger slot and exposes its main effect", () => {
    const world = stubWorld();
    const instance = equipRing(world, "RING_PROJECTILE_ADDITIONAL_PROJECTILES_1", "LEFT:0");

    expect(world.progression.hands.LEFT.slots[0].ringInstanceId).toBe(instance.instanceId);

    const mods = collectWorldRingStatMods(world);
    expect(mods).toContainEqual({ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1 });
  });

  test("resolveRingEquipTargetSlotId falls back to the first slot once hands are full", () => {
    const world = stubWorld();
    const slots = [
      "LEFT:0",
      "LEFT:1",
      "LEFT:2",
      "LEFT:3",
      "RIGHT:0",
      "RIGHT:1",
      "RIGHT:2",
      "RIGHT:3",
    ] as const;

    for (const slotId of slots) {
      equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", slotId);
    }

    const targetSlotId = resolveRingEquipTargetSlotId(world.progression);
    expect(targetSlotId).toBe("LEFT:0");
    expect(canEquipRing(world, "RING_GENERIC_MOVE_SPEED_20")).toEqual({
      ok: true,
      value: {
        state: world.progression,
        slotId: "LEFT:0",
      },
    });
  });

  test("20% increased effect token scales the ring main modifier", () => {
    const world = stubWorld();
    const instance = equipRing(world, "RING_PROJECTILE_GAIN_PIERCE_1", "LEFT:0");
    grantModifierToken(world, "INCREASED_EFFECT_20");
    applyModifierTokenToRing(world, "INCREASED_EFFECT_20", instance.instanceId);

    const mod = collectWorldRingStatMods(world).find((candidate) => candidate.key === STAT_KEYS.PIERCE_ADD);
    expect(mod?.value).toBeCloseTo(1.2);
  });

  test("level-up token stores passive points even when family trees are empty", () => {
    const world = stubWorld();
    const instance = equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", "LEFT:0");
    grantModifierToken(world, "LEVEL_UP");
    applyModifierTokenToRing(world, "LEVEL_UP", instance.instanceId);

    expect(world.progression.ringsByInstanceId[instance.instanceId].allocatedPassivePoints).toBe(1);
  });

  test("finger empowerment scales the equipped ring main effect", () => {
    const world = stubWorld();
    equipRing(world, "RING_POISON_CHANCE_PERCENT_25", "RIGHT:0");
    applyHandEffect(world, "EMPOWER_FINGER", { slotId: "RIGHT:0" });

    const mod = collectWorldRingStatMods(world).find((candidate) => candidate.key === STAT_KEYS.CHANCE_TO_POISON_ADD);
    expect(mod?.value).toBeCloseTo(0.3);
  });

  test("invalid hand targets are rejected without mutating state", () => {
    const world = stubWorld();
    const before = world.progression.hands.RIGHT.slots.length;

    expect(canApplyHandEffect(world, "ADD_FINGER", {})).toEqual({
      ok: false,
      reason: "ADD_FINGER requires a valid handId",
    });
    expect(canApplyHandEffect(world, "EMPOWER_FINGER", { slotId: "RIGHT:99" })).toEqual({
      ok: false,
      reason: "Unknown finger slot: RIGHT:99",
    });
    expect(world.progression.hands.RIGHT.slots).toHaveLength(before);
  });

  test("unequipRing removes the ring from its slot and deletes the instance", () => {
    const world = stubWorld();
    const instance = equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", "LEFT:1");

    expect(world.progression.hands.LEFT.slots[1].ringInstanceId).toBe(instance.instanceId);
    expect(world.progression.ringsByInstanceId[instance.instanceId]).toBeDefined();

    unequipRing(world, "LEFT:1");

    expect(world.progression.hands.LEFT.slots[1].ringInstanceId).toBeNull();
    expect(world.progression.ringsByInstanceId[instance.instanceId]).toBeUndefined();
    expect(collectWorldRingStatMods(world)).toEqual([]);
  });

  test("unequipRing on an empty slot is a no-op", () => {
    const world = stubWorld();
    unequipRing(world, "LEFT:0");
    expect(world.progression.hands.LEFT.slots[0].ringInstanceId).toBeNull();
  });

  test("normalization rebuilds malformed state and removes orphaned progression data", () => {
    const world: any = {
      progression: {
        hands: {
          LEFT: { slots: [{ ringInstanceId: "ghost", empowermentScalar: 0.4 }] },
        },
        ringsByInstanceId: {
          "ring-instance-7": {
            instanceId: "ring-instance-7",
            defId: "RING_GENERIC_DAMAGE_PERCENT_20",
            slotId: "LEFT:0",
            allocatedPassivePoints: 0,
            increasedEffectScalar: 0.2,
            unlockedTalentNodeIds: ["fake-node"],
          },
          "ring-instance-8": {
            instanceId: "ring-instance-8",
            defId: "UNKNOWN_RING",
            slotId: "LEFT:1",
            allocatedPassivePoints: 99,
            increasedEffectScalar: 9,
            unlockedTalentNodeIds: ["fake-node"],
          },
        },
        storedModifierTokens: {
          LEVEL_UP: -3,
          INCREASED_EFFECT_20: 2.9,
        },
        nextRingInstanceSeq: 0,
      },
    };

    const state = ensureRingProgressionState(world);

    expect(state.hands.LEFT.slots).toHaveLength(4);
    expect(state.hands.RIGHT.slots).toHaveLength(4);
    expect(Object.keys(state.ringsByInstanceId)).toEqual(["ring-instance-7"]);
    expect(state.hands.LEFT.slots[0].ringInstanceId).toBe("ring-instance-7");
    expect(state.storedModifierTokens).toEqual({
      LEVEL_UP: 0,
      INCREASED_EFFECT_20: 2,
    });
    expect(state.ringsByInstanceId["ring-instance-7"].unlockedTalentNodeIds).toEqual([]);
    expect(state.ringsByInstanceId["ring-instance-7"].allocatedPassivePoints).toBe(0);
    expect(state.nextRingInstanceSeq).toBe(8);
  });
});
