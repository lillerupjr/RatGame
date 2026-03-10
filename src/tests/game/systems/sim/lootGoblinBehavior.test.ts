import { describe, expect, test } from "vitest";
import { createWorld, type World } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { anchorFromWorld } from "../../../../game/coords/anchor";
import { worldToGrid } from "../../../../game/coords/grid";
import { getEnemyWorld, getPlayerWorld } from "../../../../game/coords/worldViews";
import { ENEMY_TYPE, spawnEnemyGrid, type EnemyType } from "../../../../game/factories/enemyFactory";
import { getAuthoredMapDefByMapId } from "../../../../game/map/authored/authoredMapRegistry";
import { activateMapDef } from "../../../../game/map/authoredMapActivation";
import { getActiveMap, walkInfo } from "../../../../game/map/compile/kenneyMap";
import { movementSystem } from "../../../../game/systems/sim/movement";
import { collisionsSystem } from "../../../../game/systems/sim/collisions";
import type { InputState } from "../../../../game/systems/sim/input";
import { LOOT_GOBLIN_TRIGGER_PREFIX } from "../../../../game/systems/progression/lootGoblin";

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

function setPlayerAtTile(world: World, tx: number, ty: number): void {
  const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
  const anchor = anchorFromWorld(wx, wy, KENNEY_TILE_WORLD);
  world.pgxi = anchor.gxi;
  world.pgyi = anchor.gyi;
  world.pgox = anchor.gox;
  world.pgoy = anchor.goy;
}

function spawnEnemyAtTile(
  world: World,
  tx: number,
  ty: number,
  type: EnemyType = ENEMY_TYPE.LOOT_GOBLIN,
): number {
  const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
  const gp = worldToGrid(wx, wy, KENNEY_TILE_WORLD);
  return spawnEnemyGrid(world, type, gp.gx, gp.gy, KENNEY_TILE_WORLD);
}

function isWalkableTile(tx: number, ty: number): boolean {
  const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
  const info = walkInfo(wx, wy, KENNEY_TILE_WORLD);
  return info.walkable && info.kind !== "STAIRS";
}

function activateTestMap(seed: number): void {
  const mapDef = getAuthoredMapDefByMapId("china_town");
  expect(mapDef).toBeTruthy();
  if (!mapDef) return;
  activateMapDef(mapDef, seed);
}

function findFarWalkablePair(minDistTiles: number): { player: TilePos; enemy: TilePos } {
  const map = getActiveMap();
  let first: TilePos | null = null;
  for (let ty = map.originTy; ty < map.originTy + map.height; ty++) {
    for (let tx = map.originTx; tx < map.originTx + map.width; tx++) {
      if (!isWalkableTile(tx, ty)) continue;
      if (!first) {
        first = { tx, ty };
        continue;
      }
      const d = Math.hypot(tx - first.tx, ty - first.ty);
      if (d >= minDistTiles) {
        return { player: first, enemy: { tx, ty } };
      }
    }
  }
  throw new Error("Could not find far walkable tile pair");
}

function findFleePairWithOpenAwayTile(): { player: TilePos; enemy: TilePos } {
  const map = getActiveMap();
  const dirs: Array<{ dx: number; dy: number }> = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
  ];
  for (let py = map.originTy; py < map.originTy + map.height; py++) {
    for (let px = map.originTx; px < map.originTx + map.width; px++) {
      if (!isWalkableTile(px, py)) continue;
      for (let i = 0; i < dirs.length; i++) {
        const dx = dirs[i].dx;
        const dy = dirs[i].dy;
        const ex = px + dx;
        const ey = py + dy;
        const ax = ex + dx;
        const ay = ey + dy;
        if (!isWalkableTile(ex, ey)) continue;
        if (!isWalkableTile(ax, ay)) continue;
        return {
          player: { tx: px, ty: py },
          enemy: { tx: ex, ty: ey },
        };
      }
    }
  }
  throw new Error("Could not find flee pair with open away tile");
}

