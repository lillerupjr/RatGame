import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { EnemyId, spawnEnemyGrid } from "../../factories/enemyFactory";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getEnemyWorld, getPlayerWorld } from "../../coords/worldViews";
import { getEnemyAimWorld } from "../../combat/aimPoints";
import { makeWeaponHitMeta } from "../../combat/damageMeta";
import { spawnProjectile } from "../../factories/projectileFactory";
import { collisionsSystem } from "./collisions";
import { combatSystem } from "./combat";
import { equipRing } from "../../progression/rings/ringState";
import { createEnemyAilmentsState, addPoison, applyIgniteStacked } from "../../combat_mods/ailments/enemyAilments";
import { clearSpatialHash, insertEntity } from "../../util/spatialHash";

function rebuildEnemyHash(world: ReturnType<typeof createWorld>): void {
  clearSpatialHash(world.enemySpatialHash);
  for (let i = 0; i < world.eAlive.length; i++) {
    if (!world.eAlive[i]) continue;
    const enemyWorld = getEnemyWorld(world, i, KENNEY_TILE_WORLD);
    insertEntity(world.enemySpatialHash, i, enemyWorld.wx, enemyWorld.wy, world.eR[i] ?? 0);
  }
}

function spawnPlayerProjectileAtEnemy(
  world: ReturnType<typeof createWorld>,
  enemyIndex: number,
  args?: Partial<Parameters<typeof spawnProjectile>[1]>,
): number {
  const enemyAim = getEnemyAimWorld(world, enemyIndex);
  return spawnProjectile(world, {
    kind: 2,
    x: enemyAim.x,
    y: enemyAim.y,
    dirX: 1,
    dirY: 0,
    speed: 0,
    damage: 10,
    dmgPhys: 10,
    dmgFire: 0,
    dmgChaos: 0,
    critChance: 0,
    critMulti: 2,
    chanceBleed: 0,
    chanceIgnite: 0,
    chancePoison: 0,
    radius: 6,
    pierce: 0,
    ttl: 1,
    damageMeta: makeWeaponHitMeta("test-weapon", { category: "HIT", instigatorId: "player", isProcDamage: false }),
    ...args,
  });
}

