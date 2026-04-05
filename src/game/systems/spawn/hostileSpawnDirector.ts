import type { World } from "../../../engine/world/world";
import { ENEMIES, EnemyId, type EnemyId as EnemyIdType, type EnemySpawnRole } from "../../content/enemies";
import { isNeutralMonsterId } from "../../content/neutralMonsters";
import { getSettings } from "../../../settings/settingsStore";

export type HostileSpawnDirectorState = {
  budget: number;
  spawnCooldownSec: number;
  burstCooldownSec: number;
  rngSeed: number;
};

export type HostileSpawnRequest = {
  enemyId: EnemyIdType;
  count: number;
  reason: "normal" | "burst";
};

export type HostileSpawnDirectorContext = {
  dt: number;
  elapsedSec: number;
  floorDepth: number;
  spawningEnabled: boolean;
  activeEnemies: Array<{ enemyId: EnemyIdType }>;
};

export type HostileSpawnScalarCurvePoint = {
  timeSec: number;
  value: number;
};

export type HostileSpawnScalarCurve = readonly HostileSpawnScalarCurvePoint[];

type HostileSpawnAnchorCurve = {
  t0: number;
  t120: number;
  overtimeSlope: number;
};

export type HostileSpawnDirectorConfig = {
  stockpileMultiplier: number;
  minSpawnIntervalSec: number;
  burstCooldownBaseSec: number;
  burstChancePerSpawnWindow: number;
  burstExtraAttempts: number;
  maxPurchaseAttemptsPerUpdate: number;
  heatHealthFactor: number;
  heatPowerPerSecFactor: number;
  heatThreatCapFactor: number;
  roleCaps: Record<EnemySpawnRole, number>;
  powerPerSec: HostileSpawnAnchorCurve;
  liveThreatCap: HostileSpawnAnchorCurve;
  roleWeightCurves: Record<EnemySpawnRole, HostileSpawnScalarCurve>;
};

export type HostileSpawnDebugSnapshot = {
  budget: number;
  powerPerSec: number;
  liveThreat: number;
  liveThreatCap: number;
  stockpileCap: number;
  threatRoom: number;
  spawnCooldownSec: number;
  burstCooldownSec: number;
  lastMode: DirectorMode;
  totalAliveHostileEnemies: number;
  aliveByRole: Record<EnemySpawnRole, number>;
  lastRequests: HostileSpawnRequest[];
  requestCount: number;
  spawnAttempts: number;
  successfulSpawns: number;
  failedPlacements: number;
};

type DirectorMode = "normal" | "burst";

type MutableSeedRef = {
  seed: number;
};

type ValidEnemy = {
  enemyId: EnemyIdType;
  role: EnemySpawnRole;
  power: number;
  minGroupSize: number;
  maxGroupSize: number;
  maxAlive: number;
  effectiveWeight: number;
};

const ROLE_ORDER: EnemySpawnRole[] = [
  "baseline_chaser",
  "fast_chaser",
  "tank",
  "ranged",
  "suicide",
  "leaper",
  "special",
];

const DEFAULT_ROLE_COUNTS = (): Record<EnemySpawnRole, number> => ({
  baseline_chaser: 0,
  fast_chaser: 0,
  tank: 0,
  ranged: 0,
  suicide: 0,
  leaper: 0,
  special: 0,
});

