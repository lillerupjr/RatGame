// src/game/map/Pathfinding3D.ts
//
// 3D Pathfinding for the Layered Tile Map System
//
// Provides A* pathfinding across multiple vertical layers, handling:
// - Horizontal movement within a layer
// - Vertical transitions (stairs, ramps, elevators)
// - Height-based movement cost adjustments
// - Floor-aware enemy navigation

import { Vector3D, v3, v3Dist, v3DistXY } from "../math/Vector3D";
import { 
    LayeredTileMap3D, 
    Tile3D, 
    VerticalTransition,
    getActiveLayeredMap,
    MAX_STEP_HEIGHT
} from "./LayeredTileMap3D";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * A node in the 3D pathfinding graph.
 */
export type PathNode3D = {
    tx: number;             // Tile X
    ty: number;             // Tile Y
    layer: number;          // Layer/floor level
    z: number;              // Absolute Z position
};

/**
 * A waypoint in the path (world coordinates).
 */
export type PathWaypoint3D = {
    x: number;              // World X
    y: number;              // World Y
    z: number;              // World Z
    isTransition: boolean;  // Is this a vertical transition point?
    transitionType?: "STAIRS" | "RAMP" | "ELEVATOR" | "LADDER" | "JUMP";
};

/**
 * Result of a pathfinding query.
 */
export type PathResult3D = {
    found: boolean;
    path: PathWaypoint3D[];
    totalCost: number;
    nodesExplored: number;
};

/**
 * Configuration for pathfinding.
 */
export type PathConfig3D = {
    maxIterations: number;      // Maximum A* iterations
    allowDiagonal: boolean;     // Allow diagonal movement
    stepCostMultiplier: number; // Extra cost for height changes
    transitionCost: number;     // Cost for using vertical transitions
    entityHeight: number;       // Height clearance needed
    maxClimbHeight: number;     // Maximum single-step height change
};

const DEFAULT_CONFIG: PathConfig3D = {
    maxIterations: 10000,
    allowDiagonal: true,
    stepCostMultiplier: 1.5,
    transitionCost: 2.0,
    entityHeight: 1.8,
    maxClimbHeight: MAX_STEP_HEIGHT,
};

// ─────────────────────────────────────────────────────────────
// Priority Queue (Min-Heap for A*)
// ─────────────────────────────────────────────────────────────

type HeapNode<T> = { priority: number; value: T };

class MinHeap<T> {
    private heap: HeapNode<T>[] = [];
    
    get length(): number {
        return this.heap.length;
    }
    
    push(priority: number, value: T): void {
        this.heap.push({ priority, value });
        this.bubbleUp(this.heap.length - 1);
    }
    
    pop(): T | undefined {
        if (this.heap.length === 0) return undefined;
        
        const result = this.heap[0].value;
        const last = this.heap.pop()!;
        
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }
        
