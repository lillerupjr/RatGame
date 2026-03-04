import { describe, expect, test } from "vitest";
import { resolveActiveRewardTicket } from "../../../game/rewards/rewardTickets";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { rewardRunEventProducerSystem } from "../../../game/systems/progression/rewardRunEventProducerSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld, dismissActiveRewardUi, getActiveTicket } from "./rewardPipeline.testUtils";

describe("durable reward pipeline zone+objective same frame", () => {
  test("captures both facts and presents rewards FIFO", () => {
    const world = createRewardPipelineWorld(74, "ZONE_TRIAL");
    world.runEvents.push({ type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 });
    world.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "COMPLETED" }];

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    expect(world.runEvents).toHaveLength(2);
    expect(world.runEvents[0].type).toBe("ZONE_CLEARED");
    expect(world.runEvents[1].type).toBe("OBJECTIVE_COMPLETED");

    rewardSchedulerSystem(world);
    expect(world.rewardTickets).toHaveLength(2);

    expect(rewardPresenterSystem(world)).toBe(true);
    const first = getActiveTicket(world);
    expect(first?.kind).toBe("CARD_PICK");

    dismissActiveRewardUi(world);
    resolveActiveRewardTicket(world);
    world.state = "RUN";

    expect(rewardPresenterSystem(world)).toBe(true);
    const second = getActiveTicket(world);
    expect(second?.kind).toBe("RELIC_PICK");
  });
});
