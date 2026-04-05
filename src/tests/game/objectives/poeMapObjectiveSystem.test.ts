import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { getAuthoredMapDefByMapId } from "../../../game/map/authored/authoredMapRegistry";
import { activateMapDef, getActiveMap } from "../../../game/map/authoredMapActivation";
import {
  getPoeMapObjectiveDebugSnapshot,
  getPoeMapObjectiveProgress,
  initializePoeMapObjective,
  isPoeEnemyDormant,
  POE_MAP_PACK_TEMPLATES,
  tickPoeMapObjective,
} from "../../../game/objectives/poeMapObjectiveSystem";
import { EnemyId } from "../../../game/content/enemies";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";
import { getEnemyWorld } from "../../../game/coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { anchorFromWorld } from "../../../game/coords/anchor";
import { isEnemyHit } from "../../../game/systems/sim/hitDetection";
import { spawnProjectile, PRJ_KIND } from "../../../game/factories/projectileFactory";
import { spawnZone, ZONE_KIND } from "../../../game/factories/zoneFactory";
import { tickZonesOnce } from "../../../game/systems/sim/zones";
import { createEnemyAilmentsState } from "../../../game/combat_mods/ailments/enemyAilments";
import { tickAilmentsOnce } from "../../../game/combat_mods/systems/ailmentTickSystem";
import { getPlayerWorld } from "../../../game/coords/worldViews";
import { tickBeamContactsOnce, updatePlayerBeamCombat } from "../../../game/systems/sim/beamCombat";

function setupWorld(seed: number) {
  const world = createWorld({ seed, stage: stageDocks });
  const map = getAuthoredMapDefByMapId("DOCKS");
  expect(map).toBeTruthy();
  if (!map) throw new Error("missing docks map");
  activateMapDef(map, seed);
  world.currentObjectiveSpec = {
    objectiveType: "POE_MAP_CLEAR",
    params: { clearCount: 1 },
  };
  world.currentFloorIntent = {
    nodeId: `poe-test-${seed}`,
    zoneId: "DOCKS",
    depth: 1,
    floorIndex: 0,
    archetype: "SURVIVE",
    objectiveId: "POE_MAP_CLEAR",
  };
  return world;
}

describe("poe map template library", () => {
  test("matches v1 template library and excludes loot goblin", () => {
    const byId = new Map(POE_MAP_PACK_TEMPLATES.map((t) => [t.id, t]));
    expect(byId.size).toBe(6);

    expect(byId.get("chaser_swarm")).toMatchObject({ weight: 20, allowMagic: true, allowRareLeader: false });
    expect(byId.get("chaser_swarm")?.members).toEqual([{ type: EnemyId.MINION, min: 4, max: 6 }]);

    expect(byId.get("runner_swarm")).toMatchObject({ weight: 12, allowMagic: true, allowRareLeader: false });
    expect(byId.get("runner_swarm")?.members).toEqual([{ type: EnemyId.RUNNER, min: 5, max: 7 }]);

    expect(byId.get("bruiser_frontline")).toMatchObject({ weight: 10, allowMagic: true, allowRareLeader: true });
    expect(byId.get("bruiser_frontline")?.members).toEqual([
      { type: EnemyId.TANK, min: 2, max: 3 },
      { type: EnemyId.MINION, min: 2, max: 4 },
    ]);

    expect(byId.get("ratchemist_support")).toMatchObject({ weight: 8, allowMagic: true, allowRareLeader: true });
    expect(byId.get("ratchemist_support")?.members).toEqual([
      { type: EnemyId.SPITTER, min: 1, max: 1 },
      { type: EnemyId.MINION, min: 3, max: 5 },
    ]);

    expect(byId.get("leaper1_guard")).toMatchObject({ weight: 5, allowMagic: true, allowRareLeader: true });
    expect(byId.get("leaper1_guard")?.members).toEqual([
      { type: EnemyId.LEAPER1, min: 1, max: 1 },
      { type: EnemyId.TANK, min: 2, max: 3 },
    ]);

    expect(byId.get("abomination_pack")).toMatchObject({ weight: 3, allowMagic: false, allowRareLeader: true });
    expect(byId.get("abomination_pack")?.members).toEqual([
      { type: EnemyId.BURSTER, min: 1, max: 1 },
      { type: EnemyId.MINION, min: 3, max: 4 },
    ]);
    expect(byId.has("loot_goblin_encounter")).toBe(false);
    for (const template of POE_MAP_PACK_TEMPLATES) {
      for (const member of template.members) {
        expect(member.type).not.toBe(EnemyId.LOOT_GOBLIN);
      }
    }
  });
});

