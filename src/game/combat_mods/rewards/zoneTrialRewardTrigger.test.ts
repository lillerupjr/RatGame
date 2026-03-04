import { describe, expect, test } from "vitest";
import { chooseRelicReward } from "./relicRewardFlow";
import { createFloorRewardBudget } from "../../rewards/floorRewardBudget";
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
  test("starts exactly once and blocks advancement while reward is active", () => {
    const world = createWorld(7);

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    const startedFirst = rewardPresenterSystem(world);

    expect(startedFirst).toBe(true);
    expect(world.relicReward.active).toBe(true);
    expect(world.relicReward.options.length).toBe(3);
    expect(canAdvance(world)).toBe(false);

    resolveActiveRewardTicket(world);
    world.state = "RUN";
    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    const startedSecond = rewardPresenterSystem(world);
    expect(startedSecond).toBe(false);
  });

  test("choosing reward appends card and unblocks advancement", () => {
    const world = createWorld(9);
    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    rewardPresenterSystem(world);

    const picked = world.relicReward.options[0];
    chooseRelicReward(world, picked);
    world.state = "RUN";

    expect(world.relics.includes(picked)).toBe(true);
    expect(world.relicReward.active).toBe(false);
    expect(canAdvance(world)).toBe(true);
  });
});
