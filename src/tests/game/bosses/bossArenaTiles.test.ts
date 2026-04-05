import { afterEach, describe, expect, it, vi } from "vitest";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { createWorld } from "../../../engine/world/world";
import { BossId } from "../../../game/bosses/bossTypes";
import {
  collectBossArenaFootprintTiles,
  resolveBossArenaAnchorTile,
  selectCheckerboardTiles,
} from "../../../game/bosses/bossArenaTiles";
import { spawnBossEncounter } from "../../../game/bosses/spawnBossEncounter";
import { stageDocks } from "../../../game/content/stages";
import { getEnemyWorld } from "../../../game/coords/worldViews";
import * as authoredMapActivation from "../../../game/map/authoredMapActivation";
import { worldToTile } from "../../../game/map/compile/kenneyMap";
import { compileKenneyMapFromTable } from "../../../game/map/compile/kenneyMapLoader";

function createBossWorld() {
  const world = createWorld({ seed: 7701, stage: stageDocks });
  const result = spawnBossEncounter(world, {
    bossId: BossId.CHEM_GUY,
    spawnWorldX: 192,
    spawnWorldY: 192,
    objectiveId: "OBJ_ACT_BOSS",
  });
  return { world, result };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bossArenaTiles", () => {
  it("selects only tiles that match the requested checkerboard parity", () => {
    const tiles = [
      { tx: 0, ty: 0 },
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
      { tx: 0, ty: 1 },
      { tx: 1, ty: 1 },
    ];

    const evenTiles = selectCheckerboardTiles(tiles, 0);
    const oddTiles = selectCheckerboardTiles(tiles, 1);

    expect(evenTiles).toEqual([
      { tx: 0, ty: 0 },
      { tx: 2, ty: 0 },
      { tx: 1, ty: 1 },
    ]);
    expect(oddTiles).toEqual([
      { tx: 1, ty: 0 },
      { tx: 0, ty: 1 },
    ]);
  });

  it("uses authored boss_spawn as the stable arena anchor and filters to walkable in-bounds tiles", () => {
    const compiled = compileKenneyMapFromTable({
      id: "CHECKERBOARD_ARENA_TEST",
      w: 5,
      h: 5,
      cells: Array.from({ length: 25 }, (_, index) => {
        const x = index % 5;
        const y = Math.floor(index / 5);
        return {
          x,
          y,
          type:
            x === 0 && y === 0
              ? "spawn" as const
              : x === 4 && y === 4
                ? "wall" as const
                : "sidewalk" as const,
          z: 0,
        };
      }),
      stamps: [
        { x: 2, y: 2, type: "boss_spawn" },
      ],
    });
    vi.spyOn(authoredMapActivation, "getActiveMap").mockReturnValue(compiled);
    const { world, result } = createBossWorld();

    const anchor = resolveBossArenaAnchorTile(world, result.enemyIndex);
    const tiles = collectBossArenaFootprintTiles(world, anchor, 3, 3);

    expect(anchor).toEqual({ tx: 2, ty: 2 });
    expect(tiles.every((tile) => tile.tx >= 0 && tile.tx <= 4 && tile.ty >= 0 && tile.ty <= 4)).toBe(true);
    expect(tiles).not.toContainEqual({ tx: 4, ty: 4 });
  });

  it("falls back to the boss tile and an unclamped rectangle when no authored map is active", () => {
    vi.spyOn(authoredMapActivation, "getActiveMap").mockReturnValue(null);
    const { world, result } = createBossWorld();

    const bossWorld = getEnemyWorld(world, result.enemyIndex, KENNEY_TILE_WORLD);
    const bossTile = worldToTile(bossWorld.wx, bossWorld.wy, KENNEY_TILE_WORLD);
    const anchor = resolveBossArenaAnchorTile(world, result.enemyIndex);
    const tiles = collectBossArenaFootprintTiles(world, anchor, 1, 1);

    expect(anchor).toEqual(bossTile);
    expect(tiles).toEqual([
      { tx: bossTile.tx - 1, ty: bossTile.ty - 1 },
      { tx: bossTile.tx, ty: bossTile.ty - 1 },
      { tx: bossTile.tx + 1, ty: bossTile.ty - 1 },
      { tx: bossTile.tx - 1, ty: bossTile.ty },
      { tx: bossTile.tx, ty: bossTile.ty },
      { tx: bossTile.tx + 1, ty: bossTile.ty },
      { tx: bossTile.tx - 1, ty: bossTile.ty + 1 },
      { tx: bossTile.tx, ty: bossTile.ty + 1 },
      { tx: bossTile.tx + 1, ty: bossTile.ty + 1 },
    ]);
  });
});
