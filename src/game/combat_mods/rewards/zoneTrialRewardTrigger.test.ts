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
    cards: [] as string[],
    relics: [] as string[],
    objectiveStates: [{ id: "OBJ_ZONE_TRIAL", status: "COMPLETED" }],
    floorRewardBudget: createFloorRewardBudget("ZONE_TRIAL"),
    objectiveRewardClaimedKey: null,
    cardRewardClaimKeys: [],
    runEvents: [],
    rewardTickets: [],
    activeRewardTicketId: null,
    rewardTicketSeq: 0,
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
}

function canAdvance(world: any): boolean {
  return world.state === "RUN" && !world.cardReward.active && !world.relicReward.active;
}

describe("zoneTrial reward trigger", () => {
  test("grants objective gold exactly once and does not block advancement", () => {
    const world = createWorld(7);

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    const startedFirst = rewardPresenterSystem(world);

    expect(startedFirst).toBe(false);
    expect(world.relicReward.active).toBe(false);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(canAdvance(world)).toBe(true);

    resolveActiveRewardTicket(world);
    world.state = "RUN";
    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    const startedSecond = rewardPresenterSystem(world);
    expect(startedSecond).toBe(false);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });

  test("objective completion still records the claim key without opening reward UI", () => {
    const world = createWorld(9);
    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    const started = rewardPresenterSystem(world);

    expect(started).toBe(false);
    expect(world.relicReward.active).toBe(false);
    expect(world.objectiveRewardClaimedKey).toBe("0:TRIAL_COMPLETE");
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(canAdvance(world)).toBe(true);
  });
});
