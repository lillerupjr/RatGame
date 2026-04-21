import { describe, expect, test } from "vitest";
import { EnemyId } from "../../../game/factories/enemyFactory";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";
import { OBJECTIVE_COMPLETION_GOLD } from "../../../game/rewards/rewardDirector";
import { resolveActiveRewardTicket } from "../../../game/rewards/rewardTickets";
import { rewardPresenterSystem } from "../../../game/systems/progression/rewardPresenterSystem";
import { rewardRunEventProducerSystem } from "../../../game/systems/progression/rewardRunEventProducerSystem";
import { rewardSchedulerSystem } from "../../../game/systems/progression/rewardSchedulerSystem";
import { createRewardPipelineWorld, dismissActiveRewardUi, getActiveTicket } from "./rewardPipeline.testUtils";
import { makeUnknownDamageMeta } from "../../../game/combat/damageMeta";

describe("reward pipeline stabilization", () => {
  test("rare-zone ENTER/EXIT do not create reward events or consume budget", () => {
    const world = createRewardPipelineWorld(81, "NORMAL");
    world.floorArchetype = "RARE_TRIPLE";
    world.triggerSignals.push(
      {
        type: "ENTER",
        entityId: 0,
        triggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}1`,
      },
      {
        type: "EXIT",
        entityId: 0,
        triggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}1`,
      },
    );

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
    expect(world.runEvents).toHaveLength(0);
    expect(world.triggerSignals).toHaveLength(2);

    rewardSchedulerSystem(world);
    expect(world.rewardTickets).toHaveLength(0);
    expect(world.floorRewardBudget.nonObjectiveRewardsRemaining).toBe(0);
  });

  test("rare-zone KILL creates exactly one rare milestone event", () => {
    const world = createRewardPipelineWorld(82, "NORMAL");
    world.floorArchetype = "RARE_TRIPLE";
    world.eType[7] = EnemyId.TANK;
    world.eSpawnTriggerId[7] = `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}1`;
    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 7,
      x: 0,
      y: 0,
      source: "OTHER",
      damageMeta: makeUnknownDamageMeta("TEST_REWARD_PIPELINE_RARE_KILL"),
    });

    rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });

    expect(world.runEvents).toHaveLength(1);
    expect(world.runEvents[0]).toMatchObject({
      type: "RARE_MILESTONE_CLEARED",
      rareIndex: 1,
      floorIndex: 0,
    });
  });

  test("RARE_TRIPLE chest open does not enqueue reward tickets", () => {
    const world = createRewardPipelineWorld(83, "NORMAL");
    world.floorArchetype = "RARE_TRIPLE";
    world.runEvents.push({
      type: "CHEST_OPEN_REQUESTED",
      floorIndex: 0,
      chestKind: "BOSS",
    });

    rewardSchedulerSystem(world);

    expect(world.rewardTickets).toHaveLength(0);
    expect(world.rewardClaimKeys).toContain("0:BOSS_CHEST");
    expect(world.floorRewardBudget.nonObjectiveRewardsRemaining).toBe(0);
  });

  test("zone trial sequence is objective progression plus gold only", () => {
    const world = createRewardPipelineWorld(84, "ZONE_TRIAL");
    world.runEvents.push(
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 1 },
      { type: "ZONE_CLEARED", floorIndex: 0, zoneIndex: 2 },
      { type: "OBJECTIVE_COMPLETED", floorIndex: 0, objectiveId: "OBJ_ZONE_TRIAL" },
    );

    rewardSchedulerSystem(world);
    expect(world.rewardTickets).toHaveLength(1);

    const families: string[] = [];
    for (let i = 0; i < 1; i++) {
      expect(rewardPresenterSystem(world)).toBe(true);
      families.push(getActiveTicket(world)?.family ?? "");
      dismissActiveRewardUi(world);
      resolveActiveRewardTicket(world);
      world.state = "RUN";
    }

    expect(families).toEqual(["RING"]);
    expect(world.run.runGold).toBe(OBJECTIVE_COMPLETION_GOLD);
    expect(rewardPresenterSystem(world)).toBe(false);
  });
});
