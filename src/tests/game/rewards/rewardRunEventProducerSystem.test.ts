import { describe, expect, test } from "vitest";
import { ENEMY_TYPE } from "../../../game/factories/enemyFactory";
import { rewardRunEventProducerSystem } from "../../../game/systems/progression/rewardRunEventProducerSystem";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";
import { createRewardPipelineWorld } from "./rewardPipeline.testUtils";
import { makeUnknownDamageMeta } from "../../../game/combat/damageMeta";

describe("rewardRunEventProducerSystem", () => {
  test("emits boss milestone from ENEMY_KILLED boss with boss-zone spawn trigger", () => {
    const world = createRewardPipelineWorld(91, "NORMAL");
    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 3,
      x: 0,
      y: 0,
      source: "OTHER",
      spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}1`,
      damageMeta: makeUnknownDamageMeta("TEST_REWARD_BOSS_KILL"),
    });
    world.eType[3] = ENEMY_TYPE.BOSS;

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });

    expect(world.runEvents).toEqual([
      {
        type: "BOSS_MILESTONE_CLEARED",
        floorIndex: 0,
        bossIndex: 1,
      },
    ]);
  });

  test("ignores non-boss kill events", () => {
    const world = createRewardPipelineWorld(92, "NORMAL");
    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 4,
      x: 0,
      y: 0,
      source: "OTHER",
      spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}1`,
      damageMeta: makeUnknownDamageMeta("TEST_REWARD_NON_BOSS_KILL"),
    });
    world.eType[4] = ENEMY_TYPE.CHASER;

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    expect(world.runEvents).toHaveLength(0);
  });

  test("boss milestones are based on kill order, not zone id", () => {
    const world = createRewardPipelineWorld(96, "NORMAL");
    world.eType[1] = ENEMY_TYPE.BOSS;
    world.eType[2] = ENEMY_TYPE.BOSS;
    world.events.push(
      {
        type: "ENEMY_KILLED",
        enemyIndex: 1,
        x: 0,
        y: 0,
        source: "OTHER",
        spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}2`,
        damageMeta: makeUnknownDamageMeta("TEST_REWARD_BOSS_KILL_1"),
      },
      {
        type: "ENEMY_KILLED",
        enemyIndex: 2,
        x: 0,
        y: 0,
        source: "OTHER",
        spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}3`,
        damageMeta: makeUnknownDamageMeta("TEST_REWARD_BOSS_KILL_2"),
      },
    );

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });

    expect(world.runEvents).toEqual([
      { type: "BOSS_MILESTONE_CLEARED", floorIndex: 0, bossIndex: 1 },
      { type: "BOSS_MILESTONE_CLEARED", floorIndex: 0, bossIndex: 2 },
    ]);
  });

  test("objective completion edge emits once", () => {
    const world = createRewardPipelineWorld(93, "ZONE_TRIAL");
    world.objectiveStates = [{ id: "OBJ_ZONE_TRIAL", status: "COMPLETED" }];

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });

    expect(world.runEvents).toHaveLength(1);
    expect(world.runEvents[0]).toMatchObject({
      type: "OBJECTIVE_COMPLETED",
      objectiveId: "OBJ_ZONE_TRIAL",
      floorIndex: 0,
    });
  });

  test("survive 60-second milestone emits once per floor", () => {
    const world = createRewardPipelineWorld(94, "SURVIVE_TRIAL");
    world.timeSec = 60;

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });

    expect(world.runEvents).toEqual([
      {
        type: "SURVIVE_MILESTONE",
        floorIndex: 0,
        seconds: 60,
      },
    ]);
  });

  test("chest open emits only when includeChest is true", () => {
    const world = createRewardPipelineWorld(95, "NORMAL");
    world.chestOpenRequested = true;

    rewardRunEventProducerSystem(world, { includeCoreFacts: false, includeChest: false });
    expect(world.runEvents).toHaveLength(0);
    expect(world.chestOpenRequested).toBe(true);

    rewardRunEventProducerSystem(world, { includeCoreFacts: false, includeChest: true });
    expect(world.runEvents).toEqual([
      {
        type: "CHEST_OPEN_REQUESTED",
        floorIndex: 0,
        chestKind: "BOSS",
      },
    ]);
    expect(world.chestOpenRequested).toBe(false);
  });
});
