import { describe, expect, test } from "vitest";
import {
  processZoneClearedReward,
  processObjectiveCompletionReward,
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
    triggerSignals: [],
    objectiveStates: [],
    objectiveRewardClaimedKey: null,
    zoneRewardClaimedKey: null,
    zoneRewardClaimedKeys: [],
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

describe("zoneCleared reward trigger", () => {
  test("starts reward once per cleared zone id", () => {
    const w = createWorld(7);

    w.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}1`,
    });

    const started1 = processZoneClearedReward(w, 3);
    expect(started1).toBe(true);
    expect(w.state).toBe("REWARD");
    expect(w.cardReward.active).toBe(true);
    expect(w.zoneRewardClaimedKey).toBe("0:ZONE_CLEAR:1");

    w.state = "RUN";
    w.cardReward.active = false;
    w.cardReward.options = [];

    const startedNoSignal = processZoneClearedReward(w, 3);
    expect(startedNoSignal).toBe(false);

    w.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}1`,
    });
    const startedSameZoneAgain = processZoneClearedReward(w, 3);
    expect(startedSameZoneAgain).toBe(false);

    w.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}2`,
    });
    const startedZone2 = processZoneClearedReward(w, 3);
    expect(startedZone2).toBe(true);
    expect(w.zoneRewardClaimedKey).toBe("0:ZONE_CLEAR:2");
  });

  test("objective completion reward still works", () => {
    const w = createWorld(11);
    w.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "COMPLETED" }];
    const started = processObjectiveCompletionReward(w, 3);
    expect(started).toBe(true);
    expect(w.objectiveRewardClaimedKey).toBe("0:TRIAL_COMPLETE");
    expect(w.relicReward.active).toBe(true);
  });

  test("zone cleared reward is skipped once objective is completed", () => {
    const w = createWorld(13);
    w.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "COMPLETED" }];
    w.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}2`,
    });

    const startedZone = processZoneClearedReward(w, 3);
    expect(startedZone).toBe(false);
    expect(w.cardReward.active).toBe(false);
  });

  test("zone trial sequence: zone1 card, zone2 card, zone3 no reward, objective completion relic", () => {
    const w = createWorld(21);
    w.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "ACTIVE" }];

    w.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}1`,
    });
    expect(processZoneClearedReward(w, 3)).toBe(true);
    expect(w.cardReward.active).toBe(true);
    w.state = "RUN";
    w.cardReward.active = false;
    w.cardReward.options = [];

    w.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}2`,
    });
    expect(processZoneClearedReward(w, 3)).toBe(true);
    expect(w.cardReward.active).toBe(true);
    w.state = "RUN";
    w.cardReward.active = false;
    w.cardReward.options = [];

    w.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: `${OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix}3`,
    });
    expect(processZoneClearedReward(w, 3)).toBe(false);
    expect(w.cardReward.active).toBe(false);

    w.objectiveStates[0].status = "COMPLETED";
    expect(processObjectiveCompletionReward(w, 3)).toBe(true);
    expect(w.relicReward.active).toBe(true);
    expect(w.relicReward.options.length).toBe(3);
  });
});