        return result;
    }
    
    private bubbleUp(index: number): void {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.heap[parent].priority <= this.heap[index].priority) break;
            [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
            index = parent;
        }
    }
    
    private bubbleDown(index: number): void {
        while (true) {
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            let smallest = index;
            
            if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) {
                smallest = left;
            }
            if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) {
                smallest = right;
            }
            
            if (smallest === index) break;
            
            [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
            index = smallest;
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Pathfinding Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Find a path between two 3D positions using A*.
 */
export function findPath3D(
    startX: number, startY: number, startZ: number,
    goalX: number, goalY: number, goalZ: number,
    config: Partial<PathConfig3D> = {},
    map: LayeredTileMap3D | null = getActiveLayeredMap()
): PathResult3D {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    
    if (!map) {
        // No map - return direct path
        return {
            found: true,
            path: [
                { x: startX, y: startY, z: startZ, isTransition: false },
                { x: goalX, y: goalY, z: goalZ, isTransition: false },
            ],
            totalCost: v3Dist(v3(startX, startY, startZ), v3(goalX, goalY, goalZ)),
            nodesExplored: 0,
        };
    }
    
    const tileSize = map.config.tileSize;
    
    // Convert world to tile coords
    const startTile = map.worldToTile(startX, startY);
    const goalTile = map.worldToTile(goalX, goalY);
    const startLayer = map.zToLevel(startZ);
    const goalLayer = map.zToLevel(goalZ);
    
    // Node key for hash map
    const nodeKey = (tx: number, ty: number, layer: number): string => `${tx},${ty},${layer}`;
    
    // Start and goal nodes
    const startNode: PathNode3D = {
        tx: startTile.tx,
        ty: startTile.ty,
        layer: startLayer,
        z: startZ,
    };
    
    const goalNode: PathNode3D = {
        tx: goalTile.tx,
        ty: goalTile.ty,
        layer: goalLayer,
        z: goalZ,
    };
    
    // A* data structures
    const openSet = new MinHeap<PathNode3D>();
    const cameFrom = new Map<string, PathNode3D>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    
    const startKey = nodeKey(startNode.tx, startNode.ty, startNode.layer);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic3D(startNode, goalNode, tileSize));
    openSet.push(fScore.get(startKey)!, startNode);
    
    let nodesExplored = 0;
    
    while (openSet.length > 0 && nodesExplored < cfg.maxIterations) {
        const current = openSet.pop()!;
        const currentKey = nodeKey(current.tx, current.ty, current.layer);
        nodesExplored++;
        
        // Goal check
        if (current.tx === goalNode.tx && current.ty === goalNode.ty && current.layer === goalNode.layer) {
            // Reconstruct path
            const path = reconstructPath3D(cameFrom, current, map, tileSize);
            return {
                found: true,
                path,
                totalCost: gScore.get(currentKey) ?? 0,
                nodesExplored,
            };
        }
        
        // Get neighbors
        const neighbors = getNeighbors3D(current, map, cfg);
        
        for (const neighbor of neighbors) {
            const neighborKey = nodeKey(neighbor.node.tx, neighbor.node.ty, neighbor.node.layer);
            
            const tentativeG = (gScore.get(currentKey) ?? Infinity) + neighbor.cost;
            
            if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeG);
                
                const h = heuristic3D(neighbor.node, goalNode, tileSize);
                const f = tentativeG + h;
                fScore.set(neighborKey, f);
                
                openSet.push(f, neighbor.node);
            }
        }
    }
    
    // No path found
    return {
        found: false,
        path: [],
        totalCost: Infinity,
        nodesExplored,
    };
}

/**
 * Heuristic function for A* (3D Manhattan + Euclidean hybrid).
 */
function heuristic3D(from: PathNode3D, to: PathNode3D, tileSize: number): number {
    const dx = Math.abs(from.tx - to.tx);
    const dy = Math.abs(from.ty - to.ty);
    const dz = Math.abs(from.layer - to.layer);
    
    // Use Chebyshev distance for XY (allows diagonal)
    // Add extra cost for Z changes
    const xyDist = Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    const zDist = dz * 2; // Height changes are more expensive
    
    return (xyDist + zDist) * tileSize;
}

/**
 * Get valid neighbors for a node.
 */
