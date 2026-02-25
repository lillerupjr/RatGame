import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { PRJ_KIND, spawnProjectile } from "../../factories/projectileFactory";
import { projectilesSystem } from "./projectiles";
import { collisionsSystem } from "./collisions";
import { getPlayerWorld } from "../../coords/worldViews";
import { spawnEnemy } from "../../factories/enemyFactory";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";

describe("missile projectile", () => {
  test("arrival explosion triggers even if step would overshoot target", () => {
    const w = createWorld({ seed: 101, stage: stageDocks });
    const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
    const p = spawnProjectile(w, {
      kind: PRJ_KIND.MISSILE,
      x: pw.wx,
      y: pw.wy,
      dirX: 1,
      dirY: 0,
      speed: 700,
      damage: 0,
      radius: 5,
      pierce: 0,
      ttl: 2,
      targetX: pw.wx + 20,
      targetY: pw.wy,
      explodeRadius: 120,
    });
    w.prExplodeDmg[p] = 25;

    projectilesSystem(w, 1);

    expect(w.pAlive[p]).toBe(false);
    expect(w.zAlive.length).toBeGreaterThan(0);
  });

  test("collision causes early explosion before reaching target", () => {
    const w = createWorld({ seed: 102, stage: stageDocks });
    const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
    const enemyIndex = spawnEnemy(w, 1, pw.wx + 80, pw.wy);
    w.eHp[enemyIndex] = 1000;
    w.eHpMax[enemyIndex] = 1000;

    const p = spawnProjectile(w, {
      kind: PRJ_KIND.MISSILE,
      x: pw.wx,
      y: pw.wy,
      dirX: 1,
      dirY: 0,
      speed: 600,
      damage: 0,
      dmgPhys: 0,
      dmgFire: 0,
      dmgChaos: 0,
      radius: 6,
      pierce: 0,
      ttl: 2,
      targetX: pw.wx + 400,
      targetY: pw.wy,
      explodeRadius: 120,
    });
    w.prExplodeDmg[p] = 40;

    let exploded = false;
    for (let i = 0; i < 60; i++) {
      projectilesSystem(w, 1 / 60);
      collisionsSystem(w, 1 / 60);
      if (!w.pAlive[p]) {
        exploded = true;
        break;
      }
    }

    expect(exploded).toBe(true);
    expect(w.zAlive.length).toBeGreaterThan(0);
  });
});
