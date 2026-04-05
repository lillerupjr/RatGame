import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { isNeutralMonsterId } from "../content/neutralMonsters";
import { spawnEnemy, EnemyId } from "../factories/enemyFactory";
import { getEnemyWorld, getPlayerWorld } from "../coords/worldViews";
import { getActiveMap, getSpawnWorldFromActive, getTileHeight } from "../map/authoredMapActivation";
import { walkInfo } from "../map/compile/kenneyMap";
import { RNG } from "../util/rng";
import { OBJECTIVE_TRIGGER_IDS } from "../systems/progression/objectiveSpec";
import { estimateHostileSpawnPowerBudgetForDurationSeconds } from "../systems/spawn/hostileSpawnDirector";

export type PoeMapModifiers = {
  packSizeMultiplier?: number;
  rarePackChanceMultiplier?: number;
  magicPackChanceMultiplier?: number;
  extraPopulationScalar?: number;
};

export type PackTemplateMember = {
  type: EnemyId;
  min: number;
  max: number;
};

export type PackTemplate = {
  id: string;
  weight: number;
  members: PackTemplateMember[];
  allowMagic: boolean;
  allowRareLeader: boolean;
};

export type PoeMapPackRarity = "NORMAL" | "MAGIC" | "RARE_LEADER";
export type PoeMapPackState = "sleeping" | "combat" | "leashing" | "cleared";

export type PoeMapPackPlan = {
  id: string;
  chunkIndex: number;
  templateId: string;
  anchorTx: number;
  anchorTy: number;
  budgetCost: number;
  members: Array<{ type: EnemyId; count: number }>;
  rarity: PoeMapPackRarity;
  magicCount: number;
};

export type PoeMapPopulationPlan = {
  survive2MinBudget: number;
  poeModeScalar: number;
  totalPopulationBudget: number;
  chunkBudget: number[];
  packs: PoeMapPackPlan[];
};

export type PoeMapDebugSnapshot = {
  survive2MinBudget: number;
  totalPopulationBudget: number;
  spentPopulationBudget: number;
  chunkCount: number;
  packCount: number;
  sleepingPacks: number;
  combatPacks: number;
  leashingPacks: number;
  clearedPacks: number;
  aliveEnemies: number;
  totalEnemies: number;
  aliveEnemyHp: number;
  totalEnemyHp: number;
  dormantEnemies: number;
  nearestPackDistanceTiles: number | null;
  nearestSleepingPackDistanceTiles: number | null;
};

type RuntimePack = {
  id: string;
  state: PoeMapPackState;
  budgetCost: number;
  anchorTx: number;
  anchorTy: number;
  anchorWx: number;
  anchorWy: number;
  enemyIndices: number[];
  aggroRadiusWorld: number;
  leashRadiusWorld: number;
};

type PoeMapRuntimeState = {
  plan: PoeMapPopulationPlan;
  packs: RuntimePack[];
  enemyToPackIndex: Map<number, number>;
  dormantEnemyIndices: Set<number>;
  clearedPacks: number;
};

type ChunkBudgetSlice = {
  index: number;
  tx0: number;
  ty0: number;
  tx1: number;
  ty1: number;
  budget: number;
  isStartChunk: boolean;
  isTerminalChunk: boolean;
};

type NormalizedPoeMapModifiers = {
  packSizeMultiplier: number;
  rarePackChanceMultiplier: number;
  magicPackChanceMultiplier: number;
  extraPopulationScalar: number;
};

const POE_MODE_SCALAR = 0.85;
const SURVIVE_BUDGET_SECONDS = 120;
const MAP_CHUNK_SIZE_TILES = 24;
const SAFE_ZONE_RADIUS_TILES = 6;
const MIN_ANCHOR_SEPARATION_TILES = 5;
const AGGRO_RADIUS_TILES = 9;
const LEASH_RADIUS_TILES = 16;
const LEASH_SETTLE_RADIUS_TILES = 2;
const MEMBER_SCATTER_RADIUS_TILES = 2;
const MAX_ANCHOR_RETRIES = 48;

const BASE_MAGIC_PACK_CHANCE = 0.22;
const BASE_RARE_PACK_CHANCE = 0.1;

const MAGIC_HP_MULT = 1.35;
const MAGIC_DAMAGE_MULT = 1.15;
const RARE_HP_MULT = 1.9;
const RARE_DAMAGE_MULT = 1.35;
const RARE_SPEED_MULT = 1.08;

const enemyBudgetCost: Partial<Record<EnemyId, number>> = {
  [EnemyId.MINION]: 1,
  [EnemyId.RUNNER]: 0.9,
  [EnemyId.TANK]: 2.5,
  [EnemyId.LEAPER1]: 3.4,
  [EnemyId.BURSTER]: 4.2,
  [EnemyId.SPITTER]: 2.2,
  [EnemyId.SHARD_RAT]: 2.1,
};

