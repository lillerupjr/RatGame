import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { ENEMY_TYPE } from "../../../../game/factories/enemyFactory";
import { spawnEnemyGrid } from "../../../../game/factories/enemyFactory";
import { goldValueFromEnemyMaxHp } from "../../../../game/economy/coins";
import { dropsSystem } from "../../../../game/systems/progression/drops";
import { PICKUP_KIND, spawnGold } from "../../../../game/systems/progression/pickups";
import { getPlayerWorld } from "../../../../game/coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { makeWeaponHitMeta } from "../../../../game/combat/damageMeta";

describe("dropsSystem", () => {
  test("enemy kill spawns gold pickup value scaled by enemy max hp", () => {
    const w = createWorld({ seed: 1, stage: stageDocks });
    const e = spawnEnemyGrid(w, ENEMY_TYPE.BRUISER, 5, 5);

    const hpMax = 100;
    w.eHpMax[e] = hpMax;
    w.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: e,
      x: 0,
      y: 0,
      source: "PISTOL",
      damageMeta: makeWeaponHitMeta("PISTOL", { category: "HIT", instigatorId: "player" }),
    });

    dropsSystem(w, 1 / 60);

    const idx = w.xKind.findIndex((k) => k === PICKUP_KIND.GOLD);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(w.xValue[idx]).toBe(goldValueFromEnemyMaxHp(hpMax));
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
