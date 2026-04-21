import { describe, expect, test } from "vitest";
import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import { collectWorldRingStatMods } from "./ringEffects";
import {
  applyHandEffect,
  applyModifierTokenToRing,
  createInitialRingProgressionState,
  equipRing,
  grantModifierToken,
  unlockRingTalentNode,
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
    const instance = equipRing(world, "RING_IRON_SIGNET", "LEFT:0");

    expect(world.progression.hands.LEFT.slots[0].ringInstanceId).toBe(instance.instanceId);

    const mods = collectWorldRingStatMods(world);
    expect(mods).toContainEqual({ key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 4 });
  });

  test("20% increased effect token scales the ring main modifier", () => {
    const world = stubWorld();
    const instance = equipRing(world, "RING_IRON_SIGNET", "LEFT:0");
    grantModifierToken(world, "INCREASED_EFFECT_20");
    applyModifierTokenToRing(world, "INCREASED_EFFECT_20", instance.instanceId);

    const mod = collectWorldRingStatMods(world).find((candidate) => candidate.key === STAT_KEYS.DAMAGE_ADD_PHYSICAL);
    expect(mod?.value).toBeCloseTo(4.8);
  });

  test("level-up token grants a passive point that can unlock a family node", () => {
    const world = stubWorld();
    const instance = equipRing(world, "RING_IRON_SIGNET", "LEFT:0");
    grantModifierToken(world, "LEVEL_UP");
    applyModifierTokenToRing(world, "LEVEL_UP", instance.instanceId);
    unlockRingTalentNode(world, instance.instanceId, "physical-force-1");

    const mods = collectWorldRingStatMods(world);
    expect(mods).toContainEqual({ key: STAT_KEYS.DAMAGE_INCREASED, op: "increased", value: 0.15 });
  });

  test("finger empowerment scales the equipped ring main effect", () => {
    const world = stubWorld();
    equipRing(world, "RING_OAKEN_BAND", "RIGHT:0");
    applyHandEffect(world, "EMPOWER_FINGER", { slotId: "RIGHT:0" });

    const mod = collectWorldRingStatMods(world).find((candidate) => candidate.key === STAT_KEYS.LIFE_ADD);
    expect(mod?.value).toBeCloseTo(30);
  });
});
