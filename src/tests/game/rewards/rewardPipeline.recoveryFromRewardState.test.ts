import { describe, expect, test } from "vitest";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld, getActiveTicket } from "./rewardPipeline.testUtils";

describe("durable reward pipeline recovery", () => {
  test("retains tickets while in REWARD state and presents when RUN resumes", () => {
    const world = createRewardPipelineWorld(52, "ZONE_TRIAL");
    world.state = "REWARD";
    world.runEvents.push({ type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 });

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(1);
    expect(world.rewardTickets[0].status).toBe("PENDING");
    expect(rewardPresenterSystem(world)).toBe(false);
    expect(world.activeRewardTicketId).toBeNull();

    world.state = "RUN";
    expect(rewardPresenterSystem(world)).toBe(true);

    const active = getActiveTicket(world);
    expect(active?.status).toBe("ACTIVE");
    expect(active?.kind).toBe("CARD_PICK");
  });
});
