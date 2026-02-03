// src/game/map/proceduralMap.ts
//
// Procedural Map Generation System
// Generates challenging layouts with a linear progression of rooms connected
// by passages (same level) or ramps/stairs (height changes).
//
// Height Model:
// - Flat blocks have height BLOCK_HEIGHT units (currently 2)
// - Each ramp provides RAMP_HEIGHT unit (currently 1)
// - Therefore, RAMPS_PER_LEVEL (2) consecutive ramps are needed to climb one floor level
//
// Room Progression:
// - Maps consist of 8+ rooms arranged in a path from spawn to goal
// - Each room can be at a different height level
// - Rooms are connected by:
//   - Passages: narrow corridors at the same height
//   - Ramps/Stairs: inclined tiles to transition between height levels
//
// Tile assets (isometric view, viewer from south):
// - landscape_28 (flat floor, default)
// - landscape_30 (flat floor, spawn marker visual)
// - landscape_13 (flat floor, cosmetic variation)
// - landscape_16 (ramp: North up to South - walking N->S goes up)
// - landscape_19 (ramp: West up to East - walking W->E goes up)
// - landscape_20 (ramp: South up to North - walking S->N goes up)
// - landscape_23 (ramp: East up to West - walking E->W goes up)

import { RNG } from "../util/rng";
import type { TableMapDef, TableMapCell } from "./tableMapTypes";

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

export type FloorDifficulty = "EASY" | "MEDIUM" | "HARD" | "BOSS";
function oppositeDir(d: Dir): Dir {
    switch (d) {
        case "N": return "S";
        case "S": return "N";
        case "E": return "W";
        case "W": return "E";
    }
}
export type ProceduralMapConfig = {
    seed: number;
    floorIndex: number;            // 0-based floor number
    difficulty: FloorDifficulty;
    
    // Map size (in tiles)
    width: number;
    height: number;
    
    // Gameplay parameters
    minPathLength: number;         // Minimum path tiles from spawn to goal
    numPlatforms: number;          // Number of elevated platforms
    maxHeight: number;             // Maximum platform height level
    
    // Challenge modifiers
    narrowPassageChance: number;   // 0-1, chance of narrow corridors
    pitDensity: number;            // 0-1, density of void/pit tiles
    rampComplexity: number;        // 0-1, how winding ramps are
};

// Sensible defaults for ~2 min objective + 30s boss
export const DEFAULT_CONFIGS: Record<FloorDifficulty, Omit<ProceduralMapConfig, "seed" | "floorIndex">> = {
    EASY: {
        difficulty: "EASY",
        width: 112,
        height: 112,
        minPathLength: 200,
        numPlatforms: 40,      // 40 rooms
        maxHeight: 3,          // Max 3 levels up
        narrowPassageChance: 0.3,
        pitDensity: 0.02,
        rampComplexity: 0.3,
    },
    MEDIUM: {
        difficulty: "MEDIUM",
        width: 136,
        height: 136,
        minPathLength: 300,
        numPlatforms: 50,      // 50 rooms
        maxHeight: 4,          // Max 4 levels up
        narrowPassageChance: 0.4,
        pitDensity: 0.05,
        rampComplexity: 0.5,
    },
    HARD: {
        difficulty: "HARD",
        width: 160,
        height: 160,
        minPathLength: 400,
        numPlatforms: 60,     // 60 rooms
        maxHeight: 5,         // Max 5 levels up
        narrowPassageChance: 0.5,
        pitDensity: 0.08,
        rampComplexity: 0.7,
    },
    BOSS: {
        difficulty: "BOSS",
        width: 64,
        height: 64,
        minPathLength: 100,
        numPlatforms: 15,     // 15 rooms for boss arena
        maxHeight: 2,
        narrowPassageChance: 0.1,
        pitDensity: 0.01,
        rampComplexity: 0.2,
    },
};

