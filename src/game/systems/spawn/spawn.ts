import { type World } from "../../../engine/world/world";
import { floorForIndex, pickFloorEnemyType } from "../../content/floors";
import { walkInfo } from "../../map/compile/kenneyMap";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { worldToGrid } from "../../coords/grid";
import { getPlayerWorld } from "../../coords/worldViews";
import { spawnEnemyGrid } from "../../factories/enemyFactory";
import type { EnemyPowerTier } from "../../balance/enemyPower";

export function spawnSystem(w: World, dt: number) {
  // Unified Spawn System:
  // Trash spawns are handled ONLY by Spawn Director (tickSpawnDirector in game loop).
  // spawnSystem keeps only non-director spawn responsibilities (currently none).
  void w;
  void dt;
}

/**
 * Spawn one floor-appropriate trash enemy around an origin point.
 * Returns scaled HP of spawned enemy, or 0 if none spawned.
 */
export function spawnOneTrashEnemy(
  w: World,
  originX?: number,
  originY?: number,
  powerTier: EnemyPowerTier = "trash"
): number {
  if (w.runState !== "FLOOR") return 0;
  if (w.floorArchetype === "VENDOR" || w.floorArchetype === "HEAL") return 0;

  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const ox = originX ?? pw.wx;
  const oy = originY ?? pw.wy;
  const floor = floorForIndex(w.floorIndex ?? 0);
  const type = pickFloorEnemyType(w);

  for (let i = 0; i < 20; i++) {
    const angle = w.rng.range(0, Math.PI * 2);
    const radius = w.rng.range(floor.spawns.ringMin, floor.spawns.ringMax);
    const wx = ox + Math.cos(angle) * radius;
    const wy = oy + Math.sin(angle) * radius;
    const info = walkInfo(wx, wy, KENNEY_TILE_WORLD);
    if (!info.walkable) continue;

    const floorOk =
      info.floorH === w.activeFloorH ||
      info.kind === "STAIRS" ||
      Boolean((info as any).isRamp);
    if (!floorOk) continue;

    const gp = worldToGrid(wx, wy, KENNEY_TILE_WORLD);
    void powerTier;
    const enemyIndex = spawnEnemyGrid(w, type, gp.gx, gp.gy, KENNEY_TILE_WORLD);
    const hp = Number(w.eHp?.[enemyIndex] ?? 0);
    return Number.isFinite(hp) && hp > 0 ? hp : 0;
  }

  return 0;
}
