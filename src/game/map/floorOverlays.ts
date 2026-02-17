import type { World } from "../../engine/world/world";
import { getActiveMap, getSpawnWorldFromActive } from "./proceduralMapBridge";
import { walkInfo } from "./compile/kenneyMap";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import type { TriggerDef } from "../triggers/triggerTypes";
import type { FloorIntent, PlacementPolicy } from "./floorIntent";
import { OBJECTIVE_TRIGGER_IDS } from "../systems/progression/objectiveSpec";
import { RNG } from "../util/rng";
import { objectiveIdFromArchetype, type ObjectiveId } from "./objectivePlan";

export type OverlayAction =
  | {
      type: "PLACE_SPAWN_ZONES";
      count: number;
      radiusTiles: number;
      minSeparationTiles: number;
      placementPolicy: PlacementPolicy;
    }
  | {
      type: "PLACE_BOSS_SPAWN_ZONES";
      count: number;
      radiusTiles: number;
      minSeparationTiles: number;
      placementPolicy: PlacementPolicy;
    }
  | { type: "PLACE_VENDOR_NPC" }
  | { type: "PLACE_HEAL_INTERACTABLE" };

export type OverlaySpec = OverlayAction[];

type TilePoint = { tx: number; ty: number };
type WalkNode = {
  tx: number;
  ty: number;
  floorH: number;
  z: number;
  kind: string;
  isRamp: boolean;
};

const DEFAULT_ZONE_RADIUS = 2;
const DEFAULT_BOSS_ZONE_RADIUS = 7;
const DEFAULT_ZONE_MIN_SEPARATION = 6;

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function buildOverlaySeed(intent: FloorIntent, objectiveId: ObjectiveId): number {
  if (typeof intent.variantSeed === "number") return intent.variantSeed;
  return hashString(`${intent.nodeId}|${intent.floorIndex}|${objectiveId}`);
}

function packKey(tx: number, ty: number): number {
  return (tx & 0xffff) | ((ty & 0xffff) << 16);
}

function unpackCoord(v: number): number {
  return v & 0x8000 ? v - 0x10000 : v;
}

function unpackKey(key: number): TilePoint {
  const tx = unpackCoord(key & 0xffff);
  const ty = unpackCoord((key >> 16) & 0xffff);
  return { tx, ty };
}

function collectReachableTiles(
  spawnTile: TilePoint
): { tiles: TilePoint[]; walkable: Set<number>; nodes: Map<number, WalkNode> } {
  const map = getActiveMap();
  if (!map) return { tiles: [], walkable: new Set<number>(), nodes: new Map<number, WalkNode>() };

  const nodes = new Map<number, WalkNode>();
  const minTx = map.originTx;
  const minTy = map.originTy;
  const maxTx = map.originTx + map.width - 1;
  const maxTy = map.originTy + map.height - 1;

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
      const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
      const info = walkInfo(wx, wy, KENNEY_TILE_WORLD);
      if (!info.walkable) continue;
      const key = packKey(tx, ty);
      nodes.set(key, {
        tx,
        ty,
        floorH: info.floorH | 0,
        z: info.z,
        kind: info.kind,
        isRamp: !!(info as any).isRamp,
      });
    }
  }

  const startKey = packKey(spawnTile.tx, spawnTile.ty);
  const start = nodes.get(startKey) ?? nodes.values().next().value;
  if (!start) return { tiles: [], walkable: new Set<number>(), nodes };

  const walkable = new Set<number>();
  const tiles: TilePoint[] = [];
  const queue: WalkNode[] = [start];
  const visited = new Set<number>();
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const MAX_STEP_Z = 1.05;

  const isConnectorish = (node: WalkNode) => node.isRamp || node.kind === "STAIRS";

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curKey = packKey(cur.tx, cur.ty);
    if (visited.has(curKey)) continue;
    visited.add(curKey);

    walkable.add(curKey);
    tiles.push({ tx: cur.tx, ty: cur.ty });

    for (const [dx, dy] of dirs) {
      const nx = cur.tx + dx;
      const ny = cur.ty + dy;
      const nKey = packKey(nx, ny);
      if (visited.has(nKey)) continue;
      const next = nodes.get(nKey);
      if (!next) continue;

      const connector = isConnectorish(cur) || isConnectorish(next);
      if (!connector) {
        if (next.floorH !== cur.floorH) continue;
      } else {
        const dz = Math.abs(next.z - cur.z);
        if (dz > MAX_STEP_Z) continue;
      }

      queue.push(next);
    }
  }

  return { tiles, walkable, nodes };
}

function tileDist(a: TilePoint, b: TilePoint): number {
  const dx = a.tx - b.tx;
  const dy = a.ty - b.ty;
  return Math.sqrt(dx * dx + dy * dy);
}

