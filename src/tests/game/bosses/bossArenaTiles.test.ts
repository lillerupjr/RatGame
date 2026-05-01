import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { buildBossArena, arenaCellToWorldTile, isBossArenaCellPlayable } from "../../../game/bosses/bossArena";
import {
  generateCheckerboardPattern,
  generateInwardCollapsePattern,
  generateSnakePattern,
} from "../../../game/bosses/bossArenaPatterns";
import { BossId } from "../../../game/bosses/bossTypes";
import { spawnBossEncounter } from "../../../game/bosses/spawnBossEncounter";
import { stageDocks } from "../../../game/content/stages";
import * as authoredMapActivation from "../../../game/map/authoredMapActivation";
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

function makeCompiledArenaMap(width: number, height: number) {
  return compileKenneyMapFromTable({
    id: `ARENA_${width}x${height}`,
    w: width,
    h: height,
    cells: Array.from({ length: width * height }, (_, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return {
        x,
        y,
        type:
          x === width - 1 && y === height - 1
            ? "wall" as const
            : "sidewalk" as const,
        z: 0,
      };
    }),
    stamps: [
      { x: Math.floor(width / 2), y: Math.floor(height / 2), type: "boss_spawn" },
    ],
  });
}

describe("bossArena", () => {
  it("maps the 21x21 local arena grid directly around the authored boss center", () => {
    const compiled = makeCompiledArenaMap(21, 21);
    vi.spyOn(authoredMapActivation, "getActiveMap").mockReturnValue(compiled);
    const { world, result } = createBossWorld();

    const arena = buildBossArena(world, result.enemyIndex);

    expect(arena.width).toBe(21);
    expect(arena.height).toBe(21);
    expect(arena.centerCellX).toBe(10);
    expect(arena.centerCellY).toBe(10);
    expect(arena.anchorWorldTile).toEqual({ tx: 10, ty: 10 });
    expect(arenaCellToWorldTile(arena, { x: 10, y: 10 })).toEqual({ tx: 10, ty: 10 });
    expect(arenaCellToWorldTile(arena, { x: 0, y: 0 })).toEqual({ tx: 0, ty: 0 });
    expect(arenaCellToWorldTile(arena, { x: 20, y: 20 })).toEqual({ tx: 20, ty: 20 });
  });

  it("marks out-of-bounds and blocked cells as non-playable", () => {
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

    const arena = buildBossArena(world, result.enemyIndex);

    expect(arena.anchorWorldTile).toEqual({ tx: 2, ty: 2 });
    expect(isBossArenaCellPlayable(arena, { x: 10, y: 10 })).toBe(true);
    expect(isBossArenaCellPlayable(arena, { x: 12, y: 12 })).toBe(false);
    expect(isBossArenaCellPlayable(arena, { x: 0, y: 0 })).toBe(false);
  });
});

describe("bossArenaPatterns", () => {
  it("checkerboard returns only matching playable parity cells", () => {
    const compiled = makeCompiledArenaMap(21, 21);
    vi.spyOn(authoredMapActivation, "getActiveMap").mockReturnValue(compiled);
    const { world, result } = createBossWorld();
    const arena = buildBossArena(world, result.enemyIndex);

    const cells = generateCheckerboardPattern(arena, { parity: 0 });

    expect(cells.length).toBeGreaterThan(100);
    expect(cells.every((cell) => ((cell.x + cell.y) & 1) === 0)).toBe(true);
    expect(cells.every((cell) => isBossArenaCellPlayable(arena, cell))).toBe(true);
  });

  it("snake returns the deterministic Chem Guy serpentine ribbon", () => {
    const compiled = makeCompiledArenaMap(21, 21);
    vi.spyOn(authoredMapActivation, "getActiveMap").mockReturnValue(compiled);
    const { world, result } = createBossWorld();
    const arena = buildBossArena(world, result.enemyIndex);

    const cells = generateSnakePattern(arena, {
      bandHeightCells: 2,
      segmentWidthCells: 7,
      horizontalStepCells: 4,
      startX: 0,
      initialDirection: "right",
    });
    const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));

    expect(keys.has("0,0")).toBe(true);
    expect(keys.has("6,1")).toBe(true);
    expect(keys.has("4,2")).toBe(true);
    expect(keys.has("10,3")).toBe(true);
    expect(keys.has("12,6")).toBe(true);
    expect(keys.has("18,7")).toBe(true);
    expect(keys.has("8,20")).toBe(true);
    expect(keys.has("7,0")).toBe(false);
    expect(keys.has("0,2")).toBe(false);
    expect(keys.has("19,7")).toBe(false);
  });

  it("inward collapse returns the authored outer-to-inner rings and leaves a 3x3 safe center", () => {
    const compiled = makeCompiledArenaMap(21, 21);
    vi.spyOn(authoredMapActivation, "getActiveMap").mockReturnValue(compiled);
    const { world, result } = createBossWorld();
    const arena = buildBossArena(world, result.enemyIndex);

    const ring0 = new Set(generateInwardCollapsePattern(arena, { ringIndex: 0, ringWidthCells: 3 }).map((cell) => `${cell.x},${cell.y}`));
    const ring1 = new Set(generateInwardCollapsePattern(arena, { ringIndex: 1, ringWidthCells: 3 }).map((cell) => `${cell.x},${cell.y}`));
    const ring2 = new Set(generateInwardCollapsePattern(arena, { ringIndex: 2, ringWidthCells: 3 }).map((cell) => `${cell.x},${cell.y}`));

    expect(ring0.has("0,0")).toBe(true);
    expect(ring0.has("2,10")).toBe(true);
    expect(ring0.has("3,10")).toBe(false);
    expect(ring1.has("3,10")).toBe(true);
    expect(ring1.has("5,10")).toBe(true);
    expect(ring1.has("6,10")).toBe(false);
    expect(ring2.has("6,10")).toBe(true);
    expect(ring2.has("8,10")).toBe(true);
    expect(ring2.has("9,10")).toBe(false);
    expect(ring0.has("10,10")).toBe(false);
    expect(ring1.has("10,10")).toBe(false);
    expect(ring2.has("10,10")).toBe(false);
  });
});
