import { tickDpsMetrics } from "./dpsMetrics";
import {
  expectedDpsAtProgress,
  powerPerSecondAtProgress,
  type ExpectedPowerBudgetConfig,
  type ExpectedPowerConfig,
} from "./expectedPower";

export interface SpawnDirectorConfig {
  enabled: boolean;
  pressureBase: number;
  pressurePerDepth: number;
  pressureMin: number;
  pressureMax: number;
  minFillPerTick?: number;
  waveEnabled: boolean;
  waveTotal: number;
  waveChunk: number;
  waveChunkDelaySec: number;
  waveCooldownSec: number;
  pendingThresholdToStartWave: number;
  wavePeriodSec: number;
  waveLowMult: number;
  waveHighMult: number;
  waveHighFrac: number;
  bossTrashPressureMult: number;
  maxSpawnsPerTick: number;
}

export interface SpawnDirectorState {
  powerBudget: number;
  pendingSpawns: number;
  waveRemaining: number;
  chunkCooldownSec: number;
  waveCooldownSecLeft: number;
  lastChunkSize: number;
  queueWindowSec: number;
  queueEvents: { t: number; count: number }[];
  queuedPerSecond: number;
  spawnCountWindowSec: number;
  spawnEvents: { t: number; count: number }[];
  spawnsPerSecond: number;
}

