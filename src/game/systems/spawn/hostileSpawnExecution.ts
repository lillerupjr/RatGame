import type { World } from "../../../engine/world/world";
import { ENEMIES } from "../../content/enemies";
import { spawnOneEnemyOfType } from "./spawn";
import type { HostileSpawnRequest } from "./hostileSpawnDirector";

export function executeHostileSpawnRequests(world: World, requests: HostileSpawnRequest[]): void {
  const debug = world.hostileSpawnDebug;
  if (debug) {
    debug.requestCount = requests.length;
    debug.spawnAttempts = 0;
    debug.successfulSpawns = 0;
    debug.failedPlacements = 0;
  }

  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    for (let n = 0; n < request.count; n++) {
      if (debug) debug.spawnAttempts += 1;
      const spawnedHp = spawnOneEnemyOfType(world, request.enemyId);
      if (!debug) continue;
      if (spawnedHp > 0) {
        debug.successfulSpawns += 1;
        const enemy = ENEMIES[request.enemyId];
        if (enemy) {
          debug.totalAliveHostileEnemies += 1;
          debug.liveThreat += Math.max(0, enemy.spawn.power);
          debug.threatRoom = Math.max(0, debug.liveThreatCap - debug.liveThreat);
          debug.aliveByRole[enemy.spawn.role] += 1;
        }
      } else {
        debug.failedPlacements += 1;
      }
    }
  }
}