function getNeighbors3D(
    node: PathNode3D,
    map: LayeredTileMap3D,
    config: PathConfig3D
): { node: PathNode3D; cost: number; isTransition: boolean }[] {
    const neighbors: { node: PathNode3D; cost: number; isTransition: boolean }[] = [];
    const tileSize = map.config.tileSize;
    const layerHeight = map.config.layerHeight;
    
    // Direction offsets
    const directions = [
        { dx: 1, dy: 0 },   // E
        { dx: -1, dy: 0 },  // W
        { dx: 0, dy: 1 },   // S
        { dx: 0, dy: -1 },  // N
    ];
    
    if (config.allowDiagonal) {
        directions.push(
            { dx: 1, dy: 1 },   // SE
            { dx: 1, dy: -1 },  // NE
            { dx: -1, dy: 1 },  // SW
            { dx: -1, dy: -1 }, // NW
        );
    }
    
    // Check horizontal neighbors (same layer + small steps)
    for (const dir of directions) {
        const ntx = node.tx + dir.dx;
        const nty = node.ty + dir.dy;
        
        // Check current layer
        const tile = map.getTile(ntx, nty, node.layer);
        if (tile && tile.walkable) {
            // Check if we can step up/down to this tile
            const heightDiff = tile.zTop - node.z;
            
            if (Math.abs(heightDiff) <= config.maxClimbHeight) {
                // Check ceiling clearance
                const ceiling = map.getCeilingAt(
                    (ntx + 0.5) * tileSize,
                    (nty + 0.5) * tileSize,
                    tile.zTop
                );
                
                if (ceiling - tile.zTop >= config.entityHeight) {
                    const baseCost = dir.dx !== 0 && dir.dy !== 0 ? 1.414 : 1;
                    const stepCost = heightDiff !== 0 ? config.stepCostMultiplier : 1;
                    
                    neighbors.push({
                        node: {
                            tx: ntx,
                            ty: nty,
                            layer: node.layer,
                            z: tile.zTop,
                        },
                        cost: baseCost * stepCost * tileSize,
                        isTransition: false,
                    });
                }
            }
        }
        
        // Check adjacent layers (for tiles that span multiple heights)
        for (const dLayer of [-1, 1]) {
            const adjacentLayer = node.layer + dLayer;
            const adjacentTile = map.getTile(ntx, nty, adjacentLayer);
            
            if (adjacentTile && adjacentTile.walkable) {
                const heightDiff = adjacentTile.zTop - node.z;
                
                // Only allow small steps between layers
                if (Math.abs(heightDiff) <= config.maxClimbHeight) {
                    const ceiling = map.getCeilingAt(
                        (ntx + 0.5) * tileSize,
                        (nty + 0.5) * tileSize,
                        adjacentTile.zTop
                    );
                    
                    if (ceiling - adjacentTile.zTop >= config.entityHeight) {
                        const baseCost = dir.dx !== 0 && dir.dy !== 0 ? 1.414 : 1;
                        
                        neighbors.push({
                            node: {
                                tx: ntx,
                                ty: nty,
                                layer: adjacentLayer,
                                z: adjacentTile.zTop,
                            },
                            cost: baseCost * config.stepCostMultiplier * tileSize,
                            isTransition: false,
                        });
                    }
                }
            }
        }
    }
    
    // Check vertical transitions (stairs, elevators, etc.)
    const transitions = map.getTransitionsAt(node.tx, node.ty, node.layer);
    
    for (const trans of transitions) {
        const destLayer = trans.fromTx === node.tx && trans.fromTy === node.ty
            ? trans.toLayer
            : trans.fromLayer;
        const destTx = trans.fromTx === node.tx && trans.fromTy === node.ty
            ? trans.toTx
            : trans.fromTx;
        const destTy = trans.fromTx === node.tx && trans.fromTy === node.ty
            ? trans.toTy
            : trans.fromTy;
        
        const destTile = map.getTile(destTx, destTy, destLayer);
        if (destTile && destTile.walkable) {
            neighbors.push({
                node: {
                    tx: destTx,
                    ty: destTy,
                    layer: destLayer,
                    z: destTile.zTop,
                },
                cost: config.transitionCost * tileSize,
                isTransition: true,
            });
        }
    }
    
    return neighbors;
}

/**
 * Reconstruct the path from A* result.
 */
function reconstructPath3D(
    cameFrom: Map<string, PathNode3D>,
    endNode: PathNode3D,
    map: LayeredTileMap3D,
    tileSize: number
): PathWaypoint3D[] {
    const nodeKey = (tx: number, ty: number, layer: number): string => `${tx},${ty},${layer}`;
    
    const path: PathWaypoint3D[] = [];
    let current: PathNode3D | undefined = endNode;
    
    while (current) {
        const world = map.tileToWorld(current.tx, current.ty);
        
        // Check if this was a transition
        const prev = cameFrom.get(nodeKey(current.tx, current.ty, current.layer));
        const isTransition = prev !== undefined && prev.layer !== current.layer;
        
        path.unshift({
            x: world.wx,
            y: world.wy,
            z: current.z,
            isTransition,
        });
        
        current = cameFrom.get(nodeKey(current.tx, current.ty, current.layer));
    }
    
    return path;
}

// ─────────────────────────────────────────────────────────────
// Path Smoothing
// ─────────────────────────────────────────────────────────────

/**
 * Smooth a path by removing unnecessary waypoints.
 * Uses line-of-sight checks to skip intermediate points.
 */