// ─────────────────────────────────────────────────────────────
// Height Constants
// ─────────────────────────────────────────────────────────────
// In this game:
// - Flat blocks have height BLOCK_HEIGHT units
// - Each ramp provides RAMP_HEIGHT unit
// - Therefore, RAMPS_PER_LEVEL consecutive ramps are needed to climb one floor level
export const BLOCK_HEIGHT = 2;
export const RAMP_HEIGHT = 1;
export const RAMPS_PER_LEVEL = BLOCK_HEIGHT / RAMP_HEIGHT; // = 2

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Vec2 = { x: number; y: number };

// Cardinal directions for ramps (describes the "uphill" direction)
// N = walking North goes uphill, S = walking South goes uphill, etc.
type Dir = "N" | "S" | "E" | "W";

type TileData = {
    kind: "VOID" | "FLOOR" | "STAIRS" | "SPAWN" | "GOAL";
    h: number;      // Height in ramp units (multiples of RAMP_HEIGHT)
    level?: number; // Floor level (0, 1, 2...) - only for FLOOR tiles
    dir?: Dir;
    skin?: string;
};

// A Room is a platform/arena in the dungeon
type Room = {
    id: number;
    cx: number;         // Center X in tile coords
    cy: number;         // Center Y in tile coords
    width: number;      // Room width in tiles
    height: number;     // Room height in tiles
    level: number;      // Floor level (0, 1, 2...) - actual height = level * BLOCK_HEIGHT
    difficulty: "EASY" | "MEDIUM" | "HARD";
    shape: "RECT" | "CIRCLE" | "IRREGULAR";
};

// Connection types between rooms
type ConnectionType = "PASSAGE" | "RAMP";

type RoomConnection = {
    fromRoom: number;   // Room ID
    toRoom: number;     // Room ID
    type: ConnectionType;
    fromPos: Vec2;      // Exit point from source room
    toPos: Vec2;        // Entry point to target room
};

type PathSegment = {
    from: Vec2;
    to: Vec2;
    fromLevel: number;  // Floor level at start
    toLevel: number;    // Floor level at end
};

// ─────────────────────────────────────────────────────────────
// Floor Skins (cosmetic variety)
// ─────────────────────────────────────────────────────────────

const FLOOR_SKINS = ["edges_landscape_28", "edges_landscape_13"];
const SPAWN_SKIN = "edges_landscape_30";

// ─────────────────────────────────────────────────────────────
// Main Generator
// ─────────────────────────────────────────────────────────────
//
export function generateProceduralMap(config: ProceduralMapConfig): TableMapDef {
    const rng = new RNG(42069);
    const { width, height } = config;
    
    // Initialize grid with VOID
    const grid: TileData[][] = [];
    for (let y = 0; y < height; y++) {
        grid[y] = [];
        for (let x = 0; x < width; x++) {
            grid[y][x] = { kind: "VOID", h: 0 };
        }
    }
    
    // 1. Generate rooms in a linear progression path
    const rooms = generateRoomPath(rng, config);
    
    // 2. Carve rooms into grid
    for (const room of rooms) {
        carveRoom(grid, room, rng);
    }
    
    // 3. Connect rooms with passages or ramps
    const connections = connectRooms(grid, rooms, rng, config);
    
    // 4. Place spawn in first room
    const spawnRoom = rooms[0];
    const spawn = { x: spawnRoom.cx, y: spawnRoom.cy };
    grid[spawn.y][spawn.x] = { 
        kind: "SPAWN", 
        h: spawnRoom.level * BLOCK_HEIGHT, 
        level: spawnRoom.level, 
        skin: SPAWN_SKIN 
    };
    
    // 5. Place goal in last room
    const goalRoom = rooms[rooms.length - 1];
    const goal = { x: goalRoom.cx, y: goalRoom.cy };
    grid[goal.y][goal.x] = { 
        kind: "GOAL", 
        h: goalRoom.level * BLOCK_HEIGHT, 
        level: goalRoom.level, 
        skin: SPAWN_SKIN 
    };
    
    // 6. Add challenge elements (pits, decorations)
    addChallenges(grid, rng, config, spawn, goal);
    
    // 7. Polish: fill small gaps, smooth edges
    polishMap(grid, rng);
    
    // 8. Convert to TableMapDef format
    return gridToTableMapDef(grid, config);
}

