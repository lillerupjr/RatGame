import { describe, expect, test } from "vitest";
import { createDpsMetrics } from "../../../game/balance/dpsMetrics";
import { createSpawnDirectorState, tickSpawnDirector, type SpawnDirectorConfig } from "../../../game/balance/spawnDirector";
import type { ExpectedPowerBudgetConfig, ExpectedPowerConfig } from "../../../game/balance/expectedPower";

const cfg: SpawnDirectorConfig = {
  enabled: true,
  pressureBase: 1,
  pressurePerDepth: 0,
  pressureMin: 1,
  minFillPerTick: 0,
  waveEnabled: false,
  waveTotal: 10,
  waveChunk: 3,
  waveChunkDelaySec: 1.0,
  waveCooldownSec: 0.5,
  pendingThresholdToStartWave: 6,
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

describe("spawnDirector wave scheduler", () => {
  test("queues then releases chunked wave over cadence", () => {
    const state = createSpawnDirectorState();
    state.pendingSpawns = 50;
    let spawns = 0;
    const w: any = { timeSec: 0, metrics: { dps: createDpsMetrics() } };

    tickSpawnDirector(w, 0.016, cfg, expectedCfg, powerBudgetCfg, state, {
      getRunHeat: () => 0,
      isBossActive: () => false,
      canSpawnNow: () => true,
      spawnTrash: () => {
        spawns += 1;
        return true;
      },
    });
    expect(spawns).toBe(3);
    expect(state.waveRemaining).toBe(7);
    expect(state.pendingSpawns).toBe(40);
    expect(state.chunkCooldownSec).toBeCloseTo(1.0);
    expect(state.lastChunkSize).toBe(3);

    tickSpawnDirector(w, 0.1, cfg, expectedCfg, powerBudgetCfg, state, {
      getRunHeat: () => 0,
      isBossActive: () => false,
      canSpawnNow: () => true,
      spawnTrash: () => {
        spawns += 1;
        return true;
      },
    });
    expect(spawns).toBe(3);

    tickSpawnDirector(w, 1.0, cfg, expectedCfg, powerBudgetCfg, state, {
      getRunHeat: () => 0,
      isBossActive: () => false,
      canSpawnNow: () => true,
      spawnTrash: () => {
        spawns += 1;
        return true;
      },
    });
    expect(spawns).toBe(6);
  });

  test("threshold prevents micro-waves until pending reaches threshold", () => {
    const state = createSpawnDirectorState();
    const expectedZero: ExpectedPowerConfig = { ...expectedCfg, timeCurve: [{ tSec: 0, dps: 0 }] };
    let spawns = 0;
    const w: any = { timeSec: 0, metrics: { dps: createDpsMetrics() } };

    state.pendingSpawns = 5;
    tickSpawnDirector(w, 0.016, cfg, expectedZero, powerBudgetCfg, state, {
      getRunHeat: () => 0,
      isBossActive: () => false,
      canSpawnNow: () => true,
      spawnTrash: () => {
        spawns += 1;
        return true;
      },
    });
    expect(spawns).toBe(0);
    expect(state.pendingSpawns).toBe(5);

    state.pendingSpawns += 1; // now 6
    tickSpawnDirector(w, 0.016, cfg, expectedZero, powerBudgetCfg, state, {
      getRunHeat: () => 0,
      isBossActive: () => false,
      canSpawnNow: () => true,
      spawnTrash: () => {
        spawns += 1;
        return true;
      },
    });
    expect(spawns).toBe(3);
    expect(state.waveRemaining).toBe(3);
    expect(state.pendingSpawns).toBe(0);
  });

  test("budget converts to pending even when spawning is blocked", () => {
    const state = createSpawnDirectorState();
    let spawns = 0;
    const w: any = { timeSec: 0, metrics: { dps: createDpsMetrics() } };

    tickSpawnDirector(w, 5, cfg, expectedCfg, powerBudgetCfg, state, {
      getRunHeat: () => 0,
      isBossActive: () => false,
      canSpawnNow: () => false,
      spawnTrash: () => {
        spawns += 1;
        return true;
      },
    });

    expect(state.pendingSpawns).toBe(4);
    expect(spawns).toBe(0);
    expect(state.queuedPerSecond).toBeGreaterThan(0);
  });
});
