import { describe, expect, test } from "vitest";
import { createDpsMetrics } from "../../../game/balance/dpsMetrics";
import { createSpawnDirectorState, tickSpawnDirector, type SpawnDirectorConfig } from "../../../game/balance/spawnDirector";
import type { ExpectedPowerBudgetConfig, ExpectedPowerConfig } from "../../../game/balance/expectedPower";
import { ENEMY_TYPE } from "../../../game/content/enemies";
import { registry } from "../../../game/content/registry";

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

const TARGET_REPRESENTATIVE_HP = 20;
const chaserBaseLife = registry.enemy(ENEMY_TYPE.CHASER).baseLife ?? 1;
const hpBaseForRepresentativeHp =
  TARGET_REPRESENTATIVE_HP / Math.max(1, chaserBaseLife);

describe("spawnDirector interval queue", () => {
  test("same heat yields same scaling regardless of map-depth presentation", () => {
    const stateA = createSpawnDirectorState();
    const stateB = createSpawnDirectorState();
    const makeWorld = () => ({
      timeSec: 10,
      phaseTime: 10,
      metrics: { dps: createDpsMetrics() },
      enemyPowerConfig: { costs: { trash: 1 } },
      balance: {
        spawnTuning: {
          spawnBase: 1.0,
          spawnPerDepth: 1.12,
          hpBase: hpBaseForRepresentativeHp,
          hpPerDepth: 1.18,
          pressureAt0Sec: 0.8,
          pressureAt120Sec: 1.6,
        },
      },
    });
    const wA: any = { ...makeWorld(), mapDepth: 1 };
    const wB: any = { ...makeWorld(), mapDepth: 999 };

    tickSpawnDirector(wA, 1, cfg, expectedCfg, powerBudgetCfg, stateA, {
      getRunHeat: () => 10,
      isBossActive: () => false,
      canSpawnNow: () => false,
      spawnTrash: () => true,
    });
    tickSpawnDirector(wB, 1, cfg, expectedCfg, powerBudgetCfg, stateB, {
      getRunHeat: () => 10,
      isBossActive: () => false,
      canSpawnNow: () => false,
      spawnTrash: () => true,
    });

    expect(wA.spawnDirectorDebug.spawnPressureMult).toBeCloseTo(wB.spawnDirectorDebug.spawnPressureMult);
    expect(wA.spawnDirectorDebug.spawnHpMult).toBeCloseTo(wB.spawnDirectorDebug.spawnHpMult);
    expect(wA.spawnDirectorDebug.powerPerSecond).toBeCloseTo(wB.spawnDirectorDebug.powerPerSecond);
  });

  test("spawn interval converts elapsed time into pending count", () => {
    const state = createSpawnDirectorState();
    const w: any = {
      timeSec: 10,
      metrics: { dps: createDpsMetrics() },
      enemyPowerConfig: { costs: { trash: 1 } },
      balance: {
        spawnTuning: {
          spawnBase: 1.0,
          spawnPerDepth: 1.12,
          hpBase: hpBaseForRepresentativeHp,
          hpPerDepth: 1.18,
          pressureAt0Sec: 0.8,
          pressureAt120Sec: 1.6,
        },
      },
    };
    let spawned = 0;

    tickSpawnDirector(w, 10, cfg, expectedCfg, powerBudgetCfg, state, {
      getRunHeat: () => 0,
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
      balance: {
        spawnTuning: {
          spawnBase: 1.0,
          spawnPerDepth: 1.12,
          hpBase: hpBaseForRepresentativeHp,
          hpPerDepth: 1.18,
          pressureAt0Sec: 0.8,
          pressureAt120Sec: 1.6,
        },
      },
    };

    tickSpawnDirector(w, 10, cfg, expectedCfg, powerBudgetCfg, state, {
      getRunHeat: () => 0,
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

  test("spawn director telemetry pressure exceeds 50 and keeps climbing over long time", () => {
    const state = createSpawnDirectorState();
    const w: any = {
      timeSec: 500,
      phaseTime: 500,
      metrics: { dps: createDpsMetrics() },
      enemyPowerConfig: { costs: { trash: 1 } },
      balance: {
        spawnTuning: {
          spawnBase: 1.0,
          spawnPerDepth: 1.12,
          hpBase: hpBaseForRepresentativeHp,
          hpPerDepth: 1.18,
          pressureAt0Sec: 0.8,
          pressureAt120Sec: 1.6,
        },
      },
    };

    tickSpawnDirector(w, 1, cfg, expectedCfg, powerBudgetCfg, state, {
      getRunHeat: () => 1,
      isBossActive: () => false,
      canSpawnNow: () => false,
      spawnTrash: () => true,
    });
    const p1 = w.spawnDirectorDebug.pressure;
    expect(p1).toBeGreaterThan(50);

    w.timeSec = 560;
    w.phaseTime = 560;
    tickSpawnDirector(w, 1, cfg, expectedCfg, powerBudgetCfg, state, {
      getRunHeat: () => 1,
      isBossActive: () => false,
      canSpawnNow: () => false,
      spawnTrash: () => true,
    });
    const p2 = w.spawnDirectorDebug.pressure;
    expect(p2).toBeGreaterThan(50);
    expect(p2).toBeGreaterThan(p1);
  });
});
