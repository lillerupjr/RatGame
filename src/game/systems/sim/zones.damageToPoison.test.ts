import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { EnemyId, spawnEnemyGrid } from "../../factories/enemyFactory";
import { clearSpatialHash, insertEntity } from "../../util/spatialHash";
import { getEnemyWorld, getPlayerWorld } from "../../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";
import { tickZonesOnce, zonesSystem } from "./zones";
import { makeEnemyHitMeta } from "../../combat/damageMeta";
import { DOT_TICK_INTERVAL_SEC } from "../../combat/dot/dotConstants";

function rebuildEnemyHash(world: ReturnType<typeof createWorld>): void {
  clearSpatialHash(world.enemySpatialHash);
  for (let i = 0; i < world.eAlive.length; i++) {
    if (!world.eAlive[i]) continue;
    const ew = getEnemyWorld(world, i, KENNEY_TILE_WORLD);
    insertEntity(world.enemySpatialHash, i, ew.wx, ew.wy, world.eR[i] ?? 0);
  }
}

describe("zonesSystem damage-to-poison behavior", () => {
  test("PASS_DAMAGE_TO_POISON_ALL does not auto-apply poison from zone damage", () => {
    const w = createWorld({ seed: 46, stage: stageDocks });
    w.relics = ["PASS_DAMAGE_TO_POISON_ALL"];
    const enemy = spawnEnemyGrid(w, EnemyId.MINION, 8, 8);
    w.eHpMax[enemy] = 200;
    w.eHp[enemy] = 200;

    rebuildEnemyHash(w);
    const ew = getEnemyWorld(w, enemy, KENNEY_TILE_WORLD);
    spawnZone(w, {
      kind: ZONE_KIND.FIRE,
      x: ew.wx,
      y: ew.wy,
      radius: 80,
      damage: 20,
      tickEvery: 0.1,
      ttl: 2.0,
      followPlayer: false,
    });

    zonesSystem(w, 0.11);
    tickZonesOnce(w, DOT_TICK_INTERVAL_SEC);

    expect(w.eHp[enemy]).toBeCloseTo(180, 6);
    const poisonStacks = w.eAilments?.[enemy]?.poison ?? [];
    expect(poisonStacks.length).toBe(0);
  });

  test("boss hazard player damage emits PLAYER_HIT with ENEMY cause metadata", () => {
    const w = createWorld({ seed: 47, stage: stageDocks });
    const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);

    spawnZone(w, {
      kind: ZONE_KIND.HAZARD,
      x: pw.wx,
      y: pw.wy,
      radius: 80,
      damage: 0,
      damagePlayer: 12,
      tickEvery: 0.1,
      ttl: 1,
      followPlayer: false,
      playerDamageMeta: makeEnemyHitMeta("BOSS", "TEST_BOSS_HAZARD", {
        category: "DOT",
        instigatorId: "boss_test",
      }),
    });

    zonesSystem(w, 0.11);
    tickZonesOnce(w, DOT_TICK_INTERVAL_SEC);

    const playerHit = w.events.find((ev) => ev.type === "PLAYER_HIT");
    expect(playerHit?.type).toBe("PLAYER_HIT");
    if (!playerHit || playerHit.type !== "PLAYER_HIT") return;

    expect(playerHit.damageMeta.category).toBe("DOT");
    expect(playerHit.damageMeta.cause.kind).toBe("ENEMY");
    if (playerHit.damageMeta.cause.kind === "ENEMY") {
      expect(playerHit.damageMeta.cause.enemyTypeId).toBe("BOSS");
      expect(playerHit.damageMeta.cause.attackId).toBe("TEST_BOSS_HAZARD");
      expect(playerHit.damageMeta.cause.mode).toBe("INTRINSIC");
    }
    expect(playerHit.damageMeta.instigator.actor).toBe("ENEMY");
    expect(playerHit.damageMeta.instigator.id).toBe("boss_test");
    expect(playerHit.damageMeta.isProcDamage === true).toBe(false);
  });

  test("enemy zone damage gates by logical floor, not visual ramp height", () => {
    const w = createWorld({ seed: 48, stage: stageDocks });
    const enemy = spawnEnemyGrid(w, EnemyId.MINION, 9, 9);
    w.eHpMax[enemy] = 100;
    w.eHp[enemy] = 100;

    // Simulate a staircase/ramp frame where visual z has not yet matched logical floor.
    w.activeFloorH = 1;
    w.ezVisual[enemy] = 0.2;
    w.ezLogical[enemy] = 1;

    rebuildEnemyHash(w);
    const ew = getEnemyWorld(w, enemy, KENNEY_TILE_WORLD);
    spawnZone(w, {
      kind: ZONE_KIND.FIRE,
      x: ew.wx,
      y: ew.wy,
      radius: 64,
      damage: 10,
      tickEvery: 0.1,
      ttl: 1,
      followPlayer: false,
    });

    zonesSystem(w, 0.11);
    tickZonesOnce(w, DOT_TICK_INTERVAL_SEC);

    expect(w.eHp[enemy]).toBeCloseTo(90, 6);
  });
});
