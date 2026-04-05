import type { World } from "../../../engine/world/world";
import { OBJECTIVE_TRIGGER_IDS } from "./objectiveSpec";
import { spawnEnemyGrid, EnemyId } from "../../factories/enemyFactory";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { findNearestWalkableSpawnGrid } from "../spawn/findWalkableSpawn";

export function bossZoneSpawnSystem(world: World): void {
  if (world.triggerSignals.length === 0) return;

  for (let i = 0; i < world.triggerSignals.length; i++) {
    const signal = world.triggerSignals[i];
    if (signal.type !== "ENTER") continue;
    if (!signal.triggerId.startsWith(OBJECTIVE_TRIGGER_IDS.bossZonePrefix)) continue;
    if (world.bossZoneSpawned.includes(signal.triggerId)) continue;

    const def = world.overlayTriggerDefs.find((d) => d.id === signal.triggerId);
    if (!def) continue;

    const wx = (def.tx + 0.5) * KENNEY_TILE_WORLD;
    const wy = (def.ty + 0.5) * KENNEY_TILE_WORLD;
    const gp = findNearestWalkableSpawnGrid(world, wx, wy);
    const e = spawnEnemyGrid(world, EnemyId.BOSS, gp.gx, gp.gy, KENNEY_TILE_WORLD);
    world.eSpawnTriggerId[e] = signal.triggerId;

    world.bossZoneSpawned.push(signal.triggerId);
  }
}
