import { describe, expect, test } from "vitest";
import { resolveActiveRewardTicket } from "../../../game/rewards/rewardTickets";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld, dismissActiveRewardUi, getActiveTicket } from "./rewardPipeline.testUtils";

describe("durable reward pipeline queueing", () => {
  test("zone clear plus objective completion queues one floor progression reward", () => {
    const world = createRewardPipelineWorld(41, "ZONE_TRIAL");

    world.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" },
    );

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(1);
    expect(world.rewardTickets[0].status).toBe("PENDING");

    expect(rewardPresenterSystem(world)).toBe(true);
    expect(world.state).toBe("REWARD");

    const first = getActiveTicket(world);
    expect(first?.createdSeq).toBe(1);
    expect(first?.family).toBe("RING");
    expect(world.progressionReward.active).toBe(true);
    expect(world.run.runGold).toBe(0);

    dismissActiveRewardUi(world);
    resolveActiveRewardTicket(world);
  });
});
