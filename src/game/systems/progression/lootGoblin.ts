import type { World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { ENEMY_TYPE, spawnEnemyGrid } from "../../factories/enemyFactory";
import { getActiveMap } from "../../map/compile/kenneyMap";
import { pickZoneTrialLikePlacements } from "../../objectives/zoneObjectiveSystem";
import { worldToGrid } from "../../coords/grid";
import { spawnGold } from "./pickups";

export const LOOT_GOBLIN_TRIGGER_PREFIX = "LOOT_GOBLIN_RUNTIME";

export const SPAWN_CHANCE_DENOMINATOR = 2;
export const FLEE_TRIGGER_RADIUS_TILES = 8;
export const FLEE_SPEED_MULT = 1.6;
export const DROP_TOTAL_GOLD = 300;
const DROP_INTERVAL_BASE_SEC = 0.1;
const DROP_SPEED_MULT = 2;
export const DROP_INTERVAL_SEC = DROP_INTERVAL_BASE_SEC / DROP_SPEED_MULT;
export const DROP_RADIUS_TILES = 3;

type QueuedGoldDrop = {
  t: number;
  x: number;
  y: number;
  value: number;
};

type LootGoblinSpawnDebug = {
  floorIndex: number;
  spawnChanceDenominator: number;
  spawnRolled: boolean;
  rollValue: number | null;
  chancePassed: boolean;
  spawned: boolean;
  enemyIndex: number | null;
  triggerId: string | null;
  spawnTx: number | null;
  spawnTy: number | null;
  spawnWx: number | null;
  spawnWy: number | null;
  failureReason: string | null;
};

type LootGoblinState = {
  queuedGoldDrops: QueuedGoldDrop[];
  spawnDebug: LootGoblinSpawnDebug;
};

const lootGoblinStateByWorld = new WeakMap<World, LootGoblinState>();

export type LootGoblinDebugSnapshot = LootGoblinSpawnDebug & {
  alive: boolean;
  queuedGoldDrops: number;
};

function createSpawnDebugForFloor(floorIndex: number): LootGoblinSpawnDebug {
  return {
    floorIndex,
    spawnChanceDenominator: SPAWN_CHANCE_DENOMINATOR,
    spawnRolled: false,
    rollValue: null,
    chancePassed: false,
    spawned: false,
    enemyIndex: null,
    triggerId: null,
    spawnTx: null,
    spawnTy: null,
    spawnWx: null,
    spawnWy: null,
    failureReason: null,
  };
}

function ensureState(world: World): LootGoblinState {
  let state = lootGoblinStateByWorld.get(world);
  if (!state) {
    state = {
      queuedGoldDrops: [],
      spawnDebug: createSpawnDebugForFloor(Math.max(0, Math.floor(world.floorIndex ?? 0))),
    };
    lootGoblinStateByWorld.set(world, state);
  }
  return state;
}

export function isLootGoblinEnemy(world: Pick<World, "eSpawnTriggerId">, enemyIndex: number): boolean {
  if (!Number.isFinite(enemyIndex) || enemyIndex < 0) return false;
  const triggerId = world.eSpawnTriggerId[enemyIndex];
  return typeof triggerId === "string" && triggerId.startsWith(LOOT_GOBLIN_TRIGGER_PREFIX);
}

export function resetLootGoblinFloorState(world: World): void {
  const state = ensureState(world);
  state.queuedGoldDrops.length = 0;
  state.spawnDebug = createSpawnDebugForFloor(Math.max(0, Math.floor(world.floorIndex ?? 0)));
  lootGoblinStateByWorld.set(world, state);
}

export function trySpawnLootGoblinForFloor(world: World): void {
  const state = ensureState(world);
  const floorIndex = Math.max(0, Math.floor(world.floorIndex ?? 0));
  const debug = createSpawnDebugForFloor(floorIndex);
  const rollValue = world.rng.int(1, SPAWN_CHANCE_DENOMINATOR);
  debug.spawnRolled = true;
  debug.rollValue = rollValue;
  debug.chancePassed = rollValue === 1;
  state.spawnDebug = debug;
  lootGoblinStateByWorld.set(world, state);
  if (!debug.chancePassed) {
    debug.failureReason = "ROLL_FAILED";
    return;
  }

  const map = getActiveMap();
  if (!map) {
    debug.failureReason = "NO_ACTIVE_MAP";
    return;
  }

  const placements = pickZoneTrialLikePlacements(world, 1, 1, world.rng);
  if (placements.length <= 0) {
    debug.failureReason = "NO_REACHABLE_TILE";
    return;
  }

  const picked = placements[0];
  const tx = (map.originTx | 0) + (picked.tileX | 0);
  const ty = (map.originTy | 0) + (picked.tileY | 0);
  const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
  const gp = worldToGrid(wx, wy, KENNEY_TILE_WORLD);
  const gx = gp.gx;
  const gy = gp.gy;

  const enemyIndex = spawnEnemyGrid(world, ENEMY_TYPE.LOOT_GOBLIN, gx, gy, KENNEY_TILE_WORLD);
  const triggerId = `${LOOT_GOBLIN_TRIGGER_PREFIX}:${floorIndex}:${tx}:${ty}`;
  world.eSpawnTriggerId[enemyIndex] = triggerId;
  debug.spawned = true;
  debug.enemyIndex = enemyIndex;
  debug.triggerId = triggerId;
  debug.spawnTx = tx;
  debug.spawnTy = ty;
  debug.spawnWx = wx;
  debug.spawnWy = wy;
  debug.failureReason = null;
}

export function scheduleLootGoblinGoldBurst(world: World, x: number, y: number): void {
  const state = ensureState(world);
  const radiusWorld = DROP_RADIUS_TILES * KENNEY_TILE_WORLD;

  for (let i = 0; i < DROP_TOTAL_GOLD; i++) {
    const angle = world.rng.range(0, Math.PI * 2);
    const radius = Math.sqrt(world.rng.range(0, 1)) * radiusWorld;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    state.queuedGoldDrops.push({
      t: (i + 1) * DROP_INTERVAL_SEC,
      x: x + dx,
      y: y + dy,
      value: 1,
    });
  }
}

export function tickLootGoblinGoldBurst(world: World, dt: number): void {
  const state = ensureState(world);
  if (state.queuedGoldDrops.length <= 0) return;
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
  const pending: QueuedGoldDrop[] = [];

  for (let i = 0; i < state.queuedGoldDrops.length; i++) {
    const entry = state.queuedGoldDrops[i];
    const nextT = entry.t - step;
    if (nextT <= 0) {
      spawnGold(world, entry.x, entry.y, entry.value);
      continue;
    }
    pending.push({
      ...entry,
      t: nextT,
    });
  }

  state.queuedGoldDrops = pending;
  lootGoblinStateByWorld.set(world, state);
}

export function getLootGoblinDebugSnapshot(world: World): LootGoblinDebugSnapshot {
  const state = ensureState(world);
  const debug = state.spawnDebug;
  const enemyIndex = debug.enemyIndex;
  const alive = Number.isFinite(enemyIndex)
    && (enemyIndex as number) >= 0
    && !!world.eAlive[enemyIndex as number];
  return {
    floorIndex: debug.floorIndex,
    spawnChanceDenominator: debug.spawnChanceDenominator,
    spawnRolled: debug.spawnRolled,
    rollValue: debug.rollValue,
    chancePassed: debug.chancePassed,
    spawned: debug.spawned,
    enemyIndex: debug.enemyIndex,
    triggerId: debug.triggerId,
    spawnTx: debug.spawnTx,
    spawnTy: debug.spawnTy,
    spawnWx: debug.spawnWx,
    spawnWy: debug.spawnWy,
    failureReason: debug.failureReason,
    alive,
    queuedGoldDrops: state.queuedGoldDrops.length,
  };
}
