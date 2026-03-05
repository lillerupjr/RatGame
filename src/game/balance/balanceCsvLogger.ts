// src/game/balance/balanceCsvLogger.ts

export type BalanceCsvRow = {
  tSec: number;
  heat: number;

  // Core balancing signals
  spawnedHpThisSec: number;
  spawnedHpTotal: number;
  aliveEnemyHp: number;

  // Spawn director signals (best-effort; "-" if missing)
  pressure: number;
  basePressure: number;
  effectivePressure: number;

  powerPerSecond: number;
  spawnHpPerSecond: number;
  queuedPerSecond: number;
  spawnsPerSecond: number;
  pendingSpawns: number;
};

export type BalanceCsvLogger = {
  enabled: boolean;

  // accumulator for current 1s bucket
  bucketT0: number;
  bucketSpawnedHp: number;

  // totals
  totalSpawnedHp: number;

  // rows
  rows: BalanceCsvRow[];

  // last sampled sec (for stable once-per-second sampling)
  lastSampleSec: number;
};

function safeNum(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sumAliveEnemyHp(w: any): number {
  const alive = w?.eAlive;
  const hp = w?.eHp;
  if (!Array.isArray(alive) || !Array.isArray(hp)) return 0;
  let sum = 0;
  for (let i = 0; i < alive.length; i++) {
    if (alive[i]) sum += safeNum(hp[i], 0);
  }
  return sum;
}

export function createBalanceCsvLogger(): BalanceCsvLogger {
  return {
    enabled: false,
    bucketT0: 0,
    bucketSpawnedHp: 0,
    totalSpawnedHp: 0,
    rows: [],
    lastSampleSec: -1,
  };
}

/**
 * Call this whenever an enemy is spawned (after final scaled hp is known).
 * This only increments a per-second bucket + total.
 */
export function recordEnemySpawnedHp(logger: BalanceCsvLogger, hp: number): void {
  if (!logger.enabled) return;
  const v = Math.max(0, safeNum(hp, 0));
  if (v <= 0) return;
  logger.bucketSpawnedHp += v;
  logger.totalSpawnedHp += v;
}

function csvEscape(s: string): string {
  if (!s.includes(",") && !s.includes("\"") && !s.includes("\n")) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function clearBalanceCsv(logger: BalanceCsvLogger): void {
  logger.bucketT0 = 0;
  logger.bucketSpawnedHp = 0;
  logger.totalSpawnedHp = 0;
  logger.rows = [];
  logger.lastSampleSec = -1;
}

export function setBalanceCsvEnabled(logger: BalanceCsvLogger, enabled: boolean, nowSec: number): void {
  logger.enabled = enabled;
  if (enabled) {
    // start a fresh bucket at "now"
    logger.bucketT0 = nowSec;
    logger.bucketSpawnedHp = 0;
    logger.lastSampleSec = -1;
  }
}

/**
 * Tick once per frame.
 * We only emit a row once per whole second while enabled.
 */
export function tickBalanceCsvLogger(w: any, dtSec: number): void {
  void dtSec;
  const logger = (w as any).balanceCsvLogger as BalanceCsvLogger | undefined;
  if (!logger || !logger.enabled) return;

  const now = safeNum(w.timeSec, 0);
  const sec = Math.floor(now);

  // Only sample once per second
  if (sec === logger.lastSampleSec) return;
  logger.lastSampleSec = sec;

  const dbg = (w as any).spawnDirectorDebug ?? null;

  const heat = safeNum(dbg?.heat, safeNum(w.runHeat, 0));
  const aliveEnemyHp = sumAliveEnemyHp(w);

  const row: BalanceCsvRow = {
    tSec: sec,
    heat,

    spawnedHpThisSec: safeNum(logger.bucketSpawnedHp, 0),
    spawnedHpTotal: safeNum(logger.totalSpawnedHp, 0),
    aliveEnemyHp,

    pressure: safeNum(dbg?.spawnPressureMult ?? dbg?.pressure, 0),
    basePressure: safeNum(dbg?.basePressure, 0),
    effectivePressure: safeNum(dbg?.effectivePressure ?? dbg?.pressure, 0),

    powerPerSecond: safeNum(dbg?.powerPerSecond, 0),
    spawnHpPerSecond: safeNum(dbg?.spawnHpPerSecond, 0),
    queuedPerSecond: safeNum(dbg?.queuedPerSecond, 0),
    spawnsPerSecond: safeNum(dbg?.spawnsPerSecond, 0),
    pendingSpawns: safeNum(dbg?.pendingSpawns, 0),
  };

  logger.rows.push(row);

  // reset bucket for next second
  logger.bucketSpawnedHp = 0;
}

export function buildBalanceCsv(logger: BalanceCsvLogger): string {
  const header = [
    "tSec",
    "heat",
    "spawnedHpThisSec",
    "spawnedHpTotal",
    "aliveEnemyHp",
    "pressure",
    "basePressure",
    "effectivePressure",
    "powerPerSecond",
    "spawnHpPerSecond",
    "queuedPerSecond",
    "spawnsPerSecond",
    "pendingSpawns",
  ].join(",");

  const lines = [header];

  for (const r of logger.rows) {
    const cols = [
      r.tSec,
      r.heat,
      r.spawnedHpThisSec,
      r.spawnedHpTotal,
      r.aliveEnemyHp,
      r.pressure,
      r.basePressure,
      r.effectivePressure,
      r.powerPerSecond,
      r.spawnHpPerSecond,
      r.queuedPerSecond,
      r.spawnsPerSecond,
      r.pendingSpawns,
    ].map((v) => csvEscape(String(v)));
    lines.push(cols.join(","));
  }

  return lines.join("\n");
}

export function downloadBalanceCsv(logger: BalanceCsvLogger, filename: string): void {
  const csv = buildBalanceCsv(logger);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  // cleanup
  setTimeout(() => URL.revokeObjectURL(url), 250);
}
