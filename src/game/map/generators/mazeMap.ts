// src/game/map/mazeMap.ts
//
// Maze-like room graph generator + map compiler.
// Produces a tile map compatible with the Kenney isometric system.

import type { ApronBaseMode, TableMapCell, TableMapDef } from "../formats/table/tableMapTypes";
import type { FloorDifficulty } from "./proceduralMap";

export type RoomType = "start" | "combat" | "puzzle" | "treasure" | "boss" | "shop" | "rest";

export interface Room {
    id: number;
    x: number;
    y: number;
    type: RoomType;
    difficulty: number; // 1..5
    treasure: number;   // 0..3
    locked: boolean;
}

export interface Edge {
    a: number;
    b: number;
    corridor: "main" | "side";
}

export interface RoomGraph {
    rooms: Room[];
    edges: Edge[];
}

export type MazeMapConfig = {
    seed: number;
    width: number;           // number of rooms (x)
    height: number;          // number of rooms (y)
    branchChance: number;    // 0..1 chance of adding side edges
    roomSize: number;        // odd tile size (e.g. 5)
    corridorLength: number;  // tiles between room blocks (e.g. 3)
    corridorWidth: number;   // tiles wide (e.g. 1)
    centerOnZero?: boolean;
    id?: string;
    apronBaseMode?: ApronBaseMode;
};

export const DEFAULT_MAZE_CONFIGS: Record<FloorDifficulty, Omit<MazeMapConfig, "seed" | "id">> = {
    EASY: {
        width: 6,
        height: 6,
        branchChance: 0.12,
        roomSize: 10,
        corridorLength: 3,
        corridorWidth: 1,
        centerOnZero: true,
    },
    MEDIUM: {
        width: 7,
        height: 7,
        branchChance: 0.15,
        roomSize: 10,
        corridorLength: 3,
        corridorWidth: 1,
        centerOnZero: true,
    },
    HARD: {
        width: 8,
        height: 8,
        branchChance: 0.18,
        roomSize: 10,
        corridorLength: 3,
        corridorWidth: 1,
        centerOnZero: true,
    },
    BOSS: {
        width: 4,
        height: 4,
        branchChance: 0.05,
        roomSize: 10,
        corridorLength: 2,
        corridorWidth: 1,
        centerOnZero: true,
    },
};

/** Build a room graph layout for a maze map. */
export function createMazeRoomGraph(
    width: number,
    height: number,
    seed = 42,
    branchChance = 0.1
): RoomGraph {
    const rng = mulberry32(seed);
    const rooms: Room[] = [];
    const edges: Edge[] = [];
    const id = (x: number, y: number) => y * width + x;

    const roomTypes: RoomType[] = ["start", "combat", "puzzle", "treasure", "boss", "shop", "rest"];
    const typeWeights = [0.06, 0.42, 0.18, 0.12, 0.04, 0.10, 0.08];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            rooms.push({
                id: id(x, y),
                x,
                y,
                type: weightedPick(roomTypes, typeWeights, rng),
                difficulty: 1 + Math.floor(rng() * 5),
                treasure: Math.floor(rng() * 4),
                locked: rng() < 0.5,
            });
        }
    }

    const visited = new Set<string>();
    const stack: Array<[number, number]> = [[0, 0]];
    visited.add("0,0");

    const neighbors = (x: number, y: number) => {
        const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        shuffle(dirs, rng);
        return dirs
            .map(([dx, dy]) => [x + dx, y + dy] as [number, number])
            .filter(([nx, ny]) => nx >= 0 && nx < width && ny >= 0 && ny < height);
    };

    while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const unvisited = neighbors(x, y).filter(([nx, ny]) => !visited.has(`${nx},${ny}`));
        if (unvisited.length) {
            const [nx, ny] = unvisited[0];
            visited.add(`${nx},${ny}`);
            stack.push([nx, ny]);
            edges.push({ a: id(x, y), b: id(nx, ny), corridor: "main" });
        } else {
            stack.pop();
        }
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (rng() < branchChance) {
                const opts = neighbors(x, y);
                const [nx, ny] = opts[Math.floor(rng() * opts.length)];
                const a = id(x, y);
                const b = id(nx, ny);
                if (!edges.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))) {
                    edges.push({ a, b, corridor: "side" });
                }
            }
        }
    }

    rooms[id(0, 0)].type = "start";
    rooms[id(width - 1, height - 1)].type = "boss";

    return { rooms, edges };
}

