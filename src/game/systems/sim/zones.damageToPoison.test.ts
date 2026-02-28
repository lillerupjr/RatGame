import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { ENEMY_TYPE, spawnEnemyGrid } from "../../factories/enemyFactory";
import { clearSpatialHash, insertEntity } from "../../util/spatialHash";
import { getEnemyWorld } from "../../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";
import { zonesSystem } from "./zones";

function rebuildEnemyHash(world: ReturnType<typeof createWorld>): void {
  clearSpatialHash(world.enemySpatialHash);
  for (let i = 0; i < world.eAlive.length; i++) {
    if (!world.eAlive[i]) continue;
    const ew = getEnemyWorld(world, i, KENNEY_TILE_WORLD);
    insertEntity(world.enemySpatialHash, i, ew.wx, ew.wy, world.eR[i] ?? 0);
  }
}

describe("zonesSystem damage-to-poison conversion", () => {
  test("PASS_DAMAGE_TO_POISON_ALL converts zone damage into poison", () => {
    const w = createWorld({ seed: 46, stage: stageDocks });
    w.relics = ["PASS_DAMAGE_TO_POISON_ALL"];
    const enemy = spawnEnemyGrid(w, ENEMY_TYPE.CHASER, 8, 8);
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

    expect(w.eHp[enemy]).toBeCloseTo(180, 6);
    const poisonStacks = w.eAilments[enemy]?.poison ?? [];
    expect(poisonStacks.length).toBe(1);
    expect(poisonStacks[0].dps).toBeCloseTo(2, 6);
  });
});
