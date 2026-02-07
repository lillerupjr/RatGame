// src/game/map/flowField.ts
//
// Dijkstra flow field for enemy pathfinding.
// Computes a single flood-fill from the player's position on the kenneyMap
// tile graph. Every reachable tile stores the optimal direction toward the
// player, giving O(1) per-enemy direction queries.

import { walkInfo, getActiveMap, worldToTile } from "../compile/kenneyMap";
import type { CompiledKenneyMap } from "../compile/kenneyMapLoader";
import { tileToGrid } from "../../coords/grid";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Info cached per walkable tile node during graph build. */
type NavNode = {
    tx: number;
    ty: number;
    floorH: number;
    z: number;       // continuous Z at tile center
    isRamp: boolean;
    kind: string;     // tile kind ("FLOOR", "STAIRS", etc.)
};

/** Precomputed navigation graph over the tile grid. */
type NavGraph = {
    nodes: NavNode[];
    /** Packed key → node index. */
    nodeIndex: Map<number, number>;
    /** Adjacency: nodeIndex → array of { neighborIdx, cost }. */
    adj: { idx: number; cost: number }[][];
    /** Identity of the map used to build this graph. */
    mapId: string;
};

/** Result of a Dijkstra flow field computation. */
export type FlowField = {
    /** Distance from player for each node (indexed by nodeId). */
    dist: Float32Array;
    /**
     * Direction toward the player, encoded as tile-space delta index:
     * 0 = at goal / unreachable, 1 = +tx, 2 = -tx, 3 = +ty, 4 = -ty
     */
    parentDir: Int8Array;
    /** The nav graph this field was built on. */
    graph: NavGraph;
    /** Player tile when this field was computed. */
    playerTx: number;
    playerTy: number;
    playerFloorH: number;
    /** Timestamp (performance.now) when this field was computed. */
    buildTime: number;
};

// Direction encoding: index → tile-space delta
const DIR_DTX = [0, 1, -1, 0, 0];
const DIR_DTY = [0, 0, 0, 1, -1];

// Reverse direction: if we arrived at a neighbor by going +tx, the neighbor
// should point back -tx (toward the player). So reverse[1]=2, reverse[2]=1, etc.
const DIR_REVERSE = [0, 2, 1, 4, 3];

// ─────────────────────────────────────────────────────────────
// MinHeap (priority queue for Dijkstra)
// ─────────────────────────────────────────────────────────────

type HeapEntry = { priority: number; value: number };

class MinHeap {
    private heap: HeapEntry[] = [];

    get length(): number {
        return this.heap.length;
    }

    push(priority: number, value: number): void {
        this.heap.push({ priority, value });
        this._up(this.heap.length - 1);
    }

    pop(): number | undefined {
        if (this.heap.length === 0) return undefined;
        const result = this.heap[0].value;
        const last = this.heap.pop()!;
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this._down(0);
        }
        return result;
    }

    private _up(i: number): void {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.heap[p].priority <= this.heap[i].priority) break;
            [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
            i = p;
        }
    }

    private _down(i: number): void {
        const n = this.heap.length;
        while (true) {
            const l = 2 * i + 1;
            const r = 2 * i + 2;
            let s = i;
            if (l < n && this.heap[l].priority < this.heap[s].priority) s = l;
            if (r < n && this.heap[r].priority < this.heap[s].priority) s = r;
            if (s === i) break;
            [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]];
            i = s;
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Key packing
// ─────────────────────────────────────────────────────────────

// Pack (tx, ty, floorH) into a single number.
// Supports tx/ty in [-2048, 2047] and floorH in [0, 255].
function packKey(tx: number, ty: number, floorH: number): number {
    return ((tx + 2048) | ((ty + 2048) << 12) | ((floorH & 0xff) << 24));
}

// ─────────────────────────────────────────────────────────────
// Nav Graph Construction
// ─────────────────────────────────────────────────────────────

const MAX_STEP_Z = 1.05;
const RAMP_COST_MULT = 1.5;

function buildNavGraph(tileWorld: number): NavGraph {
    const map: CompiledKenneyMap = getActiveMap();
    const nodes: NavNode[] = [];
    const nodeIndex = new Map<number, number>();

    const minTx = map.originTx;
    const minTy = map.originTy;
    const maxTx = minTx + map.width;
    const maxTy = minTy + map.height;

    // Phase 1: create nodes for all walkable tile centers
    for (let ty = minTy; ty < maxTy; ty++) {
        for (let tx = minTx; tx < maxTx; tx++) {
            const wx = (tx + 0.5) * tileWorld;
            const wy = (ty + 0.5) * tileWorld;
            const info = walkInfo(wx, wy, tileWorld);

            if (!info.walkable) continue;

            const key = packKey(tx, ty, info.floorH);
            if (nodeIndex.has(key)) continue;

            const idx = nodes.length;
            nodes.push({
                tx,
                ty,
                floorH: info.floorH,
                z: info.z,
                isRamp: info.isRamp,
                kind: info.kind,
            });
            nodeIndex.set(key, idx);
        }
    }

    // Phase 2: build adjacency (4-directional)
    const adj: { idx: number; cost: number }[][] = new Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) adj[i] = [];

    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        for (let d = 1; d <= 4; d++) {
            const ntx = n.tx + DIR_DTX[d];
            const nty = n.ty + DIR_DTY[d];

            // Try same floorH first
            let nKey = packKey(ntx, nty, n.floorH);
            let nIdx = nodeIndex.get(nKey);

            if (nIdx === undefined) {
                // Try neighboring heights (ramps connect different floors)
                for (let dh = -1; dh <= 1; dh++) {
                    if (dh === 0) continue;
                    nKey = packKey(ntx, nty, n.floorH + dh);
                    nIdx = nodeIndex.get(nKey);
                    if (nIdx !== undefined) break;
                }
            }

            if (nIdx === undefined) continue;

            const nb = nodes[nIdx];
            const dz = Math.abs(nb.z - n.z);

            // Height connectivity check
            const rampInvolved =
                n.isRamp ||
                nb.isRamp ||
                n.kind === "STAIRS" ||
                nb.kind === "STAIRS";

            if (!rampInvolved) {
                if (nb.floorH !== n.floorH) continue;
            } else {
                if (dz > MAX_STEP_Z) continue;
            }

            const cost = rampInvolved ? RAMP_COST_MULT : 1.0;
            adj[i].push({ idx: nIdx, cost });
        }
    }

    return { nodes, nodeIndex, adj, mapId: map.id };
}