const PACK_TEMPLATES: PackTemplate[] = [
  {
    id: "chaser_swarm",
    weight: 20,
    members: [{ type: EnemyId.MINION, min: 4, max: 6 }],
    allowMagic: true,
    allowRareLeader: false,
  },
  {
    id: "runner_swarm",
    weight: 12,
    members: [{ type: EnemyId.RUNNER, min: 5, max: 7 }],
    allowMagic: true,
    allowRareLeader: false,
  },
  {
    id: "bruiser_frontline",
    weight: 10,
    members: [
      { type: EnemyId.TANK, min: 2, max: 3 },
      { type: EnemyId.MINION, min: 2, max: 4 },
    ],
    allowMagic: true,
    allowRareLeader: true,
  },
  {
    id: "ratchemist_support",
    weight: 8,
    members: [
      { type: EnemyId.SPITTER, min: 1, max: 1 },
      { type: EnemyId.MINION, min: 3, max: 5 },
    ],
    allowMagic: true,
    allowRareLeader: true,
  },
  {
    id: "leaper1_guard",
    weight: 5,
    members: [
      { type: EnemyId.LEAPER1, min: 1, max: 1 },
      { type: EnemyId.TANK, min: 2, max: 3 },
    ],
    allowMagic: true,
    allowRareLeader: true,
  },
  {
    id: "abomination_pack",
    weight: 3,
    members: [
      { type: EnemyId.BURSTER, min: 1, max: 1 },
      { type: EnemyId.MINION, min: 3, max: 4 },
    ],
    allowMagic: false,
    allowRareLeader: true,
  },
];

export const POE_MAP_PACK_TEMPLATES: readonly PackTemplate[] = PACK_TEMPLATES;
export const POE_MAP_ENEMY_BUDGET_COST: Readonly<Partial<Record<EnemyId, number>>> = enemyBudgetCost;

const poeStateByWorld = new WeakMap<World, PoeMapRuntimeState>();

function isExcludedPoeGenerationType(type: EnemyId): boolean {
  return isNeutralMonsterId(type) || type === EnemyId.BOSS;
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeModifiers(modifiers: PoeMapModifiers | undefined): NormalizedPoeMapModifiers {
  return {
    packSizeMultiplier: clampNumber(modifiers?.packSizeMultiplier, 1, 0.5, 2.5),
    rarePackChanceMultiplier: clampNumber(modifiers?.rarePackChanceMultiplier, 1, 0, 4),
    magicPackChanceMultiplier: clampNumber(modifiers?.magicPackChanceMultiplier, 1, 0, 4),
    extraPopulationScalar: clampNumber(modifiers?.extraPopulationScalar, 1, 0.2, 3),
  };
}

function estimatePoePopulationBudgetForDurationSeconds(world: World, durationSec: number): number {
  const duration = Math.max(0, Number.isFinite(durationSec) ? durationSec : 0);
  if (duration <= 0) return 0;
  return estimateHostileSpawnPowerBudgetForDurationSeconds(world, duration);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function weightedPick<T extends { weight: number }>(rng: RNG, entries: readonly T[]): T {
  if (entries.length <= 0) {
    throw new Error("weightedPick requires at least one entry");
  }
  let total = 0;
  for (let i = 0; i < entries.length; i++) {
    total += Math.max(0, entries[i].weight);
  }
  if (total <= 0) return entries[0];

  let roll = rng.range(0, total);
  for (let i = 0; i < entries.length; i++) {
    roll -= Math.max(0, entries[i].weight);
    if (roll <= 0) return entries[i];
  }
  return entries[entries.length - 1];
}

function computeTemplateMinCost(template: PackTemplate, packSizeMultiplier: number): number {
  let total = 0;
  for (let i = 0; i < template.members.length; i++) {
    const m = template.members[i];
    if (isExcludedPoeGenerationType(m.type)) continue;
    const count = Math.max(1, Math.round(m.min * packSizeMultiplier));
    total += count * (enemyBudgetCost[m.type] ?? 1);
  }
  return total;
}

function rollTemplateMembers(
  template: PackTemplate,
  rng: RNG,
  packSizeMultiplier: number,
): Array<{ type: EnemyId; count: number }> {
  const out: Array<{ type: EnemyId; count: number }> = [];
  for (let i = 0; i < template.members.length; i++) {
    const m = template.members[i];
    if (isExcludedPoeGenerationType(m.type)) continue;
    const rolledBase = rng.int(m.min, m.max);
    const scaledCount = Math.max(1, Math.round(rolledBase * packSizeMultiplier));
    out.push({
      type: m.type,
      count: scaledCount,
    });
  }
  return out;
}

function computePackCost(members: Array<{ type: EnemyId; count: number }>): number {
  let cost = 0;
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (isExcludedPoeGenerationType(member.type)) continue;
    cost += member.count * (enemyBudgetCost[member.type] ?? 1);
  }
  return cost;
}

function tileDistance(aTx: number, aTy: number, bTx: number, bTy: number): number {
  const dx = aTx - bTx;
  const dy = aTy - bTy;
  return Math.hypot(dx, dy);
}

function isValidPoeSpawnTile(tx: number, ty: number): boolean {
  const map = getActiveMap();
  if (!map) return false;
  if (tx < map.originTx || tx >= map.originTx + map.width) return false;
  if (ty < map.originTy || ty >= map.originTy + map.height) return false;
  if (map.blockedTiles?.has(`${tx},${ty}`)) return false;
  if (map.surfacesAtXY(tx, ty).length <= 0) return false;
  const tile = map.getTile(tx, ty);
  if (tile.kind === "VOID" || tile.kind === "STAIRS") return false;
  const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
  const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
  return !!walkInfo(wx, wy, KENNEY_TILE_WORLD).walkable;
}

function hasWalkableFootprint(tx: number, ty: number): boolean {
  if (!isValidPoeSpawnTile(tx, ty)) return false;
  let walkableNeighbors = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (isValidPoeSpawnTile(tx + dx, ty + dy)) walkableNeighbors++;
    }
  }
  return walkableNeighbors >= 5;
}

