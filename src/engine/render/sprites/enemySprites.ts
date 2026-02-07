// src/game/sprites/enemySprites.ts
import { ENEMY_TYPE, type EnemyType } from "../../../game/content/enemies";
import { dir8IndexFromVector } from "./dir8";

/**
 * Enemy sprite sheet format:
 * - Separate PNGs for idle, run A, run B
 * - Each sheet is a 3x3 grid (center cell empty)
 * - Cell size defines frame size
 */

// ─────────────────────────────────────────────────────────────
// Animation definition
// ─────────────────────────────────────────────────────────────
const RUN_FRAME_SEC = 0.12;

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Sheet config
// ─────────────────────────────────────────────────────────────
type SpriteAnimationDef = {
    frameTime: "static" | "fixed";
};

type SpriteSetDef = {
    idle: string;
    runA: string;
    runB: string;
    cellW: number;
    cellH: number;
    rows: number;
    cols: number;
    directions: number;
    anchorX: number; // 0..1 (0 = left, 0.5 = center)
    anchorY: number; // 0..1 (0 = top, 1 = bottom / feet)
    animations: {
        idle: SpriteAnimationDef;
        run: SpriteAnimationDef;
    };
};

type EnemySpriteDef = {
    spriteSet: SpriteSetDef;
    scale: number;
};


// ─────────────────────────────────────────────────────────────
// Enemy → sheet + scale mapping
// ─────────────────────────────────────────────────────────────
const ENEMY_SPRITES: Partial<Record<EnemyType, EnemySpriteDef>> = {
    [ENEMY_TYPE.CHASER]: {
        scale: 1,
        spriteSet: {
            idle: "/src/assets/enemies/idle/rat-test.png",
            runA: "/src/assets/enemies/walk/rat-test.1.png",
            runB: "/src/assets/enemies/walk/rat-test-2.png",
            cellW: 64,
            cellH: 64,
            rows: 3,
            cols: 3,
            directions: 8,
            anchorX: 0.5,
            anchorY: 0.65,
            animations: {
                idle: { frameTime: "static" },
                run: { frameTime: "fixed" },
            },
        },
    },

    [ENEMY_TYPE.RUNNER]: {
        scale: 2,
        spriteSet: {
            idle: "/src/assets/enemies/idle/rat-test.png",
            runA: "/src/assets/enemies/walk/rat-test.1.png",
            runB: "/src/assets/enemies/walk/rat-test-2.png",
            cellW: 64,
            cellH: 64,
            rows: 3,
            cols: 3,
            directions: 8,
            anchorX: 0.5,
            anchorY: 0.65,
            animations: {
                idle: { frameTime: "static" },
                run: { frameTime: "fixed" },
            },
        },
    },

    [ENEMY_TYPE.BRUISER]: {
        scale: 3,
        spriteSet: {
            idle: "/src/assets/enemies/idle/rat-test.png",
            runA: "/src/assets/enemies/walk/rat-test.1.png",
            runB: "/src/assets/enemies/walk/rat-test-2.png",
            cellW: 64,
            cellH: 64,
            rows: 3,
            cols: 3,
            directions: 8,
            anchorX: 0.5,
            anchorY: 0.65,
            animations: {
                idle: { frameTime: "static" },
                run: { frameTime: "fixed" },
            },
        },
    },

    [ENEMY_TYPE.BOSS]: {
        scale: 5,
        spriteSet: {
            idle: "/src/assets/enemies/idle/rat-test.png",
            runA: "/src/assets/enemies/walk/rat-test.1.png",
            runB: "/src/assets/enemies/walk/rat-test-2.png",
            cellW: 64,
            cellH: 64,
            rows: 3,
            cols: 3,
            directions: 8,
            anchorX: 0.5,
            anchorY: 0.65,
            animations: {
                idle: { frameTime: "static" },
                run: { frameTime: "fixed" },
            },
        },
    },
};

// ─────────────────────────────────────────────────────────────
// Image loading
// ─────────────────────────────────────────────────────────────
type Loaded = { img: HTMLImageElement; ready: boolean };
const cache: Record<string, Loaded> = Object.create(null);

