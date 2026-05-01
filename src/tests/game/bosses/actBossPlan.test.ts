import { describe, expect, it } from "vitest";
import {
  ACT_BOSS_MAP_POOL,
  ACT_BOSS_POOL,
  buildActBossPlan,
  resolveActBossMapOverride,
} from "../../../game/bosses/actBossPlan";

describe("actBossPlan", () => {
  it("resolves a valid authored map override directly by map name", () => {
    expect(resolveActBossMapOverride(" downtown ")).toBe("downtown");
  });

  it("ignores invalid map overrides", () => {
    expect(resolveActBossMapOverride("definitely_not_a_map")).toBeNull();
  });

  it("selects boss and map from the authored pools", () => {
    const plan = buildActBossPlan(12345, 6);

    expect(ACT_BOSS_POOL.some((entry) => entry.bossId === plan.bossId)).toBe(true);
    expect(ACT_BOSS_MAP_POOL.some((entry) => entry.mapId === plan.mapId)).toBe(true);
  });

  it("applies the explicit map override when it is valid", () => {
    const plan = buildActBossPlan(777, 4, "industrial");
    expect(plan.mapId).toBe("industrial");
  });

  it("falls back to the authored pool when the override is invalid", () => {
    const plan = buildActBossPlan(888, 4, "not_a_real_map");
    expect(plan.mapId).not.toBe("not_a_real_map");
    expect(ACT_BOSS_MAP_POOL.some((entry) => entry.mapId === plan.mapId)).toBe(true);
  });
});
