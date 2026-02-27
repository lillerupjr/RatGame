import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { DEFAULT_SPAWN_TUNING } from "../balance/spawnTuningDefaults";
import { worldToTile } from "../coords/tile";
import { getPlayerWorld } from "../coords/worldViews";
import { getActiveMap, surfacesAtXY, walkInfo } from "../map/compile/kenneyMap";
import { buildZoneClearedTriggerId, OBJECTIVE_TRIGGER_IDS } from "../systems/progression/objectiveSpec";
import {
  DEFAULT_ZONE_TRIAL_CONFIG,
  isTileInsideZone,
  type ZoneObjective,
  type ZoneTrialConfig,
  type ZoneTrialObjectiveState,
} from "./zoneObjectiveTypes";

type TilePoint = { x: number; y: number };
const zoneTrialStateByWorld = new WeakMap<World, ZoneTrialObjectiveState>();
type ZoneTileRejectReason = "BLOCKED_TILE" | "NO_SURFACE" | "VOID_OR_STAIRS" | "NOT_WALKABLE";
type RandomIntSource = { int(min: number, max: number): number };

export type ZonePlacementRect = {
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function effectiveDepth(world: any): number {
  if (Number.isFinite(world.delveDepth) && world.delveDepth > 0) return world.delveDepth;
  return (world.floorIndex ?? 0) + 1;
}

function zoneOverlaps(a: ZoneObjective, b: ZoneObjective): boolean {
  return !(
    a.tileX + a.tileW <= b.tileX ||
    b.tileX + b.tileW <= a.tileX ||
    a.tileY + a.tileH <= b.tileY ||
    b.tileY + b.tileH <= a.tileY
  );
}

function shuffleInPlace<T>(arr: T[], rng: RandomIntSource): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function isWalkableZoneTile(
  localX: number,
  localY: number,
  originTx: number,
  originTy: number,
  blockedTiles: Set<string>,
  tileWorld: number,
): { ok: true } | { ok: false; reason: ZoneTileRejectReason } {
  const tx = originTx + localX;
  const ty = originTy + localY;
  const key = `${tx},${ty}`;
  if (blockedTiles.has(key)) return { ok: false, reason: "BLOCKED_TILE" };

  const map = getActiveMap();
  if (!map) return { ok: false, reason: "NO_SURFACE" };
  if (surfacesAtXY(tx, ty).length === 0) return { ok: false, reason: "NO_SURFACE" };
  const tile = map.getTile(tx, ty);
  if (tile.kind === "VOID" || tile.kind === "STAIRS") return { ok: false, reason: "VOID_OR_STAIRS" };

  const wx = (tx + 0.5) * tileWorld;
  const wy = (ty + 0.5) * tileWorld;
  if (!walkInfo(wx, wy, tileWorld).walkable) return { ok: false, reason: "NOT_WALKABLE" };
  return { ok: true };
}

function buildReachableMask(
  width: number,
  height: number,
  start: TilePoint,
  walkableMask: boolean[],
): boolean[] {
  const reachable = new Array<boolean>(width * height).fill(false);
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const idx = (x: number, y: number) => y * width + x;
  if (!inBounds(start.x, start.y)) return reachable;
  if (!walkableMask[idx(start.x, start.y)]) return reachable;

  const queue: TilePoint[] = [{ x: start.x, y: start.y }];
  reachable[idx(start.x, start.y)] = true;

  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const neighbors: TilePoint[] = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];
    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      if (!inBounds(n.x, n.y)) continue;
      const nIdx = idx(n.x, n.y);
      if (reachable[nIdx]) continue;
      if (!walkableMask[nIdx]) continue;
      reachable[nIdx] = true;
      queue.push(n);
    }
  }

  return reachable;
}

function makeZoneCandidates(
  width: number,
  height: number,
  zoneSize: number,
  reachableMask: boolean[],
  walkableMask: boolean[],
): TilePoint[] {
  const out: TilePoint[] = [];
  const idx = (x: number, y: number) => y * width + x;
  for (let y = 0; y + zoneSize <= height; y++) {
    for (let x = 0; x + zoneSize <= width; x++) {
      let ok = true;
      for (let dy = 0; dy < zoneSize && ok; dy++) {
        for (let dx = 0; dx < zoneSize; dx++) {
          const tileIdx = idx(x + dx, y + dy);
          if (!walkableMask[tileIdx] || !reachableMask[tileIdx]) {
            ok = false;
            break;
          }
        }
      }
      if (ok) out.push({ x, y });
    }
  }
  return out;
}

function findNearestWalkableLocal(
  width: number,
  height: number,
  start: TilePoint,
  walkableMask: boolean[],
): TilePoint | null {
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const idx = (x: number, y: number) => y * width + x;
  if (!inBounds(start.x, start.y)) return null;
  if (walkableMask[idx(start.x, start.y)]) return start;

  const maxR = Math.max(width, height);
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = start.x + dx;
        const ny = start.y + dy;
        if (!inBounds(nx, ny)) continue;
        if (!walkableMask[idx(nx, ny)]) continue;
        return { x: nx, y: ny };
      }
    }
  }
  return null;
}

