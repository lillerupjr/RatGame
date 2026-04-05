import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { ENEMIES, EnemyId, type EnemySpawnConfig, type EnemySpawnRole } from "../../../../game/content/enemies";
import {
  HOSTILE_SPAWN_DIRECTOR_CONFIG,
  resetHostileSpawnDirectorForFloor,
  updateHostileSpawnDirector,
} from "../../../../game/systems/spawn/hostileSpawnDirector";

function makeWorld(seed = 12345) {
  const world = createWorld({ seed, stage: stageDocks });
  world.state = "RUN";
  world.runState = "FLOOR";
  world.currentFloorIntent = {
    nodeId: `NODE_${seed}`,
    zoneId: "DOCKS",
    depth: 1,
    floorIndex: 0,
    archetype: "SURVIVE",
    mapId: "DOCKS_ROOM_A",
    objectiveId: "SURVIVE",
    variantSeed: seed,
  } as any;
  resetHostileSpawnDirectorForFloor(world);
  return world;
}

function makeContext(overrides: Partial<Parameters<typeof updateHostileSpawnDirector>[1]> = {}) {
  return {
    dt: 0,
    elapsedSec: 0,
    floorDepth: 0,
    spawningEnabled: true,
    activeEnemies: [],
    ...overrides,
  };
}

const originalEnemySpawns = new Map<EnemyId, EnemySpawnConfig>();
const originalConfig = structuredClone(HOSTILE_SPAWN_DIRECTOR_CONFIG);

function restoreConfig(): void {
  HOSTILE_SPAWN_DIRECTOR_CONFIG.stockpileMultiplier = originalConfig.stockpileMultiplier;
  HOSTILE_SPAWN_DIRECTOR_CONFIG.minSpawnIntervalSec = originalConfig.minSpawnIntervalSec;
  HOSTILE_SPAWN_DIRECTOR_CONFIG.burstCooldownBaseSec = originalConfig.burstCooldownBaseSec;
  HOSTILE_SPAWN_DIRECTOR_CONFIG.burstChancePerSpawnWindow = originalConfig.burstChancePerSpawnWindow;
  HOSTILE_SPAWN_DIRECTOR_CONFIG.burstExtraAttempts = originalConfig.burstExtraAttempts;
  HOSTILE_SPAWN_DIRECTOR_CONFIG.maxPurchaseAttemptsPerUpdate = originalConfig.maxPurchaseAttemptsPerUpdate;
  for (const role of Object.keys(originalConfig.roleCaps) as EnemySpawnRole[]) {
    HOSTILE_SPAWN_DIRECTOR_CONFIG.roleCaps[role] = originalConfig.roleCaps[role];
    HOSTILE_SPAWN_DIRECTOR_CONFIG.roleWeightCurves[role] = structuredClone(originalConfig.roleWeightCurves[role]);
  }
  HOSTILE_SPAWN_DIRECTOR_CONFIG.powerPerSec = { ...originalConfig.powerPerSec };
  HOSTILE_SPAWN_DIRECTOR_CONFIG.liveThreatCap = { ...originalConfig.liveThreatCap };
}

beforeEach(() => {
  originalEnemySpawns.clear();
  for (const enemy of Object.values(ENEMIES) as Array<(typeof ENEMIES)[EnemyId]>) {
    originalEnemySpawns.set(enemy.id, structuredClone(enemy.spawn));
  }
  restoreConfig();
});

afterEach(() => {
  for (const enemy of Object.values(ENEMIES) as Array<(typeof ENEMIES)[EnemyId]>) {
    const originalSpawn = originalEnemySpawns.get(enemy.id);
    if (originalSpawn) enemy.spawn = structuredClone(originalSpawn);
  }
  restoreConfig();
});