export const HOSTILE_SPAWN_DIRECTOR_CONFIG: HostileSpawnDirectorConfig = {
  stockpileMultiplier: 1.35,
  minSpawnIntervalSec: 1.25,
  burstCooldownBaseSec: 12,
  burstChancePerSpawnWindow: 0.16,
  burstExtraAttempts: 1,
  maxPurchaseAttemptsPerUpdate: 3,
  heatHealthFactor: 0.12,
  heatPowerPerSecFactor: 0.08,
  heatThreatCapFactor: 0.05,
  roleCaps: {
    baseline_chaser: 28,
    fast_chaser: 20,
    tank: 10,
    ranged: 8,
    suicide: 6,
    leaper: 5,
    special: 8,
  },
  powerPerSec: {
    t0: 0.6,
    t120: 2.0,
    overtimeSlope: 0.006,
  },
  liveThreatCap: {
    t0: 4.0,
    t120: 18.0,
    overtimeSlope: 0.05,
  },
  roleWeightCurves: {
    baseline_chaser: [{ timeSec: 0, value: 1.0 }, { timeSec: 120, value: 1.0 }],
    fast_chaser: [{ timeSec: 0, value: 0.8 }, { timeSec: 120, value: 0.9 }],
    tank: [{ timeSec: 0, value: 0.35 }, { timeSec: 120, value: 0.75 }],
    ranged: [{ timeSec: 0, value: 0.45 }, { timeSec: 120, value: 0.85 }],
    suicide: [{ timeSec: 0, value: 0.15 }, { timeSec: 120, value: 0.55 }],
    leaper: [{ timeSec: 0, value: 0.1 }, { timeSec: 120, value: 0.45 }],
    special: [{ timeSec: 0, value: 0.25 }, { timeSec: 120, value: 0.55 }],
  },
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function makeFloorSeed(world: Pick<World, "runSeed" | "floorIndex" | "mapDepth" | "currentFloorIntent">): number {
  const floorKey = world.currentFloorIntent?.nodeId ?? "NO_FLOOR_INTENT";
  return hashString(`${world.runSeed}:${floorKey}:${world.floorIndex}:${world.mapDepth}:hostile`);
}

export function resetHostileSpawnDirectorForFloor(world: World): void {
  const resolvedConfig = resolveHostileSpawnDirectorConfig();
  world.hostileSpawnDirector = {
    budget: 0,
    spawnCooldownSec: 0,
    burstCooldownSec: resolvedConfig.burstCooldownBaseSec,
    rngSeed: makeFloorSeed(world),
  };
  world.hostileSpawnDebug = null;
}

function worldDepthLike(world: Pick<World, "mapDepth" | "delveDepth" | "floorIndex">): number {
  if (Number.isFinite(world.mapDepth) && world.mapDepth > 0) return Math.floor(world.mapDepth);
  if (Number.isFinite(world.delveDepth) && world.delveDepth > 0) return Math.floor(world.delveDepth);
  return Math.max(1, Math.floor((world.floorIndex ?? 0) + 1));
}

export function getHostileSpawnHeatFromDepth(depth: number): number {
  return Math.max(0, Math.floor(Number(depth) || 0) - 1);
}

export function getHostileSpawnHeat(world: Pick<World, "mapDepth" | "delveDepth" | "floorIndex">): number {
  return getHostileSpawnHeatFromDepth(worldDepthLike(world));
}

export function resolveHostileSpawnDirectorConfig(): HostileSpawnDirectorConfig {
  const system = getSettings().system;
  return {
    ...HOSTILE_SPAWN_DIRECTOR_CONFIG,
    stockpileMultiplier: system.hostileSpawnStockpileMultiplier,
    minSpawnIntervalSec: system.hostileSpawnMinSpawnIntervalSec,
    burstChancePerSpawnWindow: system.hostileSpawnBurstChancePerSpawnWindow,
    burstExtraAttempts: system.hostileSpawnBurstExtraAttempts,
    heatHealthFactor: system.hostileSpawnHeatHealthFactor,
    heatPowerPerSecFactor: system.hostileSpawnHeatPowerPerSecFactor,
    heatThreatCapFactor: system.hostileSpawnHeatThreatCapFactor,
    powerPerSec: {
      t0: system.hostileSpawnT0PowerPerSec,
      t120: system.hostileSpawnT120PowerPerSec,
      overtimeSlope: system.hostileSpawnOvertimePowerPerSecSlope,
    },
    liveThreatCap: {
      t0: system.hostileSpawnT0LiveThreatCap,
      t120: system.hostileSpawnT120LiveThreatCap,
      overtimeSlope: system.hostileSpawnOvertimeLiveThreatCapSlope,
    },
  };
}

export function resolveHostileSpawnHeatHealthMultiplier(
  world: Pick<World, "mapDepth" | "delveDepth" | "floorIndex">,
): number {
  const config = resolveHostileSpawnDirectorConfig();
  const heat = getHostileSpawnHeat(world);
  return 1 + heat * config.heatHealthFactor;
}

function sampleAnchorCurve(curve: HostileSpawnAnchorCurve, elapsedSec: number): number {
  const t = Math.max(0, Number.isFinite(elapsedSec) ? elapsedSec : 0);
  if (t <= 120) {
    const alpha = t / 120;
    return curve.t0 + (curve.t120 - curve.t0) * alpha;
  }
  return curve.t120 + curve.overtimeSlope * (t - 120);
}

function integrateAnchorCurve(curve: HostileSpawnAnchorCurve, durationSec: number): number {
  const duration = Math.max(0, Number.isFinite(durationSec) ? durationSec : 0);
  if (duration <= 0) return 0;

  if (duration <= 120) {
    const endValue = sampleAnchorCurve(curve, duration);
    return duration * (curve.t0 + endValue) * 0.5;
  }

  const firstSegment = 120 * (curve.t0 + curve.t120) * 0.5;
  const extra = duration - 120;
  const overtimeSegment = extra * curve.t120 + 0.5 * curve.overtimeSlope * extra * extra;
  return firstSegment + overtimeSegment;
}

export function estimateHostileSpawnPowerBudgetForDurationSeconds(
  world: Pick<World, "mapDepth" | "delveDepth" | "floorIndex">,
  durationSec: number,
): number {
  const config = resolveHostileSpawnDirectorConfig();
  const heat = getHostileSpawnHeat(world);
  const baseBudget = integrateAnchorCurve(config.powerPerSec, durationSec);
  return baseBudget * (1 + heat * config.heatPowerPerSecFactor);
}

function sampleRoleCurve(curve: HostileSpawnScalarCurve, elapsedSec: number): number {
  if (curve.length <= 0) return 0;
  const t = Math.max(0, Number.isFinite(elapsedSec) ? elapsedSec : 0);
  const start = curve[0];
  const end = curve[curve.length - 1];
  if (t <= start.timeSec) return start.value;
  if (t >= end.timeSec) return end.value;
  for (let i = 1; i < curve.length; i++) {
    const right = curve[i];
    const left = curve[i - 1];
    if (t > right.timeSec) continue;
    const span = Math.max(1e-6, right.timeSec - left.timeSec);
    const alpha = (t - left.timeSec) / span;
    return left.value + (right.value - left.value) * alpha;
  }
  return end.value;
}

function nextSeed(seed: number): number {
  let x = seed >>> 0;
  if (x === 0) x = 0x12345678;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function randomFloat(seedRef: MutableSeedRef): number {
  seedRef.seed = nextSeed(seedRef.seed);
  return seedRef.seed / 0xffffffff;
}

function randomInt(seedRef: MutableSeedRef, min: number, maxInclusive: number): number {
  if (maxInclusive <= min) return min;
  return min + Math.floor(randomFloat(seedRef) * (maxInclusive - min + 1));
}

function weightedPickIndex(weights: number[], seedRef: MutableSeedRef): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i]);
  if (total <= 0) return -1;
  let roll = randomFloat(seedRef) * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= Math.max(0, weights[i]);
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}

