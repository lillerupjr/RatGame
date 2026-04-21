import { describe, expect, test } from "vitest";
import { resolveActiveRewardTicket } from "../../../game/rewards/rewardTickets";
import { OBJECTIVE_COMPLETION_GOLD } from "../../../game/rewards/rewardDirector";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld, dismissActiveRewardUi, getActiveTicket } from "./rewardPipeline.testUtils";

describe("zone-cleared reward scheduling", () => {
  test("records unique zone-clear claim keys without creating reward tickets", () => {
    const w = createRewardPipelineWorld(7, "ZONE_TRIAL");
    w.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 2 },
    );

    rewardSchedulerSystem(w);
    expect(w.rewardTickets).toHaveLength(0);
    expect(w.rewardClaimKeys).toEqual(["0:ZONE_CLEAR:1", "0:ZONE_CLEAR:2"]);
  });

  test("objective completion grants gold and a progression reward ticket", () => {
    const w = createRewardPipelineWorld(11, "ZONE_TRIAL");
    w.runEvents.push({ type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" });
    rewardSchedulerSystem(w);

    expect(w.rewardTickets).toHaveLength(1);
    expect(w.rewardTickets[0].family).toBe("RING");
    expect(w.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(w.objectiveRewardClaimedKey).toBe("0:TRIAL_COMPLETE");
  });

  test("zone trial sequence stays gold-plus-progression objective only", () => {
    const w = createRewardPipelineWorld(21, "ZONE_TRIAL");
    w.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 2 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" },
    );

    rewardSchedulerSystem(w);

    expect(rewardPresenterSystem(w)).toBe(true);
    expect(getActiveTicket(w)?.family).toBe("RING");
    dismissActiveRewardUi(w);
    resolveActiveRewardTicket(w);
    w.state = "RUN";

    expect(rewardPresenterSystem(w)).toBe(false);
    expect(w.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
  });
});
