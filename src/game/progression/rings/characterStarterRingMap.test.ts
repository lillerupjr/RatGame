import { describe, expect, test } from "vitest";
import { createInitialRingProgressionState, equipRing } from "./ringState";
import {
  equipStarterRingForCharacter,
  resolveCharacterStarterRingDefId,
} from "./characterStarterRingMap";
import type { RingInstance } from "./ringTypes";

function stubWorld(): any {
  return {
    progression: createInitialRingProgressionState(),
  };
}

describe("character starter ring loadout", () => {
  test("resolves each playable character to the recovered starter ring", () => {
    expect(resolveCharacterStarterRingDefId("JAMAL")).toBe("RING_STARTER_STREET_REFLEX");
    expect(resolveCharacterStarterRingDefId("JACK")).toBe("RING_STARTER_LUCKY_CHAMBER");
    expect(resolveCharacterStarterRingDefId("HOBO")).toBe("RING_STARTER_CONTAMINATED_ROUNDS");
    expect(resolveCharacterStarterRingDefId("TOMMY")).toBe("RING_STARTER_POINT_BLANK_CARNAGE");
    expect(resolveCharacterStarterRingDefId("JOEY")).toBe("RING_STARTER_THERMAL_STARTER");
  });

  test("falls back to Jack's starter ring for missing or unknown characters", () => {
    expect(resolveCharacterStarterRingDefId()).toBe("RING_STARTER_LUCKY_CHAMBER");
    expect(resolveCharacterStarterRingDefId("UNKNOWN")).toBe("RING_STARTER_LUCKY_CHAMBER");
  });

  test("equips the starter ring onto the left-most finger", () => {
    const world = stubWorld();

    const instance = equipStarterRingForCharacter(world, "HOBO");

    expect(instance.defId).toBe("RING_STARTER_CONTAMINATED_ROUNDS");
    expect(instance.slotId).toBe("LEFT:0");
    expect(world.progression.hands.LEFT.slots[0].ringInstanceId).toBe(instance.instanceId);
  });

  test("reuses the same starter ring instance when re-applied and rehomes it to LEFT:0", () => {
    const world = stubWorld();
    const first = equipStarterRingForCharacter(world, "JAMAL", "RIGHT:2");
    equipRing(world, "RING_GENERIC_DAMAGE_PERCENT_20", "LEFT:0");

    const second = equipStarterRingForCharacter(world, "JAMAL");

    expect(second.instanceId).toBe(first.instanceId);
    expect(second.slotId).toBe("LEFT:0");
    expect(world.progression.hands.RIGHT.slots[2].ringInstanceId).toBeNull();
    expect(world.progression.hands.LEFT.slots[0].ringInstanceId).toBe(first.instanceId);
    expect(Object.values(world.progression.ringsByInstanceId).map((instance) => (instance as RingInstance).defId))
      .toEqual(["RING_STARTER_STREET_REFLEX"]);
  });
});