// ─────────────────────────────────────────────────────────────
// Dijkstra Flow Field
// ─────────────────────────────────────────────────────────────

export function computeFlowField(
    goalWx: number,
    goalWy: number,
    goalFloorH: number,
    tileWorld: number,
): FlowField {
    // Ensure nav graph is current
    const map = getActiveMap();
    if (!_navGraph || _navGraph.mapId !== map.id) {
        _navGraph = buildNavGraph(tileWorld);
    }
    const graph = _navGraph;
    const n = graph.nodes.length;

    const dist = new Float32Array(n);
    dist.fill(Infinity);
    const parentDir = new Int8Array(n); // 0 = no direction

    // Find goal node
    const goalTile = worldToTile(goalWx, goalWy, tileWorld);
    const goalKey = packKey(goalTile.tx, goalTile.ty, goalFloorH);
    const goalIdx = graph.nodeIndex.get(goalKey);

    if (goalIdx === undefined) {
        // Player is off-graph (shouldn't happen in normal play)
        return {
            dist,
            parentDir,
            graph,
            playerTx: goalTile.tx,
            playerTy: goalTile.ty,
            playerFloorH: goalFloorH,
            buildTime: performance.now(),
        };
    }

    // Dijkstra from goal
    dist[goalIdx] = 0;
    const heap = new MinHeap();
    heap.push(0, goalIdx);

    while (heap.length > 0) {
        const u = heap.pop()!;
        const du = dist[u];

        const neighbors = graph.adj[u];
        for (let i = 0; i < neighbors.length; i++) {
            const { idx: v, cost } = neighbors[i];
            const newDist = du + cost;

            if (newDist < dist[v]) {
                dist[v] = newDist;

                // Determine which direction v should go to reach u (toward player).
                // u is closer to the goal; v is farther.
                // The direction FROM v TO u in tile space:
                const nu = graph.nodes[u];
                const nv = graph.nodes[v];
                const dtx = nu.tx - nv.tx;
                const dty = nu.ty - nv.ty;

                // Encode as direction index
                let dir = 0;
                if (dtx === 1 && dty === 0) dir = 1;
                else if (dtx === -1 && dty === 0) dir = 2;
                else if (dtx === 0 && dty === 1) dir = 3;
                else if (dtx === 0 && dty === -1) dir = 4;

                parentDir[v] = dir;
                heap.push(newDist, v);
            }
        }
    }

    return {
        dist,
        parentDir,
        graph,
        playerTx: goalTile.tx,
        playerTy: goalTile.ty,
        playerFloorH: goalFloorH,
        buildTime: performance.now(),
    };
}

// ─────────────────────────────────────────────────────────────
// Direction Query
// ─────────────────────────────────────────────────────────────

/**
 * Query the flow field for the direction an enemy should move.
 * Returns a normalized grid-space direction {dx, dy}, or null if unreachable.
 */
export function queryFlowDirection(
    field: FlowField,
    wx: number,
    wy: number,
    floorH: number,
    tileWorld: number,
): { dx: number; dy: number } | null {
    const tx = Math.floor(wx / tileWorld);
    const ty = Math.floor(wy / tileWorld);
    const fh = floorH | 0;

    const key = packKey(tx, ty, fh);
    const nodeId = field.graph.nodeIndex.get(key);
    if (nodeId === undefined) return null;

    const dir = field.parentDir[nodeId];
    if (dir === 0) return null; // at goal or unreachable

    // Convert tile-space delta to grid-space delta
    const dtx = DIR_DTX[dir];
    const dty = DIR_DTY[dir];
    const gd = tileToGrid(dtx, dty);

    const glen = Math.hypot(gd.gx, gd.gy);
    if (glen < 1e-6) return null;

    return { dx: gd.gx / glen, dy: gd.gy / glen };
}

// ─────────────────────────────────────────────────────────────
// Staleness Check
// ─────────────────────────────────────────────────────────────

const RECOMPUTE_INTERVAL_MS = 500;

export function isFieldStale(
    field: FlowField | null,
    playerTx: number,
    playerTy: number,
    playerFloorH: number,
): boolean {
    if (!field) return true;

    // Player moved to a different tile
    if (
        field.playerTx !== playerTx ||
        field.playerTy !== playerTy ||
        field.playerFloorH !== playerFloorH
    ) {
        return true;
    }

    // Map changed
    const map = getActiveMap();
    if (field.graph.mapId !== map.id) return true;

    // Age check
    if (performance.now() - field.buildTime > RECOMPUTE_INTERVAL_MS) return true;

    return false;
}

// ─────────────────────────────────────────────────────────────
// Module-scoped cache
// ─────────────────────────────────────────────────────────────

let _navGraph: NavGraph | null = null;

/** Force nav graph rebuild (call on map change if needed). */
export function invalidateNavGraph(): void {
    _navGraph = null;
}