function anchorTooCloseToExisting(
  tx: number,
  ty: number,
  anchors: Array<{ tx: number; ty: number }>,
  minDistanceTiles: number,
): boolean {
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    if (tileDistance(tx, ty, a.tx, a.ty) < minDistanceTiles) return true;
  }
  return false;
}

function chooseAnchorInChunk(
  rng: RNG,
  chunk: ChunkBudgetSlice,
  spawnTx: number,
  spawnTy: number,
  existingAnchors: Array<{ tx: number; ty: number }>,
): { tx: number; ty: number } | null {
  for (let attempt = 0; attempt < MAX_ANCHOR_RETRIES; attempt++) {
    const tx = rng.int(chunk.tx0, chunk.tx1);
    const ty = rng.int(chunk.ty0, chunk.ty1);
    if (!isValidPoeSpawnTile(tx, ty)) continue;
    if (tileDistance(tx, ty, spawnTx, spawnTy) < SAFE_ZONE_RADIUS_TILES) continue;
    if (anchorTooCloseToExisting(tx, ty, existingAnchors, MIN_ANCHOR_SEPARATION_TILES)) continue;
    if (!hasWalkableFootprint(tx, ty)) continue;
    return { tx, ty };
  }
  return null;
}

function chooseAnchorNearSpawnInChunk(
  rng: RNG,
  chunk: ChunkBudgetSlice,
  spawnTx: number,
  spawnTy: number,
  existingAnchors: Array<{ tx: number; ty: number }>,
): { tx: number; ty: number } | null {
  const minRadius = Math.max(2, SAFE_ZONE_RADIUS_TILES);
  const maxRadius = Math.max(minRadius + 1, Math.min(MAP_CHUNK_SIZE_TILES, 16));
  for (let radius = minRadius; radius <= maxRadius; radius++) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const tx = spawnTx + rng.int(-radius, radius);
      const ty = spawnTy + rng.int(-radius, radius);
      if (tx < chunk.tx0 || tx > chunk.tx1 || ty < chunk.ty0 || ty > chunk.ty1) continue;
      if (!isValidPoeSpawnTile(tx, ty)) continue;
      if (tileDistance(tx, ty, spawnTx, spawnTy) < SAFE_ZONE_RADIUS_TILES) continue;
      if (anchorTooCloseToExisting(tx, ty, existingAnchors, MIN_ANCHOR_SEPARATION_TILES)) continue;
      if (!hasWalkableFootprint(tx, ty)) continue;
      return { tx, ty };
    }
  }
  return chooseAnchorInChunk(rng, chunk, spawnTx, spawnTy, existingAnchors);
}

function fallbackAnchor(
  rng: RNG,
  originTx: number,
  originTy: number,
  width: number,
  height: number,
  spawnTx: number,
  spawnTy: number,
): { tx: number; ty: number } | null {
  const total = Math.max(1, width * height);
  for (let i = 0; i < total; i++) {
    const tx = originTx + (i % width);
    const ty = originTy + Math.floor(i / width);
    if (!isValidPoeSpawnTile(tx, ty)) continue;
    if (tileDistance(tx, ty, spawnTx, spawnTy) < 2) continue;
    return { tx, ty };
  }

  for (let tries = 0; tries < total; tries++) {
    const tx = originTx + rng.int(0, Math.max(0, width - 1));
    const ty = originTy + rng.int(0, Math.max(0, height - 1));
    if (!isValidPoeSpawnTile(tx, ty)) continue;
    return { tx, ty };
  }

  return null;
}

function normalizeChunkCount(widthTiles: number, heightTiles: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.round(widthTiles / MAP_CHUNK_SIZE_TILES));
  const rows = Math.max(1, Math.round(heightTiles / MAP_CHUNK_SIZE_TILES));
  return { cols, rows };
}

