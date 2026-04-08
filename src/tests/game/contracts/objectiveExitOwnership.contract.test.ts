import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { maybeStartFloorEndCountdown } from "../../../game/systems/progression/floorEndCountdown";
import { createFloorRewardBudget } from "../../../game/rewards/floorRewardBudget";
import { rewardRunEventProducerSystem } from "../../../game/systems/progression/rewardRunEventProducerSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";

describe("objective/exit ownership contract", () => {
  test("parallel completion flags are absent from world runtime state", () => {
    const world = createWorld({ seed: 1, stage: stageDocks });
    expect("zoneTrialObjective" in (world as any)).toBe(false);
    expect("bossRewardPending" in (world as any)).toBe(false);
  });

  test("exit countdown authority is objective completion, not chest state", () => {
    const world: any = {
      floorIndex: 1,
      runState: "FLOOR",
      objectiveStates: [{ status: "ACTIVE" }],
      chestOpenRequested: true,
      floorEndCountdownActive: false,
      floorEndCountdownSec: 0,
      floorEndCountdownStartedKey: null,
    };

    expect(maybeStartFloorEndCountdown(world)).toBe(false);
    world.objectiveStates[0].status = "COMPLETED";
    expect(maybeStartFloorEndCountdown(world)).toBe(true);
  });

  test("objective reward trigger does not treat chest state as objective completion", () => {
    const world: any = {
      state: "RUN",
      runState: "FLOOR",
      floorArchetype: "TIME_TRIAL",
      floorIndex: 0,
      timeSec: 0,
      chestOpenRequested: true,
      objectiveStates: [{ id: "OBJ_ZONE_TRIAL", status: "ACTIVE", progress: { signalCount: 0 } }],
      objectiveRewardClaimedKey: null,
      cardRewardClaimKeys: [],
      floorRewardBudget: createFloorRewardBudget("ZONE_TRIAL"),
      runEvents: [],
      rewardTickets: [],
      activeRewardTicketId: null,
      rewardTicketSeq: 0,
      cardReward: { active: false, source: "ZONE_TRIAL", options: [] },
      relicReward: { active: false, source: "OBJECTIVE_COMPLETION", options: [] },
      rng: { next: () => 0.5 },
    };

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardSchedulerSystem(world);
    expect(rewardPresenterSystem(world)).toBe(false);
    expect(world.cardReward.active).toBe(false);
    expect(world.relicReward.active).toBe(false);
  });
});
