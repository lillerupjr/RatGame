// src/game/map/proceduralMapBridge.ts
//
// Bridge between procedural map generation and the game's map systems.
// Provides functions to generate, compile, and switch maps at runtime.

import { RNG } from "../util/rng";
import {
    generateFloorMap,
    generateFloorMapWithRooms,
    generateProceduralMap,
    generateProceduralMapWithRooms,
    type ProceduralMapConfig,
    type ProceduralMapResult,
} from "./proceduralMap";
import {
    generateMazeFloorMap,
    generateMazeMapDef,
    type MazeMapConfig,
    type RoomGraph,
} from "./mazeMap";
import {
    compileKenneyMapFromTable,
    type CompiledKenneyMap,
    type IsoTile,
} from "./kenneyMapLoader";
import type { TableMapDef } from "./tableMapTypes";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { PLANE_TILE_Z_OFFSET, setActiveMap as setKenneyActiveMap } from "./kenneyMap";
import { initializeRoomChallenges } from "../systems/roomChallenge";
import type { World } from "../world";


// ─────────────────────────────────────────────────────────────
// Active Map State
// ─────────────────────────────────────────────────────────────

let _activeMap: CompiledKenneyMap | null = null;
let _activeMapDef: TableMapDef | null = null;
let _activeRoomData: ProceduralMapResult["rooms"] | null = null;

/**
 * Get the currently active compiled map.
 */
export function getActiveMap(): CompiledKenneyMap | null {
    return _activeMap;
}

/**
 * Get the currently active map definition (for debugging/serialization).
 */
export function getActiveMapDef(): TableMapDef | null {
    return _activeMapDef;
}

// ─────────────────────────────────────────────────────────────
// Procedural Map Generation
// ─────────────────────────────────────────────────────────────

/**
 * Generate and activate a new procedural map for the given floor.
 * 
 * @param seed - Base RNG seed for the run
 * @param floorIndex - 0-based floor number (affects difficulty)
 * @param isBoss - Whether this is a boss arena
 * @param world - Optional world to initialize room challenges (if provided, challenges are enabled)
 * @returns The compiled map
 */
/** Generate a procedural floor map and set it as active. */
export function generateAndActivateFloorMap(
    seed: number,
    floorIndex: number,
    isBoss: boolean = false,
    world?: World
): CompiledKenneyMap {
    // Generate map with room data for challenges
    const { mapDef, rooms } = generateFloorMapWithRooms(seed, floorIndex, isBoss);
    
    // CRITICAL: Update the global kenneyMap state so all game systems use the new map
    const compiled = setKenneyActiveMap(mapDef);
    
    _activeMapDef = mapDef;
    _activeMap = compiled;
    _activeRoomData = rooms;
    
    // Initialize room challenges if world is provided
    if (world) {
        initializeRoomChallenges(world, rooms);
    }
    
    return compiled;
}

/**
 * Initialize room challenges for an already-active map.
 * Call this if you generated a map without passing world, but want to enable challenges later.
 */
export function activateRoomChallenges(world: World): void {
    if (_activeRoomData) {
        initializeRoomChallenges(world, _activeRoomData);
    }
}

/**
 * Get the room data for the currently active map.
 */
export function getActiveRoomData(): ProceduralMapResult["rooms"] | null {
    return _activeRoomData;
}

/**
 * Generate a map with custom configuration.
 */
export function generateAndActivateCustomMap(config: ProceduralMapConfig, world?: World): CompiledKenneyMap {
    // Generate map with room data for challenges
    const { mapDef, rooms } = generateProceduralMapWithRooms(config);
    
    // CRITICAL: Update the global kenneyMap state so all game systems use the new map
    const compiled = setKenneyActiveMap(mapDef);
    
    _activeMapDef = mapDef;
    _activeMap = compiled;
    _activeRoomData = rooms;
    
    // Initialize room challenges if world is provided
    if (world) {
        initializeRoomChallenges(world, rooms);
    }
    
    return compiled;
}

/**
 * Generate and activate a maze-style map with custom configuration.
 */
export function generateAndActivateMazeMap(config: MazeMapConfig): { compiled: CompiledKenneyMap; graph: RoomGraph } {
    const { mapDef, graph } = generateMazeMapDef(config);

    // CRITICAL: Update the global kenneyMap state so all game systems use the new map
    const compiled = setKenneyActiveMap(mapDef);

    _activeMapDef = mapDef;
    _activeMap = compiled;
    _activeRoomData = null;

    return { compiled, graph };
}

