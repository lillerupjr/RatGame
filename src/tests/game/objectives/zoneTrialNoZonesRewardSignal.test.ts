import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { startZoneTrial } from "../../../game/objectives/zoneObjectiveSystem";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";
import { hasCompletedAnyObjective, objectiveSystem } from "../../../game/systems/progression/objective";

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
    world.objectiveDefs = [
      {
        id: "OBJ_ZONE_TRIAL",
        listensTo: [OBJECTIVE_TRIGGER_IDS.zoneTrialComplete],
        completionRule: { type: "SIGNAL_COUNT", count: 1, signalType: "KILL" },
        outcomes: [],
      },
    ];
    world.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "ACTIVE", progress: { signalCount: 0 } }];
    world.triggerSignals = [];

    startZoneTrial(world, { zoneSize: 9999 });
    objectiveSystem(world);

    expect(hasCompletedAnyObjective(world)).toBe(true);
    const hasSignal = world.triggerSignals.some(
      (s) => s.triggerId === OBJECTIVE_TRIGGER_IDS.zoneTrialComplete && s.type === "KILL"
    );
    expect(hasSignal).toBe(true);
  });
});
