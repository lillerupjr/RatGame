// src/game/sprites/enemySprites.ts
import { ENEMY_TYPE, type EnemyType } from "../content/enemies";

/**
 * Enemy sprite sheet format (your current sheet):
 * - 8 columns = 8 directions
 * - 32 rows total
 * - We use:
 *   - idle: row 4 (1-based) => index 3 (0-based)
 *   - walk: rows 5–12 (1-based) => indices 4..11 (0-based), 8 frames
 */

// You asked for a scale constant (same idea as we did for player)
export const ENEMY_SPRITE_SCALE = 2.0;

// 0-based row indices
const IDLE_ROW = 3; // frame 4 (1-based)
const WALK_ROWS = [4, 5, 6, 7, 8, 9, 10, 11]; // rows 5–12 (1-based)

// Animation tuning
const WALK_FPS = 10; // 8 frames * 10fps = 0.8s loop

type SheetConfig = {
    // 1-based: 8 dirs across, 32 frames down
    rows: number; // 32
    cols: number; // 8
    idleRow: number; // 0-based
    walkRows: number[]; // 0-based list
    scale: number;
};

// Map enemy type -> sheet asset
// (Start simple: CHASER uses antlion_0.png)
const SHEET_BY_TYPE: Partial<Record<EnemyType, { path: string; cfg: SheetConfig }>> = {
    [ENEMY_TYPE.CHASER]: {
        path: "/src/assets/enemies/antlion_0.png",
        cfg: {
            rows: 32,
            cols: 8,
            idleRow: IDLE_ROW,
            walkRows: WALK_ROWS,
            scale: ENEMY_SPRITE_SCALE,
        },
    },
};

type Loaded = { img: HTMLImageElement; ready: boolean; w: number; h: number };

// Cache load results
const cache: Record<string, Loaded> = Object.create(null);

function loadImage(path: string): Loaded {
    const existing = cache[path];
    if (existing) return existing;

    const img = new Image();
    const entry: Loaded = { img, ready: false, w: 0, h: 0 };
    cache[path] = entry;

    img.onload = () => {
        entry.ready = true;
        entry.w = img.naturalWidth || img.width;
        entry.h = img.naturalHeight || img.height;
    };
    img.src = path;

    return entry;
}

export function preloadEnemySprites() {
    for (const v of Object.values(SHEET_BY_TYPE)) {
        if (!v) continue;
        loadImage(v.path);
    }
}

function dir8FromVector(dx: number, dy: number): number {
    // dir order: 0=N,1=NE,2=E,3=SE,4=S,5=SW,6=W,7=NW
    // Using angle where 0 is "up" (north)
    const ang = Math.atan2(dy, dx); // -pi..pi, 0 = east
    // rotate so 0 = north
    const a = ang + Math.PI / 2;
    // map to 8 slices
    let idx = Math.round((a / (Math.PI * 2)) * 8);
    idx = ((idx % 8) + 8) % 8;
    return idx;
}

export function getEnemySpriteFrame(args: {
    type: EnemyType;
    time: number;
    // facing vector (enemy -> player) OR velocity, your choice
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
}
    | null {
    const entry = SHEET_BY_TYPE[args.type];
    if (!entry) return null;

    const loaded = loadImage(entry.path);
    if (!loaded.ready || loaded.w <= 0 || loaded.h <= 0) return null;

    const { cfg } = entry;

    // Fixed grid: 32x8 over 4096x1024 => 128x128 per cell
    const CELL_W = 128;
    const CELL_H = 128;

    const col = dir8FromVector(args.faceDx, args.faceDy);

    let row = cfg.idleRow;
    if (args.moving) {
        const t = Math.max(0, args.time);
        const walkIndex = Math.floor(t * WALK_FPS) % cfg.walkRows.length;
        row = cfg.walkRows[walkIndex];
    }

    return {
        img: loaded.img,
        sx: col * CELL_W,
        sy: row * CELL_H,
        sw: CELL_W,
        sh: CELL_H,
        scale: cfg.scale,
    };

}
