// src/game/map/LayeredTileMap3D.ts
//
// Layered 3D Tile Map System (Option A)
//
// This system extends the existing 2D tile-based map to support true 3D by:
// 1. Stacking multiple 2D tile layers at different Z heights
// 2. Providing height queries for any world position
// 3. Supporting walkability across layers (stairs, ramps, elevators)
// 4. Maintaining backward compatibility with existing 2D systems

import { Vector3D, v3, v3Add } from "../../math/Vector3D";
import { BoundingBox3D, bb3, bb3Intersects, bb3ContainsPoint } from "../../math/BoundingBox3D";
import type { IsoTile, IsoTileKind } from "./kenneyMapLoader";
import type { TableMapCell, TableMapDef } from "../formats/table/tableMapTypes";
import { worldToTile as worldToTileHelper, tileToWorldCenter } from "../../coords/tile";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * A single tile in a 3D layer.
 * Extends IsoTile with explicit 3D properties.
 */
export type Tile3D = {
    // From IsoTile
    kind: IsoTileKind;
    h: number;              // Original height level (0, 1, 2...)
    
    // 3D extensions
    zBase: number;          // Absolute Z position of tile bottom
    zTop: number;           // Absolute Z position of tile top (walkable surface)
    zCeiling: number;       // Ceiling Z (for enclosed spaces, Infinity if open)
    
    // Collision
    walkable: boolean;      // Can entities walk on this tile's top?
    solid: boolean;         // Does this tile block movement through it?
    
    // Visual
    visible: boolean;       // Should this tile be rendered?
    transparent: boolean;   // Is this tile see-through (for visibility)?
    
    // Connectivity
    allowsUp: boolean;      // Can entities move UP from this tile?
    allowsDown: boolean;    // Can entities move DOWN from this tile?
    
    // Reference back to original tile data
    originalTile: IsoTile;
};

/**
 * A single layer in the 3D map.
 * Each layer represents a horizontal "floor" at a specific Z level.
 */
export type TileLayer3D = {
    id: string;             // Layer identifier
    zLevel: number;         // Integer floor level (0, 1, 2...)
    zBase: number;          // Absolute Z height of this layer's floor
    zHeight: number;        // Height of this layer (distance to next layer)
    
    // Tile data (2D array indexed by [ty][tx])
    tiles: Tile3D[][];
    
    // Bounds
    width: number;
    height: number;
};

/**
 * Configuration for creating a layered 3D map.
 */
export type LayeredMap3DConfig = {
    tileSize: number;       // World units per tile (e.g., 64)
    layerHeight: number;    // World units per layer (e.g., 2)
    maxLayers: number;      // Maximum number of vertical layers
};

/**
 * Result of a ground height query.
 */
export type GroundQuery3D = {
    z: number;              // Ground Z at this position
    walkable: boolean;      // Is this position walkable?
    layer: number;          // Layer index (-1 if void)
    tile: Tile3D | null;    // The tile at this position
};

/**
 * Result of a movement query.
 */
export type MovementQuery3D = {
    canMove: boolean;       // Can entity move to this position?
    groundZ: number;        // Ground Z at destination
    blocked: boolean;       // Is movement blocked by obstacle?
    stepUp: boolean;        // Does this require stepping up?
    stepDown: boolean;      // Does this require stepping down?
    stepHeight: number;     // Height difference if stepping
};

/**
 * Vertical transition (stairs, elevator, etc.)
 */
export type VerticalTransition = {
    id: string;
    type: "STAIRS" | "RAMP" | "ELEVATOR" | "LADDER" | "JUMP";
    
    // Source position (tile coords)
    fromTx: number;
    fromTy: number;
    fromLayer: number;
    
    // Destination position
    toTx: number;
    toTy: number;
    toLayer: number;
    
    // Transition properties
    bidirectional: boolean;
    travelTime: number;     // Seconds to traverse (0 = instant)
};

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: LayeredMap3DConfig = {
    tileSize: 64,
    layerHeight: 2,
    maxLayers: 10,
};

// Maximum step height for walking (without using stairs)
export const MAX_STEP_HEIGHT = 0.5;

// ─────────────────────────────────────────────────────────────
// LayeredTileMap3D Class
// ─────────────────────────────────────────────────────────────

/**
 * A 3D tile map composed of stacked 2D layers.
 * Provides height queries, collision detection, and pathfinding support.
 */
export class LayeredTileMap3D {
    readonly config: LayeredMap3DConfig;
    
    private layers: Map<number, TileLayer3D> = new Map();
    private transitions: VerticalTransition[] = [];
    
