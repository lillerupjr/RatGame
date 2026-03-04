import { describe, expect, test } from "vitest";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld } from "./rewardPipeline.testUtils";

describe("durable reward pipeline idempotency", () => {
  test("duplicate events with same claim key do not create duplicate tickets", () => {
    const world = createRewardPipelineWorld(63, "ZONE_TRIAL");

    world.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
    );

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(1);
    expect(world.cardRewardClaimKeys).toEqual(["0:ZONE_CLEAR:1"]);
    expect(world.floorRewardBudget.nonObjectiveCardsRemaining).toBe(1);

    world.runEvents.push({ type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 });
    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(1);
    expect(world.cardRewardClaimKeys).toEqual(["0:ZONE_CLEAR:1"]);
    expect(world.floorRewardBudget.nonObjectiveCardsRemaining).toBe(1);
  });
});
