import type { World } from "../../../engine/world/world";
import { spawnOneEnemyOfType } from "./spawn";
import type { HostileSpawnRequest } from "./hostileSpawnDirector";

export function executeHostileSpawnRequests(world: World, requests: HostileSpawnRequest[]): void {
  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    for (let n = 0; n < request.count; n++) {
      spawnOneEnemyOfType(world, request.enemyId);
    }
  }
}