describe("poe map population runtime", () => {
  test("respects per-chunk budget and spawns no act-boss actors or loot goblins", () => {
    const world = setupWorld(71_001);
    const { plan, totalPacks } = initializePoeMapObjective(world, { objectiveSeed: 71_001 });
    const activeMap = getActiveMap();
    expect(activeMap).toBeTruthy();
    if (!activeMap) throw new Error("missing active map");

    expect(totalPacks).toBeGreaterThan(0);
    expect(plan.packs.length).toBe(totalPacks);

    for (let i = 0; i < plan.packs.length; i++) {
      const pack = plan.packs[i];
      const chunkBudget = plan.chunkBudget[pack.chunkIndex] ?? 0;
      expect(pack.budgetCost).toBeLessThanOrEqual(chunkBudget + 1e-6);
      expect(activeMap.blockedTiles.has(`${pack.anchorTx},${pack.anchorTy}`)).toBe(false);
      for (let j = 0; j < pack.members.length; j++) {
        expect(pack.members[j].type).not.toBe(EnemyId.BOSS);
        expect(pack.members[j].type).not.toBe(EnemyId.LOOT_GOBLIN);
      }
    }

    for (let i = 0; i < world.eType.length; i++) {
      expect(world.eType[i]).not.toBe(EnemyId.LOOT_GOBLIN);
    }

    // Regression guard: PoE pack tile placement must map into in-bounds world positions.
    const minTx = activeMap.originTx;
    const minTy = activeMap.originTy;
    const maxTx = activeMap.originTx + activeMap.width - 1;
    const maxTy = activeMap.originTy + activeMap.height - 1;
    for (let i = 0; i < world.eAlive.length; i++) {
      if (!world.eAlive[i]) continue;
      const ew = getEnemyWorld(world, i, KENNEY_TILE_WORLD);
      const tx = Math.floor(ew.wx / KENNEY_TILE_WORLD);
      const ty = Math.floor(ew.wy / KENNEY_TILE_WORLD);
      expect(tx).toBeGreaterThanOrEqual(minTx);
      expect(tx).toBeLessThanOrEqual(maxTx);
      expect(ty).toBeGreaterThanOrEqual(minTy);
      expect(ty).toBeLessThanOrEqual(maxTy);
      expect(activeMap.blockedTiles.has(`${tx},${ty}`)).toBe(false);
    }
  });

  test("starts dormant, wakes on proximity, and emits clear signals", () => {
    const world = setupWorld(71_002);
    const { plan, totalPacks } = initializePoeMapObjective(world, { objectiveSeed: 71_002 });
    expect(totalPacks).toBeGreaterThan(0);

    const debugAtStart = getPoeMapObjectiveDebugSnapshot(world);
    expect(debugAtStart).toBeTruthy();
    expect(debugAtStart?.packCount).toBe(totalPacks);
    expect(debugAtStart?.aliveEnemies).toBeGreaterThan(0);
    expect(debugAtStart?.totalEnemies).toBeGreaterThan(0);
    expect(debugAtStart?.aliveEnemies).toBe(debugAtStart?.totalEnemies);
    expect(debugAtStart?.dormantEnemies).toBe(debugAtStart?.aliveEnemies);
    expect(debugAtStart?.aliveEnemyHp).toBeGreaterThan(0);
    expect(debugAtStart?.totalEnemyHp).toBeGreaterThan(0);
    expect(debugAtStart?.aliveEnemyHp).toBeLessThanOrEqual(debugAtStart?.totalEnemyHp ?? 0);
    expect(debugAtStart?.spentPopulationBudget).toBeGreaterThan(0);
    expect(debugAtStart?.spentPopulationBudget).toBeLessThanOrEqual((debugAtStart?.totalPopulationBudget ?? 0) + 1e-6);
    expect(debugAtStart?.nearestPackDistanceTiles).not.toBeNull();

    expect(isPoeEnemyDormant(world, 0)).toBe(true);

    const firstPack = plan.packs[0];
    const packAnchorWorldX = (firstPack.anchorTx + 0.5) * KENNEY_TILE_WORLD;
    const packAnchorWorldY = (firstPack.anchorTy + 0.5) * KENNEY_TILE_WORLD;
    const playerAnchor = anchorFromWorld(packAnchorWorldX, packAnchorWorldY, KENNEY_TILE_WORLD);
    world.pgxi = playerAnchor.gxi;
    world.pgyi = playerAnchor.gyi;
    world.pgox = playerAnchor.gox;
    world.pgoy = playerAnchor.goy;

    tickPoeMapObjective(world);
    expect(isPoeEnemyDormant(world, 0)).toBe(false);

    const debugAfterWake = getPoeMapObjectiveDebugSnapshot(world);
    expect(debugAfterWake).toBeTruthy();
    expect(debugAfterWake?.combatPacks).toBeGreaterThan(0);

    for (let i = 0; i < world.eAlive.length; i++) {
      world.eAlive[i] = false;
    }
    world.triggerSignals.length = 0;
    tickPoeMapObjective(world);

    const clearSignals = world.triggerSignals.filter((s) => s.triggerId === OBJECTIVE_TRIGGER_IDS.poePackClear);
    expect(clearSignals.length).toBe(totalPacks);

    const progress = getPoeMapObjectiveProgress(world);
    expect(progress).toEqual({ cleared: totalPacks, total: totalPacks });
  });

  test("sleeping pack members ignore shared damage paths", () => {
    const world = setupWorld(71_003);
    initializePoeMapObjective(world, { objectiveSeed: 71_003 });

    const enemyIndex = world.eAlive.findIndex((alive) => alive);
    expect(enemyIndex).toBeGreaterThanOrEqual(0);
    expect(isPoeEnemyDormant(world, enemyIndex)).toBe(true);

    const ew = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
    const baseHp = world.eHp[enemyIndex];

    const projectileIndex = spawnProjectile(world, {
      kind: PRJ_KIND.PISTOL,
      x: ew.wx,
      y: ew.wy,
      dirX: 1,
      dirY: 0,
      speed: 0,
      damage: 999,
      radius: 8,
      pierce: 0,
      ttl: 1,
    });
    expect(isEnemyHit(world, projectileIndex, enemyIndex, 0, 0, world.eR[enemyIndex] + world.prR[projectileIndex])).toBe(false);

    spawnZone(world, {
      kind: ZONE_KIND.EXPLOSION,
      x: ew.wx,
      y: ew.wy,
      radius: 24,
      damage: 999,
      tickEvery: 0.2,
      ttl: 1,
      followPlayer: false,
    });
    tickZonesOnce(world, 0.2);
    expect(world.eHp[enemyIndex]).toBe(baseHp);
    expect(world.eAlive[enemyIndex]).toBe(true);

    world.eAilments ??= [];
    world.eAilments[enemyIndex] = createEnemyAilmentsState();
    world.eAilments[enemyIndex]!.poison.push({ kind: "poison", dps: 999, tLeft: 10 });
    tickAilmentsOnce(world, 0.5);
    expect(world.eHp[enemyIndex]).toBe(baseHp);
    expect(world.eAlive[enemyIndex]).toBe(true);

    const pw = getPlayerWorld(world, KENNEY_TILE_WORLD);
    updatePlayerBeamCombat(world, {
      dirX: ew.wx - pw.wx,
      dirY: ew.wy - pw.wy,
      maxRangePx: Math.hypot(ew.wx - pw.wx, ew.wy - pw.wy) + 16,
      widthPx: 48,
      glowIntensity: 0,
      dpsPhys: 999,
      dpsFire: 0,
      dpsChaos: 0,
    });
    tickBeamContactsOnce(world, 0.5);
    expect(world.eHp[enemyIndex]).toBe(baseHp);
    expect(world.eAlive[enemyIndex]).toBe(true);

    world.triggerSignals.length = 0;
    tickPoeMapObjective(world);
    const clearSignals = world.triggerSignals.filter((s) => s.triggerId === OBJECTIVE_TRIGGER_IDS.poePackClear);
    expect(clearSignals).toEqual([]);
    expect(getPoeMapObjectiveProgress(world)?.cleared).toBe(0);
  });
});
