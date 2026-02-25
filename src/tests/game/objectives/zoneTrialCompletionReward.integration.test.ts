import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { objectiveSystem, setObjectivesFromSpec } from "../../../game/systems/progression/objective";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";
import { processObjectiveCompletionReward } from "../../../game/combat_mods/rewards/rewardTriggers";
import { stageDocks } from "../../../game/content/stages";

describe("zone trial completion reward chain", () => {
  test("completion trigger resolves objective and starts reward", () => {
    const world = createWorld({ seed: 123, stage: stageDocks });
    world.state = "RUN";
    world.runState = "FLOOR";
    world.floorIndex = 0;

    setObjectivesFromSpec(world, {
      objectiveType: "ZONE_TRIAL",
      params: {
        zoneCount: 2,
        zoneSize: 4,
        killTargetPerZone: 8,
      },
    });

    world.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: OBJECTIVE_TRIGGER_IDS.zoneTrialComplete,
    });

    objectiveSystem(world);
    const started = processObjectiveCompletionReward(world, 3);

    expect(started).toBe(true);
    expect(world.state).toBe("REWARD");
    expect(world.relicReward.active).toBe(true);
    expect(world.relicReward.source).toBe("OBJECTIVE_COMPLETION");
    expect(world.relicReward.options).toHaveLength(3);
  });
});
