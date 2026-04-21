import { describe, expect, test } from "vitest";
import { createFloorRewardBudget } from "../../rewards/floorRewardBudget";
import { OBJECTIVE_COMPLETION_GOLD } from "../../rewards/rewardDirector";
import { rewardRunEventProducerSystem } from "../../systems/progression/rewardRunEventProducerSystem";
import { rewardSchedulerSystem } from "../../systems/progression/rewardSchedulerSystem";
import { rewardPresenterSystem } from "../../systems/progression/rewardPresenterSystem";
import { resolveActiveRewardTicket } from "../../rewards/rewardTickets";

function createWorld(seed = 123): any {
  let s = seed >>> 0;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };

  return {
    rng: { next },
    state: "RUN",
    runState: "FLOOR",
    floorArchetype: "TIME_TRIAL",
    floorIndex: 0,
    timeSec: 0,
    run: { runGold: 0, xp: 0, level: 1, xpToNextLevel: 50 },
    level: 1,
    objectiveStates: [{ id: "OBJ_ZONE_TRIAL", status: "COMPLETED" }],
    floorRewardBudget: createFloorRewardBudget("ZONE_TRIAL"),
    objectiveRewardClaimedKey: null,
    rewardClaimKeys: [],
    runEvents: [],
    rewardTickets: [],
    activeRewardTicketId: null,
    rewardTicketSeq: 0,
    progressionReward: {
      active: false,
      family: "RING",
      source: "FLOOR_COMPLETION",
      options: [],
    },
  };
}

function canAdvance(world: any): boolean {
  return world.state === "RUN" && !world.progressionReward.active;
}

describe("zoneTrial reward trigger", () => {
  test("grants objective gold plus progression reward exactly once and blocks advancement until resolved", () => {
    const world = createWorld(7);

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    const startedFirst = rewardPresenterSystem(world);

    expect(startedFirst).toBe(true);
    expect(world.progressionReward.active).toBe(true);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(canAdvance(world)).toBe(false);

    resolveActiveRewardTicket(world);
    world.progressionReward.active = false;
    world.progressionReward.options = [];
    world.state = "RUN";
    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    const startedSecond = rewardPresenterSystem(world);
    expect(startedSecond).toBe(false);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(canAdvance(world)).toBe(true);
  });

  test("objective completion still records the claim key while opening reward UI", () => {
    const world = createWorld(9);
    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    const started = rewardPresenterSystem(world);

    expect(started).toBe(true);
    expect(world.progressionReward.active).toBe(true);
    expect(world.objectiveRewardClaimedKey).toBe("0:TRIAL_COMPLETE");
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(canAdvance(world)).toBe(false);
  });
});
