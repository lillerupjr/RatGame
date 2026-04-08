import { describe, expect, test } from "vitest";
import { resolveActiveRewardTicket } from "../../../game/rewards/rewardTickets";
import { OBJECTIVE_COMPLETION_GOLD } from "../../../game/rewards/rewardDirector";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld, dismissActiveRewardUi, getActiveTicket } from "./rewardPipeline.testUtils";

describe("durable reward pipeline queueing", () => {
  test("queues multiple same-frame rewards and presents one at a time", () => {
    const world = createRewardPipelineWorld(41, "ZONE_TRIAL");

    world.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "LEVEL_UP", floorIndex: 0, level: 2 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" },
    );

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(1);
    expect(world.rewardTickets[0].status).toBe("PENDING");

    expect(rewardPresenterSystem(world)).toBe(true);
    expect(world.state).toBe("REWARD");

    const first = getActiveTicket(world);
    expect(first?.createdSeq).toBe(1);
    expect(first?.kind).toBe("RELIC_PICK");

    dismissActiveRewardUi(world);
    resolveActiveRewardTicket(world);
    world.state = "RUN";

    expect(rewardPresenterSystem(world)).toBe(false);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });
});
