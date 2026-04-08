import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { grantXp } from "../../../game/economy/xp";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";

describe("cluster jewel xp backend", () => {
  test("world starts with empty jewel state and zero skill points", () => {
    const world = createWorld({ seed: 31, stage: stageDocks });

    expect(world.clusterJewels).toEqual([]);
    expect(world.clusterJewelSkillPoints).toBe(0);
  });

  test("level gains accrue unspent cluster jewel skill points without reward tickets", () => {
    const world = createWorld({ seed: 32, stage: stageDocks });

    grantXp(world, 120);

    expect(world.run.xp).toBe(5);
    expect(world.run.level).toBe(6);
    expect(world.run.xpToNextLevel).toBe(40);
    expect(world.level).toBe(6);
    expect(world.clusterJewelSkillPoints).toBe(5);
    expect(world.runEvents).toEqual([
      { type: "LEVEL_UP", floorIndex: 0, level: 2 },
      { type: "LEVEL_UP", floorIndex: 0, level: 3 },
      { type: "LEVEL_UP", floorIndex: 0, level: 4 },
      { type: "LEVEL_UP", floorIndex: 0, level: 5 },
      { type: "LEVEL_UP", floorIndex: 0, level: 6 },
    ]);

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toEqual([]);
    expect(world.activeRewardTicketId).toBeNull();
    expect(world.relicReward.active).toBe(false);
  });
});
