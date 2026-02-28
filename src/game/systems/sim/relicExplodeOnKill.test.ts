import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { ENEMY_TYPE, spawnEnemyGrid } from "../../factories/enemyFactory";
import { getEnemyWorld } from "../../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { clearSpatialHash, insertEntity } from "../../util/spatialHash";
import { relicExplodeOnKillSystem } from "./relicExplodeOnKill";
import { applyRelic } from "../progression/relics";
import { relicRetriggerSystem } from "../progression/relicRetriggerSystem";
import { relicTriggerSystem } from "../progression/relicTriggerSystem";
import { PRJ_KIND } from "../../factories/projectileFactory";
import { RNG } from "../../util/rng";
import { createEnemyAilmentsState } from "../../combat_mods/ailments/enemyAilments";

function rebuildEnemyHash(world: ReturnType<typeof createWorld>): void {
  clearSpatialHash(world.enemySpatialHash);
  for (let i = 0; i < world.eAlive.length; i++) {
    if (!world.eAlive[i]) continue;
    const ew = getEnemyWorld(world, i, KENNEY_TILE_WORLD);
    insertEntity(world.enemySpatialHash, i, ew.wx, ew.wy, world.eR[i] ?? 0);
  }
}

describe("relicExplodeOnKillSystem", () => {
  test("triggers on non-OTHER kill and damages nearby enemies", () => {
    const w = createWorld({ seed: 11, stage: stageDocks });
    w.relics = ["ACT_EXPLODE_ON_KILL"];

    const a = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 5, 5);
    const b = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 6, 5);
    w.eHpMax[a] = 100;
    w.eHp[a] = 0;
    w.eAlive[a] = false;
    w.eHpMax[b] = 40;
    w.eHp[b] = 40;

    rebuildEnemyHash(w);
    const aw = getEnemyWorld(w, a, KENNEY_TILE_WORLD);
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: a,
      x: aw.wx,
      y: aw.wy,
      source: "PISTOL",
    });

    relicExplodeOnKillSystem(w, 1 / 60);

    expect(w.zAlive.length).toBe(1);
    expect(w.eHp[b]).toBeCloseTo(-10, 6);
    const chainedKill = w.events.find(
      (ev) => ev.type === "ENEMY_KILLED" && ev.enemyIndex === b && ev.source === "OTHER"
    );
    expect(chainedKill).toBeTruthy();
  });

  test("does not trigger on OTHER kill source", () => {
    const w = createWorld({ seed: 12, stage: stageDocks });
    w.relics = ["ACT_EXPLODE_ON_KILL"];

    const a = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 5, 5);
    const b = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 6, 5);
    w.eHpMax[a] = 100;
    w.eHp[a] = 0;
    w.eAlive[a] = false;
    w.eHp[b] = 40;

    rebuildEnemyHash(w);
    const aw = getEnemyWorld(w, a, KENNEY_TILE_WORLD);
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: a,
      x: aw.wx,
      y: aw.wy,
      source: "OTHER",
    });

    relicExplodeOnKillSystem(w, 1 / 60);

    expect(w.zAlive.length).toBe(0);
    expect(w.eHp[b]).toBe(40);
  });

  test("PASS_DAMAGE_TO_POISON_ALL converts ACT_EXPLODE_ON_KILL damage into poison", () => {
    const w = createWorld({ seed: 44, stage: stageDocks });
    w.relics = ["ACT_EXPLODE_ON_KILL", "PASS_DAMAGE_TO_POISON_ALL"];

    const dead = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 5, 5);
    const target = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 6, 5);
    w.eHpMax[dead] = 100;
    w.eHp[dead] = 0;
    w.eAlive[dead] = false;
    w.eHpMax[target] = 400;
    w.eHp[target] = 400;

    rebuildEnemyHash(w);
    const dw = getEnemyWorld(w, dead, KENNEY_TILE_WORLD);
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: dead,
      x: dw.wx,
      y: dw.wy,
      source: "PISTOL",
    });

    relicExplodeOnKillSystem(w, 1 / 60);

    expect(w.eHp[target]).toBeCloseTo(350, 6);
    const poisonStacks = w.eAilments[target]?.poison ?? [];
    expect(poisonStacks.length).toBe(1);
    expect(poisonStacks[0].dps).toBeCloseTo(5, 6);
  });

  test("ACT_TRIGGERS_DOUBLE retriggers explosion after delay", () => {
    const w = createWorld({ seed: 14, stage: stageDocks });
    w.relics = ["ACT_EXPLODE_ON_KILL", "ACT_TRIGGERS_DOUBLE"];

    const a = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 5, 5);
    w.eHpMax[a] = 100;
    w.eHp[a] = 0;
    w.eAlive[a] = false;

    rebuildEnemyHash(w);
    const aw = getEnemyWorld(w, a, KENNEY_TILE_WORLD);
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: a,
      x: aw.wx,
      y: aw.wy,
      source: "PISTOL",
    });

    relicExplodeOnKillSystem(w, 1 / 60);
    expect(w.zAlive.length).toBe(1);
    expect(w.relicRetriggerQueue.length).toBe(1);

    w.time += 0.49;
    relicRetriggerSystem(w);
    expect(w.zAlive.length).toBe(1);
    expect(w.relicRetriggerQueue.length).toBe(1);

    w.time += 0.01;
    relicRetriggerSystem(w);
    expect(w.zAlive.length).toBe(2);
    expect(w.relicRetriggerQueue.length).toBe(0);
  });

  test("PASS_DAMAGE_TO_POISON_ALL converts ACT_ALL_HITS_EXPLODE_20 damage into poison", () => {
    const w = createWorld({ seed: 45, stage: stageDocks });
    w.relics = ["ACT_ALL_HITS_EXPLODE_20", "PASS_DAMAGE_TO_POISON_ALL"];

    const hitTarget = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 8, 8);
    const splashTarget = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 9, 8);
    w.eHpMax[splashTarget] = 500;
    w.eHp[splashTarget] = 500;

    rebuildEnemyHash(w);
    const hw = getEnemyWorld(w, hitTarget, KENNEY_TILE_WORLD);
    w.events.push({
      type: "ENEMY_HIT",
      enemyIndex: hitTarget,
      damage: 100,
      dmgPhys: 100,
      dmgFire: 0,
      dmgChaos: 0,
      x: hw.wx,
      y: hw.wy,
      isCrit: false,
      source: "PISTOL",
    });

    relicTriggerSystem(w);

    expect(w.eHp[splashTarget]).toBeCloseTo(480, 6);
    const poisonStacks = w.eAilments[splashTarget]?.poison ?? [];
    expect(poisonStacks.length).toBe(1);
    expect(poisonStacks[0].dps).toBeCloseTo(2, 6);
  });

  test("applyRelic dedupes ACT_EXPLODE_ON_KILL", () => {
    const w = createWorld({ seed: 13, stage: stageDocks });
    applyRelic(w, "ACT_EXPLODE_ON_KILL");
    applyRelic(w, "ACT_EXPLODE_ON_KILL");
    expect(w.relics).toEqual(["ACT_EXPLODE_ON_KILL"]);
  });

  test("ACT_DAGGER_ON_KILL_50 selects target when delay elapses", () => {
    const w = createWorld({ seed: 15, stage: stageDocks });
    w.relics = ["ACT_DAGGER_ON_KILL_50"];
    (w.rng as any).next = () => 0.1; // force proc success

    const dead = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 5, 5);
    const near = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 6, 5);
    const far = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 8, 5);
    w.eAlive[dead] = false;
    w.eHp[near] = 1_000_000;
    w.eHpMax[near] = 1_000_000;
    rebuildEnemyHash(w);

    const dw = getEnemyWorld(w, dead, KENNEY_TILE_WORLD);
    w.events.push({
      type: "ENEMY_HIT",
      enemyIndex: dead,
      damage: 120,
      x: dw.wx,
      y: dw.wy,
      isCrit: false,
      source: "PISTOL",
    });
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: dead,
      x: dw.wx,
      y: dw.wy,
      source: "PISTOL",
    });

    relicExplodeOnKillSystem(w, 1 / 60);
    expect(w.relicDaggerQueue.length).toBe(1);
    expect(w.relicDaggerQueue[0].excludeEnemyIndex).toBe(dead);
    expect(w.pAlive.length).toBe(1);
    expect(w.prjKind[0]).toBe(PRJ_KIND.DAGGER);
    expect(w.prNoCollide[0]).toBe(true);
    expect(w.prvx[0]).toBe(0);
    expect(w.prvy[0]).toBe(0);
    expect(w.prDamage[0]).toBeCloseTo(60, 6);

    w.time += 1.99;
    relicTriggerSystem(w);
    expect(w.prNoCollide[0]).toBe(true);
    expect(w.prvx[0]).toBe(0);
    // Remove the nearest target before activation; selection should happen now, not at proc-time.
    w.eAlive[near] = false;
    w.time += 0.01;
    relicTriggerSystem(w);
    expect(w.prNoCollide[0]).toBe(false);
    expect(Math.hypot(w.prvx[0], w.prvy[0])).toBeGreaterThan(0);
    const fw = getEnemyWorld(w, far, KENNEY_TILE_WORLD);
    expect(w.prTargetX[0]).toBeCloseTo(fw.wx, 6);
    expect(w.prTargetY[0]).toBeCloseTo(fw.wy, 6);
  });

  test("ACT_DAGGER_ON_KILL_50 deterministic proc count for seeded kill events", () => {
    const seed = 19;
    const w = createWorld({ seed, stage: stageDocks });
    w.relics = ["ACT_DAGGER_ON_KILL_50"];

    const dead = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 9, 9);
    spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 10, 9);
    w.eAlive[dead] = false;
    rebuildEnemyHash(w);
    const dw = getEnemyWorld(w, dead, KENNEY_TILE_WORLD);

    for (let i = 0; i < 10; i++) {
      w.events.push({
        type: "ENEMY_HIT",
        enemyIndex: dead,
        damage: 100,
        x: dw.wx,
        y: dw.wy,
        isCrit: false,
        source: "PISTOL",
      });
      w.events.push({
        type: "ENEMY_KILLED",
        enemyIndex: dead,
        x: dw.wx,
        y: dw.wy,
        source: "PISTOL",
      });
    }

    relicExplodeOnKillSystem(w, 1 / 60);
    const expectedRng = new RNG(seed);
    let expected = 0;
    for (let i = 0; i < 10; i++) {
      if (expectedRng.next() < 0.5) expected++;
    }
    expect(w.relicDaggerQueue.length).toBe(expected);
  });

  test("dagger kill source OTHER does not retrigger Soul Shards", () => {
    const w = createWorld({ seed: 16, stage: stageDocks });
    w.relics = ["ACT_DAGGER_ON_KILL_50"];
    const dead = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 5, 5);
    const dw = getEnemyWorld(w, dead, KENNEY_TILE_WORLD);
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: dead,
      x: dw.wx,
      y: dw.wy,
      source: "OTHER",
    });

    relicExplodeOnKillSystem(w, 1 / 60);
    expect(w.relicDaggerQueue.length).toBe(0);
  });

  test("ACT_IGNITE_SPREAD_ON_DEATH spreads ignite to all nearby enemies", () => {
    const w = createWorld({ seed: 31, stage: stageDocks });
    w.relics = ["ACT_IGNITE_SPREAD_ON_DEATH"];

    const dead = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 5, 5);
    const a = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 6, 5);
    const b = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 5, 6);
    const c = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 6, 6);
    w.eAlive[dead] = false;
    w.eAilments[dead] = createEnemyAilmentsState();
    w.eAilments[dead]!.ignite = { kind: "ignite", dps: 12, tLeft: 3 };
    rebuildEnemyHash(w);

    const dw = getEnemyWorld(w, dead, KENNEY_TILE_WORLD);
    w.events.push({ type: "ENEMY_KILLED", enemyIndex: dead, x: dw.wx, y: dw.wy, source: "PISTOL" });

    relicExplodeOnKillSystem(w, 1 / 60);

    expect(w.eAilments[a]?.ignite).toBeTruthy();
    expect(w.eAilments[b]?.ignite).toBeTruthy();
    expect(w.eAilments[c]?.ignite).toBeTruthy();
  });

  test("ACT_IGNITE_SPREAD_ON_DEATH does not spread when dead enemy has no ignite", () => {
    const w = createWorld({ seed: 32, stage: stageDocks });
    w.relics = ["ACT_IGNITE_SPREAD_ON_DEATH"];

    const dead = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 5, 5);
    const a = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 6, 5);
    w.eAlive[dead] = false;
    w.eAilments[dead] = createEnemyAilmentsState();
    rebuildEnemyHash(w);

    const dw = getEnemyWorld(w, dead, KENNEY_TILE_WORLD);
    w.events.push({ type: "ENEMY_KILLED", enemyIndex: dead, x: dw.wx, y: dw.wy, source: "PISTOL" });

    relicExplodeOnKillSystem(w, 1 / 60);

    expect(w.eAilments[a]?.ignite ?? null).toBeNull();
  });

  test("ACT_IGNITE_SPREAD_ON_DEATH target set and strength are deterministic", () => {
    const run = () => {
      const w = createWorld({ seed: 33, stage: stageDocks });
      w.relics = ["ACT_IGNITE_SPREAD_ON_DEATH"];
      const dead = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 10, 10);
      const t1 = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 11, 10);
      const t2 = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 10, 11);
      w.eAlive[dead] = false;
      w.eAilments[dead] = createEnemyAilmentsState();
      w.eAilments[dead]!.ignite = { kind: "ignite", dps: 9, tLeft: 2 };
      rebuildEnemyHash(w);
      const dw = getEnemyWorld(w, dead, KENNEY_TILE_WORLD);
      w.events.push({ type: "ENEMY_KILLED", enemyIndex: dead, x: dw.wx, y: dw.wy, source: "PISTOL" });
      relicExplodeOnKillSystem(w, 1 / 60);
      return [w.eAilments[t1]?.ignite, w.eAilments[t2]?.ignite];
    };

    const [a1, a2] = run();
    const [b1, b2] = run();
    expect(a1?.dps).toBeCloseTo(b1?.dps ?? 0, 6);
    expect(a1?.tLeft).toBeCloseTo(b1?.tLeft ?? 0, 6);
    expect(a2?.dps).toBeCloseTo(b2?.dps ?? 0, 6);
    expect(a2?.tLeft).toBeCloseTo(b2?.tLeft ?? 0, 6);
  });

  test("ACT_IGNITE_SPREAD_ON_DEATH does not trigger on OTHER kill events", () => {
    const w = createWorld({ seed: 34, stage: stageDocks });
    w.relics = ["ACT_IGNITE_SPREAD_ON_DEATH"];
    const dead = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 12, 12);
    const a = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 13, 12);
    w.eAlive[dead] = false;
    w.eAilments[dead] = createEnemyAilmentsState();
    w.eAilments[dead]!.ignite = { kind: "ignite", dps: 20, tLeft: 3 };
    rebuildEnemyHash(w);
    const dw = getEnemyWorld(w, dead, KENNEY_TILE_WORLD);
    w.events.push({ type: "ENEMY_KILLED", enemyIndex: dead, x: dw.wx, y: dw.wy, source: "OTHER" });

    relicExplodeOnKillSystem(w, 1 / 60);
    expect(w.eAilments[a]?.ignite ?? null).toBeNull();
  });
});