function buildChunkBudgetSlices(
  rng: RNG,
  totalBudget: number,
  originTx: number,
  originTy: number,
  width: number,
  height: number,
  spawnTx: number,
  spawnTy: number,
): ChunkBudgetSlice[] {
  const { cols, rows } = normalizeChunkCount(width, height);
  const slices: ChunkBudgetSlice[] = [];

  const startCx = Math.max(0, Math.min(cols - 1, Math.floor((spawnTx - originTx) / MAP_CHUNK_SIZE_TILES)));
  const startCy = Math.max(0, Math.min(rows - 1, Math.floor((spawnTy - originTy) / MAP_CHUNK_SIZE_TILES)));
  const startChunkIndex = startCy * cols + startCx;

  let terminalChunkIndex = 0;
  let bestTerminalDistance = -1;

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const tx0 = originTx + cx * MAP_CHUNK_SIZE_TILES;
      const ty0 = originTy + cy * MAP_CHUNK_SIZE_TILES;
      const tx1 = Math.min(originTx + width - 1, tx0 + MAP_CHUNK_SIZE_TILES - 1);
      const ty1 = Math.min(originTy + height - 1, ty0 + MAP_CHUNK_SIZE_TILES - 1);
      const index = cy * cols + cx;
      const centerTx = (tx0 + tx1) * 0.5;
      const centerTy = (ty0 + ty1) * 0.5;
      const dist = tileDistance(centerTx, centerTy, spawnTx, spawnTy);
      if (dist > bestTerminalDistance) {
        bestTerminalDistance = dist;
        terminalChunkIndex = index;
      }

      slices.push({
        index,
        tx0,
        ty0,
        tx1,
        ty1,
        budget: 0,
        isStartChunk: index === startChunkIndex,
        isTerminalChunk: false,
      });
    }
  }

  for (let i = 0; i < slices.length; i++) {
    slices[i].isTerminalChunk = slices[i].index === terminalChunkIndex;
  }

  const weights: number[] = [];
  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    if (slice.isTerminalChunk && slices.length > 1) {
      weights.push(0);
      continue;
    }
    let weight = slice.isStartChunk ? 0.55 : 1;
    if (!slice.isStartChunk) {
      weight *= rng.range(0.85, 1.2);
    }
    weights.push(Math.max(0.05, weight));
  }

  let weightSum = 0;
  for (let i = 0; i < weights.length; i++) weightSum += weights[i];
  if (weightSum <= 0) {
    const equal = slices.length > 0 ? totalBudget / slices.length : 0;
    for (let i = 0; i < slices.length; i++) slices[i].budget = equal;
    return slices;
  }

  for (let i = 0; i < slices.length; i++) {
    slices[i].budget = totalBudget * (weights[i] / weightSum);
  }

  return slices;
}

function choosePackRarity(
  template: PackTemplate,
  rng: RNG,
  modifiers: NormalizedPoeMapModifiers,
): { rarity: PoeMapPackRarity; magicCount: number } {
  const rareChance = BASE_RARE_PACK_CHANCE * modifiers.rarePackChanceMultiplier;
  const magicChance = BASE_MAGIC_PACK_CHANCE * modifiers.magicPackChanceMultiplier;

  if (template.allowRareLeader && rng.next() < rareChance) {
    return { rarity: "RARE_LEADER", magicCount: 0 };
  }

  if (template.allowMagic && rng.next() < magicChance) {
    return { rarity: "MAGIC", magicCount: rng.int(2, 3) };
  }

  return { rarity: "NORMAL", magicCount: 0 };
}

function flattenMembers(members: Array<{ type: EnemyId; count: number }>): EnemyId[] {
  const out: EnemyId[] = [];
  for (let i = 0; i < members.length; i++) {
    const row = members[i];
    if (isExcludedPoeGenerationType(row.type)) continue;
    for (let n = 0; n < row.count; n++) out.push(row.type);
  }
  return out;
}

function pickRareLeaderIndex(slots: EnemyId[]): number {
  if (slots.length <= 0) return -1;
  let best = 0;
  let bestCost = -1;
  for (let i = 0; i < slots.length; i++) {
    const c = enemyBudgetCost[slots[i]] ?? 0;
    if (c > bestCost) {
      bestCost = c;
      best = i;
    }
  }
  return best;
}

function isEliteType(type: EnemyId): boolean {
  return type === EnemyId.LEAPER1 || type === EnemyId.BURSTER || type === EnemyId.BOSS;
}

function tileToWorldCenter(tx: number, ty: number): { wx: number; wy: number } {
  return {
    wx: (tx + 0.5) * KENNEY_TILE_WORLD,
    wy: (ty + 0.5) * KENNEY_TILE_WORLD,
  };
}

function pickMagicIndices(rng: RNG, slots: EnemyId[], desiredCount: number): Set<number> {
  const out = new Set<number>();
  const count = Math.max(0, Math.min(desiredCount, slots.length));
  if (count <= 0) return out;

  const nonElitePool: number[] = [];
  const elitePool: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (isEliteType(slots[i])) elitePool.push(i);
    else nonElitePool.push(i);
  }

  while (out.size < count && nonElitePool.length > 0) {
    const idx = rng.int(0, nonElitePool.length - 1);
    out.add(nonElitePool[idx]);
    nonElitePool.splice(idx, 1);
  }

  while (out.size < count && elitePool.length > 0) {
    const idx = rng.int(0, elitePool.length - 1);
    out.add(elitePool[idx]);
    elitePool.splice(idx, 1);
  }

  while (out.size < count) {
    out.add(rng.int(0, slots.length - 1));
  }
  return out;
}