/**
 * Generate and activate a maze-style map for a given floor.
 */
export function generateAndActivateMazeFloorMap(
    seed: number,
    floorIndex: number,
    isBoss: boolean = false
): { compiled: CompiledKenneyMap; graph: RoomGraph } {
    const { mapDef, graph } = generateMazeFloorMap(seed, floorIndex, isBoss);

    // CRITICAL: Update the global kenneyMap state so all game systems use the new map
    const compiled = setKenneyActiveMap(mapDef);

    _activeMapDef = mapDef;
    _activeMap = compiled;
    _activeRoomData = null;

    return { compiled, graph };
}

/**
 * Activate a pre-existing map definition (e.g., hand-crafted maps).
 */
export function activateMapDef(mapDef: TableMapDef): CompiledKenneyMap {
    // CRITICAL: Update the global kenneyMap state so all game systems use the new map
    const compiled = setKenneyActiveMap(mapDef);
    
    _activeMapDef = mapDef;
    _activeMap = compiled;
    _activeRoomData = null;
    
    return compiled;
}

// ─────────────────────────────────────────────────────────────
// Map Query Functions (use active map)
// ─────────────────────────────────────────────────────────────

/**
 * Get tile at the given tile coordinates from the active map.
 */
export function getTileFromActive(tx: number, ty: number): IsoTile {
    if (!_activeMap) {
        return { kind: "VOID", h: 0 };
    }
    return _activeMap.getTile(tx, ty);
}

/**
 * Get spawn position in world space from the active map.
 */
export function getSpawnWorldFromActive(): {
    x: number;
    y: number;
    z: number;
    tx: number;
    ty: number;
    h: number;
} {
    if (!_activeMap) {
        return { x: 0, y: 0, z: 0, tx: 0, ty: 0, h: 0 };
    }
    
    const { spawnTx, spawnTy, spawnH } = _activeMap;
    const tile = _activeMap.getTile(spawnTx, spawnTy);
    const h = (tile.kind === "VOID" ? 0 : (tile.h | 0) + PLANE_TILE_Z_OFFSET);
    
    // Center of tile in world space
    const x = (spawnTx + 0.5) * KENNEY_TILE_WORLD;
    const y = (spawnTy + 0.5) * KENNEY_TILE_WORLD;
    const z = h;
    
    return { x, y, z, tx: spawnTx, ty: spawnTy, h };
}

/**
 * Get goal position in world space from the active map (if it has one).
 */
export function getGoalWorldFromActive(): {
    x: number;
    y: number;
    z: number;
    tx: number;
    ty: number;
    h: number;
} | null {
    if (!_activeMap || _activeMap.goalTx === null || _activeMap.goalTy === null) {
        return null;
    }
    
    const { goalTx, goalTy, goalH } = _activeMap;
    const tile = _activeMap.getTile(goalTx, goalTy);
    const h = (tile.kind === "VOID" ? 0 : (tile.h | 0) + PLANE_TILE_Z_OFFSET);
    
    // Center of tile in world space
    const x = (goalTx + 0.5) * KENNEY_TILE_WORLD;
    const y = (goalTy + 0.5) * KENNEY_TILE_WORLD;
    const z = h;
    
    return { x, y, z, tx: goalTx, ty: goalTy, h };
}

/**
 * Check if a tile is walkable (not void).
 */
export function isWalkable(tx: number, ty: number): boolean {
    const tile = getTileFromActive(tx, ty);
    return tile.kind !== "VOID";
}

/**
 * Check if a tile is a hole/void.
 */
export function isHole(tx: number, ty: number): boolean {
    return getTileFromActive(tx, ty).kind === "VOID";
}

/**
 * Check if a tile is stairs.
 */
export function isStairs(tx: number, ty: number): boolean {
    return getTileFromActive(tx, ty).kind === "STAIRS";
}

/**
 * Get the height of a tile.
 */
export function getTileHeight(tx: number, ty: number): number {
    return getTileFromActive(tx, ty).h | 0;
}

// ─────────────────────────────────────────────────────────────
// Map Statistics & Info
// ─────────────────────────────────────────────────────────────

