import { describe, expect, test } from "vitest";
import { isRareZoneKillForTrigger } from "../../../../game/systems/progression/triggerSystem";

describe("triggerSystem rare-zone kill matching", () => {
  test("prefers ENEMY_KILLED.spawnTriggerId attribution when present", () => {
    const world = {
      eSpawnTriggerId: ["OBJ_RARE_ZONE_1", "OBJ_RARE_ZONE_2", undefined],
    } as any;

    expect(isRareZoneKillForTrigger(world, 2, "OBJ_RARE_ZONE_1", "OBJ_RARE_ZONE_1")).toBe(true);
    expect(isRareZoneKillForTrigger(world, 0, "OBJ_RARE_ZONE_2", "OBJ_RARE_ZONE_1")).toBe(false);
  });

  test("falls back to world spawn trigger ownership for compatibility", () => {
    const world = {
      eSpawnTriggerId: ["OBJ_RARE_ZONE_1", "OBJ_RARE_ZONE_2", undefined],
    } as any;

    expect(isRareZoneKillForTrigger(world, 0, "OBJ_RARE_ZONE_1")).toBe(true);
    expect(isRareZoneKillForTrigger(world, 1, "OBJ_RARE_ZONE_1")).toBe(false);
    expect(isRareZoneKillForTrigger(world, 2, "OBJ_RARE_ZONE_1")).toBe(false);
  });
});
