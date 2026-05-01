import type { World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { worldToGrid } from "../../coords/grid";
import { walkInfo } from "../../map/compile/kenneyMap";

function isWalkableEncounterTile(w: World, gx: number, gy: number): boolean {
  const wx = (gx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (gy + 0.5) * KENNEY_TILE_WORLD;
  const info = walkInfo(wx, wy, KENNEY_TILE_WORLD);
  if (!info.walkable) return false;
  return (
    info.floorH === w.activeFloorH ||
    info.kind === "STAIRS" ||
    Boolean((info as any).isRamp)
  );
}

export function findNearestWalkableSpawnGrid(
  w: World,
  wx: number,
  wy: number,
  maxRadiusTiles: number = 12,
): { gx: number; gy: number } {
  const base = worldToGrid(wx, wy, KENNEY_TILE_WORLD);
  const bx = Math.round(base.gx);
  const by = Math.round(base.gy);

  if (isWalkableEncounterTile(w, bx, by)) return { gx: bx, gy: by };

  for (let r = 1; r <= maxRadiusTiles; r++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = bx + dx;
      const yTop = by - r;
      const yBottom = by + r;
      if (isWalkableEncounterTile(w, x, yTop)) return { gx: x, gy: yTop };
      if (isWalkableEncounterTile(w, x, yBottom)) return { gx: x, gy: yBottom };
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      const y = by + dy;
      const xLeft = bx - r;
      const xRight = bx + r;
      if (isWalkableEncounterTile(w, xLeft, y)) return { gx: xLeft, gy: y };
      if (isWalkableEncounterTile(w, xRight, y)) return { gx: xRight, gy: y };
    }
  }

  return { gx: bx, gy: by };
}