describe("ring combat rules", () => {
  test("Lucky Chamber guarantees every fifth shot crits", () => {
    const world = createWorld({ seed: 201, stage: stageDocks });
    (world as any).currentCharacterId = "JACK";
    equipRing(world, "RING_STARTER_LUCKY_CHAMBER", "LEFT:0");
    spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    rebuildEnemyHash(world);

    for (let i = 0; i < 5; i++) {
      world.primaryWeaponCdLeft = 0;
      combatSystem(world, 1 / 60);
    }

    expect(world.prCritChance.slice(0, 4).every((chance) => chance < 1)).toBe(true);
    expect(world.prCritChance[4]).toBe(1);
  });

  test("chaos conversion moves spawned hit damage into chaos", () => {
    const world = createWorld({ seed: 202, stage: stageDocks });
    (world as any).currentCharacterId = "JACK";
    equipRing(world, "RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS", "LEFT:0");
    spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    rebuildEnemyHash(world);
    world.primaryWeaponCdLeft = 0;

    combatSystem(world, 1 / 60);

    expect(world.prDmgPhys[0]).toBe(0);
    expect(world.prDmgFire[0]).toBe(0);
    expect(world.prDmgChaos[0]).toBeGreaterThan(0);
  });

  test("Ricochet Rounds grants player weapon projectile bounces", () => {
    const world = createWorld({ seed: 2021, stage: stageDocks });
    (world as any).currentCharacterId = "JACK";
    equipRing(world, "RING_PROJECTILE_BOUNCE_ADD_1", "LEFT:0");
    spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    rebuildEnemyHash(world);
    world.primaryWeaponCdLeft = 0;

    combatSystem(world, 1 / 60);

    expect(world.prBouncesLeft[0]).toBe(1);
  });

  test("crit rolls twice can convert a failed first roll into a crit", () => {
    const world = createWorld({ seed: 203, stage: stageDocks });
    equipRing(world, "RING_CRIT_ROLLS_TWICE", "LEFT:0");
    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    rebuildEnemyHash(world);
    spawnPlayerProjectileAtEnemy(world, enemy, {
      critChance: 0.5,
      critMulti: 2,
    });
    const rolls = [0.9, 0.1];
    (world.rng as any).range = () => rolls.shift() ?? 0;

    collisionsSystem(world, 1 / 60);

    const hitEvent = world.events.find((event) => event.type === "ENEMY_HIT");
    expect(hitEvent?.type).toBe("ENEMY_HIT");
    expect((hitEvent as any)?.isCrit).toBe(true);
  });

  test("Contaminated Rounds pierces poisoned enemies and boosts piercing damage", () => {
    const world = createWorld({ seed: 204, stage: stageDocks });
    equipRing(world, "RING_STARTER_CONTAMINATED_ROUNDS", "LEFT:0");
    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    rebuildEnemyHash(world);
    world.eAilments = [];
    world.eAilments[enemy] = createEnemyAilmentsState();
    addPoison(world.eAilments[enemy]!, 20);
    const projectileIndex = spawnPlayerProjectileAtEnemy(world, enemy, { damage: 10, dmgPhys: 10 });

    collisionsSystem(world, 1 / 60);

    const hitEvent = world.events.find((event) => event.type === "ENEMY_HIT") as any;
    expect(hitEvent.damage).toBeCloseTo(12);
    expect(world.pAlive[projectileIndex]).toBe(true);
  });

  test("Point Blank Carnage increases close-range damage and knocks enemies back", () => {
    const world = createWorld({ seed: 205, stage: stageDocks });
    equipRing(world, "RING_STARTER_POINT_BLANK_CARNAGE", "LEFT:0");
    const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);
    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    const enemyBefore = getEnemyWorld(world, enemy, KENNEY_TILE_WORLD);
    rebuildEnemyHash(world);
    spawnPlayerProjectileAtEnemy(world, enemy, { damage: 10, dmgPhys: 10 });

    collisionsSystem(world, 1 / 60);

    const hitEvent = world.events.find((event) => event.type === "ENEMY_HIT") as any;
    const enemyAfter = getEnemyWorld(world, enemy, KENNEY_TILE_WORLD);
    expect(hitEvent.damage).toBeGreaterThan(10);
    expect(Math.hypot(enemyAfter.wx - playerWorld.wx, enemyAfter.wy - playerWorld.wy)).toBeGreaterThan(
      Math.hypot(enemyBefore.wx - playerWorld.wx, enemyBefore.wy - playerWorld.wy),
    );
  });

  test("Close Quarters Guard increases nearby no-pierce projectile damage", () => {
    const world = createWorld({ seed: 2052, stage: stageDocks });
    equipRing(world, "RING_PROJECTILE_CLOSE_QUARTERS_GUARD", "LEFT:0");
    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);
    const enemyAim = getEnemyAimWorld(world, enemy);
    expect(Math.hypot(enemyAim.x - playerWorld.wx, enemyAim.y - playerWorld.wy)).toBeLessThan(220);
    rebuildEnemyHash(world);
    spawnPlayerProjectileAtEnemy(world, enemy, { damage: 10, dmgPhys: 10 });

    collisionsSystem(world, 1 / 60);

    const hitEvent = world.events.find((event) => event.type === "ENEMY_HIT") as any;
    expect(hitEvent.damage).toBeCloseTo(13.5);
    expect(hitEvent.dmgPhys).toBeCloseTo(13.5);
  });

  test("Close Quarters Guard ignores piercing projectiles and distant targets", () => {
    const pierceWorld = createWorld({ seed: 2053, stage: stageDocks });
    equipRing(pierceWorld, "RING_PROJECTILE_CLOSE_QUARTERS_GUARD", "LEFT:0");
    const closeEnemy = spawnEnemyGrid(pierceWorld, EnemyId.MINION, 1, 0);
    rebuildEnemyHash(pierceWorld);
    spawnPlayerProjectileAtEnemy(pierceWorld, closeEnemy, { damage: 10, dmgPhys: 10, pierce: 1 });

    collisionsSystem(pierceWorld, 1 / 60);

    const pierceHit = pierceWorld.events.find((event) => event.type === "ENEMY_HIT") as any;
    expect(pierceHit.damage).toBeCloseTo(10);

    const distantWorld = createWorld({ seed: 2054, stage: stageDocks });
    equipRing(distantWorld, "RING_PROJECTILE_CLOSE_QUARTERS_GUARD", "LEFT:0");
    const distantEnemy = spawnEnemyGrid(distantWorld, EnemyId.MINION, 9, 9);
    const playerWorld = getPlayerWorld(distantWorld, KENNEY_TILE_WORLD);
    const enemyAim = getEnemyAimWorld(distantWorld, distantEnemy);
    expect(Math.hypot(enemyAim.x - playerWorld.wx, enemyAim.y - playerWorld.wy)).toBeGreaterThan(220);
    rebuildEnemyHash(distantWorld);
    spawnPlayerProjectileAtEnemy(distantWorld, distantEnemy, { damage: 10, dmgPhys: 10 });

    collisionsSystem(distantWorld, 1 / 60);

    const distantHit = distantWorld.events.find((event) => event.type === "ENEMY_HIT") as any;
    expect(distantHit.damage).toBeCloseTo(10);
  });

  test("Pure Force increases physical damage and suppresses non-physical damage", () => {
    const world = createWorld({ seed: 2055, stage: stageDocks });
    equipRing(world, "RING_PHYSICAL_PURE_FORCE", "LEFT:0");
    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    rebuildEnemyHash(world);
    spawnPlayerProjectileAtEnemy(world, enemy, {
      damage: 30,
      dmgPhys: 10,
      dmgFire: 10,
      dmgChaos: 10,
    });

    collisionsSystem(world, 1 / 60);

    const hitEvent = world.events.find((event) => event.type === "ENEMY_HIT") as any;
    expect(hitEvent.damage).toBeCloseTo(13);
    expect(hitEvent.dmgPhys).toBeCloseTo(13);
    expect(hitEvent.dmgFire).toBe(0);
    expect(hitEvent.dmgChaos).toBe(0);
  });

  test("Physical Devotion counts itself and another physical ring", () => {
    const world = createWorld({ seed: 2056, stage: stageDocks });
    equipRing(world, "RING_PHYSICAL_DEVOTION", "LEFT:0");
    equipRing(world, "RING_PHYSICAL_DAMAGE_PERCENT_10", "LEFT:1");
    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 1, 0);
    rebuildEnemyHash(world);
    spawnPlayerProjectileAtEnemy(world, enemy, { damage: 10, dmgPhys: 10 });

    collisionsSystem(world, 1 / 60);

    const hitEvent = world.events.find((event) => event.type === "ENEMY_HIT") as any;
    expect(hitEvent.damage).toBeCloseTo(14);
    expect(hitEvent.dmgPhys).toBeCloseTo(14);
  });

  test("Thermal Starter increases hit damage against burning enemies", () => {
    const world = createWorld({ seed: 2051, stage: stageDocks });
    equipRing(world, "RING_STARTER_THERMAL_STARTER", "LEFT:0");
    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    rebuildEnemyHash(world);
    world.eAilments = [];
    world.eAilments[enemy] = createEnemyAilmentsState();
    applyIgniteStacked(world.eAilments[enemy]!, 40);
    spawnPlayerProjectileAtEnemy(world, enemy, { damage: 10, dmgPhys: 10 });

    collisionsSystem(world, 1 / 60);

    const hitEvent = world.events.find((event) => event.type === "ENEMY_HIT") as any;
    expect(hitEvent.damage).toBeCloseTo(11.5);
  });

  test("poison extra stack chance can add a second poison stack from one hit", () => {
    const world = createWorld({ seed: 206, stage: stageDocks });
    equipRing(world, "RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25", "LEFT:0");
    const enemy = spawnEnemyGrid(world, EnemyId.MINION, 9, 9);
    rebuildEnemyHash(world);
    world.eAilments = [];
    spawnPlayerProjectileAtEnemy(world, enemy, {
      damage: 10,
      dmgPhys: 0,
      dmgChaos: 10,
      chancePoison: 1,
    });
    (world.rng as any).range = () => 0;

    collisionsSystem(world, 1 / 60);

    expect(world.eAilments?.[enemy]?.poison?.length ?? 0).toBe(2);
  });
});
