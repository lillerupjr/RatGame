import { describe, expect, test } from "vitest";
import { objectiveSpecFromObjectiveId } from "../../../game/map/objectivePlan";

describe("objectivePlan", () => {
  test("survive objective default duration is 120 seconds", () => {
    const spec = objectiveSpecFromObjectiveId("SURVIVE_TIMER");
    expect(spec.objectiveType).toBe("SURVIVE_TIMER");
    if (spec.objectiveType !== "SURVIVE_TIMER") return;
    expect(spec.params.timeLimitSec).toBe(120);
  });
});
