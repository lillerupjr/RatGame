import { describe, expect, it } from "vitest";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { createWorld } from "../../../engine/world/world";
import { anchorFromWorld } from "../../../game/coords/anchor";
import { getEnemyWorld } from "../../../game/coords/worldViews";
import jsonBoss1Map from "../../../game/map/authored/maps/jsonMaps/boss1.json";
import { worldToTile } from "../../../game/map/compile/kenneyMap";
import { compileKenneyMapFromTable } from "../../../game/map/compile/kenneyMapLoader";
import { activateMapDef } from "../../../game/map/authoredMapActivation";
import { loadTableMapDefFromJson } from "../../../game/map/formats/json/jsonMapLoader";
import { movementSystem } from "../../../game/systems/sim/movement";
import type { InputState } from "../../../game/systems/sim/input";
import { stageDocks } from "../../../game/content/stages";
import { EnemyId } from "../../../game/content/enemies";
import { bossEncounterSystem } from "../../../game/bosses/bossSystem";
import { spawnActBossEncounterFromActiveMap, spawnBossEncounter } from "../../../game/bosses/spawnBossEncounter";
import {
  getBossDefinitionForEntity,
  getTrackedBossEncounterForObjective,
  isBossEntity,
  markBossEncounterDefeated,
} from "../../../game/bosses/bossRuntime";
import { BossId } from "../../../game/bosses/bossTypes";

const IDLE_INPUT: InputState = {
  moveX: 0,
  moveY: 0,
  moveMag: 0,
  up: false,
  down: false,
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  interact: false,
  interactPressed: false,
};

describe("bossRuntime", () => {
  it("spawns boss encounters through the boss-owned runtime path", () => {
    const world = createWorld({ seed: 1001, stage: stageDocks });
    const result = spawnBossEncounter(world, {
      bossId: BossId.CHEM_GUY,
      spawnWorldX: 160,
      spawnWorldY: 224,
      objectiveId: "OBJ_ACT_BOSS",
    });

    expect(result.bossId).toBe(BossId.CHEM_GUY);
    expect(world.eType[result.enemyIndex]).toBe(EnemyId.BOSS);
    expect(world.eBossId[result.enemyIndex]).toBe(BossId.CHEM_GUY);
    expect(isBossEntity(world, result.enemyIndex)).toBe(true);
    expect(getBossDefinitionForEntity(world, result.enemyIndex)?.name).toBe("Chem Guy");
    expect(getTrackedBossEncounterForObjective(world, "OBJ_ACT_BOSS")).toMatchObject({
      id: result.encounterId,
      bossId: BossId.CHEM_GUY,
      enemyIndex: result.enemyIndex,
      status: "ACTIVE",
      activationState: "ACTIVE",
    });
  });

  it("marks the tracked boss encounter defeated through boss runtime lifecycle", () => {
    const world = createWorld({ seed: 1002, stage: stageDocks });
    const result = spawnBossEncounter(world, {
      bossId: BossId.CHEM_GUY,
      spawnWorldX: 96,
      spawnWorldY: 96,
      objectiveId: "OBJ_ACT_BOSS",
    });

    markBossEncounterDefeated(world, result.enemyIndex);

    expect(getTrackedBossEncounterForObjective(world, "OBJ_ACT_BOSS")?.status).toBe("DEFEATED");
    expect(world.bossRuntime.activeEncounterId).toBeNull();
  });

  it("uses authored boss_spawn from the active boss map", () => {
    const bossMap = loadTableMapDefFromJson(jsonBoss1Map, "boss1");
    activateMapDef(bossMap, 404);
    const world = createWorld({ seed: 1003, stage: stageDocks });

    const result = spawnActBossEncounterFromActiveMap(world, {
      bossId: BossId.CHEM_GUY,
      objectiveId: "OBJ_ACT_BOSS",
    });

    const tile = compileKenneyMapFromTable(bossMap).semanticData.bossSpawn;
    const enemyWorld = getEnemyWorld(world, result.enemyIndex, KENNEY_TILE_WORLD);
    const enemyTile = worldToTile(enemyWorld.wx, enemyWorld.wy, KENNEY_TILE_WORLD);
    expect(tile).toBeTruthy();
    expect(enemyTile.tx).toBe(tile?.tx);
    expect(enemyTile.ty).toBe(tile?.ty);
    expect(getTrackedBossEncounterForObjective(world, "OBJ_ACT_BOSS")?.activationState).toBe("DORMANT");
  });

  it("fails clearly when the active boss map is missing boss_spawn", () => {
    activateMapDef({
      id: "BOSS_MISSING_SPAWN",
      w: 4,
      h: 4,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [],
    }, 505);
    const world = createWorld({ seed: 1004, stage: stageDocks });

    expect(() => spawnActBossEncounterFromActiveMap(world, {
      bossId: BossId.CHEM_GUY,
      objectiveId: "OBJ_ACT_BOSS",
    })).toThrow(/missing required semantic boss_spawn/i);
  });

  it("keeps dormant bosses inert until the player enters engage range", () => {
    const world = createWorld({ seed: 1005, stage: stageDocks });
    const result = spawnBossEncounter(world, {
      bossId: BossId.CHEM_GUY,
      spawnWorldX: 640,
      spawnWorldY: 640,
      objectiveId: "OBJ_ACT_BOSS",
      activationState: "DORMANT",
    });

    const encounter = getTrackedBossEncounterForObjective(world, "OBJ_ACT_BOSS");
    expect(encounter?.activationState).toBe("DORMANT");

    const startX = world.egxi[result.enemyIndex] + world.egox[result.enemyIndex];
    const startY = world.egyi[result.enemyIndex] + world.egoy[result.enemyIndex];
    bossEncounterSystem(world, 1);
    movementSystem(world, { ...IDLE_INPUT }, 1);

    expect(encounter?.activationState).toBe("DORMANT");
    expect(encounter?.lastAbilityId).toBeNull();
    expect(world.egxi[result.enemyIndex] + world.egox[result.enemyIndex]).toBe(startX);
    expect(world.egyi[result.enemyIndex] + world.egoy[result.enemyIndex]).toBe(startY);

    const playerAnchor = anchorFromWorld(640, 640, KENNEY_TILE_WORLD);
    world.pgxi = playerAnchor.gxi;
    world.pgyi = playerAnchor.gyi;
    world.pgox = playerAnchor.gox;
    world.pgoy = playerAnchor.goy;

    bossEncounterSystem(world, 0.016);
    expect(encounter?.activationState).toBe("ACTIVE");
  });
});