describe("loot goblin behavior", () => {
  test("loot goblin stays idle when player is farther than flee radius", () => {
    activateTestMap(22_001);
    const world = createWorld({ seed: 22_001, stage: stageDocks });
    const pair = findFarWalkablePair(9);
    setPlayerAtTile(world, pair.player.tx, pair.player.ty);
    const goblin = spawnEnemyAtTile(world, pair.enemy.tx, pair.enemy.ty);
    world.eSpawnTriggerId[goblin] = `${LOOT_GOBLIN_TRIGGER_PREFIX}:0:${pair.enemy.tx}:${pair.enemy.ty}`;

    const before = getEnemyWorld(world, goblin, KENNEY_TILE_WORLD);
    movementSystem(world, baseInput(), 0.25);
    const after = getEnemyWorld(world, goblin, KENNEY_TILE_WORLD);
    const moved = Math.hypot(after.wx - before.wx, after.wy - before.wy);
    expect(moved).toBeLessThan(0.001);
  });

  test("loot goblin flees when player is near", () => {
    activateTestMap(22_002);
    const world = createWorld({ seed: 22_002, stage: stageDocks });
    const pair = findFleePairWithOpenAwayTile();
    setPlayerAtTile(world, pair.player.tx, pair.player.ty);
    const goblin = spawnEnemyAtTile(world, pair.enemy.tx, pair.enemy.ty);
    world.eSpawnTriggerId[goblin] = `${LOOT_GOBLIN_TRIGGER_PREFIX}:0:${pair.enemy.tx}:${pair.enemy.ty}`;

    const playerBefore = getPlayerWorld(world, KENNEY_TILE_WORLD);
    const enemyBefore = getEnemyWorld(world, goblin, KENNEY_TILE_WORLD);
    const beforeDist = Math.hypot(enemyBefore.wx - playerBefore.wx, enemyBefore.wy - playerBefore.wy);

    movementSystem(world, baseInput(), 0.25);

    const playerAfter = getPlayerWorld(world, KENNEY_TILE_WORLD);
    const enemyAfter = getEnemyWorld(world, goblin, KENNEY_TILE_WORLD);
    const afterDist = Math.hypot(enemyAfter.wx - playerAfter.wx, enemyAfter.wy - playerAfter.wy);
    expect(afterDist).toBeGreaterThan(beforeDist);
  });

  test("loot goblin contact does not damage or collide with player", () => {
    activateTestMap(22_003);
    const world = createWorld({ seed: 22_003, stage: stageDocks });
    const map = getActiveMap();
    setPlayerAtTile(world, map.spawnTx, map.spawnTy);
    const goblin = spawnEnemyAtTile(world, map.spawnTx, map.spawnTy);
    world.eSpawnTriggerId[goblin] = `${LOOT_GOBLIN_TRIGGER_PREFIX}:0:${map.spawnTx}:${map.spawnTy}`;
    world.eDamage[goblin] = 999;
    const hpBefore = world.playerHp;
    const playerPosBefore = getPlayerWorld(world, KENNEY_TILE_WORLD);

    collisionsSystem(world, 1 / 60);

    const playerPosAfter = getPlayerWorld(world, KENNEY_TILE_WORLD);
    expect(world.playerHp).toBe(hpBefore);
    expect(world.events.some((ev) => ev.type === "PLAYER_HIT")).toBe(false);
    expect(playerPosAfter.wx).toBeCloseTo(playerPosBefore.wx, 6);
    expect(playerPosAfter.wy).toBeCloseTo(playerPosBefore.wy, 6);
  });

  test("non-goblin enemy contact still damages player", () => {
    activateTestMap(22_004);
    const world = createWorld({ seed: 22_004, stage: stageDocks });
    const pair = findFleePairWithOpenAwayTile();
    setPlayerAtTile(world, pair.player.tx, pair.player.ty);
    const enemy = spawnEnemyAtTile(world, pair.player.tx, pair.player.ty, ENEMY_TYPE.RUNNER);
    const playerZ = Number.isFinite(world.pzVisual) ? world.pzVisual : world.pz;
    world.ezVisual[enemy] = playerZ;
    world.ezLogical[enemy] = playerZ;
    world.maxArmor = 0;
    world.currentArmor = 0;
    world.eDamage[enemy] = 12;
    const hpBefore = world.playerHp;

    collisionsSystem(world, 1 / 60);

    expect(world.playerHp).toBeLessThan(hpBefore);
    expect(world.events.some((ev) => ev.type === "PLAYER_HIT")).toBe(true);
  });
});