export function pickZoneTrialLikePlacements(
  world: World,
  zoneCount: number,
  zoneSize: number,
  rng: RandomIntSource = world.rng,
): ZonePlacementRect[] {
  const map = getActiveMap();
  if (!map) return [];

  const width = map.width;
  const height = map.height;
  const originTx = map.originTx;
  const originTy = map.originTy;
  const blockedTiles = map.blockedTiles ?? new Set<string>();
  const idx = (x: number, y: number) => y * width + x;
  const walkableMask = new Array<boolean>(width * height).fill(false);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const eligibility = isWalkableZoneTile(
        x,
        y,
        originTx,
        originTy,
        blockedTiles,
        KENNEY_TILE_WORLD,
      );
      walkableMask[idx(x, y)] = eligibility.ok;
    }
  }

  const spawnLocalRaw = {
    x: clamp(map.spawnTx - originTx, 0, width - 1),
    y: clamp(map.spawnTy - originTy, 0, height - 1),
  };
  const spawnLocal = findNearestWalkableLocal(width, height, spawnLocalRaw, walkableMask) ?? spawnLocalRaw;
  const reachableMask = buildReachableMask(width, height, spawnLocal, walkableMask);
  const candidates = makeZoneCandidates(width, height, zoneSize, reachableMask, walkableMask);
  shuffleInPlace(candidates, rng);

  const zones: ZonePlacementRect[] = [];
  for (let i = 0; i < candidates.length && zones.length < zoneCount; i++) {
    const c = candidates[i];
    const next = {
      tileX: c.x,
      tileY: c.y,
      tileW: zoneSize,
      tileH: zoneSize,
    };
    let overlaps = false;
    for (let j = 0; j < zones.length; j++) {
      if (zoneOverlaps(
        { ...next, id: 0, killTarget: 0, killCount: 0, completed: false },
        { ...zones[j], id: 0, killTarget: 0, killCount: 0, completed: false },
      )) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) zones.push(next);
  }

  return zones;
}

export function startZoneTrial(world: World, config: Partial<ZoneTrialConfig> = {}): void {
  const spec = world.currentObjectiveSpec;
  if (!spec || spec.objectiveType !== "ZONE_TRIAL") {
    zoneTrialStateByWorld.delete(world);
    return;
  }

  const map = getActiveMap();
  if (!map) {
    zoneTrialStateByWorld.delete(world);
    return;
  }

  const zoneCount = Math.max(1, config.zoneCount ?? spec.params.zoneCount ?? DEFAULT_ZONE_TRIAL_CONFIG.zoneCount);
  const zoneSize = Math.max(1, config.zoneSize ?? spec.params.zoneSize ?? DEFAULT_ZONE_TRIAL_CONFIG.zoneSize);
  const baseKillTargetPerZone =
    config.killTargetPerZone ?? spec.params.killTargetPerZone ?? DEFAULT_ZONE_TRIAL_CONFIG.killTargetPerZone;

  const d = Math.max(1, effectiveDepth(world));
  const spawnDepthMult = Math.pow(DEFAULT_SPAWN_TUNING.spawnPerDepth, d - 1);
  const hpDepthMult = Math.pow(DEFAULT_SPAWN_TUNING.hpPerDepth, d - 1);
  const scaledKillTargetRaw = Math.round(baseKillTargetPerZone * spawnDepthMult * hpDepthMult);

  const killTargetPerZone = clamp(
    scaledKillTargetRaw,
    config.killTargetMin ?? DEFAULT_ZONE_TRIAL_CONFIG.killTargetMin,
    config.killTargetMax ?? DEFAULT_ZONE_TRIAL_CONFIG.killTargetMax,
  );
  if (import.meta.env.DEV) {
    console.debug("[zoneTrial] killTarget scaling", {
      baseKillTargetPerZone,
      depth: d,
      spawnDepthMult,
      hpDepthMult,
      killTargetPerZone,
    });
  }

  const placements = pickZoneTrialLikePlacements(world, zoneCount, zoneSize, world.rng);
  const zones: ZoneObjective[] = placements.map((p, i) => ({
    id: i + 1,
    tileX: p.tileX,
    tileY: p.tileY,
    tileW: p.tileW,
    tileH: p.tileH,
    killTarget: killTargetPerZone,
    killCount: 0,
    completed: false,
  }));

  zoneTrialStateByWorld.set(world, {
    zones,
    totalZones: zones.length,
    completedZones: 0,
    completed: zones.length === 0,
    completionSignalEmitted: zones.length === 0,
  });

  if (zones.length === 0) {
    world.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: OBJECTIVE_TRIGGER_IDS.zoneTrialComplete,
    });
  }
}

export function updateZoneTrialObjective(world: World): void {
  const state = zoneTrialStateByWorld.get(world);
  if (!state || state.completed) return;
  const map = getActiveMap();
  if (!map) return;

  const originTx = map.originTx;
  const originTy = map.originTy;
  const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);
  const playerTile = worldToTile(playerWorld.wx, playerWorld.wy, KENNEY_TILE_WORLD);
  const localPX = playerTile.tx - originTx;
  const localPY = playerTile.ty - originTy;
  let progressChanged = false;

  for (let i = 0; i < world.events.length; i++) {
    const ev = world.events[i];
    if (ev.type !== "ENEMY_KILLED") continue;

    for (let z = 0; z < state.zones.length; z++) {
      const zone = state.zones[z];
      if (zone.completed) continue;
      if (!isTileInsideZone(localPX, localPY, zone)) continue;

      zone.killCount++;
      progressChanged = true;
      if (zone.killCount >= zone.killTarget) {
        zone.killCount = zone.killTarget;
        zone.completed = true;
        state.completedZones++;
        world.triggerSignals.push({
          type: "KILL",
          entityId: -1,
          triggerId: buildZoneClearedTriggerId(z + 1),
        });
      }
      break;
    }
  }

  if (state.completedZones >= state.totalZones) {
    state.completed = true;
  }

  if (state.completed && !state.completionSignalEmitted) {
    world.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: OBJECTIVE_TRIGGER_IDS.zoneTrialComplete,
    });
    state.completionSignalEmitted = true;
  }

  if (!progressChanged && !state.completed) return;
}

export function getZoneTrialObjectiveState(world: World): ZoneTrialObjectiveState | null {
  return zoneTrialStateByWorld.get(world) ?? null;
}