function applyMagicStats(world: World, enemyIndex: number): void {
  const hpMax = Math.max(1, Math.round((world.eHpMax[enemyIndex] ?? 1) * MAGIC_HP_MULT));
  world.eHpMax[enemyIndex] = hpMax;
  world.eHp[enemyIndex] = Math.max(1, Math.min(hpMax, Math.round((world.eHp[enemyIndex] ?? hpMax) * MAGIC_HP_MULT)));
  world.eDamage[enemyIndex] = Math.max(1, Math.round((world.eDamage[enemyIndex] ?? 1) * MAGIC_DAMAGE_MULT));
}

function applyRareLeaderStats(world: World, enemyIndex: number): void {
  const hpMax = Math.max(1, Math.round((world.eHpMax[enemyIndex] ?? 1) * RARE_HP_MULT));
  world.eHpMax[enemyIndex] = hpMax;
  world.eHp[enemyIndex] = Math.max(1, Math.min(hpMax, Math.round((world.eHp[enemyIndex] ?? hpMax) * RARE_HP_MULT)));
  world.eDamage[enemyIndex] = Math.max(1, Math.round((world.eDamage[enemyIndex] ?? 1) * RARE_DAMAGE_MULT));
  world.eSpeed[enemyIndex] = Math.max(1, (world.eSpeed[enemyIndex] ?? 1) * RARE_SPEED_MULT);
}

function findMemberSpawnTile(
  rng: RNG,
  anchorTx: number,
  anchorTy: number,
  usedTiles: Set<string>,
): { tx: number; ty: number } {
  const key = (tx: number, ty: number) => `${tx},${ty}`;
  for (let radius = 0; radius <= MEMBER_SCATTER_RADIUS_TILES; radius++) {
    for (let attempt = 0; attempt < 18; attempt++) {
      const tx = anchorTx + rng.int(-radius, radius);
      const ty = anchorTy + rng.int(-radius, radius);
      if (!isValidPoeSpawnTile(tx, ty)) continue;
      const h = getTileHeight(tx, ty);
      const ah = getTileHeight(anchorTx, anchorTy);
      if (Math.abs(h - ah) > 1) continue;
      const k = key(tx, ty);
      if (usedTiles.has(k)) continue;
      usedTiles.add(k);
      return { tx, ty };
    }
  }

  usedTiles.add(key(anchorTx, anchorTy));
  return { tx: anchorTx, ty: anchorTy };
}

function setPackDormancy(state: PoeMapRuntimeState, world: World, packIndex: number, dormant: boolean): void {
  const pack = state.packs[packIndex];
  if (!pack) return;
  for (let i = 0; i < pack.enemyIndices.length; i++) {
    const enemyIndex = pack.enemyIndices[i];
    if (!world.eAlive[enemyIndex]) {
      state.dormantEnemyIndices.delete(enemyIndex);
      continue;
    }
    if (dormant) state.dormantEnemyIndices.add(enemyIndex);
    else state.dormantEnemyIndices.delete(enemyIndex);
  }
}

function countAlivePackMembers(world: World, pack: RuntimePack): number {
  let alive = 0;
  for (let i = 0; i < pack.enemyIndices.length; i++) {
    if (world.eAlive[pack.enemyIndices[i]]) alive++;
  }
  return alive;
}

function areAllAliveEnemiesNearAnchor(world: World, pack: RuntimePack, radiusWorld: number): boolean {
  for (let i = 0; i < pack.enemyIndices.length; i++) {
    const enemyIndex = pack.enemyIndices[i];
    if (!world.eAlive[enemyIndex]) continue;
    const ew = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
    const dist = Math.hypot(ew.wx - pack.anchorWx, ew.wy - pack.anchorWy);
    if (dist > radiusWorld) return false;
  }
  return true;
}

function ensureFallbackPack(plan: PoeMapPopulationPlan, rng: RNG, originTx: number, originTy: number, width: number, height: number, spawnTx: number, spawnTy: number): void {
  if (plan.packs.length > 0) return;
  const nearSpawnAnchor: { tx: number; ty: number } | null = (() => {
    const minRadius = Math.max(2, SAFE_ZONE_RADIUS_TILES);
    const maxRadius = Math.max(minRadius + 1, 18);
    for (let radius = minRadius; radius <= maxRadius; radius++) {
      for (let i = 0; i < 36; i++) {
        const tx = spawnTx + rng.int(-radius, radius);
        const ty = spawnTy + rng.int(-radius, radius);
        if (!isValidPoeSpawnTile(tx, ty)) continue;
        if (!hasWalkableFootprint(tx, ty)) continue;
        return { tx, ty };
      }
    }
    return null;
  })();
  const anchor = nearSpawnAnchor ?? fallbackAnchor(rng, originTx, originTy, width, height, spawnTx, spawnTy) ?? { tx: spawnTx, ty: spawnTy };
  const fallbackChunkBudget = Math.max(1, Math.round(plan.chunkBudget[0] ?? 1));
  const chaserCount = Math.max(1, Math.min(4, fallbackChunkBudget));
  if (!Number.isFinite(plan.chunkBudget[0])) {
    plan.chunkBudget[0] = chaserCount;
  } else {
    plan.chunkBudget[0] = Math.max(plan.chunkBudget[0], chaserCount);
  }
  plan.packs.push({
    id: "POE_PACK_1",
    chunkIndex: 0,
    templateId: "fallback_chasers",
    anchorTx: anchor.tx,
    anchorTy: anchor.ty,
    budgetCost: chaserCount,
    members: [{ type: EnemyId.MINION, count: chaserCount }],
    rarity: "NORMAL",
    magicCount: 0,
  });
}