/** Generate a maze map definition and its room graph. */
export function generateMazeMapDef(config: MazeMapConfig): { mapDef: TableMapDef; graph: RoomGraph } {
    const rng = mulberry32(config.seed + 0x9e3779b9);
    const graph = createMazeRoomGraph(config.width, config.height, config.seed, config.branchChance);

    const roomSize = Math.max(3, config.roomSize | 0);
    const corridorLength = Math.max(1, config.corridorLength | 0);
    const corridorWidth = Math.max(1, config.corridorWidth | 0);
    const halfCorridor = Math.floor(corridorWidth / 2);
    const halfRoom = Math.floor(roomSize / 2);
    const stride = roomSize + corridorLength;
    const maxConnectionLength = 20;
    const minRoomGap = 2;
    const maxJitter = Math.max(0, Math.floor((maxConnectionLength - stride) / 2));

    const mapWidth = config.width * roomSize + (config.width - 1) * corridorLength;
    const mapHeight = config.height * roomSize + (config.height - 1) * corridorLength;

    const grid: Array<Array<"VOID" | "FLOOR" | "SPAWN" | "GOAL">> = [];
    for (let y = 0; y < mapHeight; y++) {
        const row: Array<"VOID" | "FLOOR" | "SPAWN" | "GOAL"> = [];
        for (let x = 0; x < mapWidth; x++) row.push("VOID");
        grid.push(row);
    }

    const roomBaseCenter = (rx: number, ry: number) => {
        const cx = rx * stride + halfRoom;
        const cy = ry * stride + halfRoom;
        return { x: cx, y: cy };
    };

    type RoomPos = { x: number; y: number; rx: number; ry: number; w: number; h: number };
    const roomPositions = new Map<number, RoomPos>();

    const rectsOverlap = (a: RoomPos, b: RoomPos) => {
        const aHalfW = Math.floor(a.w / 2);
        const aHalfH = Math.floor(a.h / 2);
        const bHalfW = Math.floor(b.w / 2);
        const bHalfH = Math.floor(b.h / 2);

        const aLeft = a.x - aHalfW;
        const aRight = a.x + aHalfW;
        const aTop = a.y - aHalfH;
        const aBottom = a.y + aHalfH;

        const bLeft = b.x - bHalfW;
        const bRight = b.x + bHalfW;
        const bTop = b.y - bHalfH;
        const bBottom = b.y + bHalfH;

        return !(
            aRight + minRoomGap < bLeft ||
            aLeft - minRoomGap > bRight ||
            aBottom + minRoomGap < bTop ||
            aTop - minRoomGap > bBottom
        );
    };

    const pickRoomDims = () => {
        const min = Math.max(3, roomSize - Math.floor(roomSize * 0.4));
        const max = Math.max(min, roomSize + Math.floor(roomSize * 0.6));
        const w = makeOdd(min + Math.floor(rng() * (max - min + 1)));
        const h = makeOdd(min + Math.floor(rng() * (max - min + 1)));
        return { w, h };
    };

    const placeRoom = (room: Room) => {
        const base = roomBaseCenter(room.x, room.y);
        const { w, h } = pickRoomDims();
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);

        const minX = halfW;
        const minY = halfH;
        const maxX = mapWidth - 1 - halfW;
        const maxY = mapHeight - 1 - halfH;

        const attempts = 24;
        for (let i = 0; i < attempts; i++) {
            const jx = maxJitter > 0 ? Math.floor(rng() * (maxJitter * 2 + 1)) - maxJitter : 0;
            const jy = maxJitter > 0 ? Math.floor(rng() * (maxJitter * 2 + 1)) - maxJitter : 0;

            const cx = Math.max(minX, Math.min(maxX, base.x + jx));
            const cy = Math.max(minY, Math.min(maxY, base.y + jy));

            const candidate: RoomPos = { x: cx, y: cy, rx: room.x, ry: room.y, w, h };

            let ok = true;
            for (const [, placed] of roomPositions) {
                if (rectsOverlap(candidate, placed)) {
                    ok = false;
                    break;
                }
            }

            if (!ok) continue;

            roomPositions.set(room.id, candidate);
            return;
        }

        // Fallback to base center (clamped)
        const fallback: RoomPos = {
            x: Math.max(minX, Math.min(maxX, base.x)),
            y: Math.max(minY, Math.min(maxY, base.y)),
            rx: room.x,
            ry: room.y,
            w,
            h,
        };
        roomPositions.set(room.id, fallback);
    };

    const carveRect = (cx: number, cy: number, w: number, h: number) => {
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        for (let y = cy - halfH; y <= cy + halfH; y++) {
            if (y < 0 || y >= mapHeight) continue;
            for (let x = cx - halfW; x <= cx + halfW; x++) {
                if (x < 0 || x >= mapWidth) continue;
                grid[y][x] = "FLOOR";
            }
        }
    };

    const carveCircle = (cx: number, cy: number, w: number, h: number) => {
        const r = Math.floor(Math.min(w, h) / 2);
        const r2 = r * r;
        for (let y = cy - r; y <= cy + r; y++) {
            if (y < 0 || y >= mapHeight) continue;
            for (let x = cx - r; x <= cx + r; x++) {
                if (x < 0 || x >= mapWidth) continue;
                const dx = x - cx;
                const dy = y - cy;
                if (dx * dx + dy * dy <= r2) {
                    grid[y][x] = "FLOOR";
                }
            }
        }
    };

    const carveIrregular = (cx: number, cy: number, w: number, h: number) => {
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        for (let y = cy - halfH; y <= cy + halfH; y++) {
            if (y < 0 || y >= mapHeight) continue;
            for (let x = cx - halfW; x <= cx + halfW; x++) {
                if (x < 0 || x >= mapWidth) continue;
                const edgeDist = Math.min(
                    Math.abs(x - (cx - halfW)),
                    Math.abs(x - (cx + halfW)),
                    Math.abs(y - (cy - halfH)),
                    Math.abs(y - (cy + halfH))
                );
                const carveChance = edgeDist <= 1 ? 0.35 : edgeDist <= 2 ? 0.18 : 0.05;
                if (rng() < carveChance) continue;
                grid[y][x] = "FLOOR";
            }
        }
    };

    const carveRoomShape = (cx: number, cy: number, w: number, h: number) => {
        const roll = rng();
        if (roll < 0.45) {
            carveRect(cx, cy, w, h);
        } else if (roll < 0.8) {
            carveCircle(cx, cy, w, h);
        } else {
            carveIrregular(cx, cy, w, h);
        }
    };

    const carveCorridor = (ax: number, ay: number, bx: number, by: number) => {
        if (ax === bx) {
            const y0 = Math.min(ay, by);
            const y1 = Math.max(ay, by);
            for (let y = y0; y <= y1; y++) {
                for (let dx = -halfCorridor; dx <= halfCorridor; dx++) {
                    const x = ax + dx;
                    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) continue;
                    grid[y][x] = "FLOOR";
                }
            }
        } else if (ay === by) {
            const x0 = Math.min(ax, bx);
            const x1 = Math.max(ax, bx);
            for (let x = x0; x <= x1; x++) {
                for (let dy = -halfCorridor; dy <= halfCorridor; dy++) {
                    const y = ay + dy;
                    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) continue;
                    grid[y][x] = "FLOOR";
                }
            }
        } else {
            // L-shaped corridor (randomized order)
            if (rng() < 0.5) {
                carveCorridor(ax, ay, bx, ay);
                carveCorridor(bx, ay, bx, by);
            } else {
                carveCorridor(ax, ay, ax, by);
                carveCorridor(ax, by, bx, by);
            }
        }
    };

    // Rooms
    for (const room of graph.rooms) {
        placeRoom(room);
        const pos = roomPositions.get(room.id)!;
        carveRoomShape(pos.x, pos.y, pos.w, pos.h);
    }

    // Corridors
    for (const edge of graph.edges) {
        const aPos = roomPositions.get(edge.a);
        const bPos = roomPositions.get(edge.b);
        if (!aPos || !bPos) continue;
        carveCorridor(aPos.x, aPos.y, bPos.x, bPos.y);
    }

    // Spawn and goal
    const startRoom = graph.rooms.find(r => r.type === "start") ?? graph.rooms[0];
    const bossRoom = graph.rooms.find(r => r.type === "boss") ?? graph.rooms[graph.rooms.length - 1];
    const startPos = roomPositions.get(startRoom.id) ?? { x: Math.floor(roomSize / 2), y: Math.floor(roomSize / 2) };
    const goalPos = roomPositions.get(bossRoom.id) ?? { x: mapWidth - 1 - Math.floor(roomSize / 2), y: mapHeight - 1 - Math.floor(roomSize / 2) };
    const start = { x: startPos.x, y: startPos.y };
    const goal = { x: goalPos.x, y: goalPos.y };
    grid[start.y][start.x] = "SPAWN";
    grid[goal.y][goal.x] = "GOAL";

    const cells: TableMapCell[] = [];
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const t = grid[y][x];
            if (t === "VOID") continue;
            const token = t === "SPAWN" ? "P0" : t === "GOAL" ? "G0" : "F0";
            cells.push({ x, y, t: token });
        }
    }

    const mapDef: TableMapDef = {
        id: config.id ?? `MAZE_${config.width}x${config.height}_S${config.seed}`,
        w: mapWidth,
        h: mapHeight,
        centerOnZero: config.centerOnZero ?? true,
        apronBaseMode: config.apronBaseMode,
        cells,
    };

    return { mapDef, graph };
}

/** Generate a maze map definition for a floor seed. */
export function generateMazeFloorMap(
    seed: number,
    floorIndex: number,
    isBoss: boolean = false
): { mapDef: TableMapDef; graph: RoomGraph } {
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

    const base = DEFAULT_MAZE_CONFIGS[difficulty];
    const config: MazeMapConfig = {
        ...base,
        seed,
    };

    return generateMazeMapDef(config);
}

function weightedPick<T>(items: T[], weights: number[], rng: () => number): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

function shuffle<T>(arr: T[], rng: () => number) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeOdd(n: number): number {
    return n % 2 === 0 ? n + 1 : n;
}
