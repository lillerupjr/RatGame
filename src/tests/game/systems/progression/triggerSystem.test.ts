import { describe, expect, test } from "vitest";
import { isBossZoneKillForTrigger } from "../../../../game/systems/progression/triggerSystem";

describe("triggerSystem boss-zone kill matching", () => {
  test("prefers ENEMY_KILLED.spawnTriggerId attribution when present", () => {
    const world = {
      eSpawnTriggerId: ["OBJ_BOSS_ZONE_1", "OBJ_BOSS_ZONE_2", undefined],
    } as any;

    expect(isBossZoneKillForTrigger(world, 2, "OBJ_BOSS_ZONE_1", "OBJ_BOSS_ZONE_1")).toBe(true);
    expect(isBossZoneKillForTrigger(world, 0, "OBJ_BOSS_ZONE_2", "OBJ_BOSS_ZONE_1")).toBe(false);
  });

  test("falls back to world spawn trigger ownership for compatibility", () => {
    const world = {
      eSpawnTriggerId: ["OBJ_BOSS_ZONE_1", "OBJ_BOSS_ZONE_2", undefined],
    } as any;

    expect(isBossZoneKillForTrigger(world, 0, "OBJ_BOSS_ZONE_1")).toBe(true);
    expect(isBossZoneKillForTrigger(world, 1, "OBJ_BOSS_ZONE_1")).toBe(false);
    expect(isBossZoneKillForTrigger(world, 2, "OBJ_BOSS_ZONE_1")).toBe(false);
  });
});
