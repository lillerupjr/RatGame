import { describe, expect, test } from "vitest";
import { resolveActiveRewardTicket } from "../../game/rewards/rewardTickets";
import { rewardRunEventProducerSystem } from "../../game/systems/progression/rewardRunEventProducerSystem";
import { rewardSchedulerSystem } from "../../game/systems/progression/rewardSchedulerSystem";
import { rewardPresenterSystem } from "../../game/systems/progression/rewardPresenterSystem";
import { createRewardPipelineWorld } from "./rewards/rewardPipeline.testUtils";
import { OBJECTIVE_COMPLETION_GOLD } from "../../game/rewards/rewardDirector";

describe("reward pipeline runtime facts", () => {
  test("chest handshake does not start boss chest reward", () => {
    const w = createRewardPipelineWorld(5, "ZONE_TRIAL");
    w.chestOpenRequested = true;

    rewardRunEventProducerSystem(w, { includeCoreFacts: false, includeChest: true });
    rewardSchedulerSystem(w);
    const started = rewardPresenterSystem(w);

    expect(started).toBe(false);
    expect(w.state).toBe("RUN");
    expect(w.relicReward.active).toBe(false);
    expect(w.rewardClaimKeys).toContain("0:BOSS_CHEST");
  });

  test("objective completion grants gold plus relic once and edge-gates repeats", () => {
    const w = createRewardPipelineWorld(6, "ZONE_TRIAL");
    w.objectiveStates = [{ id: "OBJ_A", status: "COMPLETED" }];

    rewardRunEventProducerSystem(w, { includeCoreFacts: true, includeChest: false });
    rewardRunEventProducerSystem(w, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(w);
    const started1 = rewardPresenterSystem(w);

    expect(started1).toBe(true);
    expect(w.state).toBe("REWARD");
    expect(w.relicReward.active).toBe(true);
    expect(w.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(w.objectiveRewardClaimedKey).toBe("0:TRIAL_COMPLETE");

    resolveActiveRewardTicket(w);
    w.relicReward.active = false;
    w.relicReward.options = [];
    w.state = "RUN";

    rewardRunEventProducerSystem(w, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(w);
    const started2 = rewardPresenterSystem(w);
    expect(started2).toBe(false);
    expect(w.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
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

  test("vendor/heal objectives grant gold and start relic reward UI", () => {
    const vendor = createRewardPipelineWorld(12, "NORMAL");
    vendor.floorArchetype = "VENDOR";
    vendor.objectiveStates = [{ id: "OBJ_VENDOR", status: "COMPLETED" }];
    rewardRunEventProducerSystem(vendor, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(vendor);
    expect(rewardPresenterSystem(vendor)).toBe(true);
    expect(vendor.relicReward.active).toBe(true);
    expect(vendor.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);

    const heal = createRewardPipelineWorld(13, "NORMAL");
    heal.floorArchetype = "HEAL";
    heal.objectiveStates = [{ id: "OBJ_HEAL", status: "COMPLETED" }];
    rewardRunEventProducerSystem(heal, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(heal);
    expect(rewardPresenterSystem(heal)).toBe(true);
    expect(heal.relicReward.active).toBe(true);
    expect(heal.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });
});
