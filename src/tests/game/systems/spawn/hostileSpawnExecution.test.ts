import { beforeEach, describe, expect, it, vi } from "vitest";

import { EnemyId } from "../../../../game/content/enemies";
import { executeHostileSpawnRequests } from "../../../../game/systems/spawn/hostileSpawnExecution";
import { spawnOneEnemyOfType } from "../../../../game/systems/spawn/spawn";

vi.mock("../../../../game/systems/spawn/spawn", () => ({
  spawnOneEnemyOfType: vi.fn(),
}));

describe("hostileSpawnExecution", () => {
  beforeEach(() => {
    vi.mocked(spawnOneEnemyOfType).mockReset();
  });

  it("processes requests in array order and count order", () => {
    const world = {} as any;

    executeHostileSpawnRequests(world, [
      { enemyId: EnemyId.MINION, count: 2, reason: "normal" },
      { enemyId: EnemyId.RUNNER, count: 1, reason: "burst" },
      { enemyId: EnemyId.TANK, count: 3, reason: "normal" },
    ]);

    expect(spawnOneEnemyOfType).toHaveBeenCalledTimes(6);
    expect(vi.mocked(spawnOneEnemyOfType).mock.calls.map((call: unknown[]) => call[1])).toEqual([
      EnemyId.MINION,
      EnemyId.MINION,
      EnemyId.RUNNER,
      EnemyId.TANK,
      EnemyId.TANK,
      EnemyId.TANK,
    ]);
  });

  it("keeps processing later attempts even when earlier placements fail", () => {
    vi.mocked(spawnOneEnemyOfType)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(0);

    const world = {
      hostileSpawnDebug: {
        budget: 4,
        powerPerSec: 1,
        liveThreat: 2,
        liveThreatCap: 10,
        stockpileCap: 12,
        threatRoom: 8,
        spawnCooldownSec: 0,
        burstCooldownSec: 0,
        lastMode: "burst",
        totalAliveHostileEnemies: 2,
        aliveByRole: {
          baseline_chaser: 0,
          fast_chaser: 0,
          tank: 0,
          ranged: 1,
          suicide: 0,
          leaper: 0,
          special: 0,
        },
        lastRequests: [{ enemyId: EnemyId.SPITTER, count: 3, reason: "burst" }],
        requestCount: 0,
        spawnAttempts: 99,
        successfulSpawns: 99,
        failedPlacements: 99,
      },
    } as any;

    executeHostileSpawnRequests(world, [
      { enemyId: EnemyId.SPITTER, count: 3, reason: "burst" },
    ]);

    expect(spawnOneEnemyOfType).toHaveBeenCalledTimes(3);
    expect(vi.mocked(spawnOneEnemyOfType).mock.calls.map((call: unknown[]) => call[1])).toEqual([
      EnemyId.SPITTER,
      EnemyId.SPITTER,
      EnemyId.SPITTER,
    ]);
    expect(world.hostileSpawnDebug.requestCount).toBe(1);
    expect(world.hostileSpawnDebug.spawnAttempts).toBe(3);
    expect(world.hostileSpawnDebug.successfulSpawns).toBe(1);
    expect(world.hostileSpawnDebug.failedPlacements).toBe(2);
    expect(world.hostileSpawnDebug.totalAliveHostileEnemies).toBe(3);
    expect(world.hostileSpawnDebug.aliveByRole.ranged).toBe(2);
    expect(world.hostileSpawnDebug.liveThreat).toBeCloseTo(3.6, 6);
    expect(world.hostileSpawnDebug.threatRoom).toBeCloseTo(6.4, 6);
  });
});
