import { describe, expect, test } from "vitest";
import { chooseCardReward } from "./cardRewardFlow";
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
    floorIndex: 0,
    cards: [] as string[],
    objectiveStates: [{ id: "OBJ_ZONE_TRIAL", status: "COMPLETED" }],
    objectiveRewardClaimedKey: null,
    cardReward: {
      active: false,
      source: "ZONE_TRIAL",
      options: [],
    },
  };
}

function canAdvance(world: any): boolean {
  return world.state === "RUN" && !world.cardReward.active;
}

describe("zoneTrial reward trigger", () => {
  test("starts exactly once and blocks advancement while reward is active", () => {
    const world = createWorld(7);

    const startedFirst = processObjectiveCompletionReward(world, 3);
    const startedSecond = processObjectiveCompletionReward(world, 3);

    expect(startedFirst).toBe(true);
    expect(startedSecond).toBe(false);
    expect(world.cardReward.active).toBe(true);
    expect(world.cardReward.options.length).toBe(3);
    expect(canAdvance(world)).toBe(false);
  });

  test("choosing reward appends card and unblocks advancement", () => {
    const world = createWorld(9);
    processObjectiveCompletionReward(world, 3);

    const picked = world.cardReward.options[0];
    chooseCardReward(world, picked);
    world.state = "RUN";

    expect(world.cards.includes(picked)).toBe(true);
    expect(world.cardReward.active).toBe(false);
    expect(canAdvance(world)).toBe(true);
  });
});
