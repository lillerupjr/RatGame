import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { worldToTile } from "../coords/tile";
import { getActiveMap, walkInfo } from "../map/compile/kenneyMap";
import { OBJECTIVE_TRIGGER_IDS } from "../systems/progression/objectiveSpec";
import {
  DEFAULT_ZONE_TRIAL_CONFIG,
  isTileInsideZone,
  type ZoneObjective,
  type ZoneTrialConfig,
  type ZoneTrialObjectiveState,
} from "./zoneObjectiveTypes";

type TilePoint = { x: number; y: number };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function zoneOverlaps(a: ZoneObjective, b: ZoneObjective): boolean {
  return !(
    a.tileX + a.tileW <= b.tileX ||
    b.tileX + b.tileW <= a.tileX ||
    a.tileY + a.tileH <= b.tileY ||
    b.tileY + b.tileH <= a.tileY
  );
}

function shuffleInPlace<T>(arr: T[], world: World): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = world.rng.int(0, i);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function buildOccluderTileSet(map: ReturnType<typeof getActiveMap>): Set<string> {
  const out = new Set<string>();
  if (!map) return out;
  for (const pieces of map.occludersByLayer.values()) {
    for (let i = 0; i < pieces.length; i++) {
      out.add(`${pieces[i].tx},${pieces[i].ty}`);
    }
  }
  return out;
}

function isWalkableZoneTile(
  localX: number,
  localY: number,
  originTx: number,
  originTy: number,
  blockedTiles: Set<string>,
  occluderTiles: Set<string>,
  tileWorld: number,
): boolean {
  const tx = originTx + localX;
  const ty = originTy + localY;
  const key = `${tx},${ty}`;
  if (blockedTiles.has(key)) return false;
  if (occluderTiles.has(key)) return false;

  const map = getActiveMap();
  if (!map) return false;
  const tile = map.getTile(tx, ty);
  if (tile.kind === "VOID" || tile.kind === "STAIRS") return false;

  const wx = (tx + 0.5) * tileWorld;
  const wy = (ty + 0.5) * tileWorld;
  return walkInfo(wx, wy, tileWorld).walkable;
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

export function startZoneTrial(world: World, config: Partial<ZoneTrialConfig> = {}): void {
  const spec = world.currentObjectiveSpec;
  if (!spec || spec.objectiveType !== "ZONE_TRIAL") {
    world.zoneTrialObjective = null;
    return;
  }

  const map = getActiveMap();
  if (!map) {
    world.zoneTrialObjective = null;
    return;
  }

  const zoneCount = Math.max(1, config.zoneCount ?? spec.params.zoneCount ?? DEFAULT_ZONE_TRIAL_CONFIG.zoneCount);
  const zoneSize = Math.max(1, config.zoneSize ?? spec.params.zoneSize ?? DEFAULT_ZONE_TRIAL_CONFIG.zoneSize);
  const killTargetPerZone = clamp(
    config.killTargetPerZone ?? spec.params.killTargetPerZone ?? DEFAULT_ZONE_TRIAL_CONFIG.killTargetPerZone,
    config.killTargetMin ?? DEFAULT_ZONE_TRIAL_CONFIG.killTargetMin,
    config.killTargetMax ?? DEFAULT_ZONE_TRIAL_CONFIG.killTargetMax,
  );

  const width = map.width;
  const height = map.height;
  const originTx = map.originTx;
  const originTy = map.originTy;
  const blockedTiles = map.blockedTiles ?? new Set<string>();
  const occluderTiles = buildOccluderTileSet(map);
  const idx = (x: number, y: number) => y * width + x;
  const walkableMask = new Array<boolean>(width * height).fill(false);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      walkableMask[idx(x, y)] = isWalkableZoneTile(
        x,
        y,
        originTx,
        originTy,
        blockedTiles,
        occluderTiles,
        KENNEY_TILE_WORLD,
      );
    }
  }

  const spawnLocal = {
    x: clamp(map.spawnTx - originTx, 0, width - 1),
    y: clamp(map.spawnTy - originTy, 0, height - 1),
  };
  const reachableMask = buildReachableMask(width, height, spawnLocal, walkableMask);
  const candidates = makeZoneCandidates(width, height, zoneSize, reachableMask, walkableMask);
  shuffleInPlace(candidates, world);

  const zones: ZoneObjective[] = [];
  for (let i = 0; i < candidates.length && zones.length < zoneCount; i++) {
    const c = candidates[i];
    const next: ZoneObjective = {
      id: zones.length + 1,
      tileX: c.x,
      tileY: c.y,
      tileW: zoneSize,
      tileH: zoneSize,
      killTarget: killTargetPerZone,
      killCount: 0,
      completed: false,
    };
    let overlaps = false;
    for (let j = 0; j < zones.length; j++) {
      if (zoneOverlaps(next, zones[j])) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) zones.push(next);
  }

  world.zoneTrialObjective = {
    zones,
    totalZones: zones.length,
    completedZones: 0,
    completed: zones.length === 0,
    completionSignalEmitted: zones.length === 0,
  };
}

export function updateZoneTrialObjective(world: World): void {
  const state = world.zoneTrialObjective;
  if (!state || state.completed) return;
  const map = getActiveMap();
  if (!map) return;

  const originTx = map.originTx;
  const originTy = map.originTy;
  let progressChanged = false;

  for (let i = 0; i < world.events.length; i++) {
    const ev = world.events[i];
    if (ev.type !== "ENEMY_KILLED") continue;
    const deathTile = worldToTile(ev.x, ev.y, KENNEY_TILE_WORLD);
    const localX = deathTile.tx - originTx;
    const localY = deathTile.ty - originTy;

    for (let z = 0; z < state.zones.length; z++) {
      const zone = state.zones[z];
      if (zone.completed) continue;
      if (!isTileInsideZone(localX, localY, zone)) continue;

      zone.killCount++;
      progressChanged = true;
      if (zone.killCount >= zone.killTarget) {
        zone.killCount = zone.killTarget;
        zone.completed = true;
        state.completedZones++;
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
  return world.zoneTrialObjective;
}