// ─────────────────────────────────────────────────────────────
// Room Generation - Linear Path Layout
// ─────────────────────────────────────────────────────────────

/**
 * Generate rooms arranged in a winding path from spawn to goal.
 * Rooms alternate between same-level (connected by passages) and 
 * different levels (connected by ramps).
 * Ensures rooms do not overlap with each other.
 */
function generateRoomPath(rng: RNG, config: ProceduralMapConfig): Room[] {
    const { width, height, numPlatforms, maxHeight } = config;
    const rooms: Room[] = [];
    
    // Room size ranges
    const minRoomSize = 6;
    const maxRoomSize = 12;
    
    // Margins from map edges
    const margin = 6;
    
    // Minimum gap between rooms (for corridors/ramps)
    const minRoomGap = 4;
    
    let currentLevel = 0;
    
    /**
     * Check if a proposed room overlaps with any existing room.
     */
    function roomOverlaps(newRoom: { cx: number; cy: number; width: number; height: number }): boolean {
        const newLeft = newRoom.cx - Math.floor(newRoom.width / 2) - minRoomGap;
        const newRight = newRoom.cx + Math.floor(newRoom.width / 2) + minRoomGap;
        const newTop = newRoom.cy - Math.floor(newRoom.height / 2) - minRoomGap;
        const newBottom = newRoom.cy + Math.floor(newRoom.height / 2) + minRoomGap;
        
        for (const existing of rooms) {
            const existLeft = existing.cx - Math.floor(existing.width / 2);
            const existRight = existing.cx + Math.floor(existing.width / 2);
            const existTop = existing.cy - Math.floor(existing.height / 2);
            const existBottom = existing.cy + Math.floor(existing.height / 2);
            
            // Check for overlap (with gap)
            if (newLeft < existRight && newRight > existLeft &&
                newTop < existBottom && newBottom > existTop) {
                return true;
            }
        }
        return false;
    }
    
    for (let i = 0; i < numPlatforms; i++) {
        const roomWidth = rng.int(minRoomSize, maxRoomSize);
        const roomHeight = rng.int(minRoomSize, maxRoomSize);
        
        // Determine room difficulty based on position in path
        let difficulty: Room["difficulty"];
        if (i < numPlatforms * 0.3) {
            difficulty = "EASY";
        } else if (i < numPlatforms * 0.7) {
            difficulty = "MEDIUM";
        } else {
            difficulty = "HARD";
        }
        
        // Decide if this room changes height
        const shouldChangeLevel = i > 0 && rng.next() < 0.4;
        if (shouldChangeLevel) {
            // Randomly go up or down, but clamp to valid range
            const direction = rng.next() < 0.7 ? 1 : -1; // Bias toward going up
            const newLevel = Math.max(0, Math.min(maxHeight, currentLevel + direction));
            currentLevel = newLevel;
        }
        
        // Try to place room without overlapping
        let placed = false;
        let attempts = 0;
        const maxAttempts = 50;
        
        while (!placed && attempts < maxAttempts) {
            attempts++;
            
            let cx: number;
            let cy: number;
            
            if (rooms.length === 0) {
                // First room: place in bottom-left quadrant
                cx = margin + roomWidth/2 + rng.int(0, width/4);
                cy = height - margin - roomHeight/2 - rng.int(0, height/4);
            } else {
                // Subsequent rooms: place near the last successfully placed room
                const prevRoom = rooms[rooms.length - 1];
                const angle = rng.next() * Math.PI * 2; // Random direction
                const distance = rng.int(minRoomSize + maxRoomSize, minRoomSize + maxRoomSize + 10);
                
                cx = prevRoom.cx + Math.cos(angle) * distance;
                cy = prevRoom.cy + Math.sin(angle) * distance;
            }
            
            // Clamp to map bounds
            cx = Math.max(margin + roomWidth/2, Math.min(width - margin - roomWidth/2, cx));
            cy = Math.max(margin + roomHeight/2, Math.min(height - margin - roomHeight/2, cy));
            
            cx = Math.floor(cx);
            cy = Math.floor(cy);
            
            const proposedRoom = { cx, cy, width: roomWidth, height: roomHeight };
            
            if (!roomOverlaps(proposedRoom)) {
                const room: Room = {
                    id: i,
                    cx,
                    cy,
                    width: roomWidth,
                    height: roomHeight,
                    level: currentLevel,
                    difficulty,
                    shape: rng.pick(["RECT", "RECT", "CIRCLE", "IRREGULAR"]),
                };
                rooms.push(room);
                placed = true;
            }
        }
        
        // If we couldn't place the room after many attempts, try a fallback position
        if (!placed) {
            // Grid-based fallback: find an empty spot
            for (let gy = margin + roomHeight/2; gy < height - margin - roomHeight/2 && !placed; gy += maxRoomSize + minRoomGap) {
                for (let gx = margin + roomWidth/2; gx < width - margin - roomWidth/2 && !placed; gx += maxRoomSize + minRoomGap) {
                    const proposedRoom = { cx: Math.floor(gx), cy: Math.floor(gy), width: roomWidth, height: roomHeight };
                    if (!roomOverlaps(proposedRoom)) {
                        const room: Room = {
                            id: i,
                            cx: Math.floor(gx),
                            cy: Math.floor(gy),
                            width: roomWidth,
                            height: roomHeight,
                            level: currentLevel,
                            difficulty,
                            shape: rng.pick(["RECT", "RECT", "CIRCLE", "IRREGULAR"]),
                        };
                        rooms.push(room);
                        placed = true;
                    }
                }
            }
        }
    }
    
    return rooms;
}

