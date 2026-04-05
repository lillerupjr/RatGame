import { describe, expect, test } from "vitest";
import {
  objectiveIdFromArchetype,
  objectiveSpecFromObjectiveId,
} from "../../../game/map/objectivePlan";

describe("objectivePlan", () => {
  test("survive objective default duration is 120 seconds", () => {
    const spec = objectiveSpecFromObjectiveId("SURVIVE_TIMER");
    expect(spec.objectiveType).toBe("SURVIVE_TIMER");
    if (spec.objectiveType !== "SURVIVE_TIMER") return;
    expect(spec.params.timeLimitSec).toBe(120);
  });

  test("act boss is a first-class archetype to objective mapping", () => {
    expect(objectiveIdFromArchetype("ACT_BOSS")).toBe("ACT_BOSS");

    const spec = objectiveSpecFromObjectiveId("ACT_BOSS");
    expect(spec).toEqual({
      objectiveType: "ACT_BOSS",
      params: {
        bossId: null,
      },
    });
  });
});
