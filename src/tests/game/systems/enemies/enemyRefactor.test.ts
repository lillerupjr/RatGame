import { describe, expect, test } from "vitest";
import { createWorld, type World } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { anchorFromWorld, writeAnchor } from "../../../../game/coords/anchor";
import { worldToGrid } from "../../../../game/coords/grid";
import { getEnemyWorld, getPlayerWorld } from "../../../../game/coords/worldViews";
import {
  ENEMIES,
  EnemyId,
} from "../../../../game/content/enemies";
import { getAuthoredMapDefByMapId } from "../../../../game/map/authored/authoredMapRegistry";
import { activateMapDef, getActiveMap } from "../../../../game/map/authoredMapActivation";
import { walkInfo } from "../../../../game/map/compile/kenneyMap";
import { spawnEnemyGrid } from "../../../../game/factories/enemyFactory";
import { PRJ_KIND } from "../../../../game/factories/projectileFactory";
import { ensureEnemyBrain } from "../../../../game/systems/enemies/brain";
import { enemyBehaviorSystem } from "../../../../game/systems/enemies/behavior";
import { enemyActionSystem } from "../../../../game/systems/enemies/actions";
import { movementSystem } from "../../../../game/systems/sim/movement";
import { projectilesSystem } from "../../../../game/systems/sim/projectiles";
import { collisionsSystem } from "../../../../game/systems/sim/collisions";
import type { InputState } from "../../../../game/systems/sim/input";

type TilePos = { tx: number; ty: number };

function baseInput(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    moveMag: 0,
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    interact: false,
    interactPressed: false,
  };
}

function activateTestMap(seed: number): void {
  const mapDef = getAuthoredMapDefByMapId("china_town");
  expect(mapDef).toBeTruthy();
  if (!mapDef) return;
  activateMapDef(mapDef, seed);
}

function isWalkableTile(tx: number, ty: number): boolean {
  const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
  const info = walkInfo(wx, wy, KENNEY_TILE_WORLD);
  return info.walkable && info.kind !== "STAIRS";
}

function findStraightWalkableLine(
  minEnemyGapTiles: number,
  maxEnemyGapTiles: number,
  extraFarGapTiles: number,
): {
  player: TilePos;
  enemy: TilePos;
  far: TilePos;
  dir: { dx: number; dy: number };
} {
  const map = getActiveMap();
  if (!map) throw new Error("Expected an active map");
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
  ];

  for (let ty = map.originTy; ty < map.originTy + map.height; ty++) {
    for (let tx = map.originTx; tx < map.originTx + map.width; tx++) {
      if (!isWalkableTile(tx, ty)) continue;
      for (let gap = minEnemyGapTiles; gap <= maxEnemyGapTiles; gap++) {
        const farGap = gap + Math.max(0, extraFarGapTiles);
        for (let di = 0; di < dirs.length; di++) {
          const dir = dirs[di];
          const enemyTx = tx + dir.dx * gap;
          const enemyTy = ty + dir.dy * gap;
          const farTx = tx + dir.dx * farGap;
          const farTy = ty + dir.dy * farGap;
          let clear = true;
          for (let step = 1; step <= farGap; step++) {
            const checkTx = tx + dir.dx * step;
            const checkTy = ty + dir.dy * step;
            if (!isWalkableTile(checkTx, checkTy)) {
              clear = false;
              break;
            }
          }
          if (!clear) continue;
          return {
            player: { tx, ty },
            enemy: { tx: enemyTx, ty: enemyTy },
            far: { tx: farTx, ty: farTy },
            dir,
          };
        }
      }
    }
  }

  throw new Error("Could not find straight walkable line");
}

function setPlayerAtTile(world: World, tx: number, ty: number): void {
  const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
  const anchor = anchorFromWorld(wx, wy, KENNEY_TILE_WORLD);
  world.pgxi = anchor.gxi;
  world.pgyi = anchor.gyi;
  world.pgox = anchor.gox;
  world.pgoy = anchor.goy;
}

function setEnemyWorld(world: World, enemyIndex: number, wx: number, wy: number): void {
  const anchor = anchorFromWorld(wx, wy, KENNEY_TILE_WORLD);
  writeAnchor({ gxi: world.egxi, gyi: world.egyi, gox: world.egox, goy: world.egoy }, enemyIndex, anchor);
}

function spawnEnemyAtTile(world: World, tx: number, ty: number, type: EnemyId): number {
  const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
  const gp = worldToGrid(wx, wy, KENNEY_TILE_WORLD);
  return spawnEnemyGrid(world, type, gp.gx, gp.gy, KENNEY_TILE_WORLD);
}

