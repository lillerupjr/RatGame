// src/game/systems/playerSprites.ts
import { dir8Index, type Dir8 } from "./dir8";

export const PLAYER_SPRITE_SCALE = 3;
const RUN_FRAME_SEC = 0.12;

type SpriteSetDef = {
    idle: string;
    runA: string;
    runB: string;
    cellW: number;
    cellH: number;
    rows: number;
    cols: number;
    anchorX: number;
    anchorY: number;
};

type Loaded = { img: HTMLImageElement; ready: boolean };
type SpriteFrame = {
    img: HTMLImageElement;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    scale: number;
    anchorX: number;
    anchorY: number;
};

const PLAYER_SPRITES: SpriteSetDef = {
    idle: "/src/assets/player/idle.png",
    runA: "/src/assets/player/walk-1.png",
    runB: "/src/assets/player/walk-2.png",
    cellW: 32,
    cellH: 32,
    rows: 3,
    cols: 3,
    anchorX: 0.5,
    anchorY: 0.65,
};

const cache: Record<string, Loaded> = Object.create(null);
let _ready = false;

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

function validateSpriteSheet(def: SpriteSetDef, img: HTMLImageElement, path: string): boolean {
    if (!path.toLowerCase().endsWith(".png")) {
        console.warn(`[playerSprites] Sprite sheet must be PNG: ${path}`);
        return false;
    }
    if (def.cellW <= 0 || def.cellH <= 0 || def.rows <= 0 || def.cols <= 0) {
        console.warn(`[playerSprites] Invalid grid for sprite sheet: ${path}`);
        return false;
    }

    const expectedW = def.cellW * def.cols;
    const expectedH = def.cellH * def.rows;
    if (img.width !== expectedW || img.height !== expectedH) {
        console.warn(
            `[playerSprites] Sprite sheet size mismatch: ${path} (${img.width}x${img.height}) expected ${expectedW}x${expectedH}`,
        );
        return false;
    }

    if (def.anchorX < 0 || def.anchorX > 1 || def.anchorY < 0 || def.anchorY > 1) {
        console.warn(`[playerSprites] Anchor out of range for sprite sheet: ${path}`);
        return false;
    }

    return true;
}

export async function preloadPlayerSprites() {
    if (_ready) return;

    const paths = [PLAYER_SPRITES.idle, PLAYER_SPRITES.runA, PLAYER_SPRITES.runB];
    const jobs = paths.map(
        (path) =>
            new Promise<void>((resolve) => {
                const entry = loadImage(path);
                if (entry.ready) {
                    resolve();
                    return;
                }
                const onDone = () => resolve();
                entry.img.addEventListener("load", onDone, { once: true });
                entry.img.addEventListener("error", onDone, { once: true });
            }),
    );

    await Promise.all(jobs);
    _ready = true;
}

export function playerSpritesReady() {
    return _ready;
}

export function getPlayerSpriteFrame(args: {
    dir: Dir8;
    moving: boolean;
    time: number;
}): SpriteFrame | null {
    const def = PLAYER_SPRITES;
    const framePath = args.moving
        ? Math.floor(Math.max(0, args.time) / RUN_FRAME_SEC) % 2 === 0
            ? def.runA
            : def.runB
        : def.idle;

    const loaded = loadImage(framePath);
    if (!loaded.ready) return null;
    if (!validateSpriteSheet(def, loaded.img, framePath)) return null;

    const dirIndex = dir8Index(args.dir);
    const dirToCell: Array<{ row: number; col: number }> = [
        { row: 0, col: 1 }, // N
        { row: 0, col: 2 }, // NE
        { row: 1, col: 2 }, // E
        { row: 2, col: 2 }, // SE
        { row: 2, col: 1 }, // S
        { row: 2, col: 0 }, // SW
        { row: 1, col: 0 }, // W
        { row: 0, col: 0 }, // NW
    ];
    const cell = dirToCell[dirIndex] ?? dirToCell[0];

    return {
        img: loaded.img,
        sx: cell.col * def.cellW,
        sy: cell.row * def.cellH,
        sw: def.cellW,
        sh: def.cellH,
        scale: PLAYER_SPRITE_SCALE,
        anchorX: def.anchorX,
        anchorY: def.anchorY,
    };
}
