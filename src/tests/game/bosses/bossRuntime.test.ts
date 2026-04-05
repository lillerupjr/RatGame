import { describe, expect, it } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { EnemyId } from "../../../game/content/enemies";
import { spawnBossEncounter } from "../../../game/bosses/spawnBossEncounter";
import {
  getBossDefinitionForEntity,
  getTrackedBossEncounterForObjective,
  isBossEntity,
  markBossEncounterDefeated,
} from "../../../game/bosses/bossRuntime";
import { BossId } from "../../../game/bosses/bossTypes";

describe("bossRuntime", () => {
  it("spawns boss encounters through the boss-owned runtime path", () => {
    const world = createWorld({ seed: 1001, stage: stageDocks });
    const result = spawnBossEncounter(world, {
      bossId: BossId.RAT_KING,
      spawnWorldX: 160,
      spawnWorldY: 224,
      objectiveId: "OBJ_ACT_BOSS",
    });

    expect(result.bossId).toBe(BossId.RAT_KING);
    expect(world.eType[result.enemyIndex]).toBe(EnemyId.BOSS);
    expect(world.eBossId[result.enemyIndex]).toBe(BossId.RAT_KING);
    expect(isBossEntity(world, result.enemyIndex)).toBe(true);
    expect(getBossDefinitionForEntity(world, result.enemyIndex)?.name).toBe("Rat King");
    expect(getTrackedBossEncounterForObjective(world, "OBJ_ACT_BOSS")).toMatchObject({
      id: result.encounterId,
      bossId: BossId.RAT_KING,
      enemyIndex: result.enemyIndex,
      status: "ACTIVE",
    });
  });

  it("marks the tracked boss encounter defeated through boss runtime lifecycle", () => {
    const world = createWorld({ seed: 1002, stage: stageDocks });
    const result = spawnBossEncounter(world, {
      bossId: BossId.RAT_KING,
      spawnWorldX: 96,
      spawnWorldY: 96,
      objectiveId: "OBJ_ACT_BOSS",
    });

    markBossEncounterDefeated(world, result.enemyIndex);

    expect(getTrackedBossEncounterForObjective(world, "OBJ_ACT_BOSS")?.status).toBe("DEFEATED");
    expect(world.bossRuntime.activeEncounterId).toBeNull();
  });
});