describe("hostileSpawnDirector", () => {
  it("tracks budget and hostile-only threat when spawning is disabled", () => {
    const world = makeWorld(101);

    const requests = updateHostileSpawnDirector(
      world,
      makeContext({
        dt: 1,
        elapsedSec: 60,
        spawningEnabled: false,
        activeEnemies: [
          { enemyId: EnemyId.MINION },
          { enemyId: EnemyId.BOSS },
          { enemyId: EnemyId.LOOT_GOBLIN },
        ],
      }),
    );

    expect(requests).toEqual([]);
    expect(world.hostileSpawnDebug?.powerPerSec).toBeCloseTo(1.3, 6);
    expect(world.hostileSpawnDebug?.liveThreat).toBeCloseTo(1.0, 6);
    expect(world.hostileSpawnDebug?.lastRequests).toEqual([]);
    expect(world.hostileSpawnDebug?.aliveByRole.baseline_chaser).toBe(1);
    expect(world.hostileSpawnDebug?.aliveByRole.special).toBe(0);
  });

  it("clamps stockpiled budget to the current threat cap", () => {
    const world = makeWorld(102);

    updateHostileSpawnDirector(
      world,
      makeContext({
        dt: 30,
        elapsedSec: 0,
        spawningEnabled: false,
      }),
    );

    expect(world.hostileSpawnDirector.budget).toBeCloseTo(5.4, 6);
    expect(world.hostileSpawnDebug?.stockpileCap).toBeCloseTo(5.4, 6);
  });

  it("clears state and debug snapshot on floor reset", () => {
    const world = makeWorld(103);
    world.hostileSpawnDirector.budget = 99;
    world.hostileSpawnDirector.spawnCooldownSec = 7;
    world.hostileSpawnDebug = {
      budget: 1,
      powerPerSec: 2,
      liveThreat: 3,
      liveThreatCap: 4,
      stockpileCap: 5,
      spawnCooldownSec: 6,
      burstCooldownSec: 7,
      aliveByRole: {
        baseline_chaser: 1,
        fast_chaser: 0,
        tank: 0,
        ranged: 0,
        suicide: 0,
        leaper: 0,
        special: 0,
      },
      lastRequests: [{ enemyId: EnemyId.MINION, count: 2, reason: "normal" }],
    };

    resetHostileSpawnDirectorForFloor(world);

    expect(world.hostileSpawnDirector.budget).toBe(0);
    expect(world.hostileSpawnDirector.spawnCooldownSec).toBe(0);
    expect(world.hostileSpawnDirector.burstCooldownSec).toBe(12);
    expect(world.hostileSpawnDebug).toBeNull();
  });

  it("emits deterministic requests for the same seed and context", () => {
    HOSTILE_SPAWN_DIRECTOR_CONFIG.maxPurchaseAttemptsPerUpdate = 1;
    const context = makeContext({
      elapsedSec: 40,
      floorDepth: 0,
      activeEnemies: [],
    });

    const a = makeWorld(104);
    const b = makeWorld(104);
    a.hostileSpawnDirector.budget = 10;
    b.hostileSpawnDirector.budget = 10;
    a.hostileSpawnDirector.rngSeed = 987654321;
    b.hostileSpawnDirector.rngSeed = 987654321;

    const requestsA = updateHostileSpawnDirector(a, context);
    const requestsB = updateHostileSpawnDirector(b, context);

    expect(requestsA).toEqual(requestsB);
    expect(a.hostileSpawnDirector.rngSeed).toBe(b.hostileSpawnDirector.rngSeed);
  });

  it("uses normal weight rules and burst weight rules independently", () => {
    HOSTILE_SPAWN_DIRECTOR_CONFIG.maxPurchaseAttemptsPerUpdate = 1;
    HOSTILE_SPAWN_DIRECTOR_CONFIG.burstChancePerSpawnWindow = 1;

    ENEMIES[EnemyId.MINION].spawn.weight = 0;
    ENEMIES[EnemyId.MINION].spawn.burstWeight = 2;
    ENEMIES[EnemyId.MINION].spawn.minGroupSize = 2;
    ENEMIES[EnemyId.MINION].spawn.maxGroupSize = 2;
    ENEMIES[EnemyId.RUNNER].spawn.weight = 2;
    ENEMIES[EnemyId.RUNNER].spawn.burstWeight = 0;
    ENEMIES[EnemyId.RUNNER].spawn.unlockTimeSec = 0;
    ENEMIES[EnemyId.RUNNER].spawn.minGroupSize = 2;
    ENEMIES[EnemyId.RUNNER].spawn.maxGroupSize = 2;

    const normalWorld = makeWorld(105);
    normalWorld.hostileSpawnDirector.budget = 10;
    normalWorld.hostileSpawnDirector.rngSeed = 1;

    const normalRequests = updateHostileSpawnDirector(
      normalWorld,
      makeContext({ elapsedSec: 40, floorDepth: 0 }),
    );

    expect(normalRequests).toEqual([{ enemyId: EnemyId.RUNNER, count: 2, reason: "normal" }]);

    const burstWorld = makeWorld(106);
    burstWorld.hostileSpawnDirector.budget = 10;
    burstWorld.hostileSpawnDirector.burstCooldownSec = 0;
    burstWorld.hostileSpawnDirector.rngSeed = 1;

    const burstRequests = updateHostileSpawnDirector(
      burstWorld,
      makeContext({ elapsedSec: 40, floorDepth: 0 }),
    );

    expect(burstRequests[0]).toEqual({ enemyId: EnemyId.MINION, count: 2, reason: "burst" });
  });

  it("honors unlock time and depth gating", () => {
    HOSTILE_SPAWN_DIRECTOR_CONFIG.maxPurchaseAttemptsPerUpdate = 1;
    ENEMIES[EnemyId.MINION].spawn.weight = 0;
    ENEMIES[EnemyId.RUNNER].spawn.weight = 1;
    ENEMIES[EnemyId.RUNNER].spawn.unlockTimeSec = 30;
    ENEMIES[EnemyId.RUNNER].spawn.unlockDepth = 2;
    ENEMIES[EnemyId.RUNNER].spawn.minGroupSize = 2;
    ENEMIES[EnemyId.RUNNER].spawn.maxGroupSize = 2;

    const world = makeWorld(107);
    world.hostileSpawnDirector.budget = 10;

    expect(
      updateHostileSpawnDirector(
        world,
        makeContext({ elapsedSec: 10, floorDepth: 1 }),
      ),
    ).toEqual([]);

    world.hostileSpawnDirector.spawnCooldownSec = 0;
    world.hostileSpawnDirector.budget = 10;

    expect(
      updateHostileSpawnDirector(
        world,
        makeContext({ elapsedSec: 40, floorDepth: 2 }),
      ),
    ).toEqual([{ enemyId: EnemyId.RUNNER, count: 2, reason: "normal" }]);
  });

  it("rejects purchases when group-size clamps below the minimum", () => {
    HOSTILE_SPAWN_DIRECTOR_CONFIG.maxPurchaseAttemptsPerUpdate = 1;
    ENEMIES[EnemyId.MINION].spawn.weight = 1;
    ENEMIES[EnemyId.MINION].spawn.minGroupSize = 3;
    ENEMIES[EnemyId.MINION].spawn.maxGroupSize = 3;
    ENEMIES[EnemyId.MINION].spawn.maxAlive = 5;

    const world = makeWorld(108);
    world.hostileSpawnDirector.budget = 10;

    const requests = updateHostileSpawnDirector(
      world,
      makeContext({
        elapsedSec: 0,
        floorDepth: 0,
        activeEnemies: [
          { enemyId: EnemyId.MINION },
          { enemyId: EnemyId.MINION },
          { enemyId: EnemyId.MINION },
        ],
      }),
    );

    expect(requests).toEqual([]);
    expect(world.hostileSpawnDebug?.lastRequests).toEqual([]);
  });
});
