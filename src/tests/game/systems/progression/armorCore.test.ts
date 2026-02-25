import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { applyPlayerIncomingDamage, restoreArmor } from "../../../../game/systems/sim/playerArmor";
import { relicTriggerSystem } from "../../../../game/systems/progression/relicTriggerSystem";
import { relicExplodeOnKillSystem } from "../../../../game/systems/sim/relicExplodeOnKill";
import { applyRelic } from "../../../../game/systems/progression/relics";

describe("armor core", () => {
  test("damage is absorbed by armor before life", () => {
    const world = createWorld({ seed: 1, stage: stageDocks });
    world.maxArmor = 50;
    world.currentArmor = 50;
    world.playerHp = 100;

    const lifeDamageA = applyPlayerIncomingDamage(world, 20);
    world.playerHp -= lifeDamageA;
    expect(world.currentArmor).toBe(30);
    expect(world.playerHp).toBe(100);

    const lifeDamageB = applyPlayerIncomingDamage(world, 40);
    world.playerHp -= lifeDamageB;
    expect(world.currentArmor).toBe(0);
    expect(world.playerHp).toBe(90);
  });

  test("armor has no passive regeneration over time", () => {
    const world = createWorld({ seed: 2, stage: stageDocks });
    world.maxArmor = 50;
    world.currentArmor = 50;
    const lifeDamage = applyPlayerIncomingDamage(world, 20);
    world.playerHp -= lifeDamage;
    expect(world.currentArmor).toBe(30);

    for (let i = 0; i < 20; i++) {
      world.time += 0.5;
      relicTriggerSystem(world);
      relicExplodeOnKillSystem(world, 0.5);
    }
    expect(world.currentArmor).toBe(30);
  });

  test("restoreArmor clamps to maxArmor", () => {
    const world = createWorld({ seed: 3, stage: stageDocks });
    world.maxArmor = 10;
    world.currentArmor = 9;
    restoreArmor(world, 5);
    expect(world.currentArmor).toBe(10);
  });

  test("armor restore relics trigger on hit and kill", () => {
    const world = createWorld({ seed: 4, stage: stageDocks });
    world.maxArmor = 100;
    world.currentArmor = 0;
    world.relics.push("ARMOR_RESTORE_ON_HIT_1", "ARMOR_RESTORE_ON_KILL_10");

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 10,
      x: 0,
      y: 0,
      isCrit: false,
      source: "PISTOL",
    });
    relicTriggerSystem(world);
    expect(world.currentArmor).toBe(1);

    world.events = [
      {
        type: "ENEMY_KILLED",
        enemyIndex: 0,
        x: 0,
        y: 0,
        source: "PISTOL",
      },
    ];
    relicExplodeOnKillSystem(world, 0.016);
    expect(world.currentArmor).toBe(11);
  });

  test("ARMOR_MAX_50 increases max armor only (no current armor gain)", () => {
    const world = createWorld({ seed: 5, stage: stageDocks });
    expect(world.maxArmor).toBe(50);
    expect(world.currentArmor).toBe(0);
    applyRelic(world, "ARMOR_MAX_50");
    expect(world.maxArmor).toBe(100);
    expect(world.currentArmor).toBe(0);
  });

  test("ARMOR_RESTORE_ON_CRIT_5 restores armor on crit and clamps", () => {
    const world = createWorld({ seed: 6, stage: stageDocks });
    world.maxArmor = 10;
    world.currentArmor = 0;
    world.relics.push("ARMOR_RESTORE_ON_CRIT_5");

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 10,
      x: 0,
      y: 0,
      isCrit: true,
      source: "PISTOL",
    });
    relicTriggerSystem(world);
    expect(world.currentArmor).toBe(5);

    world.events = [
      {
        type: "ENEMY_HIT",
        enemyIndex: 0,
        damage: 10,
        x: 0,
        y: 0,
        isCrit: true,
        source: "PISTOL",
      },
    ];
    relicTriggerSystem(world);
    expect(world.currentArmor).toBe(10);
  });

  test("ARMOR_DOUBLE_MAX doubles max armor only and keeps current unchanged", () => {
    const world = createWorld({ seed: 7, stage: stageDocks });
    world.currentArmor = 10;

    applyRelic(world, "ARMOR_DOUBLE_MAX");
    expect(world.maxArmor).toBe(100);
    expect(world.currentArmor).toBe(10);

    world.currentArmor = 10;
    applyRelic(world, "ARMOR_MAX_50");
    expect(world.maxArmor).toBe(200);
    expect(world.currentArmor).toBe(10);
  });
});
