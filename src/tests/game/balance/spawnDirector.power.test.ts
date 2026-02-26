import { describe, expect, test } from "vitest";
import { createDpsMetrics } from "../../../game/balance/dpsMetrics";
import { createSpawnDirectorState, tickSpawnDirector, type SpawnDirectorConfig } from "../../../game/balance/spawnDirector";
import type { ExpectedPowerBudgetConfig, ExpectedPowerConfig } from "../../../game/balance/expectedPower";

const cfg: SpawnDirectorConfig = {
  enabled: true,
  pressureBase: 1,
  pressurePerDepth: 0,
  pressureMin: 1,
  pressureMax: 1,
  minFillPerTick: 0,
  waveEnabled: false,
  waveTotal: 10,
  waveChunk: 3,
  waveChunkDelaySec: 1.0,
  waveCooldownSec: 0.5,
  pendingThresholdToStartWave: 0,
  wavePeriodSec: 12,
  waveLowMult: 0.7,
  waveHighMult: 1.3,
  waveHighFrac: 0.35,
  bossTrashPressureMult: 0.5,
  maxSpawnsPerTick: 200,
};

const expectedCfg: ExpectedPowerConfig = {
  timeCurve: [{ tSec: 0, dps: 100 }],
  depthMultBase: 1,
  depthMultPerDepth: 0,
  depthMultMin: 1,
  depthMultMax: 1,
};

const powerBudgetCfg: ExpectedPowerBudgetConfig = {
  basePowerPerSecond: 1,
  powerRampPerMinute: 0,
  powerRampMax: 2,
};

describe("spawnDirector interval queue", () => {
  test("spawn interval converts elapsed time into pending count", () => {
    const state = createSpawnDirectorState();
    const w: any = {
      timeSec: 10,
      metrics: { dps: createDpsMetrics() },
      enemyPowerConfig: { costs: { trash: 1 } },
    };
    let spawned = 0;

    tickSpawnDirector(w, 10, cfg, expectedCfg, powerBudgetCfg, state, {
      getDepth: () => 0,
      isBossActive: () => false,
      canSpawnNow: () => false,
      spawnTrash: () => {
        spawned += 1;
        return true;
      },
    });

    expect(state.pendingSpawns).toBe(10);
    expect(spawned).toBe(0);
    expect(w.spawnDirectorDebug.powerPerSecond).toBeCloseTo(20.8);
    expect(w.spawnDirectorDebug.powerBudget).toBeCloseTo(208);
    expect((w.spawnDirectorDebug as any).pendingHpCommitted).toBeCloseTo(200);
    expect(w.spawnDirectorDebug.trashPowerCost).toBeCloseTo(1);
  });

  test("subtracts actual spawned scaled HP from budget accumulator", () => {
    const state = createSpawnDirectorState();
    const w: any = {
      timeSec: 10,
      metrics: { dps: createDpsMetrics() },
      enemyPowerConfig: { costs: { trash: 1 } },
    };

    tickSpawnDirector(w, 10, cfg, expectedCfg, powerBudgetCfg, state, {
      getDepth: () => 0,
      isBossActive: () => false,
      canSpawnNow: () => true,
      // Spend more than representative HP (20) per spawn: 40 HP each.
      spawnTrash: () => 40,
    });

    // 208 HP budget generated, 10 pending reserved (200), first chunk spawns 3 => 120 HP consumed.
    expect(w.spawnDirectorDebug.powerBudget).toBeCloseTo(88);
    expect((w.spawnDirectorDebug as any).pendingHpCommitted).toBeCloseTo(140);
    expect(state.waveRemaining).toBe(7);
  });
});