// ─────────────────────────────────────────────────────────────
// Room Carving
// ─────────────────────────────────────────────────────────────

function carveRoom(
    grid: TileData[][],
    room: Room,
    rng: RNG
): void {
    const { cx, cy, width: rw, height: rh, level, shape } = room;
    const w = grid[0].length;
    const h = grid.length;
    
    const skin = rng.pick(FLOOR_SKINS);
    const actualHeight = level * BLOCK_HEIGHT;
    
    const halfW = Math.floor(rw / 2);
    const halfH = Math.floor(rh / 2);
    
    for (let dy = -halfH; dy <= halfH; dy++) {
        for (let dx = -halfW; dx <= halfW; dx++) {
            const x = cx + dx;
            const y = cy + dy;
            
            if (x < 0 || x >= w || y < 0 || y >= h) continue;
            
            let inRoom = false;
            
            switch (shape) {
                case "RECT":
                    inRoom = true;
                    break;
                case "CIRCLE":
                    inRoom = (dx*dx)/(halfW*halfW) + (dy*dy)/(halfH*halfH) <= 1;
                    break;
                case "IRREGULAR":
                    // Rectangle with some noise
                    const noise = Math.sin(dx * 0.8) * Math.cos(dy * 0.8) * 1.5;
                    inRoom = Math.abs(dx) <= halfW + noise && Math.abs(dy) <= halfH + noise;
                    break;
            }
            
            if (inRoom && grid[y][x].kind === "VOID") {
                grid[y][x] = { kind: "FLOOR", h: actualHeight, level, skin };
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Room Connections
// ─────────────────────────────────────────────────────────────

/**
 * Connect consecutive rooms with either passages or ramps.
 */
function connectRooms(
    grid: TileData[][],
    rooms: Room[],
    rng: RNG,
    config: ProceduralMapConfig
): RoomConnection[] {
    const connections: RoomConnection[] = [];
    
    for (let i = 0; i < rooms.length - 1; i++) {
        const fromRoom = rooms[i];
        const toRoom = rooms[i + 1];
        
        const levelDiff = toRoom.level - fromRoom.level;
        
        if (levelDiff === 0) {
            // Same level - create a passage
            createPassage(grid, fromRoom, toRoom, rng, config);
            connections.push({
                fromRoom: fromRoom.id,
                toRoom: toRoom.id,
                type: "PASSAGE",
                fromPos: { x: fromRoom.cx, y: fromRoom.cy },
                toPos: { x: toRoom.cx, y: toRoom.cy },
            });
        } else {
            // Different levels - create ramps
            createRampConnection(grid, fromRoom, toRoom, rng);
            connections.push({
                fromRoom: fromRoom.id,
                toRoom: toRoom.id,
                type: "RAMP",
                fromPos: { x: fromRoom.cx, y: fromRoom.cy },
                toPos: { x: toRoom.cx, y: toRoom.cy },
            });
        }
    }
    
    return connections;
}

/**
 * Create a passage (corridor) between two rooms at the same level.
 */
function createPassage(
    grid: TileData[][],
    fromRoom: Room,
    toRoom: Room,
    rng: RNG,
    config: ProceduralMapConfig
): void {
    const w = grid[0].length;
    const h = grid.length;
    
    // Passage width: narrow or regular
    const passageWidth = rng.next() < config.narrowPassageChance ? 1 : rng.int(2, 3);
    const skin = rng.pick(FLOOR_SKINS);
    const level = fromRoom.level;
    const actualHeight = level * BLOCK_HEIGHT;
    
    // Use L-shaped corridor
    const goHorizFirst = rng.next() < 0.5;
    
    const x0 = fromRoom.cx;
    const y0 = fromRoom.cy;
    const x1 = toRoom.cx;
    const y1 = toRoom.cy;
    
    if (goHorizFirst) {
        // Horizontal then vertical
        carveLineCorridor(grid, x0, y0, x1, y0, passageWidth, actualHeight, level, skin);
        carveLineCorridor(grid, x1, y0, x1, y1, passageWidth, actualHeight, level, skin);
    } else {
        // Vertical then horizontal
        carveLineCorridor(grid, x0, y0, x0, y1, passageWidth, actualHeight, level, skin);
        carveLineCorridor(grid, x0, y1, x1, y1, passageWidth, actualHeight, level, skin);
    }
}

/**
 * Create a ramp connection between two rooms at different levels.
 * 
 * Height Model:
 * - Each floor level has height = level * BLOCK_HEIGHT
 * - BLOCK_HEIGHT = 2, RAMP_HEIGHT = 1, so RAMPS_PER_LEVEL = 2
 * - To go from level 0 (h=0) to level 1 (h=2), we need 2 ramps:
 *   - Floor tile at h=0 (level 0 surface)
 *   - Ramp 1: placed at h=1, transitions from h=0 to h=1
 *   - Ramp 2: placed at h=2, transitions from h=1 to h=2
 *   - Floor tile at h=2 (level 1 surface)
 * 
 * The ramp heights are (lowerHeight + 1) through (higherHeight),
 * giving exactly levelDiff * RAMPS_PER_LEVEL consecutive ramps.
 */
function createRampConnection(
    grid: TileData[][],
    fromRoom: Room,
    toRoom: Room,
    rng: RNG
): void {
    const w = grid[0].length;
    const h = grid.length;
    
    const fromLevel = fromRoom.level;
    const toLevel = toRoom.level;
    const levelDiff = Math.abs(toLevel - fromLevel);
    const goingUp = toLevel > fromLevel;
    
    // Calculate number of ramps needed
    // Each level difference requires RAMPS_PER_LEVEL (2) ramp tiles
    // Level 0 (h=0) to Level 1 (h=2) needs ramps at h=1 and h=2
    const rampsNeeded = levelDiff * RAMPS_PER_LEVEL;
    
    const skin = rng.pick(FLOOR_SKINS);
    
    // Determine which room is lower and which is higher
    const lowerRoom = goingUp ? fromRoom : toRoom;
    const higherRoom = goingUp ? toRoom : fromRoom;
    
    // Determine direction from lower room to higher room
    const dx = higherRoom.cx - lowerRoom.cx;
    const dy = higherRoom.cy - lowerRoom.cy;
    
    // Choose primary direction based on larger delta
    // The ramp direction indicates which way is "uphill"
    let rampDir: Dir;
    let stepX: number;
    let stepY: number;
    
    if (Math.abs(dx) >= Math.abs(dy)) {
        // Horizontal ramp - going East or West
        if (dx > 0) {
            rampDir = "E";  // Walking East goes uphill
            stepX = 1;
            stepY = 0;
        } else {
            rampDir = "W";  // Walking West goes uphill
            stepX = -1;
            stepY = 0;
        }
    } else {
        // Vertical ramp - going North or South
        if (dy > 0) {
            rampDir = "S";  // Walking South goes uphill
            stepX = 0;
            stepY = 1;
        } else {
            rampDir = "N";  // Walking North goes uphill
            stepX = 0;
            stepY = -1;
        }
    }
    // push
    // Find a suitable starting point for the ramp
    // Start from the edge of the lower room, toward the higher room
    let startX = lowerRoom.cx;
    let startY = lowerRoom.cy;
    
    // Move to edge of lower room in direction of higher room
    const toHigherDx = Math.sign(higherRoom.cx - lowerRoom.cx);
    const toHigherDy = Math.sign(higherRoom.cy - lowerRoom.cy);
    
    if (toHigherDx !== 0) {
        startX += toHigherDx * Math.floor(lowerRoom.width / 2);
    }
    if (toHigherDy !== 0) {
        startY += toHigherDy * Math.floor(lowerRoom.height / 2);
    }
    
    // The lower room's floor height
    const lowerHeight = lowerRoom.level * BLOCK_HEIGHT;
    const lowerLevel = lowerRoom.level;
    
    // Create lead-in corridor at lower level (from room center to ramp start)
    carveLineCorridor(grid, lowerRoom.cx, lowerRoom.cy, startX, startY, 2, lowerHeight, lowerLevel, skin);
    
    // Place the ramps sequentially
    // Each ramp starts at height (lowerHeight + i) and provides +1 height
    let rampX = startX;
    let rampY = startY;
    
    for (let i = 0; i < rampsNeeded; i++) {
        // Move one step in ramp direction
        rampX += stepX;
        rampY += stepY;
        
        if (rampX < 0 || rampX >= w || rampY < 0 || rampY >= h) break;
        
        // Calculate height for this ramp tile
        // Ramp i sits at height (lowerHeight + 1 + i) - first ramp is one above floor level
        const rampHeight = lowerHeight + 1 + i;

        // Place the ramp tile
        grid[rampY][rampX] = {
            kind: "STAIRS",
            h: rampHeight,
            dir: oppositeDir(rampDir),
            skin: getRampSkin(oppositeDir(rampDir)),
        };
        
        // Also carve adjacent tiles for width (make ramp 3 tiles wide)
        for (let offset = -1; offset <= 1; offset++) {
            const adjX = rampX + (stepY !== 0 ? offset : 0);
            const adjY = rampY + (stepX !== 0 ? offset : 0);
            if (adjX >= 0 && adjX < w && adjY >= 0 && adjY < h) {
                if (grid[adjY][adjX].kind === "VOID") {
                    grid[adjY][adjX] = {
                        kind: "STAIRS",
                        h: rampHeight,
                        dir: oppositeDir(rampDir),
                        skin: getRampSkin(oppositeDir(rampDir)),
                    };
                }
            }
        }
    }
    
    // After all ramps, we should be at the higher room's level
    // Create lead-out corridor from ramp end to higher room
    const endX = rampX + stepX;
    const endY = rampY + stepY;
    const higherHeight = higherRoom.level * BLOCK_HEIGHT;
    const higherLevel = higherRoom.level;
    
    carveLineCorridor(grid, endX, endY, higherRoom.cx, higherRoom.cy, 2, higherHeight, higherLevel, skin);
}

function carveLineCorridor(
    grid: TileData[][],
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    width: number,
    height: number,
    level: number,
    skin: string
): void {
    const w = grid[0].length;
    const h = grid.length;
    
    // Bresenham-like line with thickness
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    let x = x0;
    let y = y0;
    
    while (true) {
        // Carve with width
        for (let wy = -width; wy <= width; wy++) {
            for (let wx = -width; wx <= width; wx++) {
                const tx = x + wx;
                const ty = y + wy;
                if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
                    if (grid[ty][tx].kind === "VOID") {
                        grid[ty][tx] = { kind: "FLOOR", h: height, level, skin };
                    }
                }
            }
        }
        
        if (x === x1 && y === y1) break;
        
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Ramp Skin Helper
// ─────────────────────────────────────────────────────────────

function getRampSkin(dir: Dir): string {
    // Ramp tiles - direction indicates which way is "uphill":
    // - edges_landscape_16: North up to South (walking N->S goes up)
    // - edges_landscape_19: West up to East (walking W->E goes up)  
    // - edges_landscape_20: South up to North (walking S->N goes up)
    // - edges_landscape_23: East up to West (walking E->W goes up)
    switch (dir) {
        case "S": return "edges_landscape_16"; // Going South = going up
        case "E": return "edges_landscape_19"; // Going East = going up
        case "N": return "edges_landscape_20"; // Going North = going up
        case "W": return "edges_landscape_23"; // Going West = going up
    }
}

// ─────────────────────────────────────────────────────────────
// Challenge Elements
// ─────────────────────────────────────────────────────────────

function addChallenges(
    grid: TileData[][],
    rng: RNG,
    config: ProceduralMapConfig,
    spawn: Vec2,
    goal: Vec2
): void {
    const w = grid[0].length;
    const h = grid.length;
    
    // Add pits (void areas) away from critical path
    const numPits = Math.floor(w * h * config.pitDensity * 0.01);
    
    for (let i = 0; i < numPits; i++) {
        const px = rng.int(2, w - 3);
        const py = rng.int(2, h - 3);
        
        // Don't place pits near spawn or goal
        const distToSpawn = Math.hypot(px - spawn.x, py - spawn.y);
        const distToGoal = Math.hypot(px - goal.x, py - goal.y);
        
        if (distToSpawn < 6 || distToGoal < 6) continue;
        
        // Only convert floor tiles to void
        if (grid[py][px].kind === "FLOOR") {
            // Check we're not blocking the only path
            const neighbors = countFloorNeighbors(grid, px, py);
            if (neighbors >= 3) {
                grid[py][px] = { kind: "VOID", h: 0 };
            }
        }
    }
    
    // Add narrow choke points
    if (config.narrowPassageChance > 0) {
        addChokePoints(grid, rng, config, spawn, goal);
    }
}

function countFloorNeighbors(grid: TileData[][], x: number, y: number): number {
    const w = grid[0].length;
    const h = grid.length;
    let count = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                if (grid[ny][nx].kind !== "VOID") count++;
            }
        }
    }
    
    return count;
}

function addChokePoints(
    grid: TileData[][],
    rng: RNG,
    config: ProceduralMapConfig,
    spawn: Vec2,
    goal: Vec2
): void {
    const w = grid[0].length;
    const h = grid.length;
    
    // Find wide corridors and narrow them
    for (let y = 3; y < h - 3; y++) {
        for (let x = 3; x < w - 3; x++) {
            if (grid[y][x].kind !== "FLOOR") continue;
            if (rng.next() > config.narrowPassageChance * 0.1) continue;
            
            // Check if this is a wide area (3+ floor tiles in each direction)
            const isWide = (
                grid[y-1][x].kind !== "VOID" &&
                grid[y+1][x].kind !== "VOID" &&
                grid[y][x-1].kind !== "VOID" &&
                grid[y][x+1].kind !== "VOID" &&
                grid[y-2][x].kind !== "VOID" &&
                grid[y+2][x].kind !== "VOID"
            );
            
            if (!isWide) continue;
            
            // Don't create choke points too close to spawn/goal
            const distToSpawn = Math.hypot(x - spawn.x, y - spawn.y);
            const distToGoal = Math.hypot(x - goal.x, y - goal.y);
            if (distToSpawn < 8 || distToGoal < 8) continue;
            
            // Create a choke by removing side tiles
            if (rng.next() < 0.5) {
                if (grid[y-2][x].kind === "FLOOR") grid[y-2][x] = { kind: "VOID", h: 0 };
                if (grid[y+2][x].kind === "FLOOR") grid[y+2][x] = { kind: "VOID", h: 0 };
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Polish & Cleanup
// ─────────────────────────────────────────────────────────────

function polishMap(grid: TileData[][], rng: RNG): void {
    const w = grid[0].length;
    const h = grid.length;
    
    // Remove isolated single-tile floors
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            if (grid[y][x].kind === "FLOOR") {
                const neighbors = countFloorNeighbors(grid, x, y);
                if (neighbors <= 1) {
                    grid[y][x] = { kind: "VOID", h: 0 };
                }
            }
        }
    }
    
    // Fill small gaps (1-tile voids surrounded by floors)
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            if (grid[y][x].kind === "VOID") {
                const neighbors = countFloorNeighbors(grid, x, y);
                if (neighbors >= 6) {
                    // Get average height of neighbors
                    let sumH = 0;
                    let countH = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx;
                            const ny = y + dy;
                            if (grid[ny][nx].kind !== "VOID") {
                                sumH += grid[ny][nx].h;
                                countH++;
                            }
                        }
                    }
                    const avgH = countH > 0 ? Math.round(sumH / countH) : 0;
                    grid[y][x] = { kind: "FLOOR", h: avgH, skin: rng.pick(FLOOR_SKINS) };
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Export Conversion
// ─────────────────────────────────────────────────────────────

function gridToTableMapDef(grid: TileData[][], config: ProceduralMapConfig): TableMapDef {
    const cells: TableMapCell[] = [];
    const h = grid.length;
    const w = grid[0].length;
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const tile = grid[y][x];
            if (tile.kind === "VOID") continue;
            
            let token: string;
            
            switch (tile.kind) {
                case "SPAWN":
                    token = `P${tile.h}`;
                    break;
                case "GOAL":
                    // Mark goals as G<height> - we'll need to handle this in the loader
                    // For now, use floor with a special marker
                    token = `G${tile.h}`;
                    break;
                case "STAIRS":
                    // Use cardinal directions (N, S, E, W) for uphill direction
                    token = `S${tile.h}${tile.dir || "N"}`;
                    break;
                case "FLOOR":
                default:
                    token = `F${tile.h}`;
                    break;
            }
            
            cells.push({ x, y, t: token });
        }
    }
    
    return {
        id: `PROCEDURAL_F${config.floorIndex}_${config.seed}`,
        w,
        h,
        defaultFloorSkin: "edges_landscape_28",
        defaultSpawnSkin: "edges_landscape_30",
        centerOnZero: true,
        cells,
    };
}

// ─────────────────────────────────────────────────────────────
// High-Level API
// ─────────────────────────────────────────────────────────────

/**
 * Generate a complete floor map with appropriate difficulty scaling.
 * 
 * @param seed - Base RNG seed for the run
 * @param floorIndex - 0-based floor number
 * @param isBoss - Whether this is a boss arena (smaller, simpler)
 */
export function generateFloorMap(
    seed: number,
    floorIndex: number,
    isBoss: boolean = false
): TableMapDef {
    // Determine difficulty based on floor progression
    let difficulty: FloorDifficulty;
    if (isBoss) {
        difficulty = "BOSS";
    } else if (floorIndex === 0) {
        difficulty = "EASY";
    } else if (floorIndex === 1) {
        difficulty = "MEDIUM";
    } else {
        difficulty = "HARD";
    }
    
    const baseConfig = DEFAULT_CONFIGS[difficulty];
    
    const config: ProceduralMapConfig = {
        ...baseConfig,
        seed,
        floorIndex,
    };
    
    return generateProceduralMap(config);
}

/**
 * Get estimated gameplay duration for a generated map.
 */
export function estimateMapDuration(config: ProceduralMapConfig): { objectiveSeconds: number; bossSeconds: number } {
    if (config.difficulty === "BOSS") {
        return { objectiveSeconds: 0, bossSeconds: 30 };
    }
    
    // Base estimate: ~3 seconds per tile of minimum path length
    // Adjusted for combat slowdown and exploration
    const baseTime = config.minPathLength * 3;
    const combatMultiplier = 1.5; // Combat slows progress
    const explorationMultiplier = 1.2; // Players don't take optimal paths
    
    const objectiveSeconds = Math.round(baseTime * combatMultiplier * explorationMultiplier);
    
    return { objectiveSeconds, bossSeconds: 30 };
}
