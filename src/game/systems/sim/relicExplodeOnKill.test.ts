import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { ENEMY_TYPE, spawnEnemyGrid } from "../../factories/enemyFactory";
import { getEnemyWorld } from "../../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { clearSpatialHash, insertEntity } from "../../util/spatialHash";
import { relicExplodeOnKillSystem } from "./relicExplodeOnKill";
import { applyRelic } from "../progression/relics";

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

  test("applyRelic dedupes ACT_EXPLODE_ON_KILL", () => {
    const w = createWorld({ seed: 13, stage: stageDocks });
    applyRelic(w, "ACT_EXPLODE_ON_KILL");
    applyRelic(w, "ACT_EXPLODE_ON_KILL");
    expect(w.relics).toEqual(["ACT_EXPLODE_ON_KILL"]);
  });
});
