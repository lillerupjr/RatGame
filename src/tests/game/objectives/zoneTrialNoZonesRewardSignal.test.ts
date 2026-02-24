import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { startZoneTrial } from "../../../game/objectives/zoneObjectiveSystem";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";

describe("zone trial zero-zone completion signal", () => {
  test("emits completion trigger immediately when no valid zones are generated", () => {
    const world = createWorld({ seed: 42, stage: stageDocks });
    world.currentObjectiveSpec = {
      objectiveType: "ZONE_TRIAL",
      params: {
        zoneCount: 2,
        zoneSize: 9999,
        killTargetPerZone: 8,
      },
    };
    world.triggerSignals = [];

    startZoneTrial(world, { zoneSize: 9999 });

    expect(world.zoneTrialObjective?.completed).toBe(true);
    const hasSignal = world.triggerSignals.some(
      (s) => s.triggerId === OBJECTIVE_TRIGGER_IDS.zoneTrialComplete && s.type === "KILL"
    );
    expect(hasSignal).toBe(true);
  });
});
