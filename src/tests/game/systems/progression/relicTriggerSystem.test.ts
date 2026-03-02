import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import {
  computeEffectiveRelicProcChance,
  relicTriggerSystem,
} from "../../../../game/systems/progression/relicTriggerSystem";
import { relicRetriggerSystem } from "../../../../game/systems/progression/relicRetriggerSystem";
import { PRJ_KIND } from "../../../../game/factories/projectileFactory";
import { ENEMY_TYPE, spawnEnemyGrid } from "../../../../game/factories/enemyFactory";
import { getEnemyWorld, getPlayerWorld } from "../../../../game/coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { clearSpatialHash, insertEntity } from "../../../../game/util/spatialHash";
import { RNG } from "../../../../game/util/rng";
import { zonesSystem } from "../../../../game/systems/sim/zones";
import { STARTER_RELIC_IDS } from "../../../../game/content/starterRelics";

function rebuildEnemyHash(world: ReturnType<typeof createWorld>): void {
  clearSpatialHash(world.enemySpatialHash);
  for (let i = 0; i < world.eAlive.length; i++) {
    if (!world.eAlive[i]) continue;
    const ew = getEnemyWorld(world, i, KENNEY_TILE_WORLD);
    insertEntity(world.enemySpatialHash, i, ew.wx, ew.wy, world.eR[i] ?? 0);
  }
}

function runSparkProcCount(
  world: ReturnType<typeof createWorld>,
  hitEnemy: number,
  wx: number,
  wy: number,
  hits: number,
  damage: number,
): number {
  let procCount = 0;
  const sparksBefore = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length;
  for (let i = 0; i < hits; i++) {
    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: hitEnemy,
      damage,
      x: wx,
      y: wy,
      isCrit: false,
      source: "PISTOL",
    });
    relicTriggerSystem(world);
    world.events = [];
  }
  procCount = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length - sparksBefore;
  return procCount;
}