export function createSpawnDirectorState(): SpawnDirectorState {
  return {
    powerBudget: 0,
    pendingSpawns: 0,
    waveRemaining: 0,
    chunkCooldownSec: 0,
    waveCooldownSecLeft: 0,
    lastChunkSize: 0,
    queueWindowSec: 5,
    queueEvents: [],
    queuedPerSecond: 0,
    spawnCountWindowSec: 5,
    spawnEvents: [],
    spawnsPerSecond: 0,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function pressureAtDepth(cfg: SpawnDirectorConfig, depth: number): number {
  return clamp(cfg.pressureBase + cfg.pressurePerDepth * depth, cfg.pressureMin, cfg.pressureMax);
}

function recordSpawnCount(state: SpawnDirectorState, nowSec: number, count: number): void {
  if (count > 0) state.spawnEvents.push({ t: nowSec, count });
  const cutoff = nowSec - state.spawnCountWindowSec;
  while (state.spawnEvents.length && state.spawnEvents[0].t < cutoff) state.spawnEvents.shift();

  let sum = 0;
  for (let i = 0; i < state.spawnEvents.length; i++) sum += state.spawnEvents[i].count;
  state.spawnsPerSecond = sum / state.spawnCountWindowSec;
}

function recordRate(
  events: { t: number; count: number }[],
  windowSec: number,
  nowSec: number,
  count: number
): number {
  if (count > 0) events.push({ t: nowSec, count });
  const cutoff = nowSec - windowSec;
  while (events.length && events[0].t < cutoff) events.shift();
  let sum = 0;
  for (let i = 0; i < events.length; i++) sum += events[i].count;
  return sum / windowSec;
}

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function waveMultiplier(cfg: SpawnDirectorConfig, nowSec: number): number {
  if (!cfg.waveEnabled) return 1;
  const period = Math.max(0.001, cfg.wavePeriodSec);
  const phase = (nowSec % period) / period;
  const highFrac = Math.max(0, Math.min(0.95, cfg.waveHighFrac));
  const highStart = 1 - highFrac;
  if (phase < highStart) return cfg.waveLowMult;
  const u = (phase - highStart) / Math.max(0.001, 1 - highStart);
  const s = smoothstep01(u);
  return cfg.waveLowMult + (cfg.waveHighMult - cfg.waveLowMult) * s;
}

export function tickSpawnDirector(
  w: any,
  dtSec: number,
  cfg: SpawnDirectorConfig,
  expectedCfg: ExpectedPowerConfig,
  powerBudgetCfg: ExpectedPowerBudgetConfig,
  state: SpawnDirectorState,
  callbacks: {
    getDepth: () => number;
    isBossActive: () => boolean;
    canSpawnNow?: () => boolean;
    spawnTrash: () => boolean;
  }
): void {
  if (!cfg.enabled) return;

  if (w.metrics?.dps) tickDpsMetrics(w.metrics.dps, w.timeSec ?? 0, dtSec);

  const now = w.timeSec ?? 0;
  const depth = callbacks.getDepth();
  const trashPowerCost = Math.max(1e-6, w.enemyPowerConfig?.costs?.trash ?? 1.0);

  const expectedDps = expectedDpsAtProgress(expectedCfg, now, depth);
  let pressure = pressureAtDepth(cfg, depth);
  if (callbacks.isBossActive()) pressure *= cfg.bossTrashPressureMult;
  const waveMult = waveMultiplier(cfg, now);

  const basePowerPerSecond = powerPerSecondAtProgress(powerBudgetCfg, now);
  const powerPerSecond = basePowerPerSecond * pressure * waveMult;
  state.powerBudget += powerPerSecond * dtSec;

  let extraQueue = 0;
  while (state.powerBudget >= trashPowerCost && extraQueue < cfg.maxSpawnsPerTick) {
    state.powerBudget -= trashPowerCost;
    extraQueue++;
  }
  if (extraQueue > 0) {
    state.pendingSpawns += extraQueue;
    state.queuedPerSecond = recordRate(
      state.queueEvents,
      state.queueWindowSec,
      now,
      extraQueue
    );
  } else {
    state.queuedPerSecond = recordRate(state.queueEvents, state.queueWindowSec, now, 0);
  }

  const fill = Math.max(0, Math.floor(cfg.minFillPerTick ?? 0));
  if (fill > 0) {
    state.pendingSpawns += fill;
    state.queuedPerSecond = recordRate(state.queueEvents, state.queueWindowSec, now, fill);
  }

  state.chunkCooldownSec = Math.max(0, state.chunkCooldownSec - dtSec);
  state.waveCooldownSecLeft = Math.max(0, state.waveCooldownSecLeft - dtSec);

  let spawned = 0;
  const threshold = Math.max(0, cfg.pendingThresholdToStartWave ?? 0);
  const readyByThreshold = threshold > 0 ? state.pendingSpawns >= threshold : state.pendingSpawns > 0;
  const canSpawn = callbacks.canSpawnNow ? callbacks.canSpawnNow() : true;

  if (
    canSpawn &&
    state.waveRemaining <= 0 &&
    state.waveCooldownSecLeft <= 0 &&
    readyByThreshold
  ) {
    state.waveRemaining = Math.min(Math.max(0, cfg.waveTotal), state.pendingSpawns);
    state.pendingSpawns -= state.waveRemaining;
    state.chunkCooldownSec = 0;
  }

  state.lastChunkSize = 0;
  if (canSpawn && state.waveRemaining > 0 && state.chunkCooldownSec <= 0) {
    const chunkTarget = Math.min(
      Math.max(1, cfg.waveChunk),
      state.waveRemaining,
      Math.max(0, cfg.maxSpawnsPerTick - spawned)
    );
    let chunkSpawned = 0;
    for (let i = 0; i < chunkTarget; i++) {
      if (callbacks.spawnTrash()) {
        chunkSpawned++;
        spawned++;
      }
    }
    state.waveRemaining = Math.max(0, state.waveRemaining - chunkSpawned);
    state.lastChunkSize = chunkSpawned;
    state.chunkCooldownSec = Math.max(0.01, cfg.waveChunkDelaySec);
    if (state.waveRemaining <= 0) {
      state.waveCooldownSecLeft = Math.max(0, cfg.waveCooldownSec);
    }
  }
  recordSpawnCount(state, now, spawned);

  const actualDps = w.metrics?.dps?.dpsSmoothed ?? 0;
  const aheadFactor = expectedDps > 0 ? actualDps / expectedDps : 0;

  w.spawnDirectorDebug = {
    depth,
    timeSec: now,
    expectedDps,
    actualDps,
    actualDpsInstant: w.metrics?.dps?.dpsInstant ?? 0,
    aheadFactor,
    pressure,
    waveMult,
    powerPerSecond,
    trashPowerCost,
    powerBudget: state.powerBudget,
    pendingSpawns: state.pendingSpawns,
    waveRemaining: state.waveRemaining,
    chunkCooldownSec: state.chunkCooldownSec,
    waveCooldownSecLeft: state.waveCooldownSecLeft,
    lastChunkSize: state.lastChunkSize,
    queuedPerSecond: state.queuedPerSecond,
    pendingThresholdToStartWave: threshold,
    spawnsPerSecond: state.spawnsPerSecond,
  };
}
