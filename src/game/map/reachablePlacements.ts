import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { getActiveMap } from "./authoredMapActivation";
import { walkInfo } from "./compile/kenneyMap";
import { RNG } from "../util/rng";

export type TilePoint = { tx: number; ty: number };

type WalkNode = {
  tx: number;
  ty: number;
  floorH: number;
  z: number;
  kind: string;
  isRamp: boolean;
};

type ReachableTilesResult = {
  tiles: TilePoint[];
  walkable: Set<number>;
  nodes: Map<number, WalkNode>;
};

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

export function collectReachableTiles(spawnTile: TilePoint): ReachableTilesResult {
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

export function tileDist(a: TilePoint, b: TilePoint): number {
  const dx = a.tx - b.tx;
  const dy = a.ty - b.ty;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pickReachableTilesStatic(
  candidates: TilePoint[],
  count: number,
  minSep: number,
  rng: RNG,
  spawn: TilePoint,
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
  walkable: Set<number>,
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
  walkable: Set<number>,
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

export function pickReachableTilesLongestPath(
  candidates: TilePoint[],
  nodes: Map<number, WalkNode>,
  walkable: Set<number>,
  count: number,
  minSep: number,
  rng: RNG,
  spawn: TilePoint,
  jitterRadius: number,
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
    const idx = Math.max(0, Math.min(path.length - 1, baseIndex + jitter));

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

    if (found) picks.push(chosen);
  }

  return picks.length > 0 ? picks : candidates.slice(0, count);
}