function hostileEnemyEntries() {
  return Object.values(ENEMIES).filter((enemy) => enemy.id !== EnemyId.BOSS && !isNeutralMonsterId(enemy.id));
}

function buildAliveState(activeEnemies: Array<{ enemyId: EnemyIdType }>): {
  liveThreat: number;
  aliveByEnemyId: Map<EnemyIdType, number>;
  aliveByRole: Record<EnemySpawnRole, number>;
  totalAliveHostileEnemies: number;
} {
  const aliveByEnemyId = new Map<EnemyIdType, number>();
  const aliveByRole = DEFAULT_ROLE_COUNTS();
  let liveThreat = 0;
  let totalAliveHostileEnemies = 0;

  for (let i = 0; i < activeEnemies.length; i++) {
    const enemyId = activeEnemies[i].enemyId;
    if (enemyId === EnemyId.BOSS || isNeutralMonsterId(enemyId)) continue;
    const def = ENEMIES[enemyId];
    if (!def) continue;
    totalAliveHostileEnemies += 1;
    liveThreat += Math.max(0, def.spawn.power);
    aliveByEnemyId.set(enemyId, (aliveByEnemyId.get(enemyId) ?? 0) + 1);
    aliveByRole[def.spawn.role] += 1;
  }

  return { liveThreat, aliveByEnemyId, aliveByRole, totalAliveHostileEnemies };
}

function effectiveEnemyWeight(mode: DirectorMode, enemyId: EnemyIdType): number {
  const spawn = ENEMIES[enemyId].spawn;
  return mode === "burst" ? (spawn.burstWeight ?? spawn.weight) : spawn.weight;
}