function ensureStartChunkPack(
  plan: PoeMapPopulationPlan,
  chunks: ChunkBudgetSlice[],
  rng: RNG,
  modifiers: NormalizedPoeMapModifiers,
  spawnTx: number,
  spawnTy: number,
  globalAnchors: Array<{ tx: number; ty: number }>,
): void {
  if (plan.packs.length <= 0 || chunks.length <= 0) return;
  const startChunk = chunks.find((chunk) => chunk.isStartChunk && !chunk.isTerminalChunk) ?? chunks.find((chunk) => chunk.isStartChunk);
  if (!startChunk) return;
  if (plan.packs.some((pack) => pack.chunkIndex === startChunk.index)) return;

  const existingAnchors = globalAnchors.slice();
  const anchor = chooseAnchorNearSpawnInChunk(rng, startChunk, spawnTx, spawnTy, existingAnchors);
  if (!anchor) return;

  const currentChunkBudget = plan.chunkBudget[startChunk.index] ?? 0;
  const startChunkBudget = Math.max(1, currentChunkBudget);
  if (startChunkBudget !== currentChunkBudget) {
    plan.chunkBudget[startChunk.index] = startChunkBudget;
  }

  const affordableTemplates = PACK_TEMPLATES.filter(
    (template) => computeTemplateMinCost(template, modifiers.packSizeMultiplier) <= startChunkBudget + 1e-6,
  );

  let template: PackTemplate | null = null;
  let members: Array<{ type: EnemyId; count: number }> = [];
  let budgetCost = 0;

  if (affordableTemplates.length > 0) {
    const picked = weightedPick(rng, affordableTemplates);
    const rolled = rollTemplateMembers(picked, rng, modifiers.packSizeMultiplier);
    const rolledCost = computePackCost(rolled);
    if (rolledCost > 0 && rolledCost <= startChunkBudget + 1e-6) {
      template = picked;
      members = rolled;
      budgetCost = rolledCost;
    }
  }

  if (!template || members.length <= 0 || budgetCost <= 0) {
    const chaserCount = Math.max(1, Math.min(4, Math.floor(startChunkBudget)));
    template = {
      id: "start_chunk_fallback",
      weight: 0,
      members: [{ type: EnemyId.MINION, min: chaserCount, max: chaserCount }],
      allowMagic: true,
      allowRareLeader: false,
    };
    members = [{ type: EnemyId.MINION, count: chaserCount }];
    budgetCost = chaserCount;
  }

  const rarity = choosePackRarity(template, rng, modifiers);
  plan.packs.push({
    id: `POE_PACK_${plan.packs.length + 1}`,
    chunkIndex: startChunk.index,
    templateId: template.id,
    anchorTx: anchor.tx,
    anchorTy: anchor.ty,
    budgetCost,
    members,
    rarity: rarity.rarity,
    magicCount: rarity.magicCount,
  });
  globalAnchors.push(anchor);
}

export function resetPoeMapObjectiveState(world: World): void {
  poeStateByWorld.delete(world);
}

export function isPoeMapObjectiveActive(world: World): boolean {
  return poeStateByWorld.has(world);
}

export function isPoeEnemyDormant(world: World, enemyIndex: number): boolean {
  const state = poeStateByWorld.get(world);
  if (!state) return false;
  return state.dormantEnemyIndices.has(enemyIndex);
}

export function getPoeEnemyLeashAnchor(world: World, enemyIndex: number): { wx: number; wy: number } | null {
  const state = poeStateByWorld.get(world);
  if (!state) return null;
  const packIndex = state.enemyToPackIndex.get(enemyIndex);
  if (!Number.isFinite(packIndex)) return null;
  const pack = state.packs[packIndex as number];
  if (!pack || pack.state !== "leashing") return null;
  return { wx: pack.anchorWx, wy: pack.anchorWy };
}

export function getPoeMapObjectiveProgress(world: World): { cleared: number; total: number } | null {
  const state = poeStateByWorld.get(world);
  if (!state) return null;
  return {
    cleared: state.clearedPacks,
    total: state.packs.length,
  };
}