function pickSpawnZonesStatic(
  candidates: TilePoint[],
  count: number,
  minSep: number,
  rng: RNG,
  spawn: TilePoint
): TilePoint[] {
  const weighted = candidates
    .map((p) => ({ p, d: tileDist(p, spawn) }))
    .sort((a, b) => b.d - a.d || (a.p.tx - b.p.tx) || (a.p.ty - b.p.ty));

  const picked: TilePoint[] = [];
  for (let i = 0; i < weighted.length && picked.length < count; i++) {
    const candidate = weighted[i].p;
    const ok = picked.every((p) => tileDist(p, candidate) >= minSep);
    if (!ok) continue;
    picked.push(candidate);
  }

  if (picked.length < count) {
    const remaining = weighted.map((entry) => entry.p).filter((p) => !picked.includes(p));
    while (picked.length < count && remaining.length > 0) {
      const idx = rng.int(0, remaining.length - 1);
      picked.push(remaining.splice(idx, 1)[0]);
    }
  }

  return picked;
}

function bfsFarthest(
  start: TilePoint,
  nodes: Map<number, WalkNode>,
  walkable: Set<number>
): { farthest: TilePoint; parents: Map<number, number> } {
  const queue: TilePoint[] = [];
  const visited = new Set<number>();
  const parents = new Map<number, number>();
  const dist = new Map<number, number>();

  const startKey = packKey(start.tx, start.ty);
  queue.push(start);
  visited.add(startKey);
  dist.set(startKey, 0);

  let farthest = start;
  let farthestKey = startKey;
  let farthestDist = 0;

  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const MAX_STEP_Z = 1.05;
  const isConnectorish = (node: WalkNode) => node.isRamp || node.kind === "STAIRS";

  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const curKey = packKey(cur.tx, cur.ty);
    const curDist = dist.get(curKey) ?? 0;
    const curNode = nodes.get(curKey);
    if (!curNode) continue;

    if (curDist > farthestDist || (curDist === farthestDist && curKey < farthestKey)) {
      farthest = cur;
      farthestKey = curKey;
      farthestDist = curDist;
    }

    for (const [dx, dy] of dirs) {
      const nx = cur.tx + dx;
      const ny = cur.ty + dy;
      const nKey = packKey(nx, ny);
      if (visited.has(nKey)) continue;
      if (!walkable.has(nKey)) continue;
      const next = nodes.get(nKey);
      if (!next) continue;

      const connector = isConnectorish(curNode) || isConnectorish(next);
      if (!connector) {
        if (next.floorH !== curNode.floorH) continue;
      } else {
        const dz = Math.abs(next.z - curNode.z);
        if (dz > MAX_STEP_Z) continue;
      }

      visited.add(nKey);
      parents.set(nKey, curKey);
      dist.set(nKey, curDist + 1);
      queue.push({ tx: nx, ty: ny });
    }
  }

  return { farthest, parents };
}

function buildFarthestPath(
  start: TilePoint,
  nodes: Map<number, WalkNode>,
  walkable: Set<number>
): TilePoint[] {
  const result = bfsFarthest(start, nodes, walkable);
  const endKey = packKey(result.farthest.tx, result.farthest.ty);

  const path: TilePoint[] = [];
  let curKey: number | undefined = endKey;
  while (curKey !== undefined) {
    path.push(unpackKey(curKey));
    curKey = result.parents.get(curKey);
  }

  return path.reverse();
}

function pickSpawnZonesLongestPath(
  candidates: TilePoint[],
  nodes: Map<number, WalkNode>,
  walkable: Set<number>,
  count: number,
  minSep: number,
  rng: RNG,
  spawn: TilePoint,
  jitterRadius: number
): TilePoint[] {
  if (candidates.length === 0) return [];
  const start = walkable.has(packKey(spawn.tx, spawn.ty)) ? spawn : candidates[0];
  const path = buildFarthestPath(start, nodes, walkable);
  if (path.length === 0) return [];

  const picks: TilePoint[] = [];
  const step = path.length / (count + 1);

  for (let i = 1; i <= count; i++) {
    const baseIndex = Math.round(step * i);
    const jitter = jitterRadius > 0 ? rng.int(-jitterRadius, jitterRadius) : 0;
    let idx = Math.max(0, Math.min(path.length - 1, baseIndex + jitter));

    let chosen = path[idx];
    let found = false;
    for (let offset = 0; offset < path.length; offset++) {
      const forward = idx + offset;
      const backward = idx - offset;
      const candidate =
        forward < path.length
          ? path[forward]
          : backward >= 0
            ? path[backward]
            : null;
      if (!candidate) continue;
      const ok = picks.every((p) => tileDist(p, candidate) >= minSep);
      if (ok) {
        chosen = candidate;
        found = true;
        break;
      }
    }

    if (found) {
      picks.push(chosen);
    }
  }

  return picks.length > 0 ? picks : candidates.slice(0, count);
}

