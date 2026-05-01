import { describe, expect, test } from "vitest";
import { EnemyId } from "../../../game/factories/enemyFactory";
import { rewardRunEventProducerSystem } from "../../../game/systems/progression/rewardRunEventProducerSystem";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";
import { createRewardPipelineWorld } from "./rewardPipeline.testUtils";
import { makeUnknownDamageMeta } from "../../../game/combat/damageMeta";

describe("rewardRunEventProducerSystem", () => {
  test("emits a rare milestone from ENEMY_KILLED rare with rare-zone spawn trigger", () => {
    const world = createRewardPipelineWorld(91, "NORMAL");
    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 3,
      x: 0,
      y: 0,
      source: "OTHER",
      spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}1`,
      damageMeta: makeUnknownDamageMeta("TEST_REWARD_RARE_KILL"),
    });
    world.eType[3] = EnemyId.TANK;

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });

    expect(world.runEvents).toEqual([
      {
        type: "RARE_MILESTONE_CLEARED",
        floorIndex: 0,
        rareIndex: 1,
      },
    ]);
  });

  test("ignores kill events outside rare zones", () => {
    const world = createRewardPipelineWorld(92, "NORMAL");
    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 4,
      x: 0,
      y: 0,
      source: "OTHER",
      spawnTriggerId: "OBJ_ZONE_1",
      damageMeta: makeUnknownDamageMeta("TEST_REWARD_NON_RARE_ZONE_KILL"),
    });
    world.eType[4] = EnemyId.MINION;

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    expect(world.runEvents).toHaveLength(0);
  });

  test("rare milestones are based on kill order, not zone id", () => {
    const world = createRewardPipelineWorld(96, "NORMAL");
    world.eType[1] = EnemyId.TANK;
    world.eType[2] = EnemyId.LEAPER1;
    world.events.push(
      {
        type: "ENEMY_KILLED",
        enemyIndex: 1,
        x: 0,
        y: 0,
        source: "OTHER",
        spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}2`,
        damageMeta: makeUnknownDamageMeta("TEST_REWARD_RARE_KILL_1"),
      },
      {
        type: "ENEMY_KILLED",
        enemyIndex: 2,
        x: 0,
        y: 0,
        source: "OTHER",
        spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}3`,
        damageMeta: makeUnknownDamageMeta("TEST_REWARD_RARE_KILL_2"),
      },
    );

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });

    expect(world.runEvents).toEqual([
      { type: "RARE_MILESTONE_CLEARED", floorIndex: 0, rareIndex: 1 },
      { type: "RARE_MILESTONE_CLEARED", floorIndex: 0, rareIndex: 2 },
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
