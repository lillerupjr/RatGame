import { describe, expect, test } from "vitest";
import { OBJECTIVE_COMPLETION_GOLD } from "../../../game/rewards/rewardDirector";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld } from "./rewardPipeline.testUtils";

describe("floor reward budget policies", () => {
  test("ZONE_TRIAL grants zone1, zone2, and objective gold exactly once", () => {
    const world = createRewardPipelineWorld(101, "ZONE_TRIAL");
    world.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 2 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
    );

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(2);
    expect(world.rewardTickets.map((ticket: any) => ticket.kind)).toEqual([
      "CARD_PICK",
      "CARD_PICK",
    ]);
    expect(world.floorRewardBudget.nonObjectiveCardsRemaining).toBe(0);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(world.cardRewardClaimKeys).toEqual([
      "0:ZONE_CLEAR:1",
      "0:ZONE_CLEAR:2",
      "0:TRIAL_COMPLETE",
    ]);
  });

  test("BOSS_TRIPLE grants boss milestones and objective gold, but chest gives no ticket", () => {
    const world = createRewardPipelineWorld(202, "NORMAL");
    world.floorArchetype = "BOSS_TRIPLE";
    world.runEvents.push(
      { type: "BOSS_MILESTONE_CLEARED", floorIndex: 0, bossIndex: 1 },
      { type: "BOSS_MILESTONE_CLEARED", floorIndex: 0, bossIndex: 2 },
      { type: "CHEST_OPEN_REQUESTED", floorIndex: 0, chestKind: "BOSS" },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_BOSS_RARES" },
    );

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(2);
    expect(world.rewardTickets.map((ticket: any) => ticket.kind)).toEqual([
      "CARD_PICK",
      "CARD_PICK",
    ]);
    expect(world.cardRewardClaimKeys).toContain("0:BOSS_CHEST");
    expect(world.floorRewardBudget.nonObjectiveCardsRemaining).toBe(0);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });

  test("SURVIVE policy grants rewards at 60s + objective + boss chest", () => {
    const world = createRewardPipelineWorld(303, "SURVIVE_TRIAL");
    world.floorArchetype = "SURVIVE";
    world.runEvents.push(
      { type: "SURVIVE_MILESTONE", floorIndex: 0, seconds: 60 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_SURVIVE" },
      { type: "CHEST_OPEN_REQUESTED", floorIndex: 0, chestKind: "BOSS" },
    );

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(2);
    expect(world.rewardTickets.map((ticket: any) => ticket.kind)).toEqual([
      "CARD_PICK",
      "CARD_PICK",
    ]);
    expect(world.floorRewardBudget.nonObjectiveCardsRemaining).toBe(0);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });

  test("SURVIVE_BOSS policy grants exactly 2 card rewards plus objective gold", () => {
    const world = createRewardPipelineWorld(404, "SURVIVE_TRIAL");
    world.floorArchetype = "SURVIVE";
    world._surviveBossSpawned = true;
    world.runEvents.push(
      { type: "SURVIVE_MILESTONE", floorIndex: 0, seconds: 60 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_SURVIVE" },
      { type: "CHEST_OPEN_REQUESTED", floorIndex: 0, chestKind: "BOSS" },
    );

    rewardSchedulerSystem(world);
    expect(world.rewardTickets).toHaveLength(2);
    expect(world.floorRewardBudget.nonObjectiveCardsRemaining).toBe(0);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });
});
