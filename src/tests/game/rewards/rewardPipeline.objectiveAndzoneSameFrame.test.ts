import { describe, expect, test } from "vitest";
import { resolveActiveRewardTicket } from "../../../game/rewards/rewardTickets";
import { OBJECTIVE_COMPLETION_GOLD } from "../../../game/rewards/rewardDirector";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { rewardRunEventProducerSystem } from "../../../game/systems/progression/rewardRunEventProducerSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld, dismissActiveRewardUi, getActiveTicket } from "./rewardPipeline.testUtils";

describe("durable reward pipeline zone+objective same frame", () => {
  test("captures both facts and only presents the objective progression reward", () => {
    const world = createRewardPipelineWorld(74, "ZONE_TRIAL");
    world.runEvents.push({ type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 });
    world.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "COMPLETED" }];

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    expect(world.runEvents).toHaveLength(2);
    expect(world.runEvents[0].type).toBe("ZONE_CLEARED");
    expect(world.runEvents[1].type).toBe("OBJECTIVE_COMPLETED");

    rewardSchedulerSystem(world);
    expect(world.rewardTickets).toHaveLength(1);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);

    expect(rewardPresenterSystem(world)).toBe(true);
    const first = getActiveTicket(world);
    expect(first?.family).toBe("RING");
    expect(world.progressionReward.active).toBe(true);

    dismissActiveRewardUi(world);
    resolveActiveRewardTicket(world);
    world.state = "RUN";

    expect(rewardPresenterSystem(world)).toBe(false);
  });
});
