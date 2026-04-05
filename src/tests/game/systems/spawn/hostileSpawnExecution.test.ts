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

    executeHostileSpawnRequests({} as any, [
      { enemyId: EnemyId.SPITTER, count: 3, reason: "burst" },
    ]);

    expect(spawnOneEnemyOfType).toHaveBeenCalledTimes(3);
    expect(vi.mocked(spawnOneEnemyOfType).mock.calls.map((call: unknown[]) => call[1])).toEqual([
      EnemyId.SPITTER,
      EnemyId.SPITTER,
      EnemyId.SPITTER,
    ]);
  });
});
