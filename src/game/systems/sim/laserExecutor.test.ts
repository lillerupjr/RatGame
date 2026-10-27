import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { EnemyId, spawnEnemyGrid } from "../../factories/enemyFactory";
import { tickLaserExecutor } from "./laserExecutor";
import { buildCombatRulesSnapshot, type CombatRulesSnapshot } from "../../progression/effects/combatRules";
import { clearSpatialHash, insertEntity } from "../../util/spatialHash";
import { getEnemyWorld } from "../../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";

function rebuildEnemyHash(world: ReturnType<typeof createWorld>): void {
  clearSpatialHash(world.enemySpatialHash);
  for (let i = 0; i < world.eAlive.length; i++) {
    if (!world.eAlive[i]) continue;
    const ew = getEnemyWorld(world, i, KENNEY_TILE_WORLD);
    insertEntity(world.enemySpatialHash, i, ew.wx, ew.wy, world.eR[i] ?? 0);
  }
}

function makeLaserRules(): CombatRulesSnapshot {
  return buildCombatRulesSnapshot([
    { kind: "LASER_EXECUTOR", thresholdFraction: 0.15, rangePx: 200, scanEvery: 1.5 },
  ]);
}

describe("laser executor system", () => {
  test("kills enemies below threshold within range", () => {
    const world = createWorld({ seed: 400, stage: stageDocks });
    const rules = makeLaserRules();

    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    world.eHpMax ??= [];
    world.eHpMax[enemy] = 100;
    world.eHp[enemy] = 10; // 10% — below 15% threshold
    rebuildEnemyHash(world);

    tickLaserExecutor(world, 1.5, rules);

    expect(world.eAlive[enemy]).toBe(false);
    expect(world.eHp[enemy]).toBe(0);
  });

  test("does not kill enemies above threshold", () => {
    const world = createWorld({ seed: 401, stage: stageDocks });
    const rules = makeLaserRules();

    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    world.eHpMax ??= [];
    world.eHpMax[enemy] = 100;
    world.eHp[enemy] = 50; // 50% — above 15% threshold
    rebuildEnemyHash(world);

    tickLaserExecutor(world, 1.5, rules);

    expect(world.eAlive[enemy]).toBe(true);
    expect(world.eHp[enemy]).toBe(50);
  });

  test("respects scan interval", () => {
    const world = createWorld({ seed: 402, stage: stageDocks });
    const rules = makeLaserRules();

    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    world.eHpMax ??= [];
    world.eHpMax[enemy] = 100;
    world.eHp[enemy] = 10;
    rebuildEnemyHash(world);

    // dt=0.5 < scanEvery=1.5, should not scan yet
    tickLaserExecutor(world, 0.5, rules);
    expect(world.eAlive[enemy]).toBe(true);

    // dt=0.5, total=1.0, still below
    tickLaserExecutor(world, 0.5, rules);
    expect(world.eAlive[enemy]).toBe(true);

    // dt=0.5, total=1.5, now should scan
    tickLaserExecutor(world, 0.5, rules);
    expect(world.eAlive[enemy]).toBe(false);
  });
});
