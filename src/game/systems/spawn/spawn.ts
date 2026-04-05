import { type World } from "../../../engine/world/world";
import { walkInfo } from "../../map/compile/kenneyMap";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { worldToGrid } from "../../coords/grid";
import { getPlayerWorld } from "../../coords/worldViews";
import { spawnEnemyGrid, type EnemyId } from "../../factories/enemyFactory";

const DEFAULT_SPAWN_RING_MIN = 520;
const DEFAULT_SPAWN_RING_MAX = 680;

/**
 * Spawn one concrete enemy type around an origin point using generic placement sampling.
 * Returns spawned HP, or 0 if no valid location was found.
 */
export function spawnOneEnemyOfType(
  w: World,
  type: EnemyId,
  originX?: number,
  originY?: number,
): number {
  if (w.runState !== "FLOOR") return 0;
  if (w.floorArchetype === "VENDOR" || w.floorArchetype === "HEAL") return 0;

  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const ox = originX ?? pw.wx;
  const oy = originY ?? pw.wy;

  for (let i = 0; i < 20; i++) {
    const angle = w.rng.range(0, Math.PI * 2);
    const radius = w.rng.range(DEFAULT_SPAWN_RING_MIN, DEFAULT_SPAWN_RING_MAX);
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
    const enemyIndex = spawnEnemyGrid(w, type, gp.gx, gp.gy, KENNEY_TILE_WORLD);
    const hp = Number(w.eHp?.[enemyIndex] ?? 0);
    return Number.isFinite(hp) && hp > 0 ? hp : 0;
  }

  return 0;
}
