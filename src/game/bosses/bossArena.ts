import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import type { World } from "../../engine/world/world";
import { getEnemyWorld } from "../coords/worldViews";
import { getActiveMap } from "../map/authoredMapActivation";
import { worldToTile } from "../map/compile/kenneyMap";
import { getSemanticFieldDefForTileId } from "../world/semanticFields";

export type ArenaCell = {
  x: number;
  y: number;
};

export type BossArenaCell = ArenaCell & {
  worldTx: number;
  worldTy: number;
  playable: boolean;
};

export type BossArena = {
  width: number;
  height: number;
  centerCellX: number;
  centerCellY: number;
  anchorWorldTile: { tx: number; ty: number };
  cells: BossArenaCell[];
};

function arenaCellIndex(arena: BossArena, x: number, y: number): number {
  return y * arena.width + x;
}

export function arenaCellKey(cell: ArenaCell): string {
  return `${cell.x},${cell.y}`;
}

export function resolveBossArenaAnchorTile(
  world: World,
  enemyIndex: number,
): { tx: number; ty: number } {
  const activeMap = getActiveMap();
  const bossSpawn = activeMap?.semanticData?.bossSpawn;
  if (bossSpawn) return { tx: bossSpawn.tx, ty: bossSpawn.ty };

  const bossWorld = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
  return worldToTile(bossWorld.wx, bossWorld.wy, KENNEY_TILE_WORLD);
}

export function buildBossArena(
  world: World,
  enemyIndex: number,
  args?: { width?: number; height?: number },
): BossArena {
  const width = Math.max(1, args?.width ?? 21);
  const height = Math.max(1, args?.height ?? 21);
  const centerCellX = Math.floor(width / 2);
  const centerCellY = Math.floor(height / 2);
  const anchorWorldTile = resolveBossArenaAnchorTile(world, enemyIndex);
  const activeMap = getActiveMap();
  const cells: BossArenaCell[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const worldTx = anchorWorldTile.tx + (x - centerCellX);
      const worldTy = anchorWorldTile.ty + (y - centerCellY);
      let playable = true;
      if (activeMap) {
        const inBounds =
          worldTx >= activeMap.originTx
          && worldTx < activeMap.originTx + activeMap.width
          && worldTy >= activeMap.originTy
          && worldTy < activeMap.originTy + activeMap.height;
        if (!inBounds) {
          playable = false;
        } else if (activeMap.blockedTiles.has(`${worldTx},${worldTy}`)) {
          playable = false;
        } else {
          const tile = activeMap.getTile(worldTx, worldTy);
          const semantic = getSemanticFieldDefForTileId(tile.kind);
          playable = semantic.isWalkable && tile.kind !== "STAIRS";
        }
      }
      cells.push({ x, y, worldTx, worldTy, playable });
    }
  }

  return {
    width,
    height,
    centerCellX,
    centerCellY,
    anchorWorldTile,
    cells,
  };
}

export function getBossArenaCell(
  arena: BossArena,
  x: number,
  y: number,
): BossArenaCell | null {
  if (x < 0 || x >= arena.width || y < 0 || y >= arena.height) return null;
  return arena.cells[arenaCellIndex(arena, x, y)] ?? null;
}

export function isBossArenaCellPlayable(
  arena: BossArena,
  cell: ArenaCell,
): boolean {
  return getBossArenaCell(arena, cell.x, cell.y)?.playable === true;
}

export function collectPlayableArenaCells(arena: BossArena): ArenaCell[] {
  const cells: ArenaCell[] = [];
  for (let i = 0; i < arena.cells.length; i++) {
    const cell = arena.cells[i];
    if (!cell.playable) continue;
    cells.push({ x: cell.x, y: cell.y });
  }
  return cells;
}

export function arenaCellToWorldTile(
  arena: BossArena,
  cell: ArenaCell,
): { tx: number; ty: number } {
  const resolved = getBossArenaCell(arena, cell.x, cell.y);
  if (!resolved) {
    return {
      tx: arena.anchorWorldTile.tx + (cell.x - arena.centerCellX),
      ty: arena.anchorWorldTile.ty + (cell.y - arena.centerCellY),
    };
  }
  return { tx: resolved.worldTx, ty: resolved.worldTy };
}