function isPngPath(path: string): boolean {
    return path.toLowerCase().endsWith(".png");
}

function validateFrameAsset(
    spriteSet: SpriteSetDef,
    img: HTMLImageElement,
    path: string,
): boolean {
    if (!isPngPath(path)) {
        console.warn(`[enemySprites] Sprite sheet must be PNG: ${path}`);
        return false;
    }

    if (spriteSet.cellW <= 0 || spriteSet.cellH <= 0) {
        console.warn(`[enemySprites] Invalid frame size for sprite: ${path}`);
        return false;
    }

    if (spriteSet.rows <= 0 || spriteSet.cols <= 0) {
        console.warn(`[enemySprites] Invalid grid for sprite sheet: ${path}`);
        return false;
    }

    const expectedW = spriteSet.cellW * spriteSet.cols;
    const expectedH = spriteSet.cellH * spriteSet.rows;
    if (img.width !== expectedW || img.height !== expectedH) {
        console.warn(`[enemySprites] Sprite sheet size mismatch: ${path} (${img.width}x${img.height}) expected ${expectedW}x${expectedH}`);
        return false;
    }

    if (spriteSet.directions !== 8 || spriteSet.rows !== 3 || spriteSet.cols !== 3) {
        console.warn(`[enemySprites] Sprite sheet must be 3x3 with 8 directions: ${path}`);
        return false;
    }

    if (spriteSet.anchorX < 0 || spriteSet.anchorX > 1 || spriteSet.anchorY < 0 || spriteSet.anchorY > 1) {
        console.warn(`[enemySprites] Anchor out of range for sprite sheet: ${path}`);
        return false;
    }

    const idle = spriteSet.animations.idle;
    if (idle.frameTime !== "static") {
        console.warn(`[enemySprites] Idle animation must be a single static frame: ${path}`);
        return false;
    }

    const run = spriteSet.animations.run;
    if (run.frameTime !== "fixed") {
        console.warn(`[enemySprites] Run animation must be a fixed two-frame loop: ${path}`);
        return false;
    }

    return true;
}

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
    for (const v of Object.values(ENEMY_SPRITES)) {
        if (!v) continue;
        loadImage(v.spriteSet.idle);
        loadImage(v.spriteSet.runA);
        loadImage(v.spriteSet.runB);
    }
}

// ─────────────────────────────────────────────────────────────
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
    const entry = ENEMY_SPRITES[args.type];
    if (!entry) return null;

    const { spriteSet } = entry;
    const useRun = args.moving;
    const anim = useRun ? spriteSet.animations.run : spriteSet.animations.idle;

    let framePath = spriteSet.idle;
    if (useRun) {
        const k = Math.floor(Math.max(0, args.time) / RUN_FRAME_SEC) % 2;
        framePath = k === 0 ? spriteSet.runA : spriteSet.runB;
    }

    const loaded = loadImage(framePath);
    if (!loaded.ready) return null;
    if (!validateFrameAsset(spriteSet, loaded.img, framePath)) return null;

    const dirIndex = dir8IndexFromVector(args.faceDx, args.faceDy);
    const dirToCell: Array<{ row: number; col: number }> = [
        { row: 1, col: 1 }, // N (slot 5)
        { row: 1, col: 0 }, // NE (slot 4)
        { row: 0, col: 2 }, // E (slot 3)
        { row: 0, col: 1 }, // SE (slot 2)
        { row: 0, col: 0 }, // S (slot 1)
        { row: 2, col: 1 }, // SW (slot 8)
        { row: 2, col: 0 }, // W (slot 7)
        { row: 1, col: 2 }, // NW (slot 6)
    ];
    const cell = dirToCell[dirIndex] ?? dirToCell[0];

    return {
        img: loaded.img,
        sx: cell.col * spriteSet.cellW,
        sy: cell.row * spriteSet.cellH,
        sw: spriteSet.cellW,
        sh: spriteSet.cellH,
        scale: entry.scale,
        anchorX: spriteSet.anchorX,
        anchorY: spriteSet.anchorY,
    };
}
