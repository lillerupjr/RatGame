import { describe, expect, test } from "vitest";
import { createFloorRewardBudget } from "./floorRewardBudget";
import { handleRewardEvent } from "./rewardDirector";

describe("rewardDirector", () => {
  test("NORMAL: first two boss chests give cards, third gives gold, objective gives reserved card", () => {
    const budget = createFloorRewardBudget("NORMAL");

    const c1 = handleRewardEvent(budget, { type: "CHEST_OPENED", chestKind: "BOSS" }, { depth: 1 });
    const c2 = handleRewardEvent(budget, { type: "CHEST_OPENED", chestKind: "BOSS" }, { depth: 1 });
    const c3 = handleRewardEvent(budget, { type: "CHEST_OPENED", chestKind: "BOSS" }, { depth: 1 });
    const obj = handleRewardEvent(budget, { type: "OBJECTIVE_COMPLETED" }, { depth: 1 });

    expect(c1.type).toBe("GRANT_CARD");
    expect(c2.type).toBe("GRANT_CARD");
    expect(c3.type).toBe("GRANT_GOLD");
    expect(obj.type).toBe("GRANT_CARD");
  });

  test("SURVIVE_TRIAL: 1min then chest then objective => 3 cards", () => {
    const budget = createFloorRewardBudget("SURVIVE_TRIAL");

    const t = handleRewardEvent(budget, { type: "SURVIVE_1MIN_REWARD" }, { depth: 2 });
    const chest = handleRewardEvent(budget, { type: "CHEST_OPENED", chestKind: "BOSS" }, { depth: 2 });
    const obj = handleRewardEvent(budget, { type: "OBJECTIVE_COMPLETED" }, { depth: 2 });

    expect(t.type).toBe("GRANT_CARD");
    expect(chest.type).toBe("GRANT_CARD");
    expect(obj.type).toBe("GRANT_CARD");
  });

  test("ZONE_TRIAL: zone1 + zone2 + objective => 3 cards", () => {
    const budget = createFloorRewardBudget("ZONE_TRIAL");

    const z1 = handleRewardEvent(budget, { type: "ZONE_COMPLETED", zoneIndex: 1 }, { depth: 1 });
    const z2 = handleRewardEvent(budget, { type: "ZONE_COMPLETED", zoneIndex: 2 }, { depth: 1 });
    const obj = handleRewardEvent(budget, { type: "OBJECTIVE_COMPLETED" }, { depth: 1 });

    expect(z1.type).toBe("GRANT_CARD");
    expect(z2.type).toBe("GRANT_CARD");
    expect(obj.type).toBe("GRANT_CARD");
  });

  test("idempotency: repeated zone/survive rewards are no-op", () => {
    const z = createFloorRewardBudget("ZONE_TRIAL");
    expect(handleRewardEvent(z, { type: "ZONE_COMPLETED", zoneIndex: 1 }, { depth: 1 }).type).toBe("GRANT_CARD");
    expect(handleRewardEvent(z, { type: "ZONE_COMPLETED", zoneIndex: 1 }, { depth: 1 }).type).toBe("NO_REWARD");

    const s = createFloorRewardBudget("SURVIVE_TRIAL");
    expect(handleRewardEvent(s, { type: "SURVIVE_1MIN_REWARD" }, { depth: 1 }).type).toBe("GRANT_CARD");
    expect(handleRewardEvent(s, { type: "SURVIVE_1MIN_REWARD" }, { depth: 1 }).type).toBe("NO_REWARD");
  });
});
