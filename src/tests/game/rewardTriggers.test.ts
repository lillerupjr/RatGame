import { describe, expect, test } from "vitest";
import { processChestOpenRequested, processObjectiveCompletionReward } from "../../game/combat_mods/rewards/rewardTriggers";
import { chooseRelicReward } from "../../game/combat_mods/rewards/relicRewardFlow";

function createWorld(seed = 1): any {
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
    cards: [],
    relics: [] as string[],
    chestOpenRequested: false,
    objectiveStates: [],
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

describe("rewardTriggers", () => {
  test("chest handshake starts boss chest reward", () => {
    const w = createWorld(5);
    w.chestOpenRequested = true;

    const started = processChestOpenRequested(w, 3);

    expect(started).toBe(true);
    expect(w.state).toBe("REWARD");
    expect(w.cardReward.active).toBe(true);
    expect(w.cardReward.source).toBe("BOSS_CHEST");
    expect(w.cardReward.options.length).toBe(3);
    expect(w.cardRewardBudgetUsed).toBe(1);
  });

  test("objective completion starts reward once and edge-gates repeats", () => {
    const w = createWorld(6);
    w.objectiveStates = [{ id: "OBJ_A", status: "COMPLETED" }];

    const started1 = processObjectiveCompletionReward(w, 3);
    const started2 = processObjectiveCompletionReward(w, 3);

    expect(started1).toBe(true);
    expect(started2).toBe(false);
    expect(w.state).toBe("REWARD");
    expect(w.relicReward.active).toBe(true);
    expect(w.relicReward.source).toBe("OBJECTIVE_COMPLETION");
    expect(w.relicReward.options.length).toBe(3);
    expect(w.objectiveRewardClaimedKey).toBe("0:TRIAL_COMPLETE");

    const picked = w.relicReward.options[0];
    chooseRelicReward(w, picked);
    expect(w.relics).toContain(picked);
    expect(w.relicReward.active).toBe(false);
  });

  test("does not start objective reward without completed objective state", () => {
    const w = createWorld(9);
    w.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "ACTIVE", progress: { signalCount: 0 } }];

    const started = processObjectiveCompletionReward(w, 3);

    expect(started).toBe(false);
    expect(w.state).toBe("RUN");
    expect(w.relicReward.active).toBe(false);
    expect(w.objectiveStates[0].status).toBe("ACTIVE");
  });

  test("does not start objective relic reward on vendor/heal floors", () => {
    const vendor = createWorld(12);
    vendor.floorArchetype = "VENDOR";
    vendor.objectiveStates = [{ id: "OBJ_VENDOR", status: "COMPLETED" }];
    expect(processObjectiveCompletionReward(vendor, 3)).toBe(false);
    expect(vendor.relicReward.active).toBe(false);

    const heal = createWorld(13);
    heal.floorArchetype = "HEAL";
    heal.objectiveStates = [{ id: "OBJ_HEAL", status: "COMPLETED" }];
    expect(processObjectiveCompletionReward(heal, 3)).toBe(false);
    expect(heal.relicReward.active).toBe(false);
  });
});
