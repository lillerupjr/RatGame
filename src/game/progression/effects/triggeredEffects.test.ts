import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { EnemyId, spawnEnemyGrid } from "../../factories/enemyFactory";
import { PRJ_KIND } from "../../factories/projectileFactory";
import { equipRing } from "../rings/ringState";
import { processProgressionTriggeredEffects } from "./triggeredEffects";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getEnemyWorld } from "../../coords/worldViews";
import { clearSpatialHash, insertEntity } from "../../util/spatialHash";
import { makeWeaponHitMeta } from "../../combat/damageMeta";
import { applyIgniteStacked } from "../../combat_mods/ailments/enemyAilments";
import { getEnemyAimWorld } from "../../combat/aimPoints";

function rebuildEnemyHash(world: ReturnType<typeof createWorld>): void {
  clearSpatialHash(world.enemySpatialHash);
  for (let i = 0; i < world.eAlive.length; i++) {
    if (!world.eAlive[i]) continue;
    const enemyWorld = getEnemyWorld(world, i, KENNEY_TILE_WORLD);
    insertEntity(world.enemySpatialHash, i, enemyWorld.wx, enemyWorld.wy, world.eR[i] ?? 0);
  }
}

function forceRolls(world: ReturnType<typeof createWorld>, values: number[]): void {
  const queue = [...values];
  (world.rng as any).range = () => queue.shift() ?? 0;
}

function playerHitEvent(enemyIndex: number, damage: number, x: number, y: number, isCrit = false) {
  return {
    type: "ENEMY_HIT" as const,
    enemyIndex,
    damage,
    dmgPhys: damage,
    dmgFire: 0,
    dmgChaos: 0,
    x,
    y,
    isCrit,
    damageMeta: makeWeaponHitMeta("test-weapon", { category: "HIT", instigatorId: "player", isProcDamage: false }),
  };
}

function playerKillEvent(enemyIndex: number, x: number, y: number, damage = 10) {
  return {
    type: "ENEMY_KILLED" as const,
    enemyIndex,
    damage,
    dmgPhys: damage,
    dmgFire: 0,
    dmgChaos: 0,
    x,
    y,
    isCrit: false,
    damageMeta: makeWeaponHitMeta("test-weapon", { category: "HIT", instigatorId: "player", isProcDamage: false }),
  };
}