describe("relicTriggerSystem", () => {
  test("ACT_BAZOOKA_ON_HIT_20 fires bazooka on hit with 20% explosion scaling", () => {
    const world = createWorld({ seed: 1, stage: stageDocks });
    world.relics.push("ACT_BAZOOKA_ON_HIT_20");
    world.events.push(
      {
        type: "ENEMY_HIT",
        enemyIndex: 0,
        damage: 100,
        dmgPhys: 60,
        dmgFire: 25,
        dmgChaos: 15,
        x: 200,
        y: 150,
        isCrit: false,
        source: "PISTOL",
      } as any
    );

    relicTriggerSystem(world);

    expect(world.pAlive.length).toBe(1);
    expect(world.prjKind[0]).toBe(PRJ_KIND.MISSILE);
    expect(world.prDamage[0]).toBe(0);
    expect(world.prDmgPhys[0]).toBe(0);
    expect(world.prDmgFire[0]).toBe(0);
    expect(world.prDmgChaos[0]).toBe(0);
    expect(world.prExplodeDmg[0]).toBeCloseTo(20, 6);
  });

  test("ACT_BAZOOKA_ON_HIT_20 aims at enemy center and spawns from player aim point", () => {
    const world = createWorld({ seed: 12, stage: stageDocks });
    world.relics.push("ACT_BAZOOKA_ON_HIT_20");
    const enemy = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 5, 5);
    rebuildEnemyHash(world);
    const enemyFeet = getEnemyWorld(world, enemy, KENNEY_TILE_WORLD);
    const playerFeet = getPlayerWorld(world, KENNEY_TILE_WORLD);

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: enemy,
      damage: 100,
      x: enemyFeet.wx,
      y: enemyFeet.wy,
      isCrit: false,
      source: "PISTOL",
    } as any);

    relicTriggerSystem(world);

    expect(world.pAlive.length).toBe(1);
    expect(world.prjKind[0]).toBe(PRJ_KIND.MISSILE);
    expect(world.prTargetX[0]).toBeCloseTo(enemyFeet.wx, 6);
    expect(world.prTargetY[0]).toBeLessThan(enemyFeet.wy);
    expect(world.prStartY[0]).toBeLessThan(playerFeet.wy);
  });

  test("loop guard: source OTHER ENEMY_HIT does not spawn bazooka", () => {
    const world = createWorld({ seed: 2, stage: stageDocks });
    world.relics.push("ACT_BAZOOKA_ON_HIT_20");
    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 100,
      x: 200,
      y: 150,
      isCrit: false,
      source: "OTHER",
    });

    relicTriggerSystem(world);

    expect(world.pAlive.length).toBe(0);
  });

  test("ACT_BAZOOKA_ON_HIT_20 scaling correctness for larger hit totals", () => {
    const world = createWorld({ seed: 3, stage: stageDocks });
    world.relics.push("ACT_BAZOOKA_ON_HIT_20");
    world.events.push(
      {
        type: "ENEMY_HIT",
        enemyIndex: 0,
        damage: 250,
        dmgPhys: 200,
        dmgFire: 25,
        dmgChaos: 25,
        x: 220,
        y: 170,
        isCrit: true,
        source: "PISTOL",
      } as any
    );

    relicTriggerSystem(world);

    expect(world.pAlive.length).toBe(1);
    expect(world.prExplodeDmg[0]).toBeCloseTo(50, 6);
  });

  test("ACT_TRIGGERS_DOUBLE schedules delayed retrigger execution", () => {
    const world = createWorld({ seed: 4, stage: stageDocks });
    world.relics.push("ACT_BAZOOKA_ON_HIT_20", "ACT_TRIGGERS_DOUBLE");
    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 100,
      x: 200,
      y: 150,
      isCrit: false,
      source: "PISTOL",
    } as any);

    relicTriggerSystem(world);

    expect(world.pAlive.length).toBe(1);
    expect(world.relicRetriggerQueue.length).toBe(1);

    world.time += 0.49;
    relicRetriggerSystem(world);
    expect(world.pAlive.length).toBe(1);
    expect(world.relicRetriggerQueue.length).toBe(1);

    world.time += 0.01;
    relicRetriggerSystem(world);
    expect(world.pAlive.length).toBe(2);
    expect(world.relicRetriggerQueue.length).toBe(0);
  });

  test("PASS_LIFE_ON_HIT_2 heals and clamps to max life", () => {
    const world = createWorld({ seed: 5, stage: stageDocks });
    world.relics.push("PASS_LIFE_ON_HIT_2");
    world.playerHpMax = 100;
    world.playerHp = 99;
    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 10,
      x: 200,
      y: 150,
      isCrit: false,
      source: "PISTOL",
    });

    relicTriggerSystem(world);

    expect(world.playerHp).toBe(100);
  });

  test("ACT_ALL_HITS_EXPLODE_20 creates explosion on hit", () => {
    const world = createWorld({ seed: 6, stage: stageDocks });
    world.relics.push("ACT_ALL_HITS_EXPLODE_20");
    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 100,
      x: 210,
      y: 140,
      isCrit: false,
      source: "PISTOL",
    });

    relicTriggerSystem(world);

    expect(world.zAlive.length).toBe(1);
  });

  test("ACT_SPARK_ON_HIT_20 proc count matches seeded expectation over 100 hits", () => {
    const seed = 123456;
    const world = createWorld({ seed, stage: stageDocks });
    world.rng = new RNG(seed);
    world.relics.push("ACT_SPARK_ON_HIT_20");

    const a = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 5, 5);
    const b = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 6, 5);
    world.eHp[a] = 1_000_000;
    world.eHpMax[a] = 1_000_000;
    world.eHp[b] = 1_000_000;
    world.eHpMax[b] = 1_000_000;
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);

    const sparksBefore = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length;
    for (let i = 0; i < 100; i++) {
      world.events.push({
        type: "ENEMY_HIT",
        enemyIndex: a,
        damage: 100,
        x: aw.wx,
        y: aw.wy,
        isCrit: false,
        source: "PISTOL",
      });
      relicTriggerSystem(world);
      world.events = [];
    }
    const procCount = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length - sparksBefore;

    const expectedRng = new RNG(seed);
    let expectedCount = 0;
    for (let i = 0; i < 100; i++) {
      if (expectedRng.next() < 0.2) expectedCount++;
    }
    expect(procCount).toBe(expectedCount);
  });

  test("ACT_SPARK_ON_HIT_20 targets enemy center-of-sprite aim point", () => {
    const world = createWorld({ seed: 33, stage: stageDocks });
    world.relics.push("ACT_SPARK_ON_HIT_20");
    (world.rng as any).next = () => 0.0; // force proc
    const a = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 9, 9);
    const b = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 10, 9);
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);
    const bw = getEnemyWorld(world, b, KENNEY_TILE_WORLD);

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: a,
      damage: 100,
      x: aw.wx,
      y: aw.wy,
      isCrit: false,
      source: "PISTOL",
    } as any);

    relicTriggerSystem(world);

    const spark = world.prjKind.findIndex((k) => k === PRJ_KIND.SPARK);
    expect(spark).toBeGreaterThanOrEqual(0);
    expect(world.prTargetX[spark]).toBeCloseTo(bw.wx, 6);
    expect(world.prTargetY[spark]).toBeLessThan(bw.wy);
  });

  test("Street Reflex starter relic throws an extra knife at a nearby enemy", () => {
    const world = createWorld({ seed: 333, stage: stageDocks });
    world.relics.push(STARTER_RELIC_IDS.STREET_REFLEX);
    (world.rng as any).next = () => 0.0; // force proc

    const a = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 9, 9);
    const b = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 10, 9);
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);
    const bw = getEnemyWorld(world, b, KENNEY_TILE_WORLD);
    const playerFeet = getPlayerWorld(world, KENNEY_TILE_WORLD);

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: a,
      damage: 24,
      x: aw.wx,
      y: aw.wy,
      isCrit: false,
      source: "PISTOL",
    } as any);

    relicTriggerSystem(world);

    const knife = world.prjKind.findIndex((k) => k === PRJ_KIND.KNIFE);
    expect(knife).toBeGreaterThanOrEqual(0);
    expect(world.prTargetX[knife]).toBeCloseTo(bw.wx, 6);
    expect(world.prTargetY[knife]).toBeLessThan(bw.wy);
    expect(world.prStartY[knife]).toBeLessThan(playerFeet.wy);
  });

  test("ACT_RETRY_FAILED_PROCS_ONCE increases Spark proc count deterministically", () => {
    const seed = 777;
    const world = createWorld({ seed, stage: stageDocks });
    world.rng = new RNG(seed);
    world.relics.push("ACT_SPARK_ON_HIT_20", "ACT_RETRY_FAILED_PROCS_ONCE");

    const a = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 7, 7);
    const b = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 8, 7);
    world.eHp[a] = 1_000_000;
    world.eHpMax[a] = 1_000_000;
    world.eHp[b] = 1_000_000;
    world.eHpMax[b] = 1_000_000;
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);

    const sparksBefore = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length;
    for (let i = 0; i < 100; i++) {
      world.events.push({
        type: "ENEMY_HIT",
        enemyIndex: a,
        damage: 80,
        x: aw.wx,
        y: aw.wy,
        isCrit: false,
        source: "PISTOL",
      });
      relicTriggerSystem(world);
      world.events = [];
    }
    const procCount = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length - sparksBefore;

    const expectedRng = new RNG(seed);
    let expectedCount = 0;
    for (let i = 0; i < 100; i++) {
      const first = expectedRng.next();
      if (first < 0.2) {
        expectedCount++;
      } else {
        const retry = expectedRng.next();
        if (retry < 0.2) expectedCount++;
      }
    }
    expect(procCount).toBe(expectedCount);
  });

  test("ACT_TRIGGERS_DOUBLE retrigger affects Spark proc count", () => {
    const world = createWorld({ seed: 9, stage: stageDocks });
    world.relics.push("ACT_SPARK_ON_HIT_20", "ACT_TRIGGERS_DOUBLE");
    const rolls = [0.1, 0.1];
    (world.rng as any).next = () => (rolls.length ? rolls.shift() : 0.99);

    const a = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 10, 10);
    const b = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 11, 10);
    world.eHp[a] = 1_000_000;
    world.eHpMax[a] = 1_000_000;
    world.eHp[b] = 1_000_000;
    world.eHpMax[b] = 1_000_000;
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: a,
      damage: 100,
      x: aw.wx,
      y: aw.wy,
      isCrit: false,
      source: "PISTOL",
    });
    const sparksBefore = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length;
    relicTriggerSystem(world);
    const immediateProcs = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length - sparksBefore;
    expect(immediateProcs).toBe(1);
    expect(world.relicRetriggerQueue.length).toBe(1);

    world.events = [];
    world.time += 0.5;
    const sparksBeforeRetrigger = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length;
    relicRetriggerSystem(world);
    const retriggerProcs = world.prjKind.filter((k) => k === PRJ_KIND.SPARK).length - sparksBeforeRetrigger;
    expect(retriggerProcs).toBe(1);
  });

  test("ACT_PROC_CHANCE_PERCENT_50 increases Spark procs deterministically", () => {
    const seed = 2026;
    const hits = 100;
    const aTx = 14;
    const aTy = 14;

    const base = createWorld({ seed, stage: stageDocks });
    base.rng = new RNG(seed);
    base.relics.push("ACT_SPARK_ON_HIT_20");
    const aBase = spawnEnemyGrid(base, ENEMY_TYPE.CHASER, aTx, aTy);
    spawnEnemyGrid(base, ENEMY_TYPE.CHASER, aTx + 1, aTy);
    base.eHp[aBase] = 1_000_000;
    base.eHpMax[aBase] = 1_000_000;
    rebuildEnemyHash(base);
    const awBase = getEnemyWorld(base, aBase, KENNEY_TILE_WORLD);
    const baseProcCount = runSparkProcCount(base, aBase, awBase.wx, awBase.wy, hits, 100);

    const overclock = createWorld({ seed, stage: stageDocks });
    overclock.rng = new RNG(seed);
    overclock.relics.push("ACT_SPARK_ON_HIT_20", "ACT_PROC_CHANCE_PERCENT_50");
    const aOver = spawnEnemyGrid(overclock, ENEMY_TYPE.CHASER, aTx, aTy);
    spawnEnemyGrid(overclock, ENEMY_TYPE.CHASER, aTx + 1, aTy);
    overclock.eHp[aOver] = 1_000_000;
    overclock.eHpMax[aOver] = 1_000_000;
    rebuildEnemyHash(overclock);
    const awOver = getEnemyWorld(overclock, aOver, KENNEY_TILE_WORLD);
    const overclockProcCount = runSparkProcCount(overclock, aOver, awOver.wx, awOver.wy, hits, 100);

    expect(overclockProcCount).toBeGreaterThan(baseProcCount);

    const expectedRng = new RNG(seed);
    let expectedBase = 0;
    let expectedOverclock = 0;
    for (let i = 0; i < hits; i++) {
      if (expectedRng.next() < 0.2) expectedBase++;
    }
    const expectedRngOver = new RNG(seed);
    for (let i = 0; i < hits; i++) {
      if (expectedRngOver.next() < 0.3) expectedOverclock++;
    }
    expect(baseProcCount).toBe(expectedBase);
    expect(overclockProcCount).toBe(expectedOverclock);
  });

  test("ACT_PROC_CHANCE_PERCENT_50 + retry uses boosted chance on retry", () => {
    const seed = 2031;
    const hits = 100;
    const world = createWorld({ seed, stage: stageDocks });
    world.rng = new RNG(seed);
    world.relics.push(
      "ACT_SPARK_ON_HIT_20",
      "ACT_PROC_CHANCE_PERCENT_50",
      "ACT_RETRY_FAILED_PROCS_ONCE",
    );
    const a = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 16, 16);
    spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 17, 16);
    world.eHp[a] = 1_000_000;
    world.eHpMax[a] = 1_000_000;
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);
    const procCount = runSparkProcCount(world, a, aw.wx, aw.wy, hits, 100);

    const expectedRng = new RNG(seed);
    let expected = 0;
    for (let i = 0; i < hits; i++) {
      const r1 = expectedRng.next();
      if (r1 < 0.3) {
        expected++;
      } else {
        const r2 = expectedRng.next();
        if (r2 < 0.3) expected++;
      }
    }
    expect(procCount).toBe(expected);
  });

  test("computeEffectiveRelicProcChance clamps overclocked chance to 1.0", () => {
    expect(computeEffectiveRelicProcChance(0.9, 1)).toBe(1);
    expect(computeEffectiveRelicProcChance(0.2, 1)).toBeCloseTo(0.3, 6);
    expect(computeEffectiveRelicProcChance(0.2, 2)).toBeCloseTo(0.45, 6);
  });

  test("ACT_NOVA_ON_CRIT_FIRE spawns a fire zone on each crit with expected tick damage", () => {
    const world = createWorld({ seed: 44, stage: stageDocks });
    world.relics.push("ACT_NOVA_ON_CRIT_FIRE");
    const a = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 20, 20);
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);
    const critHitDamage = 100;

    for (let i = 0; i < 3; i++) {
      world.events.push({
        type: "ENEMY_HIT",
        enemyIndex: a,
        damage: critHitDamage,
        dmgPhys: 100,
        dmgFire: 0,
        dmgChaos: 0,
        x: aw.wx,
        y: aw.wy,
        isCrit: true,
        source: "PISTOL",
      });
    }

    relicTriggerSystem(world);
    expect(world.zAlive.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(world.zDamage[i]).toBeCloseTo(6, 6);
      expect(world.zTickEvery[i]).toBeCloseTo(0.5, 6);
      expect(world.zTtl[i]).toBeCloseTo(5.0, 6);
    }
  });

  test("ACT_NOVA_ON_CRIT_FIRE zone ticks are source OTHER and do not retrigger relic procs", () => {
    const world = createWorld({ seed: 45, stage: stageDocks });
    world.relics.push("ACT_NOVA_ON_CRIT_FIRE");
    const a = spawnEnemyGrid(world, ENEMY_TYPE.CHASER, 22, 22);
    world.eHp[a] = 1_000_000;
    world.eHpMax[a] = 1_000_000;
    rebuildEnemyHash(world);
    const aw = getEnemyWorld(world, a, KENNEY_TILE_WORLD);

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: a,
      damage: 100,
      x: aw.wx,
      y: aw.wy,
      isCrit: true,
      source: "PISTOL",
    });
    relicTriggerSystem(world);
    expect(world.zAlive.length).toBe(1);

    world.events = [];
    zonesSystem(world, 0.5);
    const zoneHitEvents = world.events.filter((ev) => ev.type === "ENEMY_HIT");
    expect(zoneHitEvents.length).toBeGreaterThan(0);
    expect(zoneHitEvents.every((ev) => ev.source === "OTHER")).toBe(true);

    const zonesBefore = world.zAlive.length;
    relicTriggerSystem(world);
    expect(world.zAlive.length).toBe(zonesBefore);
  });
});