function centerDistanceToPlayer(world: World, enemyIndex: number): number {
  const pw = getPlayerWorld(world, KENNEY_TILE_WORLD);
  const ew = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
  return Math.hypot(ew.wx - pw.wx, ew.wy - pw.wy);
}

describe("enemy definition contract", () => {
  test("exposes explicit ai types, new content names, and single ability ownership", () => {
    expect(ENEMIES[EnemyId.MINION].name).toBe("Minion");
    expect(ENEMIES[EnemyId.RUNNER].name).toBe("Runner");
    expect(ENEMIES[EnemyId.TANK].name).toBe("Tank");
    expect(ENEMIES[EnemyId.SPITTER].name).toBe("Spitter");
    expect(ENEMIES[EnemyId.BURSTER].name).toBe("Burster");
    expect(ENEMIES[EnemyId.LEAPER1].name).toBe("Leaper1");
    expect(ENEMIES[EnemyId.SHARD_RAT].name).toBe("Shard Rat");
    expect(ENEMIES[EnemyId.MINION].presentation?.sprite?.skin).toBe("enemies/small_rat");
    expect(ENEMIES[EnemyId.RUNNER].presentation?.sprite?.skin).toBe("enemies/brown_rat");
    expect(ENEMIES[EnemyId.TANK].presentation?.sprite?.skin).toBe("enemies/guerilla_rat");
    expect(ENEMIES[EnemyId.SPITTER].presentation?.sprite?.skin).toBe("enemies/spitter");
    expect(ENEMIES[EnemyId.BURSTER].presentation?.sprite?.skin).toBe("enemies/burster");
    expect(ENEMIES[EnemyId.LEAPER1].presentation?.sprite?.skin).toBe("enemies/white_rat");
    expect(ENEMIES[EnemyId.SHARD_RAT].presentation?.sprite?.skin).toBe("enemies/shard_rat");

    for (const type of [
      EnemyId.MINION,
      EnemyId.RUNNER,
      EnemyId.TANK,
      EnemyId.SPITTER,
      EnemyId.BURSTER,
      EnemyId.LEAPER1,
      EnemyId.SHARD_RAT,
      EnemyId.LOOT_GOBLIN,
      EnemyId.BOSS,
    ]) {
      expect(typeof ENEMIES[type].aiType).toBe("string");
      expect(ENEMIES[type].stats.baseLife).toBeGreaterThan(0);
      expect(ENEMIES[type].body.radius).toBeGreaterThan(0);
      expect(ENEMIES[type].movement.speed).toBeGreaterThanOrEqual(0);
    }

    expect(ENEMIES[EnemyId.MINION].ability).toBeNull();
    expect(ENEMIES[EnemyId.RUNNER].ability).toBeNull();
    expect(ENEMIES[EnemyId.TANK].ability).toBeNull();
    expect(ENEMIES[EnemyId.SHARD_RAT].ability).toBeNull();
    expect(ENEMIES[EnemyId.LOOT_GOBLIN].ability).toBeNull();
    expect(ENEMIES[EnemyId.BOSS].ability).toBeNull();

    expect(ENEMIES[EnemyId.SPITTER].ability?.kind).toBe("projectile");
    expect(ENEMIES[EnemyId.BURSTER].ability?.kind).toBe("explode");
    expect(ENEMIES[EnemyId.LEAPER1].ability?.kind).toBe("leap");
    expect(ENEMIES[EnemyId.SHARD_RAT].deathEffects).toEqual([
      expect.objectContaining({
        type: "radial_projectiles",
        count: 8,
        projectileKind: PRJ_KIND.DAGGER,
      }),
    ]);
  });

  test("spawn initializes shared-ai enemies into the simplified move state", () => {
    activateTestMap(91_001);
    const world = createWorld({ seed: 91_001, stage: stageDocks });
    const map = getActiveMap();
    if (!map) throw new Error("Expected an active map");
    const enemy = spawnEnemyAtTile(world, map.spawnTx + 1, map.spawnTy, EnemyId.SPITTER);
    const brain = ensureEnemyBrain(world, enemy);
    expect(brain.state).toBe("move");
    expect(brain.cooldownLeftSec).toBe(0);
    expect(brain.leapTimeLeftSec).toBe(0);
  });
});

