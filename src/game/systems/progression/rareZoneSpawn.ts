import type { World } from "../../../engine/world/world";
import { OBJECTIVE_TRIGGER_IDS } from "./objectiveSpec";
import { spawnEnemyGrid, EnemyId } from "../../factories/enemyFactory";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { findNearestWalkableSpawnGrid } from "../spawn/findWalkableSpawn";

const RARE_TRIPLE_ENEMY_POOL: EnemyId[] = [
  EnemyId.TANK,
  EnemyId.LEAPER1,
  EnemyId.BURSTER,
];

function parseRareZoneIndex(triggerId: string): number {
  if (!triggerId.startsWith(OBJECTIVE_TRIGGER_IDS.rareZonePrefix)) return -1;
  const raw = triggerId.slice(OBJECTIVE_TRIGGER_IDS.rareZonePrefix.length);
  const index = Number.parseInt(raw, 10) - 1;
  return Number.isFinite(index) ? index : -1;
}

function chooseRareEnemyType(triggerId: string): EnemyId {
  const index = parseRareZoneIndex(triggerId);
  if (index < 0) return RARE_TRIPLE_ENEMY_POOL[0];
  return RARE_TRIPLE_ENEMY_POOL[index % RARE_TRIPLE_ENEMY_POOL.length];
}

export function rareZoneSpawnSystem(world: World): void {
  if (world.triggerSignals.length === 0) return;

  for (let i = 0; i < world.triggerSignals.length; i++) {
    const signal = world.triggerSignals[i];
    if (signal.type !== "ENTER") continue;
    if (!signal.triggerId.startsWith(OBJECTIVE_TRIGGER_IDS.rareZonePrefix)) continue;
    if (world.rareZoneSpawned.includes(signal.triggerId)) continue;

    const def = world.overlayTriggerDefs.find((d) => d.id === signal.triggerId);
    if (!def) continue;

    const wx = (def.tx + 0.5) * KENNEY_TILE_WORLD;
    const wy = (def.ty + 0.5) * KENNEY_TILE_WORLD;
    const gp = findNearestWalkableSpawnGrid(world, wx, wy);
    const e = spawnEnemyGrid(world, chooseRareEnemyType(signal.triggerId), gp.gx, gp.gy, KENNEY_TILE_WORLD);
    world.eSpawnTriggerId[e] = signal.triggerId;

    world.rareZoneSpawned.push(signal.triggerId);
  }
}
