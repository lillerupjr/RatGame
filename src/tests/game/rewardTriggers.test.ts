import { describe, expect, test } from "vitest";
import { chooseRelicReward } from "../../game/combat_mods/rewards/relicRewardFlow";
import { resolveActiveRewardTicket } from "../../game/rewards/rewardTickets";
import { rewardRunEventProducerSystem } from "../../game/systems/progression/rewardRunEventProducerSystem";
import { rewardSchedulerSystem } from "../../game/systems/progression/rewardSchedulerSystem";
import { rewardPresenterSystem } from "../../game/systems/progression/rewardPresenterSystem";
import { createRewardPipelineWorld } from "./rewards/rewardPipeline.testUtils";

describe("reward pipeline runtime facts", () => {
  test("chest handshake starts boss chest reward", () => {
    const w = createRewardPipelineWorld(5, "ZONE_TRIAL");
    w.chestOpenRequested = true;

    rewardRunEventProducerSystem(w, { includeCoreFacts: false, includeChest: true });
    rewardSchedulerSystem(w);
    const started = rewardPresenterSystem(w);

    expect(started).toBe(true);
    expect(w.state).toBe("REWARD");
    expect(w.cardReward.active).toBe(true);
    expect(w.cardReward.source).toBe("BOSS_CHEST");
    expect(w.cardReward.options.length).toBe(3);
    expect(w.floorRewardBudget.nonObjectiveCardsRemaining).toBe(1);
  });

  test("objective completion starts reward once and edge-gates repeats", () => {
    const w = createRewardPipelineWorld(6, "ZONE_TRIAL");
    w.objectiveStates = [{ id: "OBJ_A", status: "COMPLETED" }];

    rewardRunEventProducerSystem(w, { includeCoreFacts: true, includeChest: false });
    rewardRunEventProducerSystem(w, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(w);
    const started1 = rewardPresenterSystem(w);

    expect(started1).toBe(true);
    expect(w.state).toBe("REWARD");
    expect(w.relicReward.active).toBe(true);
    expect(w.relicReward.source).toBe("OBJECTIVE_COMPLETION");
    expect(w.relicReward.options.length).toBe(3);
    expect(w.objectiveRewardClaimedKey).toBe("0:TRIAL_COMPLETE");

    const picked = w.relicReward.options[0];
    chooseRelicReward(w, picked);
    expect(w.relics).toContain(picked);
    expect(w.relicReward.active).toBe(false);

    resolveActiveRewardTicket(w);
    w.state = "RUN";

    rewardRunEventProducerSystem(w, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(w);
    const started2 = rewardPresenterSystem(w);
    expect(started2).toBe(false);
  });

  test("does not start objective reward without completed objective state", () => {
    const w = createRewardPipelineWorld(9, "ZONE_TRIAL");
    w.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "ACTIVE", progress: { signalCount: 0 } }];

    rewardRunEventProducerSystem(w, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(w);
    const started = rewardPresenterSystem(w);

    expect(started).toBe(false);
    expect(w.state).toBe("RUN");
    expect(w.relicReward.active).toBe(false);
    expect(w.objectiveStates[0].status).toBe("ACTIVE");
  });

  test("does not start objective relic reward on vendor/heal floors", () => {
    const vendor = createRewardPipelineWorld(12, "NORMAL");
    vendor.floorArchetype = "VENDOR";
    vendor.objectiveStates = [{ id: "OBJ_VENDOR", status: "COMPLETED" }];
    rewardRunEventProducerSystem(vendor, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(vendor);
    expect(rewardPresenterSystem(vendor)).toBe(false);
    expect(vendor.relicReward.active).toBe(false);

    const heal = createRewardPipelineWorld(13, "NORMAL");
    heal.floorArchetype = "HEAL";
    heal.objectiveStates = [{ id: "OBJ_HEAL", status: "COMPLETED" }];
    rewardRunEventProducerSystem(heal, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(heal);
    expect(rewardPresenterSystem(heal)).toBe(false);
    expect(heal.relicReward.active).toBe(false);
  });
});
