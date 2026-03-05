import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { ENEMY_TYPE } from "../../../../game/factories/enemyFactory";
import { spawnEnemyGrid } from "../../../../game/factories/enemyFactory";
import { goldValueFromEnemyBaseLife } from "../../../../game/economy/coins";
import { dropsSystem } from "../../../../game/systems/progression/drops";
import { PICKUP_KIND, spawnGold } from "../../../../game/systems/progression/pickups";
import { getPlayerWorld } from "../../../../game/coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { makeWeaponHitMeta } from "../../../../game/combat/damageMeta";

describe("dropsSystem", () => {
  test("enemy kill spawns one-value coins using enemy base life (not scaled hp)", () => {
    const w = createWorld({ seed: 1, stage: stageDocks });
    const e = spawnEnemyGrid(w, ENEMY_TYPE.BRUISER, 5, 5);

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

    expect(coinIndexes).toHaveLength(expectedGold);
    for (const idx of coinIndexes) {
      expect(w.xValue[idx]).toBe(1);
    }
  });

  test("boss gold multiplier applies after base-life calculation", () => {
    const w = createWorld({ seed: 3, stage: stageDocks });
    const boss = spawnEnemyGrid(w, ENEMY_TYPE.BOSS, 8, 8);
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
    const coinCount = w.xKind.filter((kind) => kind === PICKUP_KIND.GOLD).length;
    const chestCount = w.xKind.filter((kind) => kind === PICKUP_KIND.CHEST).length;
    expect(coinCount).toBe(expectedGold);
    expect(chestCount).toBe(1);
  });

  test("collecting gold pickup grants its stored value", () => {
    const w = createWorld({ seed: 2, stage: stageDocks });
    const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);

    spawnGold(w, pw.wx, pw.wy, 7);
    dropsSystem(w, 1 / 60);

    expect(w.run.runGold).toBe(7);
    expect(w.xAlive.some(Boolean)).toBe(false);
  });
});