function buildValidEnemyPool(
  mode: DirectorMode,
  elapsedSec: number,
  floorDepth: number,
  budget: number,
  threatRoom: number,
  aliveByEnemyId: Map<EnemyIdType, number>,
  aliveByRole: Record<EnemySpawnRole, number>,
  config: HostileSpawnDirectorConfig,
): ValidEnemy[] {
  const valid: ValidEnemy[] = [];
  for (const enemy of hostileEnemyEntries()) {
    const spawn = enemy.spawn;
    if (elapsedSec < spawn.unlockTimeSec) continue;
    if (floorDepth < spawn.unlockDepth) continue;

    const power = Math.max(0, spawn.power);
    const minCost = power * spawn.minGroupSize;
    if (budget + 1e-6 < minCost) continue;
    if (threatRoom + 1e-6 < minCost) continue;

    const aliveEnemyCount = aliveByEnemyId.get(enemy.id) ?? 0;
    if (aliveEnemyCount >= spawn.maxAlive) continue;
    if (aliveByRole[spawn.role] >= config.roleCaps[spawn.role]) continue;

    const weight = effectiveEnemyWeight(mode, enemy.id);
    if (weight <= 0) continue;

    valid.push({
      enemyId: enemy.id,
      role: spawn.role,
      power,
      minGroupSize: spawn.minGroupSize,
      maxGroupSize: spawn.maxGroupSize,
      maxAlive: spawn.maxAlive,
      effectiveWeight: weight,
    });
  }
  return valid;
}

function snapshotRequests(requests: HostileSpawnRequest[]): HostileSpawnRequest[] {
  return requests.map((request) => ({ ...request }));
}

function buildDebugSnapshot(args: {
  budget: number;
  powerPerSec: number;
  liveThreat: number;
  liveThreatCap: number;
  stockpileCap: number;
  spawnCooldownSec: number;
  burstCooldownSec: number;
  lastMode: DirectorMode;
  totalAliveHostileEnemies: number;
  aliveByRole: Record<EnemySpawnRole, number>;
  lastRequests: HostileSpawnRequest[];
}): HostileSpawnDebugSnapshot {
  return {
    budget: args.budget,
    powerPerSec: args.powerPerSec,
    liveThreat: args.liveThreat,
    liveThreatCap: args.liveThreatCap,
    stockpileCap: args.stockpileCap,
    threatRoom: Math.max(0, args.liveThreatCap - args.liveThreat),
    spawnCooldownSec: args.spawnCooldownSec,
    burstCooldownSec: args.burstCooldownSec,
    lastMode: args.lastMode,
    totalAliveHostileEnemies: args.totalAliveHostileEnemies,
    aliveByRole: { ...args.aliveByRole },
    lastRequests: snapshotRequests(args.lastRequests),
    requestCount: args.lastRequests.length,
    spawnAttempts: 0,
    successfulSpawns: 0,
    failedPlacements: 0,
  };
}

