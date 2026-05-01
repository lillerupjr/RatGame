import { describe, expect, test } from "vitest";
import { resolveActiveRewardTicket } from "../../../game/rewards/rewardTickets";
import { OBJECTIVE_COMPLETION_GOLD } from "../../../game/rewards/rewardDirector";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld, dismissActiveRewardUi, getActiveTicket } from "./rewardPipeline.testUtils";

describe("durable reward pipeline queueing", () => {
  test("stores level-up token and queues the floor progression reward", () => {
    const world = createRewardPipelineWorld(41, "ZONE_TRIAL");

    world.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "LEVEL_UP", floorIndex: 0, level: 2 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" },
    );

    rewardSchedulerSystem(world);

    expect(world.progression.storedModifierTokens.LEVEL_UP).toBe(1);
    expect(world.rewardTickets).toHaveLength(1);
    expect(world.rewardTickets[0].status).toBe("PENDING");

    expect(rewardPresenterSystem(world)).toBe(true);
    expect(world.state).toBe("REWARD");

    const first = getActiveTicket(world);
    expect(first?.createdSeq).toBe(1);
    expect(first?.family).toBe("RING");
    expect(world.progressionReward.active).toBe(true);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);

    dismissActiveRewardUi(world);
    resolveActiveRewardTicket(world);
  });
});
