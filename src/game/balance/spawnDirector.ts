import { tickDpsMetrics } from "./dpsMetrics";
import type { ExpectedPowerBudgetConfig, ExpectedPowerConfig } from "./expectedPower";
import { computePressure, BASELINE_PLAYER_DPS } from "./pressureModel";
import { registry } from "../content/registry";
import { EnemyId } from "../content/enemies";
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

export interface PlannedTrashSpawn {
  type: EnemyId;
  hpCost: number;
}

export interface SpawnDirectorState {
  powerBudget: number;
  pendingHpCommitted: number;
  pendingSpawns: number;
  releaseSpawnsBudget: number;
  waveRemaining: number;
  pendingSpawnQueue: PlannedTrashSpawn[];
  waveSpawnQueue: PlannedTrashSpawn[];
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
    pendingSpawnQueue: [],
    waveSpawnQueue: [],
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

function syncSpawnCounts(state: SpawnDirectorState): void {
  state.pendingSpawns = state.pendingSpawnQueue.length;
  state.waveRemaining = state.waveSpawnQueue.length;
}

function resolveSpawnModelMultipliers(w: any, heat: number): {
  spawnMult: number;
  hpMult: number;
  pressureAt0Sec: number;
  pressureAt120Sec: number;
} {
  const tuning = w.balance?.spawnTuning ?? {};
  const pressureAt0Sec =
    typeof tuning.pressureAt0Sec === "number"
      ? tuning.pressureAt0Sec
      : DEFAULT_SPAWN_TUNING.pressureAt0Sec;
  const pressureAt120Sec =
    typeof tuning.pressureAt120Sec === "number"
      ? tuning.pressureAt120Sec
      : DEFAULT_SPAWN_TUNING.pressureAt120Sec;

  const spawnBase =
    typeof tuning.spawnBase === "number" ? tuning.spawnBase : DEFAULT_SPAWN_TUNING.spawnBase;
  const spawnPerDepth =
    typeof tuning.spawnPerDepth === "number" ? tuning.spawnPerDepth : DEFAULT_SPAWN_TUNING.spawnPerDepth;
  const spawnMult = Math.max(0, spawnBase) * Math.pow(Math.max(0.0001, spawnPerDepth), heat);

  const hpBase = typeof tuning.hpBase === "number" ? tuning.hpBase : DEFAULT_SPAWN_TUNING.hpBase;
  const hpPerDepth =
    typeof tuning.hpPerDepth === "number" ? tuning.hpPerDepth : DEFAULT_SPAWN_TUNING.hpPerDepth;
  const hpMult = Math.max(0, hpBase) * Math.pow(Math.max(0.0001, hpPerDepth), heat);

  return {
    spawnMult,
    hpMult,
    pressureAt0Sec,
    pressureAt120Sec,
  };
}

export function computeSurviveBudgetForDurationSeconds(w: any, durationSec: number): number {
  const duration = Math.max(0, safeNum(durationSec, 0));
  if (duration <= 0) return 0;

  const heat = Math.max(0, Math.floor(safeNum(w.runHeat, 0)));
  const multipliers = resolveSpawnModelMultipliers(w, heat);
  const steps = Math.max(1, Math.ceil(duration));
  const dt = duration / steps;

  let hpBudget = 0;
  for (let i = 0; i < steps; i++) {
    const t0 = i * dt;
    const t1 = (i + 1) * dt;
    const p0 = computePressure(t0, multipliers.pressureAt0Sec, multipliers.pressureAt120Sec);
    const p1 = computePressure(t1, multipliers.pressureAt0Sec, multipliers.pressureAt120Sec);
    const avgPressure = (p0 + p1) * 0.5;
    hpBudget += BASELINE_PLAYER_DPS * avgPressure * multipliers.spawnMult * dt;
  }

  return Math.max(0, hpBudget);
}

export function computeSurviveEquivalentSpawnCountForDurationSeconds(w: any, durationSec: number): number {
  const duration = Math.max(0, safeNum(durationSec, 0));
  if (duration <= 0) return 0;

  const heat = Math.max(0, Math.floor(safeNum(w.runHeat, 0)));
  const multipliers = resolveSpawnModelMultipliers(w, heat);
  const hpBudget = computeSurviveBudgetForDurationSeconds(w, duration);
  const baselineEnemyHp = Math.max(1, registry.enemy(EnemyId.MINION).stats.baseLife * multipliers.hpMult);
  if (baselineEnemyHp <= 0) return 0;
  return hpBudget / baselineEnemyHp;
}

export function createPlannedTrashSpawn(type: EnemyId, hpCost: number): PlannedTrashSpawn {
  return {
    type,
    hpCost: Math.max(1, Math.round(hpCost)),
  };
}

export function queuePlannedTrashSpawn(state: SpawnDirectorState, planned: PlannedTrashSpawn): void {
  state.pendingSpawnQueue.push(planned);
  state.pendingHpCommitted += planned.hpCost;
  state.releaseSpawnsBudget += 1;
  syncSpawnCounts(state);
}

export function queuePlannedTrashSpawns(
  state: SpawnDirectorState,
  count: number,
  planner: () => PlannedTrashSpawn | null,
): number {
  let queued = 0;
  const maxCount = Math.max(0, Math.floor(count));
  for (let i = 0; i < maxCount; i++) {
    const planned = planner();
    if (!planned) break;
    queuePlannedTrashSpawn(state, planned);
    queued++;
  }
  return queued;
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
    planTrashSpawn: () => PlannedTrashSpawn | null;
    spawnTrash: (planned: PlannedTrashSpawn) => boolean | number;
  }
): void {
  if (!cfg.enabled) return;
  void expectedCfg;
  void powerBudgetCfg;

  if (w.metrics?.dps) tickDpsMetrics(w.metrics.dps, w.timeSec ?? 0, dtSec);

  const now = w.timeSec ?? 0;
  const heat = Math.max(0, Math.floor(callbacks.getRunHeat() || 0));
  const tInFloorSec = Math.max(0, safeNum((w as any).phaseTime, safeNum((w as any).timeSec, 0)));
  const multipliers = resolveSpawnModelMultipliers(w, heat);
  const pressureT0 = multipliers.pressureAt0Sec;
  const pressureT120 = multipliers.pressureAt120Sec;

  const expectedDps = BASELINE_PLAYER_DPS;
  const previousPressure = safeNum((w as any).spawnDirectorDebug?.pressure, 0);
  const rawBasePressure = computePressure(tInFloorSec, pressureT0, pressureT120);
  const basePressure = Math.max(0, safeNum(rawBasePressure, previousPressure));
  const pressure = basePressure;
  const waveMult = waveMultiplier(cfg, now);
  const spawnMult = multipliers.spawnMult;
  const hpMult = multipliers.hpMult;

  // Authoritative spawn HP/sec: baselineDps * pressure * spawnMult
  const spawnHpPerSecond = BASELINE_PLAYER_DPS * pressure * spawnMult;
  state.powerBudget += spawnHpPerSecond * Math.max(0, dtSec);

  let queuedFromInterval = 0;
  while (queuedFromInterval < cfg.maxSpawnsPerTick) {
    const planned = callbacks.planTrashSpawn();
    if (!planned) break;
    const availableBudget = state.powerBudget - state.pendingHpCommitted;
    if (availableBudget < planned.hpCost) break;
    queuePlannedTrashSpawn(state, planned);
    queuedFromInterval++;
  }
  if (queuedFromInterval > 0) {
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
    state.waveSpawnQueue.length <= 0 &&
    state.waveCooldownSecLeft <= 0 &&
    readyByThreshold
  ) {
    const releaseCount = Math.min(Math.max(0, cfg.waveTotal), state.pendingSpawnQueue.length);
    for (let i = 0; i < releaseCount; i++) {
      const planned = state.pendingSpawnQueue.shift();
      if (!planned) break;
      state.waveSpawnQueue.push(planned);
    }
    syncSpawnCounts(state);
    state.chunkCooldownSec = 0;
  }

  state.lastChunkSize = 0;
  if (canSpawn && state.waveSpawnQueue.length > 0 && state.chunkCooldownSec <= 0) {
    const chunkBase = Math.max(1, cfg.waveChunk);
    const chunkTarget = Math.min(
      chunkBase,
      state.waveSpawnQueue.length,
      Math.max(0, cfg.maxSpawnsPerTick - spawned)
    );
    let chunkSpawned = 0;
    for (let i = 0; i < chunkTarget; i++) {
      const planned = state.waveSpawnQueue[0];
      if (!planned) break;
      const spawnResult = callbacks.spawnTrash(planned);
      const didSpawn =
        spawnResult === true || (typeof spawnResult === "number" && spawnResult > 0);
      if (didSpawn) {
        const spawnedHp = typeof spawnResult === "number" ? spawnResult : planned.hpCost;
        state.powerBudget = Math.max(0, state.powerBudget - Math.max(0, spawnedHp));
        state.pendingHpCommitted = Math.max(0, state.pendingHpCommitted - planned.hpCost);
        state.releaseSpawnsBudget = Math.max(0, state.releaseSpawnsBudget - 1);
        state.waveSpawnQueue.shift();
        chunkSpawned++;
        spawned++;
      }
    }
    syncSpawnCounts(state);
    state.lastChunkSize = chunkSpawned;
    state.chunkCooldownSec = Math.max(0.01, cfg.waveChunkDelaySec);
    if (state.waveSpawnQueue.length <= 0) {
      state.waveCooldownSecLeft = Math.max(0, cfg.waveCooldownSec);
    }
  }

  // Throughput catch-up:
  // Preserve wave chunking for look/feel, but if backlog grows beyond one wave,
  // release additional spawns from queue budget so pressure is not throttled.
  const backlogTotal = state.pendingSpawnQueue.length + state.waveSpawnQueue.length;
  const shouldCatchUp = canSpawn && backlogTotal > Math.max(0, cfg.waveTotal);
  if (shouldCatchUp) {
    const capLeft = Math.max(0, cfg.maxSpawnsPerTick - spawned);
    const budgeted = Math.max(0, Math.floor(state.releaseSpawnsBudget));
    const catchUpAttempts = Math.min(capLeft, budgeted);
    let catchUpSpawned = 0;
    for (let i = 0; i < catchUpAttempts; i++) {
      const useWave = state.waveSpawnQueue.length > 0;
      const planned = useWave ? state.waveSpawnQueue[0] : state.pendingSpawnQueue[0];
      if (!planned) break;
      const spawnResult = callbacks.spawnTrash(planned);
      const didSpawn =
        spawnResult === true || (typeof spawnResult === "number" && spawnResult > 0);
      if (!didSpawn) continue;

      const spawnedHp = typeof spawnResult === "number" ? spawnResult : planned.hpCost;
      state.powerBudget = Math.max(0, state.powerBudget - Math.max(0, spawnedHp));
      state.pendingHpCommitted = Math.max(0, state.pendingHpCommitted - planned.hpCost);
      state.releaseSpawnsBudget = Math.max(0, state.releaseSpawnsBudget - 1);

      if (useWave) {
        state.waveSpawnQueue.shift();
      } else {
        state.pendingSpawnQueue.shift();
      }

      catchUpSpawned++;
      spawned++;
      if (spawned >= cfg.maxSpawnsPerTick) break;
    }
    syncSpawnCounts(state);
    state.lastChunkSize += catchUpSpawned;
    if (state.waveSpawnQueue.length <= 0 && state.lastChunkSize > 0) {
      state.waveCooldownSecLeft = Math.max(0, cfg.waveCooldownSec);
    }
  }
  recordSpawnCount(state, now, spawned);

  const actualDps = w.metrics?.dps?.dpsSmoothed ?? 0;
  const aheadFactor = actualDps > 0 ? actualDps / Math.max(0.0001, expectedDps) : 0;
  const spawnPressureMult = spawnMult;
  const baselineEnemyHp = Math.max(1, registry.enemy(EnemyId.MINION).stats.baseLife * hpMult);
  const spawnRatePerSec = baselineEnemyHp > 0 ? spawnHpPerSecond / baselineEnemyHp : 0;

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
