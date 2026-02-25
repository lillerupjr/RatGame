import { describe, expect, test } from "vitest";
import {
  processBossMilestoneRewards,
  processChestOpenRequested,
  processObjectiveCompletionReward,
  processSurviveMilestoneRewards,
  processZoneClearedReward,
  resetFloorCardRewardBudget,
} from "../../../game/combat_mods/rewards/rewardTriggers";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";

function createWorld(seed = 1): any {
  let s = seed >>> 0;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };

  const world: any = {
    rng: { next },
    state: "RUN",
    runState: "FLOOR",
    floorArchetype: "TIME_TRIAL",
    floorIndex: 0,
    timeSec: 0,
    cards: [],
    relics: [] as string[],
    chestOpenRequested: false,
    triggerSignals: [],
    objectiveStates: [],
    objectiveRewardClaimedKey: null,
    zoneRewardClaimedKey: null,
    zoneRewardClaimedKeys: [],
    cardReward: {
      active: false,
      source: "ZONE_TRIAL",
      options: [],
    },
    relicReward: {
      active: false,
      source: "OBJECTIVE_COMPLETION",
      options: [],
    },
  };
  resetFloorCardRewardBudget(world);
  return world;
}

function resolveReward(world: any): void {
  world.state = "RUN";
  world.cardReward.active = false;
  world.cardReward.options = [];
  world.relicReward.active = false;
  world.relicReward.options = [];
}

describe("floor reward budget policies", () => {
  test("ZONE_TRIAL policy grants exactly 3 rewards (zone1, zone2, completion)", () => {
    const world = createWorld(101);
    world.floorArchetype = "TIME_TRIAL";
    world.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "ACTIVE" }];

    world.triggerSignals.push({ type: "KILL", entityId: -1, triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}1` });
    expect(processZoneClearedReward(world, 3)).toBe(true);
    resolveReward(world);

    world.triggerSignals.push({ type: "KILL", entityId: -1, triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}2` });
    expect(processZoneClearedReward(world, 3)).toBe(true);
    resolveReward(world);

    world.triggerSignals.push({ type: "KILL", entityId: -1, triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}3` });
    expect(processZoneClearedReward(world, 3)).toBe(false);

    world.objectiveStates[0].status = "COMPLETED";
    expect(processObjectiveCompletionReward(world, 3)).toBe(true);
    resolveReward(world);

    world.objectiveStates[0].status = "COMPLETED";
    expect(processObjectiveCompletionReward(world, 3)).toBe(false);
    expect(world.cardRewardBudgetUsed).toBe(3);
    expect(world.cardRewardBudgetTotal).toBe(3);
  });

  test("BOSS policy grants reward on first and second boss clears only", () => {
    const world = createWorld(202);
    world.floorArchetype = "BOSS_TRIPLE";
    world.objectiveStates = [{ id: "OBJ_BOSS_RARES", status: "COMPLETED" }];

    world.triggerSignals.push({ type: "KILL", entityId: 0, triggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}1` });
    expect(processBossMilestoneRewards(world, 3)).toBe(true);
    resolveReward(world);

    world.triggerSignals.push({ type: "KILL", entityId: 1, triggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}2` });
    expect(processBossMilestoneRewards(world, 3)).toBe(true);
    resolveReward(world);

    world.triggerSignals.push({ type: "KILL", entityId: 2, triggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}3` });
    expect(processBossMilestoneRewards(world, 3)).toBe(false);

    world.chestOpenRequested = true;
    expect(processChestOpenRequested(world, 3)).toBe(false);

    expect(processObjectiveCompletionReward(world, 3)).toBe(false);
    expect(world.cardRewardBudgetUsed).toBe(2);
  });

  test("SURVIVE policy grants rewards at 60s + objective + boss chest", () => {
    const world = createWorld(303);
    world.floorArchetype = "SURVIVE";
    world.objectiveStates = [{ id: "OBJ_SURVIVE", status: "ACTIVE" }];

    world.timeSec = 40;
    expect(processSurviveMilestoneRewards(world, 3)).toBe(false);

    world.timeSec = 60;
    expect(processSurviveMilestoneRewards(world, 3)).toBe(true);
    resolveReward(world);

    world.objectiveStates[0].status = "COMPLETED";
    expect(processObjectiveCompletionReward(world, 3)).toBe(true);
    resolveReward(world);

    world.chestOpenRequested = true;
    expect(processChestOpenRequested(world, 3)).toBe(true);
    resolveReward(world);

    expect(world.cardRewardBudgetUsed).toBe(3);
  });

  test("SURVIVE_BOSS policy grants exactly 3 rewards (60s, completion, chest)", () => {
    const world = createWorld(404);
    world.floorArchetype = "SURVIVE";
    world._surviveBossSpawned = true;
    world.objectiveStates = [{ id: "OBJ_SURVIVE", status: "ACTIVE" }];

    world.timeSec = 59;
    expect(processSurviveMilestoneRewards(world, 3)).toBe(false);

    world.timeSec = 60;
    expect(processSurviveMilestoneRewards(world, 3)).toBe(true);
    resolveReward(world);

    world.objectiveStates[0].status = "COMPLETED";
    expect(processObjectiveCompletionReward(world, 3)).toBe(true);
    resolveReward(world);

    world.chestOpenRequested = true;
    expect(processChestOpenRequested(world, 3)).toBe(true);
    resolveReward(world);

    expect(world.cardRewardBudgetUsed).toBe(3);
  });
});
