import { describe, expect, test } from "vitest";
import { resolveActiveRewardTicket } from "../../../game/rewards/rewardTickets";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld, dismissActiveRewardUi, getActiveTicket } from "./rewardPipeline.testUtils";

describe("zone-cleared reward scheduling", () => {
  test("creates one card reward per unique zone clear", () => {
    const w = createRewardPipelineWorld(7, "ZONE_TRIAL");
    w.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 2 },
    );

    rewardSchedulerSystem(w);
    expect(w.rewardTickets).toHaveLength(2);
    expect(w.cardRewardClaimKeys).toEqual(["0:ZONE_CLEAR:1", "0:ZONE_CLEAR:2"]);
  });

  test("objective completion still schedules relic reward", () => {
    const w = createRewardPipelineWorld(11, "ZONE_TRIAL");
    w.runEvents.push({ type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" });
    rewardSchedulerSystem(w);

    expect(w.rewardTickets).toHaveLength(1);
    expect(w.rewardTickets[0].kind).toBe("RELIC_PICK");
    expect(w.objectiveRewardClaimedKey).toBe("0:TRIAL_COMPLETE");
  });

  test("zone trial sequence stays zone1 card, zone2 card, objective relic", () => {
    const w = createRewardPipelineWorld(21, "ZONE_TRIAL");
    w.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 2 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" },
    );

    rewardSchedulerSystem(w);

    expect(rewardPresenterSystem(w)).toBe(true);
    expect(getActiveTicket(w)?.kind).toBe("CARD_PICK");
    dismissActiveRewardUi(w);
    resolveActiveRewardTicket(w);
    w.state = "RUN";

    expect(rewardPresenterSystem(w)).toBe(true);
    expect(getActiveTicket(w)?.kind).toBe("CARD_PICK");
    dismissActiveRewardUi(w);
    resolveActiveRewardTicket(w);
    w.state = "RUN";

    expect(rewardPresenterSystem(w)).toBe(true);
    expect(getActiveTicket(w)?.kind).toBe("RELIC_PICK");
  });
});