function normalizeZoneCenters(
  centers: TilePoint[],
  count: number,
  fallback: TilePoint
): TilePoint[] {
  if (count <= 0) return [];
  const out = centers.slice(0, count);
  if (out.length === 0) out.push(fallback);
  while (out.length < count) {
    const idx = (out.length - 1) % out.length;
    const seed = out[idx] ?? fallback;
    out.push({ tx: seed.tx, ty: seed.ty });
  }
  return out;
}

export function overlaySpecFromFloorIntent(intent: FloorIntent): OverlaySpec {
  const objectiveId = intent.objectiveId ?? objectiveIdFromArchetype(intent.archetype);
  switch (objectiveId) {
    case "ZONE_TRIAL":
    case "TIME_TRIAL_ZONES":
      return [];
    case "KILL_RARES_IN_ZONES":
      return [
        {
          type: "PLACE_BOSS_SPAWN_ZONES",
          count: intent.spawnZoneCount ?? 3,
          radiusTiles: intent.spawnZoneRadiusTiles ?? DEFAULT_BOSS_ZONE_RADIUS,
          minSeparationTiles: intent.spawnZoneMinSeparationTiles ?? DEFAULT_ZONE_MIN_SEPARATION,
          placementPolicy: intent.placementPolicy ?? "LONGEST_PATH",
        },
      ];
    case "VENDOR_VISIT":
      return [{ type: "PLACE_VENDOR_NPC" }];
    case "HEAL_VISIT":
      return [{ type: "PLACE_HEAL_INTERACTABLE" }];
    default:
      return [];
  }
}

export function applyFloorOverlays(world: World, intent: FloorIntent): void {
  const map = getActiveMap();
  if (!map) {
    world.overlayTriggerDefs = [];
    world.overlayTriggerVersion++;
    return;
  }

  const objectiveId = intent.objectiveId ?? objectiveIdFromArchetype(intent.archetype);
  const spec = overlaySpecFromFloorIntent(intent);
  const spawn = getSpawnWorldFromActive();
  const spawnTile = { tx: spawn.tx, ty: spawn.ty };
  const { tiles: candidates, walkable, nodes } = collectReachableTiles(spawnTile);
  const rng = new RNG(buildOverlaySeed(intent, objectiveId));

  const overlayTriggers: TriggerDef[] = [];

  if (objectiveId === "SURVIVE_TIMER") {
    overlayTriggers.push({
      id: OBJECTIVE_TRIGGER_IDS.timer,
      type: "timer",
      tx: spawnTile.tx,
      ty: spawnTile.ty,
      radius: 0,
    });
  }

  for (const action of spec) {
    switch (action.type) {
      case "PLACE_SPAWN_ZONES": {
        const centers =
          action.placementPolicy === "LONGEST_PATH"
            ? pickSpawnZonesLongestPath(
                candidates,
                nodes,
                walkable,
                action.count,
                action.minSeparationTiles,
                rng,
                spawnTile,
                action.radiusTiles
              )
            : pickSpawnZonesStatic(
                candidates,
                action.count,
                action.minSeparationTiles,
                rng,
                spawnTile
              );
        for (let i = 0; i < centers.length; i++) {
          overlayTriggers.push({
            id: `${OBJECTIVE_TRIGGER_IDS.zonePrefix}${i + 1}`,
            type: "radius",
            tx: centers[i].tx,
            ty: centers[i].ty,
            radius: action.radiusTiles,
          });
        }
        break;
      }
      case "PLACE_BOSS_SPAWN_ZONES": {
        const rawCenters =
          action.placementPolicy === "LONGEST_PATH"
            ? pickSpawnZonesLongestPath(
                candidates,
                nodes,
                walkable,
                action.count,
                action.minSeparationTiles,
                rng,
                spawnTile,
                action.radiusTiles
              )
            : pickSpawnZonesStatic(
                candidates,
                action.count,
                action.minSeparationTiles,
                rng,
                spawnTile
              );
        const centers = normalizeZoneCenters(rawCenters, action.count, spawnTile);
        for (let i = 0; i < centers.length; i++) {
          overlayTriggers.push({
            id: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}${i + 1}`,
            type: "radius",
            tx: centers[i].tx,
            ty: centers[i].ty,
            radius: action.radiusTiles,
          });
        }
        break;
      }
      case "PLACE_VENDOR_NPC":
        overlayTriggers.push({
          id: OBJECTIVE_TRIGGER_IDS.vendor,
          type: "radius",
          tx: spawnTile.tx,
          ty: spawnTile.ty,
          radius: 1,
        });
        break;
      case "PLACE_HEAL_INTERACTABLE":
        overlayTriggers.push({
          id: OBJECTIVE_TRIGGER_IDS.heal,
          type: "radius",
          tx: spawnTile.tx,
          ty: spawnTile.ty,
          radius: 1,
        });
        break;
    }
  }

  world.overlayTriggerDefs = overlayTriggers;
  world.overlayTriggerVersion++;
}