export type MapStats = {
    id: string;
    width: number;
    height: number;
    floorTileCount: number;
    stairsTileCount: number;
    voidTileCount: number;
    maxHeight: number;
    hasGoal: boolean;
    spawnToGoalDistance: number | null;
};

/**
 * Get statistics about the active map.
 */
export function getActiveMapStats(): MapStats | null {
    if (!_activeMap || !_activeMapDef) return null;
    
    let floorTileCount = 0;
    let stairsTileCount = 0;
    let voidTileCount = 0;
    let maxHeight = 0;
    
    const { w, h } = _activeMapDef;
    const { originTx, originTy } = _activeMap;
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const tx = x + originTx;
            const ty = y + originTy;
            const tile = _activeMap.getTile(tx, ty);
            
            switch (tile.kind) {
                case "FLOOR":
                case "SPAWN":
                case "GOAL":
                    floorTileCount++;
                    maxHeight = Math.max(maxHeight, tile.h);
                    break;
                case "STAIRS":
                    stairsTileCount++;
                    maxHeight = Math.max(maxHeight, tile.h);
                    break;
                case "VOID":
                    voidTileCount++;
                    break;
            }
        }
    }
    
    const hasGoal = _activeMap.goalTx !== null && _activeMap.goalTy !== null;
    let spawnToGoalDistance: number | null = null;
    
    if (hasGoal && _activeMap.goalTx !== null && _activeMap.goalTy !== null) {
        const dx = _activeMap.goalTx - _activeMap.spawnTx;
        const dy = _activeMap.goalTy - _activeMap.spawnTy;
        spawnToGoalDistance = Math.hypot(dx, dy);
    }
    
    return {
        id: _activeMapDef.id,
        width: w,
        height: h,
        floorTileCount,
        stairsTileCount,
        voidTileCount,
        maxHeight,
        hasGoal,
        spawnToGoalDistance,
    };
}

// ─────────────────────────────────────────────────────────────
// Debug / Visualization
// ─────────────────────────────────────────────────────────────

/**
 * Generate an ASCII representation of the active map for debugging.
 */
export function getActiveMapAscii(): string {
    if (!_activeMap || !_activeMapDef) return "(no active map)";
    
    const { w, h } = _activeMapDef;
    const { originTx, originTy, spawnTx, spawnTy, goalTx, goalTy } = _activeMap;
    
    const lines: string[] = [];
    
    for (let y = 0; y < h; y++) {
        let line = "";
        for (let x = 0; x < w; x++) {
            const tx = x + originTx;
            const ty = y + originTy;
            
            if (tx === spawnTx && ty === spawnTy) {
                line += "S";
            } else if (tx === goalTx && ty === goalTy) {
                line += "G";
            } else {
                const tile = _activeMap.getTile(tx, ty);
                switch (tile.kind) {
                    case "VOID": line += " "; break;
                    case "FLOOR": line += "."; break;
                    case "SPAWN": line += "S"; break;
                    case "GOAL": line += "G"; break;
                    case "STAIRS":
                        // Isometric diagonal directions (viewer from south)
                        switch (tile.dir) {
                            case "N": line += "↑"; break;
                            case "E": line += "→"; break;
                            case "S": line += "↓"; break;
                            case "W": line += "←"; break;
                            default: line += "~"; break;
                        }
                        break;
                    default: line += "?"; break;
                }
            }
        }
        lines.push(line);
    }
    
    return lines.join("\n");
}

/**
 * Log map info to console for debugging.
 */
export function debugLogActiveMap(): void {
    const stats = getActiveMapStats();
    if (!stats) {
        console.log("[ProceduralMap] No active map");
        return;
    }
    
    console.log("[ProceduralMap] Active Map Stats:");
    console.log(`  ID: ${stats.id}`);
    console.log(`  Size: ${stats.width}x${stats.height}`);
    console.log(`  Floors: ${stats.floorTileCount}, Stairs: ${stats.stairsTileCount}, Void: ${stats.voidTileCount}`);
    console.log(`  Max Height: ${stats.maxHeight}`);
    console.log(`  Has Goal: ${stats.hasGoal}`);
    if (stats.spawnToGoalDistance !== null) {
        console.log(`  Spawn→Goal Distance: ${stats.spawnToGoalDistance.toFixed(1)} tiles`);
    }
    console.log("\n" + getActiveMapAscii());
}