export function updateHostileSpawnDirector(
  world: World,
  context: HostileSpawnDirectorContext,
): HostileSpawnRequest[] {
  const config = resolveHostileSpawnDirectorConfig();
  const state = world.hostileSpawnDirector;
  const dt = Math.max(0, Number.isFinite(context.dt) ? context.dt : 0);
  const elapsedSec = Math.max(0, Number.isFinite(context.elapsedSec) ? context.elapsedSec : 0);
  const floorDepth = Math.max(0, Math.floor(Number(context.floorDepth) || 0));
  const heat = getHostileSpawnHeatFromDepth(floorDepth);
  const seedRef: MutableSeedRef = { seed: state.rngSeed >>> 0 };
  const previousMode = world.hostileSpawnDebug?.lastMode ?? "normal";

  state.spawnCooldownSec = Math.max(0, state.spawnCooldownSec - dt);
  state.burstCooldownSec = Math.max(0, state.burstCooldownSec - dt);

  const basePowerPerSec = sampleAnchorCurve(config.powerPerSec, elapsedSec);
  const baseLiveThreatCap = sampleAnchorCurve(config.liveThreatCap, elapsedSec);
  const powerPerSec = basePowerPerSec * (1 + heat * config.heatPowerPerSecFactor);
  const liveThreatCap = baseLiveThreatCap * (1 + heat * config.heatThreatCapFactor);
  state.budget += powerPerSec * dt;

  const derived = buildAliveState(context.activeEnemies);
  const stockpileCap = liveThreatCap * config.stockpileMultiplier;
  state.budget = Math.min(state.budget, stockpileCap);

  const requests: HostileSpawnRequest[] = [];
  if (!context.spawningEnabled || state.spawnCooldownSec > 0) {
    world.hostileSpawnDebug = buildDebugSnapshot({
      budget: state.budget,
      powerPerSec,
      liveThreat: derived.liveThreat,
      liveThreatCap,
      stockpileCap,
      spawnCooldownSec: state.spawnCooldownSec,
      burstCooldownSec: state.burstCooldownSec,
      lastMode: previousMode,
      totalAliveHostileEnemies: derived.totalAliveHostileEnemies,
      aliveByRole: derived.aliveByRole,
      lastRequests: [],
    });
    state.rngSeed = seedRef.seed >>> 0;
    return requests;
  }

  const shouldBurst =
    state.burstCooldownSec <= 0 &&
    randomFloat(seedRef) < config.burstChancePerSpawnWindow;
  const mode: DirectorMode = shouldBurst ? "burst" : "normal";
  const attempts = config.maxPurchaseAttemptsPerUpdate + (mode === "burst" ? config.burstExtraAttempts : 0);

  let localBudget = state.budget;
  let localLiveThreat = derived.liveThreat;
  const localAliveByEnemyId = new Map(derived.aliveByEnemyId);
  const localAliveByRole = { ...derived.aliveByRole };

  for (let attempt = 0; attempt < attempts; attempt++) {
    const threatRoom = Math.max(0, liveThreatCap - localLiveThreat);
    const validEnemies = buildValidEnemyPool(
      mode,
      elapsedSec,
      floorDepth,
      localBudget,
      threatRoom,
      localAliveByEnemyId,
      localAliveByRole,
      config,
    );
    if (validEnemies.length <= 0) break;

    const groupedByRole = new Map<EnemySpawnRole, ValidEnemy[]>();
    for (let i = 0; i < validEnemies.length; i++) {
      const enemy = validEnemies[i];
      const bucket = groupedByRole.get(enemy.role) ?? [];
      bucket.push(enemy);
      groupedByRole.set(enemy.role, bucket);
    }

    const candidateRoles: EnemySpawnRole[] = [];
    const roleWeights: number[] = [];
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      const role = ROLE_ORDER[i];
      if (!groupedByRole.has(role)) continue;
      const roleWeight = sampleRoleCurve(config.roleWeightCurves[role], elapsedSec);
      if (roleWeight <= 0) continue;
      candidateRoles.push(role);
      roleWeights.push(roleWeight);
    }
    if (candidateRoles.length <= 0) break;

    const chosenRoleIndex = weightedPickIndex(roleWeights, seedRef);
    if (chosenRoleIndex < 0) break;
    const chosenRole = candidateRoles[chosenRoleIndex];
    const roleEnemies = groupedByRole.get(chosenRole) ?? [];
    if (roleEnemies.length <= 0) break;

    const enemyWeights = roleEnemies.map((enemy) => enemy.effectiveWeight);
    const chosenEnemyIndex = weightedPickIndex(enemyWeights, seedRef);
    if (chosenEnemyIndex < 0) break;
    const chosenEnemy = roleEnemies[chosenEnemyIndex];
    const rolledCount = randomInt(seedRef, chosenEnemy.minGroupSize, chosenEnemy.maxGroupSize);
    const remainingEnemySlots = Math.max(0, chosenEnemy.maxAlive - (localAliveByEnemyId.get(chosenEnemy.enemyId) ?? 0));
    const remainingRoleSlots = Math.max(0, config.roleCaps[chosenEnemy.role] - localAliveByRole[chosenEnemy.role]);
    const affordableByBudget = Math.floor(localBudget / chosenEnemy.power);
    const affordableByThreat = Math.floor(threatRoom / chosenEnemy.power);
    const finalCount = Math.min(
      rolledCount,
      affordableByBudget,
      affordableByThreat,
      remainingEnemySlots,
      remainingRoleSlots,
    );
    if (finalCount < chosenEnemy.minGroupSize) continue;

    const cost = chosenEnemy.power * finalCount;
    localBudget -= cost;
    localLiveThreat += cost;
    localAliveByEnemyId.set(chosenEnemy.enemyId, (localAliveByEnemyId.get(chosenEnemy.enemyId) ?? 0) + finalCount);
    localAliveByRole[chosenEnemy.role] += finalCount;
    requests.push({
      enemyId: chosenEnemy.enemyId,
      count: finalCount,
      reason: mode,
    });
  }

  state.budget = Math.max(0, Math.min(localBudget, stockpileCap));
  if (requests.length > 0) {
    state.spawnCooldownSec = config.minSpawnIntervalSec;
    if (mode === "burst") state.burstCooldownSec = config.burstCooldownBaseSec;
  }
  state.rngSeed = seedRef.seed >>> 0;
  world.hostileSpawnDebug = buildDebugSnapshot({
    budget: state.budget,
    powerPerSec,
    liveThreat: derived.liveThreat,
    liveThreatCap,
    stockpileCap,
    spawnCooldownSec: state.spawnCooldownSec,
    burstCooldownSec: state.burstCooldownSec,
    lastMode: mode,
    totalAliveHostileEnemies: derived.totalAliveHostileEnemies,
    aliveByRole: derived.aliveByRole,
    lastRequests: requests,
  });
  return requests;
}
