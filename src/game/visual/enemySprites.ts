// src/game/sprites/enemySprites.ts
import { ENEMY_TYPE, type EnemyType } from "../content/enemies";

/**
 * Enemy sprite sheet format:
 * - PNG size: 4096x1024
 * - Grid: 32 columns x 8 rows
 * - Cell: 128x128
 *
 * Layout:
 * - ROWS (8) = directions (sheet-specific order)
 * - COLUMNS (32) = frames for one direction
 *
 * Animation:
 * - idle column = 4 (1-based) => col0 = 3
 * - walk columns = 5–12 (1-based) => col0 = 4..11 (8 frames)
 */

// ─────────────────────────────────────────────────────────────
// Grid constants
// ─────────────────────────────────────────────────────────────
const CELL_W = 128;
const CELL_H = 128;

// ─────────────────────────────────────────────────────────────
// Animation definition
// ─────────────────────────────────────────────────────────────
const IDLE_COL = 3; // frame 4 (1-based)
const WALK_COLS = [4, 5, 6, 7, 8, 9, 10, 11]; // frames 5–12 (1-based)
const WALK_FPS = 10;

// ─────────────────────────────────────────────────────────────
// Direction row order (your sheet)
// rows:
// 1=W, 2=NW, 3=N, 4=NE, 5=E, 6=SE, 7=S, 8=SW
// ─────────────────────────────────────────────────────────────
const ROW_ORDER = ["W", "NW", "N", "NE", "E", "SE", "S", "SW"] as const;
type Dir8 = (typeof ROW_ORDER)[number];

// ─────────────────────────────────────────────────────────────
// Sheet config
// ─────────────────────────────────────────────────────────────
type SheetConfig = {
    rows: number;
    cols: number;
    idleCol: number;
    walkCols: number[];
    scale: number;

    // NEW
    anchorX: number; // 0..1 (0 = left, 0.5 = center)
    anchorY: number; // 0..1 (0 = top, 1 = bottom / feet)
};


// ─────────────────────────────────────────────────────────────
// Enemy → sheet + scale mapping
// ─────────────────────────────────────────────────────────────
const SHEET_BY_TYPE: Partial<Record<EnemyType, { path: string; cfg: SheetConfig }>> = {
    [ENEMY_TYPE.CHASER]: {
        path: "/src/assets/enemies/antlion_0.png",
        cfg: {
            rows: 8,
            cols: 32,
            idleCol: IDLE_COL,
            walkCols: WALK_COLS,
            scale: 1,
            anchorX: 0.5,
            anchorY: 0.65,
        },
    },

    [ENEMY_TYPE.RUNNER]: {
        path: "/src/assets/enemies/fire_ant.png",
        cfg: {
            rows: 8,
            cols: 32,
            idleCol: IDLE_COL,
            walkCols: WALK_COLS,
            scale: 2,
            anchorX: 0.5,
            anchorY: 0.65,
        },
    },

    [ENEMY_TYPE.BRUISER]: {
        path: "/src/assets/enemies/ice_ant.png",
        cfg: {
            rows: 8,
            cols: 32,
            idleCol: IDLE_COL,
            walkCols: WALK_COLS,
            scale: 3,
            anchorX: 0.5,
            anchorY: 0.65,
        },
    },

    [ENEMY_TYPE.BOSS]: {
        path: "/src/assets/enemies/antlion_0.png",
        cfg: {
            rows: 8,
            cols: 32,
            idleCol: IDLE_COL,
            walkCols: WALK_COLS,
            scale: 5,
            anchorX: 0.5,
            anchorY: 0.65,
        },
    },
};

// ─────────────────────────────────────────────────────────────
// Image loading
// ─────────────────────────────────────────────────────────────
type Loaded = { img: HTMLImageElement; ready: boolean };
const cache: Record<string, Loaded> = Object.create(null);

function loadImage(path: string): Loaded {
    const existing = cache[path];
    if (existing) return existing;

    const img = new Image();
    const entry: Loaded = { img, ready: false };
    cache[path] = entry;

    img.onload = () => (entry.ready = true);
    img.onerror = () => (entry.ready = false);
    img.src = path;

    return entry;
}

export function preloadEnemySprites() {
    for (const v of Object.values(SHEET_BY_TYPE)) {
        if (!v) continue;
        loadImage(v.path);
    }
}

// ─────────────────────────────────────────────────────────────
// Direction helpers
// ─────────────────────────────────────────────────────────────
function dirLabelFromVector(dx: number, dy: number): Dir8 {
    const ang = Math.atan2(dy, dx); // 0 = east
    const a = ang + Math.PI / 2;    // rotate so 0 = north
    let idx = Math.round((a / (Math.PI * 2)) * 8);
    idx = ((idx % 8) + 8) % 8;

    const STANDARD: Dir8[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return STANDARD[idx];
}

function dirRowFromVector(dx: number, dy: number): number {
    return ROW_ORDER.indexOf(dirLabelFromVector(dx, dy));
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────
export function getEnemySpriteFrame(args: {
    type: EnemyType;
    time: number;
    faceDx: number;
    faceDy: number;
    moving: boolean;
}):
    | {
    img: HTMLImageElement;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    scale: number;

    // NEW
    anchorX: number;
    anchorY: number;
}
    | null {
    const entry = SHEET_BY_TYPE[args.type];
    if (!entry) return null;

    const loaded = loadImage(entry.path);
    if (!loaded.ready) return null;

    const { cfg } = entry;

    // Row = direction
    const row0 = dirRowFromVector(args.faceDx, args.faceDy);

    // Column = animation frame
    let col0 = cfg.idleCol;
    if (args.moving) {
        const k = Math.floor(Math.max(0, args.time) * WALK_FPS) % cfg.walkCols.length;
        col0 = cfg.walkCols[k];
    }

    return {
        img: loaded.img,
        sx: col0 * CELL_W,
        sy: row0 * CELL_H,
        sw: CELL_W,
        sh: CELL_H,
        scale: cfg.scale,
        anchorX: cfg.anchorX,
        anchorY: cfg.anchorY,
    };
}