describe("enemy shared behavior and action flow", () => {
  test("contact enemies stay on move and use no active ability", () => {
    activateTestMap(91_002);
    const world = createWorld({ seed: 91_002, stage: stageDocks });
    const line = findStraightWalkableLine(3, 4, 4);
    setPlayerAtTile(world, line.player.tx, line.player.ty);
    const enemy = spawnEnemyAtTile(world, line.enemy.tx, line.enemy.ty, EnemyId.MINION);

    enemyBehaviorSystem(world, 0.1);

    expect(ensureEnemyBrain(world, enemy).state).toBe("move");
    expect(ENEMIES[EnemyId.MINION].ability).toBeNull();
  });

  test("spitter winds up, fires through the shared projectile path, and enters cooldown", () => {
    activateTestMap(91_003);
    const world = createWorld({ seed: 91_003, stage: stageDocks });
    const line = findStraightWalkableLine(4, 4, 4);
    setPlayerAtTile(world, line.player.tx, line.player.ty);
    const enemy = spawnEnemyAtTile(world, line.enemy.tx, line.enemy.ty, EnemyId.SPITTER);
    const hpBefore = world.playerHp;

    enemyBehaviorSystem(world, 0.05);
    expect(ensureEnemyBrain(world, enemy).state).toBe("windup");

    enemyBehaviorSystem(world, 0.4);
    expect(ensureEnemyBrain(world, enemy).state).toBe("acting");

    enemyActionSystem(world, 0.016);
    const brainAfterAction = ensureEnemyBrain(world, enemy);
    expect(brainAfterAction.state).toBe("cooldown");
    expect(world.pAlive.some(Boolean)).toBe(true);
    expect(world.prjKind.find((kind) => Number.isFinite(kind))).toBe(PRJ_KIND.ACID);

    for (let i = 0; i < 40; i++) {
      projectilesSystem(world, 1 / 30);
      collisionsSystem(world, 1 / 30);
      if (world.events.some((ev) => ev.type === "PLAYER_HIT")) break;
    }

    expect(world.events.some((ev) => ev.type === "PLAYER_HIT")).toBe(true);
    expect(world.playerHp).toBeLessThan(hpBefore);
  });

  test("spitter re-enters move when the player leaves its effective range", () => {
    activateTestMap(91_004);
    const world = createWorld({ seed: 91_004, stage: stageDocks });
    const line = findStraightWalkableLine(4, 4, 8);
    const input = baseInput();
    setPlayerAtTile(world, line.player.tx, line.player.ty);
    const enemy = spawnEnemyAtTile(world, line.enemy.tx, line.enemy.ty, EnemyId.SPITTER);

    let reachedAbilityState = false;
    for (let i = 0; i < 80; i++) {
      enemyBehaviorSystem(world, 0.1);
      movementSystem(world, input, 0.1);
      enemyActionSystem(world, 0.1);
      const state = ensureEnemyBrain(world, enemy).state;
      if (state === "windup" || state === "acting" || state === "cooldown") {
        reachedAbilityState = true;
        break;
      }
    }

    expect(reachedAbilityState).toBe(true);

    for (let i = 0; i < 20; i++) {
      enemyBehaviorSystem(world, 0.1);
      movementSystem(world, input, 0.1);
      enemyActionSystem(world, 0.1);
      if (ensureEnemyBrain(world, enemy).state === "cooldown") break;
    }

    setPlayerAtTile(world, line.far.tx, line.far.ty);
    const distanceBefore = centerDistanceToPlayer(world, enemy);

    let movedAgain = false;
    for (let i = 0; i < 6; i++) {
      enemyBehaviorSystem(world, 0.1);
      movementSystem(world, input, 0.1);
      enemyActionSystem(world, 0.1);
      if (ensureEnemyBrain(world, enemy).state === "move") {
        movedAgain = true;
        break;
      }
    }

    const distanceAfter = centerDistanceToPlayer(world, enemy);
    expect(movedAgain).toBe(true);
    expect(distanceAfter).toBeLessThan(distanceBefore);
  });

  test("burster explodes through the shared ability path and self-destructs", () => {
    activateTestMap(91_005);
    const world = createWorld({ seed: 91_005, stage: stageDocks });
    const line = findStraightWalkableLine(1, 1, 1);
    setPlayerAtTile(world, line.player.tx, line.player.ty);
    const enemy = spawnEnemyAtTile(world, line.player.tx, line.player.ty, EnemyId.BURSTER);
    const playerPos = getPlayerWorld(world, KENNEY_TILE_WORLD);
    setEnemyWorld(world, enemy, playerPos.wx + 56, playerPos.wy);
    const hpBefore = world.playerHp;

    enemyBehaviorSystem(world, 0.05);
    expect(ensureEnemyBrain(world, enemy).state).toBe("windup");

    enemyBehaviorSystem(world, 0.6);
    expect(ensureEnemyBrain(world, enemy).state).toBe("acting");

    enemyActionSystem(world, 0.016);

    expect(world.eAlive[enemy]).toBe(false);
    expect(ensureEnemyBrain(world, enemy).state).toBe("dead");
    expect(world.playerHp).toBeLessThan(hpBefore);
    expect(world.events.some((ev) => ev.type === "PLAYER_HIT")).toBe(true);
    expect(world.events.some((ev) => ev.type === "ENEMY_KILLED" && ev.enemyIndex === enemy)).toBe(true);
  });

  test("leaper1 commits a leap through the shared movement loop and lands in cooldown", () => {
    activateTestMap(91_006);
    const world = createWorld({ seed: 91_006, stage: stageDocks });
    const input = baseInput();
    const line = findStraightWalkableLine(1, 1, 2);
    setPlayerAtTile(world, line.player.tx, line.player.ty);
    const enemy = spawnEnemyAtTile(world, line.player.tx, line.player.ty, EnemyId.LEAPER1);
    const playerPos = getPlayerWorld(world, KENNEY_TILE_WORLD);
    setEnemyWorld(world, enemy, playerPos.wx + 112, playerPos.wy);
    const hpBefore = world.playerHp;

    enemyBehaviorSystem(world, 0.05);
    expect(ensureEnemyBrain(world, enemy).state).toBe("windup");

    enemyBehaviorSystem(world, 0.5);
    expect(ensureEnemyBrain(world, enemy).state).toBe("acting");

    enemyActionSystem(world, 0.016);
    const brainAfterCommit = ensureEnemyBrain(world, enemy);
    expect(brainAfterCommit.leapTimeLeftSec).toBeGreaterThan(0);

    const startDist = centerDistanceToPlayer(world, enemy);
    for (let i = 0; i < 12; i++) {
      enemyBehaviorSystem(world, 0.05);
      movementSystem(world, input, 0.05);
      enemyActionSystem(world, 0.05);
      if (ensureEnemyBrain(world, enemy).state === "cooldown") break;
    }

    const endDist = centerDistanceToPlayer(world, enemy);
    expect(ensureEnemyBrain(world, enemy).state).toBe("cooldown");
    expect(endDist).toBeLessThan(startDist);
    expect(world.playerHp).toBeLessThan(hpBefore);
  });

  test("leaper1 does not back away from a nearby player to set up its leap", () => {
    activateTestMap(91_007);
    const world = createWorld({ seed: 91_007, stage: stageDocks });
    const input = baseInput();
    const line = findStraightWalkableLine(1, 1, 2);
    setPlayerAtTile(world, line.player.tx, line.player.ty);
    const enemy = spawnEnemyAtTile(world, line.player.tx, line.player.ty, EnemyId.LEAPER1);
    const playerPos = getPlayerWorld(world, KENNEY_TILE_WORLD);
    setEnemyWorld(world, enemy, playerPos.wx + 96, playerPos.wy);
    const startDist = centerDistanceToPlayer(world, enemy);

    enemyBehaviorSystem(world, 0.05);
    expect(ensureEnemyBrain(world, enemy).state).toBe("windup");

    movementSystem(world, input, 0.05);

    const endDist = centerDistanceToPlayer(world, enemy);
    expect(endDist).toBeLessThanOrEqual(startDist + 0.001);
  });

  test("leaper1 returns to chase movement while leap cooldown is running", () => {
    activateTestMap(91_008);
    const world = createWorld({ seed: 91_008, stage: stageDocks });
    const input = baseInput();
    const line = findStraightWalkableLine(5, 5, 2);
    setPlayerAtTile(world, line.player.tx, line.player.ty);
    const enemy = spawnEnemyAtTile(world, line.enemy.tx, line.enemy.ty, EnemyId.LEAPER1);
    const brain = ensureEnemyBrain(world, enemy);
    brain.cooldownLeftSec = 0.6;
    const startDist = centerDistanceToPlayer(world, enemy);

    for (let i = 0; i < 5; i++) {
      enemyBehaviorSystem(world, 0.05);
      expect(brain.state).toBe("move");
      movementSystem(world, input, 0.05);
    }

    const endDist = centerDistanceToPlayer(world, enemy);
    expect(endDist).toBeLessThan(startDist);
  });
});