    // Bounds
    private minLayer: number = 0;
    private maxLayer: number = 0;
    private width: number = 0;
    private height: number = 0;
    
    constructor(config: Partial<LayeredMap3DConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    // ─────────────────────────────────────────────────────────
    // Layer Management
    // ─────────────────────────────────────────────────────────
    
    /**
     * Add a layer to the map.
     */
    addLayer(layer: TileLayer3D): void {
        this.layers.set(layer.zLevel, layer);
        this.minLayer = Math.min(this.minLayer, layer.zLevel);
        this.maxLayer = Math.max(this.maxLayer, layer.zLevel);
        this.width = Math.max(this.width, layer.width);
        this.height = Math.max(this.height, layer.height);
    }
    
    /**
     * Get a layer by Z level.
     */
    getLayer(zLevel: number): TileLayer3D | null {
        return this.layers.get(zLevel) ?? null;
    }
    
    /**
     * Get all layers in order (bottom to top).
     */
    getAllLayers(): TileLayer3D[] {
        return Array.from(this.layers.values())
            .sort((a, b) => a.zLevel - b.zLevel);
    }
    
    /**
     * Get the number of layers.
     */
    get layerCount(): number {
        return this.layers.size;
    }
    
    // ─────────────────────────────────────────────────────────
    // Tile Access
    // ─────────────────────────────────────────────────────────
    
    /**
     * Get a tile at specific coordinates and layer.
     */
    getTile(tx: number, ty: number, zLevel: number): Tile3D | null {
        const layer = this.layers.get(zLevel);
        if (!layer) return null;
        
        if (tx < 0 || tx >= layer.width || ty < 0 || ty >= layer.height) {
            return null;
        }
        
        return layer.tiles[ty]?.[tx] ?? null;
    }
    
    /**
     * Get all tiles at a position (from all layers).
     */
    getTilesAtPosition(tx: number, ty: number): Tile3D[] {
        const tiles: Tile3D[] = [];
        
        for (const layer of this.layers.values()) {
            const tile = layer.tiles[ty]?.[tx];
            if (tile) {
                tiles.push(tile);
            }
        }
        
        return tiles.sort((a, b) => a.zBase - b.zBase);
    }
    
    /**
     * Set a tile at specific coordinates and layer.
     */
    setTile(tx: number, ty: number, zLevel: number, tile: Tile3D): boolean {
        const layer = this.layers.get(zLevel);
        if (!layer) return false;
        
        if (tx < 0 || tx >= layer.width || ty < 0 || ty >= layer.height) {
            return false;
        }
        
        if (!layer.tiles[ty]) {
            layer.tiles[ty] = [];
        }
        
        layer.tiles[ty][tx] = tile;
        return true;
    }
    
    // ─────────────────────────────────────────────────────────
    // World Coordinate Helpers
    // ─────────────────────────────────────────────────────────
    
    /**
     * Convert world coordinates to tile coordinates.
     */
    worldToTile(wx: number, wy: number): { tx: number; ty: number } {
        return worldToTileHelper(wx, wy, this.config.tileSize);
    }
    
    /**
     * Convert tile coordinates to world coordinates (center of tile).
     */
    tileToWorld(tx: number, ty: number): { wx: number; wy: number } {
        return tileToWorldCenter(tx, ty, this.config.tileSize);
    }
    
    /**
     * Convert Z level to absolute Z height.
     */
    levelToZ(zLevel: number): number {
        return zLevel * this.config.layerHeight;
    }
    
    /**
     * Convert absolute Z height to Z level.
     */
    zToLevel(z: number): number {
        return Math.floor(z / this.config.layerHeight);
    }
    
    // ─────────────────────────────────────────────────────────
    // Ground/Height Queries
    // ─────────────────────────────────────────────────────────
    
    /**
     * Get the ground height at a world position.
     * Returns the highest walkable surface at or below the given Z.
     */
    getGroundAt(wx: number, wy: number, fromZ: number = Infinity): GroundQuery3D {
        const { tx, ty } = this.worldToTile(wx, wy);
        
        let bestResult: GroundQuery3D = {
            z: 0,
            walkable: false,
            layer: -1,
            tile: null,
        };
        
        // Check all layers from top to bottom
        const sortedLayers = this.getAllLayers().reverse();
        
        for (const layer of sortedLayers) {
            const tile = layer.tiles[ty]?.[tx];
            if (!tile) continue;
            
            // Skip tiles above our query height
            if (tile.zTop > fromZ) continue;
            
            // Found a surface at or below query height
            if (tile.walkable && tile.zTop > bestResult.z) {
                bestResult = {
                    z: tile.zTop,
                    walkable: true,
                    layer: layer.zLevel,
                    tile,
                };
            }
        }
        
        return bestResult;
    }
    
    /**
     * Get the ceiling height at a world position.
     * Returns the lowest solid surface above the given Z.
     */
    getCeilingAt(wx: number, wy: number, fromZ: number): number {
        const { tx, ty } = this.worldToTile(wx, wy);
        
        let ceilingZ = Infinity;
        
        for (const layer of this.layers.values()) {
            const tile = layer.tiles[ty]?.[tx];
            if (!tile) continue;
            
            // Check if this tile's bottom is above our query and blocks passage
            if (tile.solid && tile.zBase > fromZ && tile.zBase < ceilingZ) {
                ceilingZ = tile.zBase;
            }
        }
        
        return ceilingZ;
    }
    
    /**
     * Get the clearance (vertical space) at a position.
     */
    getClearanceAt(wx: number, wy: number, atZ: number): number {
        return this.getCeilingAt(wx, wy, atZ) - atZ;
    }
    
    /**
     * Check if a position is walkable.
     */
    isWalkable(wx: number, wy: number, atZ: number, tolerance: number = 0.5): boolean {
        const ground = this.getGroundAt(wx, wy, atZ + tolerance);
        return ground.walkable && Math.abs(ground.z - atZ) < tolerance;
    }
    
    // ─────────────────────────────────────────────────────────
    // Movement Queries
    // ─────────────────────────────────────────────────────────
    
    /**
     * Check if movement between two positions is valid.
     */
    canMove(
        fromWx: number, fromWy: number, fromZ: number,
        toWx: number, toWy: number,
        entityHeight: number = 1.8
    ): MovementQuery3D {
        // Get ground at destination
        const destGround = this.getGroundAt(toWx, toWy, fromZ + MAX_STEP_HEIGHT);
        
        if (!destGround.walkable) {
            return {
                canMove: false,
                groundZ: fromZ,
                blocked: true,
                stepUp: false,
                stepDown: false,
                stepHeight: 0,
            };
        }
        
        const stepHeight = destGround.z - fromZ;
        const isStepUp = stepHeight > 0.1;
        const isStepDown = stepHeight < -0.1;
        
        // Check if step is too high
        if (stepHeight > MAX_STEP_HEIGHT) {
            return {
                canMove: false,
                groundZ: fromZ,
                blocked: true,
                stepUp: true,
                stepDown: false,
                stepHeight,
            };
        }
        
        // Check for ceiling clearance at destination
        const ceiling = this.getCeilingAt(toWx, toWy, destGround.z);
        if (ceiling - destGround.z < entityHeight) {
            return {
                canMove: false,
                groundZ: destGround.z,
                blocked: true,
                stepUp: isStepUp,
                stepDown: isStepDown,
                stepHeight,
            };
        }
        
        return {
            canMove: true,
            groundZ: destGround.z,
            blocked: false,
            stepUp: isStepUp,
            stepDown: isStepDown,
            stepHeight,
        };
    }
    
    /**
     * Get a corrected position that snaps to ground.
     */
    snapToGround(wx: number, wy: number, fromZ: number): Vector3D {
        const ground = this.getGroundAt(wx, wy, fromZ + MAX_STEP_HEIGHT);
        return v3(wx, wy, ground.z);
    }
    
    // ─────────────────────────────────────────────────────────
    // Vertical Transitions
    // ─────────────────────────────────────────────────────────
    
    /**
     * Add a vertical transition (stairs, elevator, etc.).
     */
    addTransition(transition: VerticalTransition): void {
        this.transitions.push(transition);
    }
    
    /**
     * Get all transitions at a tile position.
     */
    getTransitionsAt(tx: number, ty: number, layer: number): VerticalTransition[] {
        return this.transitions.filter(t =>
            (t.fromTx === tx && t.fromTy === ty && t.fromLayer === layer) ||
            (t.bidirectional && t.toTx === tx && t.toTy === ty && t.toLayer === layer)
        );
    }
    
    /**
     * Check if a transition is available at a position.
     */
    hasTransitionAt(tx: number, ty: number, layer: number, direction: "UP" | "DOWN"): boolean {
        return this.transitions.some(t => {
            if (t.fromTx === tx && t.fromTy === ty && t.fromLayer === layer) {
                return direction === "UP" ? t.toLayer > t.fromLayer : t.toLayer < t.fromLayer;
            }
            if (t.bidirectional && t.toTx === tx && t.toTy === ty && t.toLayer === layer) {
                return direction === "UP" ? t.fromLayer > t.toLayer : t.fromLayer < t.toLayer;
            }
            return false;
        });
    }
    
    // ─────────────────────────────────────────────────────────
    // Collision Detection
    // ─────────────────────────────────────────────────────────
    
    /**
     * Get solid tiles that intersect with a 3D bounding box.
     */
    getSolidTilesInBounds(bounds: BoundingBox3D): Tile3D[] {
        const results: Tile3D[] = [];
        
        const minTx = Math.floor(bounds.min.x / this.config.tileSize);
        const maxTx = Math.floor(bounds.max.x / this.config.tileSize);
        const minTy = Math.floor(bounds.min.y / this.config.tileSize);
        const maxTy = Math.floor(bounds.max.y / this.config.tileSize);
        
        for (const layer of this.layers.values()) {
            // Skip layers that don't overlap in Z
            const layerZMin = layer.zBase;
            const layerZMax = layer.zBase + layer.zHeight;
            
            if (bounds.max.z < layerZMin || bounds.min.z > layerZMax) {
                continue;
            }
            
            for (let ty = minTy; ty <= maxTy; ty++) {
                for (let tx = minTx; tx <= maxTx; tx++) {
                    const tile = layer.tiles[ty]?.[tx];
                    if (tile && tile.solid) {
                        // Check Z overlap
                        if (bounds.min.z < tile.zTop && bounds.max.z > tile.zBase) {
                            results.push(tile);
                        }
                    }
                }
            }
        }
        
        return results;
    }
    
    /**
     * Get the bounding box for a tile.
     */
    getTileBounds(tx: number, ty: number, tile: Tile3D): BoundingBox3D {
        const wx = tx * this.config.tileSize;
        const wy = ty * this.config.tileSize;
        
        return bb3(
            v3(wx, wy, tile.zBase),
            v3(wx + this.config.tileSize, wy + this.config.tileSize, tile.zTop)
        );
    }
    
    // ─────────────────────────────────────────────────────────
    // Visibility
    // ─────────────────────────────────────────────────────────
    
    /**
     * Get tiles visible from a camera position.
     * Returns tiles in render order (back to front).
     */
    getVisibleTiles(
        cameraX: number,
        cameraY: number,
        cameraZ: number,
        viewRange: number
    ): { tx: number; ty: number; tile: Tile3D; layer: number }[] {
        const results: { tx: number; ty: number; tile: Tile3D; layer: number }[] = [];
        
        const { tx: centerTx, ty: centerTy } = this.worldToTile(cameraX, cameraY);
        const tileRange = Math.ceil(viewRange / this.config.tileSize);
        
        for (const layer of this.getAllLayers()) {
            for (let dy = -tileRange; dy <= tileRange; dy++) {
                for (let dx = -tileRange; dx <= tileRange; dx++) {
                    const tx = centerTx + dx;
                    const ty = centerTy + dy;
                    
                    const tile = layer.tiles[ty]?.[tx];
                    if (tile && tile.visible) {
                        results.push({ tx, ty, tile, layer: layer.zLevel });
                    }
                }
            }
        }
        
        // Sort by depth (isometric back-to-front)
        results.sort((a, b) => {
            // First by layer (lower layers first)
            if (a.layer !== b.layer) return a.layer - b.layer;
            // Then by isometric depth (back to front)
            return (a.tx + a.ty) - (b.tx + b.ty);
        });
        
        return results;
    }
    
    // ─────────────────────────────────────────────────────────
    // Debug / Serialization
    // ─────────────────────────────────────────────────────────
    
    /**
     * Get debug info for the map.
     */
    getDebugInfo(): {
        layerCount: number;
        minLayer: number;
        maxLayer: number;
        width: number;
        height: number;
        transitionCount: number;
    } {
        return {
            layerCount: this.layers.size,
            minLayer: this.minLayer,
            maxLayer: this.maxLayer,
            width: this.width,
            height: this.height,
            transitionCount: this.transitions.length,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * Create an empty Tile3D.
 */
export function createEmptyTile3D(zLevel: number, layerHeight: number): Tile3D {
    const zBase = zLevel * layerHeight;
    
    return {
        kind: "VOID",
        h: zLevel,
        zBase,
        zTop: zBase,
        zCeiling: Infinity,
        walkable: false,
        solid: false,
        visible: false,
        transparent: true,
        allowsUp: false,
        allowsDown: false,
        originalTile: { kind: "VOID", h: zLevel },
    };
}

/**
 * Convert an existing IsoTile to Tile3D.
 */
export function isoTileToTile3D(
    tile: IsoTile,
    layerHeight: number,
    tileHeight: number = 1
): Tile3D {
    const zBase = tile.h * layerHeight;
    const zTop = zBase + tileHeight;
    
    const isWalkable = tile.kind === "FLOOR" || tile.kind === "SPAWN" || tile.kind === "GOAL" || tile.kind === "STAIRS";
    const isSolid = tile.kind !== "VOID";
    const isVisible = tile.kind !== "VOID";
    
    return {
        kind: tile.kind,
        h: tile.h,
        zBase,
        zTop: isWalkable ? zTop : zBase,
        zCeiling: Infinity,
        walkable: isWalkable,
        solid: isSolid,
        visible: isVisible,
        transparent: tile.kind === "VOID",
        allowsUp: tile.kind === "STAIRS",
        allowsDown: tile.kind === "STAIRS",
        originalTile: tile,
    };
}

/**
 * Create a LayeredTileMap3D from an existing TableMapDef.
 * This converts the current 2D map format to the new 3D layered format.
 */
export function createLayeredMapFromTable(
    mapDef: TableMapDef,
    config: Partial<LayeredMap3DConfig> = {}
): LayeredTileMap3D {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const map = new LayeredTileMap3D(fullConfig);
    
    // Group tiles by height level
    const tilesByLevel = new Map<number, { tx: number; ty: number; tile: IsoTile }[]>();
    
    // Parse the map definition using the cells array (sparse format)
    const { cells, w, h } = mapDef;

    const tileFromCell = (cell: TableMapCell): IsoTile => {
        const type = (cell.type ?? "floor").toLowerCase();
        const heightLevel = cell.z ?? 0;
        switch (type) {
            case "spawn":
                return { kind: "SPAWN", h: heightLevel };
            case "goal":
                return { kind: "GOAL", h: heightLevel };
            case "stairs":
                return { kind: "STAIRS", h: heightLevel, dir: cell.dir as any };
            case "water":
            case "ocean":
                return { kind: "OCEAN", h: heightLevel };
            case "void":
                return { kind: "VOID", h: 0 };
            case "wall":
                return { kind: "VOID", h: heightLevel };
            case "floor":
            default:
                return { kind: "FLOOR", h: heightLevel };
        }
    };

    for (const cell of cells) {
        const tile = tileFromCell(cell);
        const heightLevel = cell.z ?? 0;

        if (!tilesByLevel.has(heightLevel)) {
            tilesByLevel.set(heightLevel, []);
        }
        tilesByLevel.get(heightLevel)!.push({ tx: cell.x, ty: cell.y, tile });
    }
    
    // Create layers for each height level
    for (const [level, tiles] of tilesByLevel) {
        const layer = createLayer(level, w, h, fullConfig, tiles);
        map.addLayer(layer);
    }
    
    return map;
}

/**
 * Create a single layer from tiles.
 */
function createLayer(
    zLevel: number,
    width: number,
    height: number,
    config: LayeredMap3DConfig,
    tileData: { tx: number; ty: number; tile: IsoTile }[]
): TileLayer3D {
    const tiles: Tile3D[][] = [];
    
    // Initialize with empty tiles
    for (let ty = 0; ty < height; ty++) {
        tiles[ty] = [];
        for (let tx = 0; tx < width; tx++) {
            tiles[ty][tx] = createEmptyTile3D(zLevel, config.layerHeight);
        }
    }
    
    // Fill in actual tiles
    for (const { tx, ty, tile } of tileData) {
        if (ty >= 0 && ty < height && tx >= 0 && tx < width) {
            tiles[ty][tx] = isoTileToTile3D(tile, config.layerHeight);
        }
    }
    
    return {
        id: `layer_${zLevel}`,
        zLevel,
        zBase: zLevel * config.layerHeight,
        zHeight: config.layerHeight,
        tiles,
        width,
        height,
    };
}

/**
 * Structured tiles only (legacy token pipeline removed).
 */
// ─────────────────────────────────────────────────────────────
// Global Active Map (for backward compatibility)
// ─────────────────────────────────────────────────────────────

let _activeMap3D: LayeredTileMap3D | null = null;

/**
 * Get the currently active 3D layered map.
 */
export function getActiveLayeredMap(): LayeredTileMap3D | null {
    return _activeMap3D;
}

/**
 * Set the active 3D layered map.
 */
export function setActiveLayeredMap(map: LayeredTileMap3D): void {
    _activeMap3D = map;
}
