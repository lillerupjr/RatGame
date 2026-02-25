import { describe, expect, test } from "vitest";
import { chooseRelicReward } from "./relicRewardFlow";
import { processObjectiveCompletionReward } from "./rewardTriggers";

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
    objectiveRewardClaimedKey: null,
    cardRewardBudgetTotal: 3,
    cardRewardBudgetUsed: 0,
    cardRewardClaimKeys: [],
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

    const startedFirst = processObjectiveCompletionReward(world, 3);
    const startedSecond = processObjectiveCompletionReward(world, 3);

    expect(startedFirst).toBe(true);
    expect(startedSecond).toBe(false);
    expect(world.relicReward.active).toBe(true);
    expect(world.relicReward.options.length).toBe(3);
    expect(canAdvance(world)).toBe(false);
  });

  test("choosing reward appends card and unblocks advancement", () => {
    const world = createWorld(9);
    processObjectiveCompletionReward(world, 3);

    const picked = world.relicReward.options[0];
    chooseRelicReward(world, picked);
    world.state = "RUN";

    expect(world.relics.includes(picked)).toBe(true);
    expect(world.relicReward.active).toBe(false);
    expect(canAdvance(world)).toBe(true);
  });
});
