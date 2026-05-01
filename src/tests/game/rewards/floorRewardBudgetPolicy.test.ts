import { describe, expect, test } from "vitest";
import { OBJECTIVE_COMPLETION_GOLD } from "../../../game/rewards/rewardDirector";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld } from "./rewardPipeline.testUtils";

describe("floor reward budget policies", () => {
  test("ZONE_TRIAL grants only objective progression reward plus gold exactly once", () => {
    const world = createRewardPipelineWorld(101, "ZONE_TRIAL");
    world.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 2 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
    );

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(1);
    expect(world.rewardTickets.map((ticket: any) => ticket.family)).toEqual([
      "RING",
    ]);
    expect(world.floorRewardBudget.nonObjectiveRewardsRemaining).toBe(0);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(world.rewardClaimKeys).toEqual([
      "0:ZONE_CLEAR:1",
      "0:ZONE_CLEAR:2",
      "0:TRIAL_COMPLETE",
    ]);
  });

  test("RARE_TRIPLE grants only objective progression reward plus gold, and chest stays disabled", () => {
    const world = createRewardPipelineWorld(202, "NORMAL");
    world.floorArchetype = "RARE_TRIPLE";
    world.runEvents.push(
      { type: "RARE_MILESTONE_CLEARED", floorIndex: 0, rareIndex: 1 },
      { type: "RARE_MILESTONE_CLEARED", floorIndex: 0, rareIndex: 2 },
      { type: "CHEST_OPEN_REQUESTED", floorIndex: 0, chestKind: "BOSS" },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_RARE_TRIPLE" },
    );

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(1);
    expect(world.rewardTickets.map((ticket: any) => ticket.family)).toEqual([
      "RING",
    ]);
    expect(world.rewardClaimKeys).toContain("0:BOSS_CHEST");
    expect(world.floorRewardBudget.nonObjectiveRewardsRemaining).toBe(0);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });

  test("SURVIVE policy grants only objective progression reward plus gold", () => {
    const world = createRewardPipelineWorld(303, "SURVIVE_TRIAL");
    world.floorArchetype = "SURVIVE";
    world.runEvents.push(
      { type: "SURVIVE_MILESTONE", floorIndex: 0, seconds: 60 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_SURVIVE" },
      { type: "CHEST_OPEN_REQUESTED", floorIndex: 0, chestKind: "BOSS" },
    );

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(1);
    expect(world.rewardTickets.map((ticket: any) => ticket.family)).toEqual([
      "RING",
    ]);
    expect(world.floorRewardBudget.nonObjectiveRewardsRemaining).toBe(0);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });

  test("SURVIVE policy remains objective-only after the legacy finale removal", () => {
    const world = createRewardPipelineWorld(404, "SURVIVE_TRIAL");
    world.floorArchetype = "SURVIVE";
    world.runEvents.push(
      { type: "SURVIVE_MILESTONE", floorIndex: 0, seconds: 60 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_SURVIVE" },
      { type: "CHEST_OPEN_REQUESTED", floorIndex: 0, chestKind: "BOSS" },
    );

    rewardSchedulerSystem(world);
    expect(world.rewardTickets).toHaveLength(1);
    expect(world.floorRewardBudget.nonObjectiveRewardsRemaining).toBe(0);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });
});