describe("progression triggered effects", () => {
  test("Street Reflex spawns a knife at a nearby enemy", () => {
    const world = createWorld({ seed: 101, stage: stageDocks });
    equipRing(world, "RING_STARTER_STREET_REFLEX", "LEFT:0");
    forceRolls(world, [0]);

    const a = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const b = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);
    const bw = getEnemyAimWorld(world, b);

    world.events.push(playerHitEvent(a, 24, aw.wx, aw.wy));
    processProgressionTriggeredEffects(world);

    const knifeIndex = world.prjKind.findIndex((kind) => kind === PRJ_KIND.KNIFE);
    expect(knifeIndex).toBeGreaterThanOrEqual(0);
    expect(world.prTargetX[knifeIndex]).toBeCloseTo(bw.x, 6);
  });

  test("double triggers duplicates a successful proc", () => {
    const world = createWorld({ seed: 102, stage: stageDocks });
    equipRing(world, "RING_STARTER_STREET_REFLEX", "LEFT:0");
    equipRing(world, "RING_TRIGGER_DOUBLE_TRIGGERS", "LEFT:1");
    forceRolls(world, [0]);

    const a = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const b = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);

    world.events.push(playerHitEvent(a, 24, aw.wx, aw.wy));
    processProgressionTriggeredEffects(world);

    expect(world.prjKind.filter((kind) => kind === PRJ_KIND.KNIFE)).toHaveLength(2);
  });

  test("retry failed procs once rerolls trigger chance", () => {
    const world = createWorld({ seed: 103, stage: stageDocks });
    equipRing(world, "RING_TRIGGER_SPARK_ON_HIT", "LEFT:0");
    equipRing(world, "RING_TRIGGER_RETRY_FAILED_PROCS_ONCE", "LEFT:1");
    forceRolls(world, [0.9, 0.0]);

    const a = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const b = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);
    void b;

    world.events.push(playerHitEvent(a, 24, aw.wx, aw.wy));
    processProgressionTriggeredEffects(world);

    expect(world.prjKind.filter((kind) => kind === PRJ_KIND.SPARK)).toHaveLength(1);
  });

  test("trigger proc chance increase scales authored proc rates", () => {
    const world = createWorld({ seed: 1031, stage: stageDocks });
    equipRing(world, "RING_TRIGGER_SPARK_ON_HIT", "LEFT:0");
    equipRing(world, "RING_TRIGGER_PROC_CHANCE_PERCENT_50", "LEFT:1");
    forceRolls(world, [0.29]);

    const a = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const b = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);
    void b;

    world.events.push(playerHitEvent(a, 24, aw.wx, aw.wy));
    processProgressionTriggeredEffects(world);

    expect(world.prjKind.filter((kind) => kind === PRJ_KIND.SPARK)).toHaveLength(1);
  });

  test("Bazooka on Hit spawns a missile dealing 300% physical damage", () => {
    const world = createWorld({ seed: 1032, stage: stageDocks });
    equipRing(world, "RING_TRIGGER_BAZOOKA_ON_HIT", "LEFT:0");
    forceRolls(world, [0]);

    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    rebuildEnemyHash(world);
    const enemyWorld = getEnemyWorld(world, enemy, KENNEY_TILE_WORLD);

    world.events.push(playerHitEvent(enemy, 20, enemyWorld.wx, enemyWorld.wy));
    processProgressionTriggeredEffects(world);

    const missileIndex = world.prjKind.findIndex((kind) => kind === PRJ_KIND.MISSILE);
    expect(missileIndex).toBeGreaterThanOrEqual(0);
    expect(world.prDmgPhys[missileIndex]).toBeCloseTo(60);
    expect(world.prDmgFire[missileIndex]).toBe(0);
    expect(world.prDmgChaos[missileIndex]).toBe(0);
  });

  test("Lightning Chain hits up to three other nearby enemies with matched hit damage", () => {
    const world = createWorld({ seed: 1033, stage: stageDocks });
    equipRing(world, "RING_TRIGGER_LIGHTNING_CHAIN", "LEFT:0");
    forceRolls(world, [0]);

    const origin = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const a = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    const b = spawnEnemyGrid(world, EnemyId.MINION, 11, 9);
    const c = spawnEnemyGrid(world, EnemyId.MINION, 12, 9);
    const distant = spawnEnemyGrid(world, EnemyId.MINION, 20, 20);
    rebuildEnemyHash(world);
    for (const enemyIndex of [origin, a, b, c, distant]) {
      world.eHp[enemyIndex] = 100;
      world.eHpMax[enemyIndex] = 100;
    }
    const originWorld = getEnemyWorld(world, origin, KENNEY_TILE_WORLD);

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: origin,
      damage: 10,
      dmgPhys: 4,
      dmgFire: 0,
      dmgChaos: 6,
      x: originWorld.wx,
      y: originWorld.wy,
      isCrit: false,
      damageMeta: makeWeaponHitMeta("test-weapon", { category: "HIT", instigatorId: "player", isProcDamage: false }),
    });
    processProgressionTriggeredEffects(world);

    const chainHits = world.events.filter(
      (event) => event.type === "ENEMY_HIT" && (event as any).damageMeta?.isProcDamage,
    ) as any[];
    expect(chainHits).toHaveLength(3);
    expect(new Set(chainHits.map((event) => event.enemyIndex))).toEqual(new Set([a, b, c]));
    expect(chainHits.some((event) => event.enemyIndex === origin)).toBe(false);
    expect(chainHits.every((event) => event.dmgPhys === 4 && event.dmgChaos === 6)).toBe(true);
    expect(world.eHp[distant]).toBe(100);
  });

  test("Lightning Chain does not fire when the proc roll fails", () => {
    const world = createWorld({ seed: 1034, stage: stageDocks });
    equipRing(world, "RING_TRIGGER_LIGHTNING_CHAIN", "LEFT:0");
    forceRolls(world, [0.9]);

    const origin = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const nearby = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    rebuildEnemyHash(world);
    world.eHp[nearby] = 100;
    const originWorld = getEnemyWorld(world, origin, KENNEY_TILE_WORLD);

    world.events.push(playerHitEvent(origin, 10, originWorld.wx, originWorld.wy));
    processProgressionTriggeredEffects(world);

    const chainHits = world.events.filter(
      (event) => event.type === "ENEMY_HIT" && (event as any).damageMeta?.isProcDamage,
    );
    expect(chainHits).toHaveLength(0);
    expect(world.eHp[nearby]).toBe(100);
  });

  test("triggered explosion damages nearby enemies on kill", () => {
    const world = createWorld({ seed: 104, stage: stageDocks });
    equipRing(world, "RING_TRIGGER_EXPLODE_ON_KILL", "LEFT:0");
    forceRolls(world, [0]);

    const killed = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const nearby = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    rebuildEnemyHash(world);
    world.eHpMax[killed] = 100;
    world.eHp[nearby] = 200;
    const deadWorld = getEnemyWorld(world, killed, KENNEY_TILE_WORLD);

    world.events.push(playerKillEvent(killed, deadWorld.wx, deadWorld.wy));
    processProgressionTriggeredEffects(world);

    expect(world.eHp[nearby]).toBeCloseTo(150);
  });

  test("Dagger on Kill launches a homing dagger at the nearest enemy", () => {
    const world = createWorld({ seed: 1041, stage: stageDocks });
    equipRing(world, "RING_TRIGGER_DAGGER_ON_KILL", "LEFT:0");
    forceRolls(world, [0]);

    const killed = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const nearby = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    rebuildEnemyHash(world);
    const deadWorld = getEnemyWorld(world, killed, KENNEY_TILE_WORLD);
    const nearbyAim = getEnemyAimWorld(world, nearby);

    world.events.push(playerKillEvent(killed, deadWorld.wx, deadWorld.wy));
    processProgressionTriggeredEffects(world);

    const daggerIndex = world.prjKind.findIndex((kind) => kind === PRJ_KIND.DAGGER);
    expect(daggerIndex).toBeGreaterThanOrEqual(0);
    expect(world.prTargetX[daggerIndex]).toBeCloseTo(nearbyAim.x, 6);
    expect(world.prTargetY[daggerIndex]).toBeCloseTo(nearbyAim.y, 6);
    expect(world.prDmgPhys[daggerIndex]).toBeCloseTo(10);
  });

  test("ignite spread copies ignite stacks to nearby enemies on death", () => {
    const world = createWorld({ seed: 105, stage: stageDocks });
    equipRing(world, "RING_IGNITE_SPREAD_ON_DEATH", "LEFT:0");

    const killed = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const nearby = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    rebuildEnemyHash(world);
    const deadWorld = getEnemyWorld(world, killed, KENNEY_TILE_WORLD);
    world.eAilments = [];
    world.eAilments[killed] = { poison: [], bleed: [], ignite: [] };
    applyIgniteStacked(world.eAilments[killed]!, 100);

    world.events.push(playerKillEvent(killed, deadWorld.wx, deadWorld.wy));
    processProgressionTriggeredEffects(world);

    expect(world.eAilments?.[nearby]?.ignite?.length ?? 0).toBeGreaterThan(0);
  });

  test("crit ignite applies ignite from full hit damage", () => {
    const world = createWorld({ seed: 106, stage: stageDocks });
    equipRing(world, "RING_IGNITE_CRITS_APPLY_IGNITE", "LEFT:0");

    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    rebuildEnemyHash(world);
    const enemyWorld = getEnemyWorld(world, enemy, KENNEY_TILE_WORLD);

    world.events.push(playerHitEvent(enemy, 100, enemyWorld.wx, enemyWorld.wy, true));
    processProgressionTriggeredEffects(world);

    expect(world.eAilments?.[enemy]?.ignite?.length ?? 0).toBeGreaterThan(0);
  });

  test("Retaliation Burst stuns nearby enemies on PLAYER_HIT event", () => {
    const world = createWorld({ seed: 108, stage: stageDocks });
    equipRing(world, "RING_PHYSICAL_RETALIATION_BURST", "LEFT:0");
    forceRolls(world, [0]);

    // Spawn enemy at grid (9,9) and move the player near it so the stun explosion reaches
    const a = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    // Position the player at the enemy's grid location (close enough for 120px radius)
    world.pgxi = 9;
    world.pgyi = 9;
    world.pgox = 0;
    world.pgoy = 0;
    rebuildEnemyHash(world);

    world.events.push({ type: "PLAYER_HIT", damage: 10, source: "ENEMY" } as any);
    processProgressionTriggeredEffects(world);

    const brain = (world as any).eBrain?.[a];
    expect(brain).toBeDefined();
    expect(brain.stunLeftSec).toBeCloseTo(1);
  });

  test("triggered hits inherit player ailment chances only when the DOT rule is equipped", () => {
    const world = createWorld({ seed: 107, stage: stageDocks });
    (world as any).currentCharacterId = "HOBO";
    equipRing(world, "RING_TRIGGER_SPARK_ON_HIT", "LEFT:0");
    equipRing(world, "RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS", "LEFT:1");
    equipRing(world, "RING_POISON_CHANCE_PERCENT_25", "LEFT:2");
    forceRolls(world, [0]);

    const a = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    const b = spawnEnemyGrid(world, EnemyId.MINION, 10, 9);
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);
    void b;

    world.events.push(playerHitEvent(a, 24, aw.wx, aw.wy));
    processProgressionTriggeredEffects(world);

    const sparkIndex = world.prjKind.findIndex((kind) => kind === PRJ_KIND.SPARK);
    expect(sparkIndex).toBeGreaterThanOrEqual(0);
    expect(world.prChancePoison[sparkIndex]).toBeCloseTo(0.75);
  });
});
