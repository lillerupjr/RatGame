import { describe, expect, test } from "vitest";
import { createFloorRewardBudget } from "./floorRewardBudget";
import { handleRewardEvent } from "./rewardDirector";

describe("rewardDirector", () => {
  test("NORMAL: boss chests give no reward, objective gives progression reward", () => {
    const budget = createFloorRewardBudget("NORMAL");

    const c1 = handleRewardEvent(budget, { type: "CHEST_OPENED", chestKind: "BOSS" }, { depth: 1 });
    const obj = handleRewardEvent(budget, { type: "OBJECTIVE_COMPLETED" }, { depth: 1 });

    expect(c1.type).toBe("NO_REWARD");
    expect(obj).toEqual({
      type: "GRANT_PROGRESSION_REWARD",
      reason: "Objective completion grants progression reward",
    });
  });

  test("SURVIVE_TRIAL: milestone and chest give no reward, objective gives progression reward", () => {
    const budget = createFloorRewardBudget("SURVIVE_TRIAL");

    const t = handleRewardEvent(budget, { type: "SURVIVE_1MIN_REWARD" }, { depth: 2 });
    const chest = handleRewardEvent(budget, { type: "CHEST_OPENED", chestKind: "BOSS" }, { depth: 2 });
    const obj = handleRewardEvent(budget, { type: "OBJECTIVE_COMPLETED" }, { depth: 2 });

    expect(t.type).toBe("NO_REWARD");
    expect(chest.type).toBe("NO_REWARD");
    expect(obj.type).toBe("GRANT_PROGRESSION_REWARD");
  });

  test("ZONE_TRIAL: zone rewards disabled, objective gives progression reward", () => {
    const budget = createFloorRewardBudget("ZONE_TRIAL");

    const z1 = handleRewardEvent(budget, { type: "ZONE_COMPLETED", zoneIndex: 1 }, { depth: 1 });
    const z2 = handleRewardEvent(budget, { type: "ZONE_COMPLETED", zoneIndex: 2 }, { depth: 1 });
    const obj = handleRewardEvent(budget, { type: "OBJECTIVE_COMPLETED" }, { depth: 1 });

    expect(z1.type).toBe("NO_REWARD");
    expect(z2.type).toBe("NO_REWARD");
    expect(obj.type).toBe("GRANT_PROGRESSION_REWARD");
  });

  test("repeated zone/survive rewards remain no-op", () => {
    const z = createFloorRewardBudget("ZONE_TRIAL");
    expect(handleRewardEvent(z, { type: "ZONE_COMPLETED", zoneIndex: 1 }, { depth: 1 }).type).toBe("NO_REWARD");
    expect(handleRewardEvent(z, { type: "ZONE_COMPLETED", zoneIndex: 1 }, { depth: 1 }).type).toBe("NO_REWARD");

    const s = createFloorRewardBudget("SURVIVE_TRIAL");
    expect(handleRewardEvent(s, { type: "SURVIVE_1MIN_REWARD" }, { depth: 1 }).type).toBe("NO_REWARD");
    expect(handleRewardEvent(s, { type: "SURVIVE_1MIN_REWARD" }, { depth: 1 }).type).toBe("NO_REWARD");
  });
});
