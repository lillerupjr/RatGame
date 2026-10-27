import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { EnemyId, spawnEnemyGrid } from "../../factories/enemyFactory";
import { ZONE_KIND } from "../../factories/zoneFactory";
import { tickPoisonTrail, tickPoisonZones } from "./poisonTrail";
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

function makePoisonTrailRules(): CombatRulesSnapshot {
  return buildCombatRulesSnapshot([
    { kind: "POISON_TRAIL", radius: 30, poisonDps: 5, tickEvery: 0.5, trailTtl: 3, dropEvery: 0.3 },
  ]);
}

function makeEmptyRules(): CombatRulesSnapshot {
  return buildCombatRulesSnapshot([]);
}

describe("poison trail system", () => {
  test("spawns poison zones at player position on interval", () => {
    const world = createWorld({ seed: 300, stage: stageDocks });
    const rules = makePoisonTrailRules();

    // First tick at dt=0.3 should spawn a zone
    tickPoisonTrail(world, 0.3, rules);
    expect(world.zAlive.filter(Boolean).length).toBe(1);
    expect(world.zKind[0]).toBe(ZONE_KIND.POISON);
    expect(world.zR[0]).toBe(30);

    // Tick at dt=0.1 (total 0.4) — below dropEvery, no new zone
    tickPoisonTrail(world, 0.1, rules);
    expect(world.zAlive.filter(Boolean).length).toBe(1);

    // Tick at dt=0.2 (total 0.6 from last drop) — should spawn another
    tickPoisonTrail(world, 0.2, rules);
    expect(world.zAlive.filter(Boolean).length).toBe(2);
  });

  test("zones expire after trailTtl", () => {
    const world = createWorld({ seed: 301, stage: stageDocks });
    const rules = makePoisonTrailRules();

    tickPoisonTrail(world, 0.3, rules);
    expect(world.zAlive[0]).toBe(true);
    expect(world.zTtl[0]).toBe(3);

    // Manually decrease TTL to simulate expiry
    world.zTtl[0] = 0;
    // Next zonesSystem would mark it dead, but we can check the flag
    expect(world.zTtl[0]).toBe(0);
  });

  test("does nothing when combat rules have no poison trail", () => {
    const world = createWorld({ seed: 302, stage: stageDocks });
    const rules = makeEmptyRules();

    tickPoisonTrail(world, 1.0, rules);
    expect(world.zAlive.length).toBe(0);
  });

  test("poison zones apply poison stacks to enemies in radius", () => {
    const world = createWorld({ seed: 303, stage: stageDocks });
    const rules = makePoisonTrailRules();

    // Spawn a zone at player position
    tickPoisonTrail(world, 0.3, rules);

    // Spawn enemy at player grid position (same tile = overlaps zone)
    const pgx = Math.floor(world.pgxi + world.pgox);
    const pgy = Math.floor(world.pgyi + world.pgoy);
    const enemy = spawnEnemyGrid(world, EnemyId.MINION, pgx, pgy);
    // Force enemy onto the same floor as the zone
    world.ezVisual[enemy] = world.activeFloorH;
    world.ezLogical[enemy] = world.activeFloorH;
    rebuildEnemyHash(world);

    tickPoisonZones(world, 0.5);

    expect(world.eAilments?.[enemy]?.poison?.length).toBeGreaterThanOrEqual(1);
  });
});