export function getPoeMapObjectiveDebugSnapshot(world: World): PoeMapDebugSnapshot | null {
  const state = poeStateByWorld.get(world);
  if (!state) return null;

  let sleepingPacks = 0;
  let combatPacks = 0;
  let leashingPacks = 0;
  let clearedPacks = 0;
  let aliveEnemies = 0;
  let totalEnemies = 0;
  let aliveEnemyHp = 0;
  let totalEnemyHp = 0;
  let spentPopulationBudget = 0;
  for (let i = 0; i < state.packs.length; i++) {
    const pack = state.packs[i];
    spentPopulationBudget += pack.budgetCost;
    if (pack.state === "sleeping") sleepingPacks++;
    else if (pack.state === "combat") combatPacks++;
    else if (pack.state === "leashing") leashingPacks++;
    else clearedPacks++;
    totalEnemies += pack.enemyIndices.length;
    for (let j = 0; j < pack.enemyIndices.length; j++) {
      const enemyIndex = pack.enemyIndices[j];
      const hpMax = Math.max(0, Number(world.eHpMax[enemyIndex] ?? 0));
      totalEnemyHp += hpMax;
      if (!world.eAlive[enemyIndex]) continue;
      aliveEnemies++;
      aliveEnemyHp += Math.max(0, Number(world.eHp[enemyIndex] ?? 0));
    }
  }

  const player = getPlayerWorld(world, KENNEY_TILE_WORLD);
  let nearestPackDistanceWorld = Number.POSITIVE_INFINITY;
  let nearestSleepingDistanceWorld = Number.POSITIVE_INFINITY;
  for (let i = 0; i < state.packs.length; i++) {
    const pack = state.packs[i];
    if (pack.state === "cleared") continue;
    const dist = Math.hypot(player.wx - pack.anchorWx, player.wy - pack.anchorWy);
    if (dist < nearestPackDistanceWorld) nearestPackDistanceWorld = dist;
    if (pack.state === "sleeping" && dist < nearestSleepingDistanceWorld) {
      nearestSleepingDistanceWorld = dist;
    }
  }

  return {
    survive2MinBudget: state.plan.survive2MinBudget,
    totalPopulationBudget: state.plan.totalPopulationBudget,
    spentPopulationBudget,
    chunkCount: state.plan.chunkBudget.length,
    packCount: state.packs.length,
    sleepingPacks,
    combatPacks,
    leashingPacks,
    clearedPacks,
    aliveEnemies,
    totalEnemies,
    aliveEnemyHp,
    totalEnemyHp,
    dormantEnemies: state.dormantEnemyIndices.size,
    nearestPackDistanceTiles: Number.isFinite(nearestPackDistanceWorld) ? nearestPackDistanceWorld / KENNEY_TILE_WORLD : null,
    nearestSleepingPackDistanceTiles: Number.isFinite(nearestSleepingDistanceWorld) ? nearestSleepingDistanceWorld / KENNEY_TILE_WORLD : null,
  };
}

