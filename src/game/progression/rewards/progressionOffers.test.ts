import { describe, expect, test } from "vitest";
import { createInitialRingProgressionState, equipRing } from "../rings/ringState";
import { generateProgressionOffers } from "./progressionOffers";

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

describe("progression offer generation", () => {
  test("generates typed ring and token offers", () => {
    const world = stubWorld();

    const ringOptions = generateProgressionOffers(world, "RING", "FLOOR_COMPLETION", 3);
    expect(ringOptions).toHaveLength(3);
    expect(ringOptions.every((option) => option.family === "RING" && typeof option.ringDefId === "string")).toBe(true);

    const tokenOptions = generateProgressionOffers(world, "RING_MODIFIER_TOKEN", "LEVEL_UP", 3);
    expect(tokenOptions).toHaveLength(3);
    expect(tokenOptions.filter((option) => option.family === "RING_MODIFIER_TOKEN")).toHaveLength(3);
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
