import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { objectiveSystem, setObjectivesFromSpec } from "../../../game/systems/progression/objective";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";
import { rewardRunEventProducerSystem } from "../../../game/systems/progression/rewardRunEventProducerSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { stageDocks } from "../../../game/content/stages";
import { OBJECTIVE_COMPLETION_GOLD } from "../../../game/rewards/rewardDirector";
import { createFloorRewardBudget } from "../../../game/rewards/floorRewardBudget";

describe("zone trial completion reward chain", () => {
  test("completion trigger resolves objective and grants gold without opening reward UI", () => {
    const world = createWorld({ seed: 123, stage: stageDocks });
    world.state = "RUN";
    world.runState = "FLOOR";
    world.floorIndex = 0;
    world.floorRewardBudget = createFloorRewardBudget("ZONE_TRIAL");
    world.runEvents = [];
    world.rewardTickets = [];
    world.activeRewardTicketId = null;
    world.rewardTicketSeq = 0;
    world.cardRewardClaimKeys = [];

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
    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    const started = rewardPresenterSystem(world);

    expect(started).toBe(false);
    expect(world.state).toBe("RUN");
    expect(world.relicReward.active).toBe(false);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });
});
