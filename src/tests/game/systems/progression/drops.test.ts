import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { EnemyId } from "../../../../game/factories/enemyFactory";
import { spawnEnemyGrid } from "../../../../game/factories/enemyFactory";
import { goldValueFromEnemyBaseLife } from "../../../../game/economy/coins";
import { dropsSystem } from "../../../../game/systems/progression/drops";
import { PICKUP_KIND, spawnGold } from "../../../../game/systems/progression/pickups";
import { LOOT_GOBLIN_TRIGGER_PREFIX } from "../../../../game/systems/progression/lootGoblin";
import { getPlayerWorld } from "../../../../game/coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { makeWeaponHitMeta } from "../../../../game/combat/damageMeta";

describe("dropsSystem", () => {
  test("enemy kill spawns exactly one gold pickup using enemy base life (not scaled hp)", () => {
    const w = createWorld({ seed: 1, stage: stageDocks });
    const e = spawnEnemyGrid(w, EnemyId.TANK, 5, 5);

    // Inflate scaled hp to ensure drop calculation ignores it.
    w.eHpMax[e] = 10_000;
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: e,
      x: 0,
      y: 0,
      source: "PISTOL",
      damageMeta: makeWeaponHitMeta("PISTOL", { category: "HIT", instigatorId: "player" }),
    });

    dropsSystem(w, 1 / 60);

    const expectedGold = goldValueFromEnemyBaseLife(w.eBaseLife[e]);
    const coinIndexes = w.xKind
      .map((kind, idx) => (kind === PICKUP_KIND.GOLD ? idx : -1))
      .filter((idx) => idx >= 0);

    expect(coinIndexes).toHaveLength(1);
    expect(w.xValue[coinIndexes[0]]).toBe(expectedGold);
    expect(w.xKind.filter((kind) => kind === PICKUP_KIND.CHEST)).toHaveLength(0);
  });

  test("boss gold multiplier applies after base-life calculation without spawning a chest", () => {
    const w = createWorld({ seed: 3, stage: stageDocks });
    const boss = spawnEnemyGrid(w, EnemyId.BOSS, 8, 8);
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: boss,
      x: 0,
      y: 0,
      source: "PISTOL",
      damageMeta: makeWeaponHitMeta("PISTOL", { category: "HIT", instigatorId: "player" }),
    });

    dropsSystem(w, 1 / 60);

    const expectedGold = goldValueFromEnemyBaseLife(w.eBaseLife[boss], { isBoss: true });
    const coinIndexes = w.xKind
      .map((kind, idx) => (kind === PICKUP_KIND.GOLD ? idx : -1))
      .filter((idx) => idx >= 0);
    const chestCount = w.xKind.filter((kind) => kind === PICKUP_KIND.CHEST).length;
    expect(coinIndexes).toHaveLength(1);
    expect(w.xValue[coinIndexes[0]]).toBe(expectedGold);
    expect(chestCount).toBe(0);
  });

  test("collecting combat pickup grants its stored value as xp", () => {
    const w = createWorld({ seed: 2, stage: stageDocks });
    const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);

    spawnGold(w, pw.wx, pw.wy, 7);
    dropsSystem(w, 1 / 60);

    expect(w.run.xp).toBe(7);
    expect(w.run.runGold).toBe(0);
    expect(w.run.level).toBe(1);
    expect(w.xAlive.some(Boolean)).toBe(false);
  });

  test("large xp pickup can trigger multiple level-up rewards", () => {
    const w = createWorld({ seed: 12, stage: stageDocks });
    const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);

    spawnGold(w, pw.wx, pw.wy, 120);
    dropsSystem(w, 1 / 60);

    expect(w.run.xp).toBe(10);
    expect(w.run.level).toBe(3);
    expect(w.run.xpToNextLevel).toBe(72);
    expect(w.level).toBe(3);
    expect(w.runEvents).toEqual([
      { type: "LEVEL_UP", floorIndex: 0, level: 2 },
      { type: "LEVEL_UP", floorIndex: 0, level: 3 },
    ]);
  });

  test("loot goblin kill emits delayed 300x1g drops and skips normal kill drops", () => {
    const w = createWorld({ seed: 4, stage: stageDocks });
    const goblin = spawnEnemyGrid(w, EnemyId.LOOT_GOBLIN, 40, 40);
    w.eSpawnTriggerId[goblin] = `${LOOT_GOBLIN_TRIGGER_PREFIX}:0:40:40`;
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: goblin,
      x: (40.5) * KENNEY_TILE_WORLD,
      y: (40.5) * KENNEY_TILE_WORLD,
      source: "PISTOL",
      damageMeta: makeWeaponHitMeta("PISTOL", { category: "HIT", instigatorId: "player" }),
    });

    // Schedules delayed drops only; no immediate regular kill drop.
    dropsSystem(w, 0);
    expect(w.xAlive.filter(Boolean)).toHaveLength(0);
    w.events.length = 0;

    for (let i = 0; i < 320; i++) {
      dropsSystem(w, 0.1);
    }

    const aliveCoinIndexes = w.xAlive
      .map((alive, idx) => (alive && (w.xKind[idx] ?? PICKUP_KIND.GOLD) === PICKUP_KIND.GOLD ? idx : -1))
      .filter((idx) => idx >= 0);
    expect(aliveCoinIndexes).toHaveLength(300);
    const total = aliveCoinIndexes.reduce((sum, idx) => sum + (w.xValue[idx] ?? 0), 0);
    expect(total).toBe(300);
    expect(w.xKind.filter((kind) => kind === PICKUP_KIND.CHEST)).toHaveLength(0);
  });
});
