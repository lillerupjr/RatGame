import { describe, expect, it } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { PRJ_KIND, spawnProjectile } from "../../../../game/factories/projectileFactory";
import { EnemyId, spawnEnemyGrid } from "../../../../game/factories/enemyFactory";
import { collisionsSystem } from "../../../../game/systems/sim/collisions";
import { projectilesSystem } from "../../../../game/systems/sim/projectiles";
import { despawnProjectile } from "../../../../game/systems/sim/projectileLifecycle";

describe("projectileLifecycle", () => {
  it("emits projectile hit VFX only once when despawned directly", () => {
    const world = createWorld({ seed: 7, stage: stageDocks });
    const projectileIndex = spawnProjectile(world, {
      kind: PRJ_KIND.ACID,
      x: 16,
      y: 20,
      dirX: 1,
      dirY: 0,
      speed: 1,
      damage: 1,
      radius: 4,
      pierce: 0,
      ttl: 1,
    });

    despawnProjectile(world, projectileIndex, { x: 48, y: 52 });
    despawnProjectile(world, projectileIndex, { x: 48, y: 52 });

    const vfxEvents = world.events.filter((event) => event.type === "VFX");
    expect(world.pAlive[projectileIndex]).toBe(false);
    expect(vfxEvents).toHaveLength(1);
    expect(vfxEvents[0]).toMatchObject({
      id: "PROJECTILE_HIT_ACID",
      x: 48,
      y: 52,
    });
  });

  it("spawns projectile hit VFX on ttl expiry", () => {
    const world = createWorld({ seed: 8, stage: stageDocks });
    const projectileIndex = spawnProjectile(world, {
      kind: PRJ_KIND.ACID,
      x: 0,
      y: 0,
      dirX: 1,
      dirY: 0,
      speed: 1,
      damage: 1,
      radius: 4,
      pierce: 0,
      ttl: 0.01,
    });

    projectilesSystem(world, 0.02);

    const vfxEvents = world.events.filter((event) => event.type === "VFX");
    expect(world.pAlive[projectileIndex]).toBe(false);
    expect(vfxEvents).toHaveLength(1);
    expect(vfxEvents[0]).toMatchObject({ id: "PROJECTILE_HIT_ACID" });
  });

  it("spawns projectile hit VFX once on collision-based death", () => {
    const world = createWorld({ seed: 9, stage: stageDocks });
    spawnEnemyGrid(world, EnemyId.MINION, 0, 0);
    spawnProjectile(world, {
      kind: PRJ_KIND.ACID,
      x: 0,
      y: 0,
      dirX: 1,
      dirY: 0,
      speed: 1,
      damage: 3,
      radius: 10,
      pierce: 0,
      ttl: 1,
      z: 0,
      zLogical: 0,
    });

    collisionsSystem(world, 1 / 60);
    collisionsSystem(world, 1 / 60);

    const vfxEvents = world.events.filter((event) => event.type === "VFX");
    expect(vfxEvents).toHaveLength(1);
    expect(vfxEvents[0]).toMatchObject({ id: "PROJECTILE_HIT_ACID" });
  });
});
