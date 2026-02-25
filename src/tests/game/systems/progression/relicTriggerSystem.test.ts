import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { relicTriggerSystem } from "../../../../game/systems/progression/relicTriggerSystem";
import { PRJ_KIND } from "../../../../game/factories/projectileFactory";

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
});