export function initializePoeMapObjective(
  world: World,
  options: {
    objectiveSeed: number;
    modifiers?: PoeMapModifiers;
  },
): { totalPacks: number; plan: PoeMapPopulationPlan } {
  const map = getActiveMap();
  if (!map) {
    const emptyPlan: PoeMapPopulationPlan = {
      survive2MinBudget: 0,
      poeModeScalar: POE_MODE_SCALAR,
      totalPopulationBudget: 0,
      chunkBudget: [],
      packs: [],
    };
    poeStateByWorld.delete(world);
    return { totalPacks: 0, plan: emptyPlan };
  }

  const modifiers = normalizeModifiers(options.modifiers);
  const seed = options.objectiveSeed ^ hashString(`poe:${world.currentFloorIntent?.nodeId ?? world.floorIndex}`);
  const rng = new RNG(seed >>> 0);

  const spawn = getSpawnWorldFromActive();
  const originTx = map.originTx;
  const originTy = map.originTy;
  const width = map.width;
  const height = map.height;

  const survive2MinBudget = estimatePoePopulationBudgetForDurationSeconds(world, SURVIVE_BUDGET_SECONDS);
  const totalPopulationBudget = Math.max(0, survive2MinBudget * POE_MODE_SCALAR * modifiers.extraPopulationScalar);

  const chunks = buildChunkBudgetSlices(
    rng,
    totalPopulationBudget,
    originTx,
    originTy,
    width,
    height,
    spawn.tx,
    spawn.ty,
  );

  const plan: PoeMapPopulationPlan = {
    survive2MinBudget,
    poeModeScalar: POE_MODE_SCALAR,
    totalPopulationBudget,
    chunkBudget: chunks.map((c) => c.budget),
    packs: [],
  };

  const globalAnchors: Array<{ tx: number; ty: number }> = [];
  const minTemplateCost = PACK_TEMPLATES.reduce((min, t) => Math.min(min, computeTemplateMinCost(t, modifiers.packSizeMultiplier)), Number.POSITIVE_INFINITY);

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    if (chunk.isTerminalChunk && chunks.length > 1) continue;

    let remaining = chunk.budget;
    let tries = 0;

    while (remaining > Math.max(0.35, minTemplateCost * 0.5) && tries < 64) {
      const candidates = PACK_TEMPLATES.filter(
        (template) => {
          const minCost = computeTemplateMinCost(template, modifiers.packSizeMultiplier);
          return minCost > 0 && minCost <= remaining + 1e-6;
        },
      );
      if (candidates.length <= 0) break;

      const template = weightedPick(rng, candidates);
      const members = rollTemplateMembers(template, rng, modifiers.packSizeMultiplier);
      if (members.length <= 0) {
        tries++;
        continue;
      }
      const budgetCost = computePackCost(members);
      if (budgetCost <= 0) {
        tries++;
        continue;
      }
      if (budgetCost > remaining + 1e-6) {
        tries++;
        continue;
      }

      const anchor = chooseAnchorInChunk(rng, chunk, spawn.tx, spawn.ty, globalAnchors);
      if (!anchor) {
        tries++;
        continue;
      }

      const rarity = choosePackRarity(template, rng, modifiers);
      plan.packs.push({
        id: `POE_PACK_${plan.packs.length + 1}`,
        chunkIndex: chunk.index,
        templateId: template.id,
        anchorTx: anchor.tx,
        anchorTy: anchor.ty,
        budgetCost,
        members,
        rarity: rarity.rarity,
        magicCount: rarity.magicCount,
      });

      globalAnchors.push(anchor);
      remaining -= budgetCost;
      tries++;
    }
  }

  ensureStartChunkPack(plan, chunks, rng, modifiers, spawn.tx, spawn.ty, globalAnchors);
  ensureFallbackPack(plan, rng, originTx, originTy, width, height, spawn.tx, spawn.ty);

  const runtimePacks: RuntimePack[] = [];
  const enemyToPackIndex = new Map<number, number>();
  const dormantEnemyIndices = new Set<number>();

  for (let p = 0; p < plan.packs.length; p++) {
    const pack = plan.packs[p];
    const slots = flattenMembers(pack.members);
    const usedTiles = new Set<string>();

    const rareLeaderIndex = pack.rarity === "RARE_LEADER" ? pickRareLeaderIndex(slots) : -1;
    const magicIndices =
      pack.rarity === "MAGIC"
        ? pickMagicIndices(rng, slots, Math.max(2, Math.min(pack.magicCount, slots.length)))
        : new Set<number>();

    const enemyIndices: number[] = [];
    for (let s = 0; s < slots.length; s++) {
      const spawnTile = findMemberSpawnTile(rng, pack.anchorTx, pack.anchorTy, usedTiles);
      const spawnWorld = tileToWorldCenter(spawnTile.tx, spawnTile.ty);
      const enemyIndex = spawnEnemy(world, slots[s], spawnWorld.wx, spawnWorld.wy);
      enemyIndices.push(enemyIndex);

      if (magicIndices.has(s)) applyMagicStats(world, enemyIndex);
      if (s === rareLeaderIndex) applyRareLeaderStats(world, enemyIndex);
    }

    const anchorWorld = tileToWorldCenter(pack.anchorTx, pack.anchorTy);
    const runtimePack: RuntimePack = {
      id: pack.id,
      state: "sleeping",
      budgetCost: pack.budgetCost,
      anchorTx: pack.anchorTx,
      anchorTy: pack.anchorTy,
      anchorWx: anchorWorld.wx,
      anchorWy: anchorWorld.wy,
      enemyIndices,
      aggroRadiusWorld: AGGRO_RADIUS_TILES * KENNEY_TILE_WORLD,
      leashRadiusWorld: LEASH_RADIUS_TILES * KENNEY_TILE_WORLD,
    };

    runtimePacks.push(runtimePack);
  }

  const runtimeState: PoeMapRuntimeState = {
    plan,
    packs: runtimePacks,
    enemyToPackIndex,
    dormantEnemyIndices,
    clearedPacks: 0,
  };

  for (let p = 0; p < runtimePacks.length; p++) {
    const runtimePack = runtimePacks[p];
    for (let i = 0; i < runtimePack.enemyIndices.length; i++) {
      const enemyIndex = runtimePack.enemyIndices[i];
      enemyToPackIndex.set(enemyIndex, p);
      dormantEnemyIndices.add(enemyIndex);
    }
  }

  poeStateByWorld.set(world, runtimeState);
  return {
    totalPacks: runtimePacks.length,
    plan,
  };
}

export function tickPoeMapObjective(world: World): void {
  const state = poeStateByWorld.get(world);
  if (!state) return;

  const player = getPlayerWorld(world, KENNEY_TILE_WORLD);

  for (let p = 0; p < state.packs.length; p++) {
    const pack = state.packs[p];
    if (pack.state === "cleared") continue;

    const alive = countAlivePackMembers(world, pack);
    if (alive <= 0) {
      pack.state = "cleared";
      state.clearedPacks += 1;
      setPackDormancy(state, world, p, false);
      world.triggerSignals.push({
        type: "KILL",
        entityId: -1,
        triggerId: OBJECTIVE_TRIGGER_IDS.poePackClear,
      });
      continue;
    }

    const anchorDist = Math.hypot(player.wx - pack.anchorWx, player.wy - pack.anchorWy);

    if (pack.state === "sleeping") {
      if (anchorDist < pack.aggroRadiusWorld) {
        pack.state = "combat";
        setPackDormancy(state, world, p, false);
      }
      continue;
    }

    if (pack.state === "combat") {
      if (anchorDist > pack.leashRadiusWorld) {
        pack.state = "leashing";
      }
      continue;
    }

    if (pack.state === "leashing") {
      if (anchorDist < pack.aggroRadiusWorld) {
        pack.state = "combat";
        continue;
      }
      const settled = areAllAliveEnemiesNearAnchor(
        world,
        pack,
        LEASH_SETTLE_RADIUS_TILES * KENNEY_TILE_WORLD,
      );
      if (settled) {
        pack.state = "sleeping";
        setPackDormancy(state, world, p, true);
      }
    }
  }
}
