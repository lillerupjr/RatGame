import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import type { World } from "../../engine/world/world";
import { getEnemyWorld } from "../coords/worldViews";
import { getActiveMap } from "../map/authoredMapActivation";
import { worldToTile } from "../map/compile/kenneyMap";
import { getSemanticFieldDefForTileId } from "../world/semanticFields";

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

export function collectBossArenaFootprintTiles(
  world: World,
  anchor: { tx: number; ty: number },
  halfWidth: number,
  halfHeight: number,
): Array<{ tx: number; ty: number }> {
  void world;
  const safeHalfWidth = Math.max(0, halfWidth | 0);
  const safeHalfHeight = Math.max(0, halfHeight | 0);
  const activeMap = getActiveMap();

  const minTxRaw = anchor.tx - safeHalfWidth;
  const maxTxRaw = anchor.tx + safeHalfWidth;
  const minTyRaw = anchor.ty - safeHalfHeight;
  const maxTyRaw = anchor.ty + safeHalfHeight;

  const minTx = activeMap ? Math.max(activeMap.originTx, minTxRaw) : minTxRaw;
  const maxTx = activeMap ? Math.min(activeMap.originTx + activeMap.width - 1, maxTxRaw) : maxTxRaw;
  const minTy = activeMap ? Math.max(activeMap.originTy, minTyRaw) : minTyRaw;
  const maxTy = activeMap ? Math.min(activeMap.originTy + activeMap.height - 1, maxTyRaw) : maxTyRaw;

  const tiles: Array<{ tx: number; ty: number }> = [];
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (activeMap) {
        if (activeMap.blockedTiles.has(`${tx},${ty}`)) continue;
        const tile = activeMap.getTile(tx, ty);
        const semantic = getSemanticFieldDefForTileId(tile.kind);
        if (!semantic.isWalkable || tile.kind === "STAIRS") continue;
      }
      tiles.push({ tx, ty });
    }
  }
  return tiles;
}

export function selectCheckerboardTiles(
  tiles: Array<{ tx: number; ty: number }>,
  parity: 0 | 1,
): Array<{ tx: number; ty: number }> {
  return tiles.filter((tile) => ((tile.tx + tile.ty) & 1) === parity);
}
