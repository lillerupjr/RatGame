import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { makeUnknownDamageMeta } from "../../../../game/combat/damageMeta";
import { ENEMIES, EnemyId } from "../../../../game/content/enemies";
import { stageDocks } from "../../../../game/content/stages";
import { getEnemyWorld } from "../../../../game/coords/worldViews";
import { spawnEnemyGrid } from "../../../../game/factories/enemyFactory";
import { finalizeEnemyDeath } from "../../../../game/systems/enemies/finalize";

describe("enemy death effects", () => {
  test("shard rat emits an even radial projectile burst through the centralized death pipeline", () => {
    const world = createWorld({ seed: 91_101, stage: stageDocks });
    const enemyIndex = spawnEnemyGrid(world, EnemyId.SHARD_RAT, 8, 8, KENNEY_TILE_WORLD);
    const enemyPos = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
    const effect = ENEMIES[EnemyId.SHARD_RAT]!.deathEffects?.[0];

    expect(effect).toMatchObject({
      type: "radial_projectiles",
      count: 8,
    });
    if (!effect || effect.type !== "radial_projectiles") {
      throw new Error("Expected shard rat radial projectile effect");
    }

    const finalized = finalizeEnemyDeath(world, enemyIndex, {
      damageMeta: makeUnknownDamageMeta("test_shard_rat_death"),
      source: "OTHER",
    });

    expect(finalized).toBe(true);
    expect(world.eAlive[enemyIndex]).toBe(false);
    expect(world.events.some((event) => event.type === "ENEMY_KILLED" && event.enemyIndex === enemyIndex)).toBe(true);

    const projectileIndices = world.pAlive
      .map((alive, index) => (alive ? index : -1))
      .filter((index) => index >= 0);
    expect(projectileIndices).toHaveLength(effect.count);

    const angles = projectileIndices
      .map((projectileIndex) => {
        expect(world.prjKind[projectileIndex]).toBe(effect.projectileKind);
        expect(world.prHitsPlayer[projectileIndex]).toBe(true);
        expect(world.prNoCollide[projectileIndex]).toBe(true);
        expect(world.prStartX[projectileIndex]).toBeCloseTo(enemyPos.wx, 3);
        expect(world.prStartY[projectileIndex]).toBeCloseTo(enemyPos.wy, 3);
        return Math.atan2(world.prDirY[projectileIndex], world.prDirX[projectileIndex]);
      })
      .sort((a, b) => a - b);

    const expectedGap = (Math.PI * 2) / effect.count;
    for (let i = 0; i < angles.length; i++) {
      const nextAngle = i === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[i + 1];
      expect(nextAngle - angles[i]).toBeCloseTo(expectedGap, 3);
    }
  });
});
