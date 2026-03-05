import { tickDpsMetrics } from "./dpsMetrics";
import type { ExpectedPowerBudgetConfig, ExpectedPowerConfig } from "./expectedPower";
import { computePressure, BASELINE_PLAYER_DPS } from "./pressureModel";
import { registry } from "../content/registry";
import { ENEMY_TYPE } from "../content/enemies";
import { DEFAULT_SPAWN_TUNING } from "./spawnTuningDefaults";

export interface SpawnDirectorConfig {
  enabled: boolean;
  pressureBase: number;
  pressurePerDepth: number;
  pressureMin: number;
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
  pendingSoftCap?: number;
  pendingHardCap?: number;
  baseSpawnIntervalSec?: number;
}

export interface SpawnDirectorState {
  powerBudget: number;
  pendingHpCommitted: number;
  pendingSpawns: number;
  releaseSpawnsBudget: number;
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
    pendingHpCommitted: 0,
    pendingSpawns: 0,
    releaseSpawnsBudget: 0,
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

function safeNum(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function pressureAtDepth(cfg: SpawnDirectorConfig, depth: number): number {
  const d = Math.max(0, depth);
  const p = cfg.pressureBase + cfg.pressurePerDepth * d;
  return Math.max(cfg.pressureMin, p);
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
    getRunHeat: () => number;
    isBossActive: () => boolean;
    canSpawnNow?: () => boolean;
    spawnTrash: () => boolean | number;
  }
): void {
  if (!cfg.enabled) return;
  void expectedCfg;
  void powerBudgetCfg;

  if (w.metrics?.dps) tickDpsMetrics(w.metrics.dps, w.timeSec ?? 0, dtSec);

  const now = w.timeSec ?? 0;
  const heat = Math.max(0, Math.floor(callbacks.getRunHeat() || 0));
  const tInFloorSec = Math.max(0, safeNum((w as any).phaseTime, safeNum((w as any).timeSec, 0)));
  const tuning = w.balance?.spawnTuning ?? {};
  const pressureT0 = typeof tuning.pressureAt0Sec === "number" ? tuning.pressureAt0Sec : DEFAULT_SPAWN_TUNING.pressureAt0Sec;
  const pressureT120 = typeof tuning.pressureAt120Sec === "number" ? tuning.pressureAt120Sec : DEFAULT_SPAWN_TUNING.pressureAt120Sec;

  const expectedDps = BASELINE_PLAYER_DPS;
  const previousPressure = safeNum((w as any).spawnDirectorDebug?.pressure, 0);
  const rawBasePressure = computePressure(tInFloorSec, pressureT0, pressureT120);
  const basePressure = Math.max(0, safeNum(rawBasePressure, previousPressure));
  const pressure = basePressure;
  const waveMult = waveMultiplier(cfg, now);

  // Authoritative spawn scaling: spawnBase * spawnPerDepth^heat
  const spawnBase = typeof tuning.spawnBase === "number"
    ? tuning.spawnBase
    : DEFAULT_SPAWN_TUNING.spawnBase;
  const spawnPerDepth = typeof tuning.spawnPerDepth === "number"
    ? tuning.spawnPerDepth
    : DEFAULT_SPAWN_TUNING.spawnPerDepth;
  const spawnMult = Math.max(0, spawnBase) * Math.pow(Math.max(0.0001, spawnPerDepth), heat);
  const hpBase = typeof tuning.hpBase === "number" ? tuning.hpBase : DEFAULT_SPAWN_TUNING.hpBase;
  const hpPerDepth = typeof tuning.hpPerDepth === "number" ? tuning.hpPerDepth : DEFAULT_SPAWN_TUNING.hpPerDepth;
  const hpMult = Math.max(0, hpBase) * Math.pow(Math.max(0.0001, hpPerDepth), heat);

  // Authoritative spawn HP/sec: baselineDps * pressure * spawnMult
  const spawnHpPerSecond = BASELINE_PLAYER_DPS * pressure * spawnMult;
  // Convert HP budget flow to enemy-count interval using representative trash HP.
  const chaserDef = registry.enemy(ENEMY_TYPE.CHASER);
  const baseEnemyHp = Math.max(1, chaserDef.baseLife ?? chaserDef.hp ?? 1);
  const enemyHpForRate = baseEnemyHp * hpMult;
  state.powerBudget += spawnHpPerSecond * Math.max(0, dtSec);

  let queuedFromInterval = 0;
  while (
    (state.powerBudget - state.pendingHpCommitted) >= enemyHpForRate &&
    queuedFromInterval < cfg.maxSpawnsPerTick
  ) {
    state.pendingHpCommitted += enemyHpForRate;
    queuedFromInterval++;
  }
  if (queuedFromInterval > 0) {
    state.pendingSpawns += queuedFromInterval;
    state.releaseSpawnsBudget += queuedFromInterval;
    state.queuedPerSecond = recordRate(
      state.queueEvents,
      state.queueWindowSec,
      now,
      queuedFromInterval
    );
  } else {
    state.queuedPerSecond = recordRate(state.queueEvents, state.queueWindowSec, now, 0);
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
    const chunkBase = Math.max(1, cfg.waveChunk);
    const chunkTarget = Math.min(
      chunkBase,
      state.waveRemaining,
      Math.max(0, cfg.maxSpawnsPerTick - spawned)
    );
    let chunkSpawned = 0;
    for (let i = 0; i < chunkTarget; i++) {
      const spawnResult = callbacks.spawnTrash();
      const didSpawn =
        spawnResult === true || (typeof spawnResult === "number" && spawnResult > 0);
      if (didSpawn) {
        const spawnedHp = typeof spawnResult === "number" ? spawnResult : enemyHpForRate;
        state.powerBudget = Math.max(0, state.powerBudget - Math.max(0, spawnedHp));
        state.pendingHpCommitted = Math.max(0, state.pendingHpCommitted - enemyHpForRate);
        state.releaseSpawnsBudget = Math.max(0, state.releaseSpawnsBudget - 1);
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

  // Throughput catch-up:
  // Preserve wave chunking for look/feel, but if backlog grows beyond one wave,
  // release additional spawns from queue budget so pressure is not throttled.
  const backlogTotal = state.pendingSpawns + state.waveRemaining;
  const shouldCatchUp = canSpawn && backlogTotal > Math.max(0, cfg.waveTotal);
  if (shouldCatchUp) {
    const capLeft = Math.max(0, cfg.maxSpawnsPerTick - spawned);
    const budgeted = Math.max(0, Math.floor(state.releaseSpawnsBudget));
    const catchUpAttempts = Math.min(capLeft, budgeted);
    let catchUpSpawned = 0;
    for (let i = 0; i < catchUpAttempts; i++) {
      if (state.waveRemaining <= 0 && state.pendingSpawns <= 0) break;
      const useWave = state.waveRemaining > 0;
      const spawnResult = callbacks.spawnTrash();
      const didSpawn =
        spawnResult === true || (typeof spawnResult === "number" && spawnResult > 0);
      if (!didSpawn) continue;

      const spawnedHp = typeof spawnResult === "number" ? spawnResult : enemyHpForRate;
      state.powerBudget = Math.max(0, state.powerBudget - Math.max(0, spawnedHp));
      state.pendingHpCommitted = Math.max(0, state.pendingHpCommitted - enemyHpForRate);
      state.releaseSpawnsBudget = Math.max(0, state.releaseSpawnsBudget - 1);

      if (useWave) {
        state.waveRemaining = Math.max(0, state.waveRemaining - 1);
      } else {
        state.pendingSpawns = Math.max(0, state.pendingSpawns - 1);
      }

      catchUpSpawned++;
      spawned++;
      if (spawned >= cfg.maxSpawnsPerTick) break;
    }
    state.lastChunkSize += catchUpSpawned;
    if (state.waveRemaining <= 0 && state.lastChunkSize > 0) {
      state.waveCooldownSecLeft = Math.max(0, cfg.waveCooldownSec);
    }
  }
  recordSpawnCount(state, now, spawned);

  const actualDps = w.metrics?.dps?.dpsSmoothed ?? 0;
  const aheadFactor = actualDps > 0 ? actualDps / Math.max(0.0001, expectedDps) : 0;
  const spawnPressureMult = spawnMult;
  const spawnRatePerSec = enemyHpForRate > 0 ? spawnHpPerSecond / enemyHpForRate : 0;

  w.spawnDirectorDebug = {
    heat,
    timeSec: now,
    expectedDps,
    actualDps,
    actualDpsInstant: w.metrics?.dps?.dpsInstant ?? 0,
    aheadFactor,
    basePressure,
    effectivePressure: pressure,
    pressure,
    waveMult,
    timePressure: 1,
    spawnPressureMult,
    spawnHpMult: hpMult,
    powerPerSecond: spawnHpPerSecond,
    effectivePowerPerSecond: spawnHpPerSecond,
    throttleScale: 1,
    tInFloorSec,
    inFrontload: false,
    spawnHpPerSecond,
    trashPowerCost: 1,
    powerBudget: state.powerBudget,
    pendingHpCommitted: state.pendingHpCommitted,
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