export function smoothPath3D(
    path: PathWaypoint3D[],
    map: LayeredTileMap3D | null = getActiveLayeredMap()
): PathWaypoint3D[] {
    if (path.length <= 2 || !map) return path;
    
    const smoothed: PathWaypoint3D[] = [path[0]];
    let current = 0;
    
    while (current < path.length - 1) {
        let furthest = current + 1;
        
        // Find the furthest point we can reach directly
        for (let i = path.length - 1; i > current + 1; i--) {
            // Don't skip transition points
            if (path[i].isTransition || path[furthest].isTransition) break;
            
            // Check line of sight
            if (hasLineOfSight3D(path[current], path[i], map)) {
                furthest = i;
                break;
            }
        }
        
        smoothed.push(path[furthest]);
        current = furthest;
    }
    
    return smoothed;
}

/**
 * Check if there's a clear line of sight between two points.
 */
function hasLineOfSight3D(
    from: PathWaypoint3D,
    to: PathWaypoint3D,
    map: LayeredTileMap3D
): boolean {
    const tileSize = map.config.tileSize;
    
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 1) return true;
    
    // Sample points along the line
    const steps = Math.ceil(dist / (tileSize * 0.5));
    
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = from.x + dx * t;
        const y = from.y + dy * t;
        const z = from.z + dz * t;
        
        // Check if this point is walkable
        if (!map.isWalkable(x, y, z, 0.5)) {
            return false;
        }
    }
    
    return true;
}

// ─────────────────────────────────────────────────────────────
// Path Following
// ─────────────────────────────────────────────────────────────

/**
 * State for an entity following a path.
 */
export type PathFollowState = {
    path: PathWaypoint3D[];
    currentIndex: number;
    reached: boolean;
};

/**
 * Create a new path follow state.
 */
export function createPathFollowState(path: PathWaypoint3D[]): PathFollowState {
    return {
        path,
        currentIndex: 0,
        reached: path.length === 0,
    };
}

/**
 * Update path following, returning the direction to move.
 */
export function updatePathFollow(
    state: PathFollowState,
    currentX: number, currentY: number, currentZ: number,
    arrivalRadius: number = 16
): { dx: number; dy: number; dz: number; done: boolean } {
    if (state.reached || state.currentIndex >= state.path.length) {
        state.reached = true;
        return { dx: 0, dy: 0, dz: 0, done: true };
    }
    
    const target = state.path[state.currentIndex];
    
    // Check if we've reached this waypoint
    const dx = target.x - currentX;
    const dy = target.y - currentY;
    const dz = target.z - currentZ;
    const distXY = Math.sqrt(dx * dx + dy * dy);
    
    if (distXY < arrivalRadius) {
        state.currentIndex++;
        
        if (state.currentIndex >= state.path.length) {
            state.reached = true;
            return { dx: 0, dy: 0, dz: 0, done: true };
        }
        
        // Move to next waypoint
        return updatePathFollow(state, currentX, currentY, currentZ, arrivalRadius);
    }
    
    // Normalize direction
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-9) {
        return { dx: 0, dy: 0, dz: 0, done: false };
    }
    
    return {
        dx: dx / len,
        dy: dy / len,
        dz: dz / len,
        done: false,
    };
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Check if a path is still valid (no new obstacles).
 */
export function isPathValid3D(
    path: PathWaypoint3D[],
    map: LayeredTileMap3D | null = getActiveLayeredMap()
): boolean {
    if (!map || path.length === 0) return true;
    
    for (const waypoint of path) {
        if (!map.isWalkable(waypoint.x, waypoint.y, waypoint.z)) {
            return false;
        }
    }
    
    return true;
}

/**
 * Get the total length of a path.
 */
export function getPathLength3D(path: PathWaypoint3D[]): number {
    let length = 0;
    
    for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x;
        const dy = path[i].y - path[i - 1].y;
        const dz = path[i].z - path[i - 1].z;
        length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    return length;
}

/**
 * Get estimated travel time for a path.
 */
export function estimatePathTime3D(path: PathWaypoint3D[], speed: number): number {
    return getPathLength3D(path) / Math.max(1, speed);
}
