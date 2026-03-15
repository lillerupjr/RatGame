import { type Dir8 } from "./dir8";
import {
    buildPaletteVariantKey,
    resolveActivePaletteId,
    resolveActivePaletteSwapWeightPercents,
    resolveActivePaletteVariantKey,
} from "../../../game/render/activePalette";
import { getSpriteByIdForDarknessPercent, getSpriteByIdForPalette, type LoadedImg } from "./renderSprites";

export type AnimKey = string;
export type SpriteLoaderSource = {
    packRoot: string;
};

export type SpriteDarknessPercent = 0 | 25 | 50 | 75 | 100;
export type SpritePreloadState = "READY" | "PENDING" | "UNSUPPORTED" | "FAILED";

export class SpritePreloadError extends Error {
    kind: "UNSUPPORTED" | "FAILED";
    constructor(kind: "UNSUPPORTED" | "FAILED", message: string, cause?: unknown) {
        super(message);
        this.name = "SpritePreloadError";
        this.kind = kind;
        if (cause !== undefined) {
            (this as { cause?: unknown }).cause = cause;
        }
    }
}

export function isSpritePreloadError(value: unknown): value is SpritePreloadError {
    return value instanceof SpritePreloadError;
}

export type SpritePack = {
    skin: string;
    size: { w: number; h: number };
    frameCount: number;
    rotations: Partial<Record<Dir8, HTMLImageElement>>;
    animations: Record<AnimKey, Partial<Record<Dir8, HTMLImageElement[]>>>;
};

const DIR_KEYS = [
    "north",
    "north-east",
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west",
] as const;

type DirKey = (typeof DIR_KEYS)[number];

const DIR_KEY_TO_DIR8: Record<DirKey, Dir8> = {
    north: "N",
    "north-east": "NE",
    east: "E",
    "south-east": "SE",
    south: "S",
    "south-west": "SW",
    west: "W",
    "north-west": "NW",
};

const DIR_FALLBACK_PRIORITY: Dir8[] = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"];
const DEFAULT_FRAME_COUNT = 4;
const DEFAULT_FPS = 10;

const ENEMY_SOURCE: SpriteLoaderSource = { packRoot: "entities/enemies" };

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const packCache = new Map<string, Promise<SpritePack>>();

function normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
}

function dirKeyToDir8(key: string): Dir8 {
    const mapped = DIR_KEY_TO_DIR8[key as DirKey];
    if (!mapped) throw new Error(`[spriteLoader] Invalid direction key: ${key}`);
    return mapped;
}

function packSuffix(packRoot: string, skin: string, relative: string): string {
    return `${packRoot}/${skin}/${relative}`;
}

function asSpriteId(assetPath: string): string {
    const normalized = normalizePath(assetPath).replace(/^\/+/, "");
    return normalized.toLowerCase().endsWith(".png") ? normalized.slice(0, -4) : normalized;
}

async function loadImage(
    spriteId: string,
    paletteId: string,
    paletteVariantKey: string,
    darknessPercent?: SpriteDarknessPercent,
): Promise<HTMLImageElement> {
    const id = asSpriteId(spriteId);
    const cacheId = `${id}@@palv:${paletteVariantKey}@@dk:${darknessPercent == null ? "active" : darknessPercent}`;
    const existing = imageCache.get(cacheId);
    if (existing) return existing;

    const job = new Promise<HTMLImageElement>((resolve, reject) => {
        const started = performance.now();
        const MAX_WAIT_MS = 1500;

        const tick = () => {
            const rec = darknessPercent == null
                ? getSpriteByIdForPalette(id, paletteId)
                : getSpriteByIdForDarknessPercent(id, darknessPercent);
            const state = classifyLoadedImgState(rec);
            if (state === "READY") {
                resolve(rec.img);
                return;
            }
            if (state === "UNSUPPORTED") {
                reject(new SpritePreloadError(
                    darknessPercent == null ? "FAILED" : "UNSUPPORTED",
                    `[spriteLoader] Unsupported sprite source: ${id}`,
                ));
                return;
            }
            if (state === "FAILED") {
                reject(new SpritePreloadError("FAILED", `[spriteLoader] Failed sprite source: ${id}`));
                return;
            }
            if (performance.now() - started >= MAX_WAIT_MS) {
                reject(new SpritePreloadError("FAILED", `[spriteLoader] Timed out waiting for sprite: ${id}`));
                return;
            }
            requestAnimationFrame(tick);
        };

        tick();
    });

    imageCache.set(cacheId, job);

    try {
        const img = await job;
        if (img.decode) {
            try {
                await img.decode();
            } catch (err) {
                if (!(img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)) {
                    throw new SpritePreloadError("FAILED", `[spriteLoader] Failed to decode sprite: ${id}`, err);
                }
            }
        }
        if (!(img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)) {
            throw new SpritePreloadError("FAILED", `[spriteLoader] Sprite is not decodable: ${id}`);
        }
        return img;
    } catch (err) {
        imageCache.delete(cacheId);
        if (isSpritePreloadError(err)) throw err;
        throw new SpritePreloadError("FAILED", `[spriteLoader] Failed to load image: ${id}`, err);
    }
}

function classifyLoadedImgState(rec: LoadedImg): SpritePreloadState {
    if (rec.ready && rec.img && rec.img.naturalWidth > 0 && rec.img.naturalHeight > 0) return "READY";
    if (rec.unsupported) return "UNSUPPORTED";
    if (rec.failed) return "FAILED";
    return "PENDING";
}

function pickDir<T>(record: Partial<Record<Dir8, T>>, requested: Dir8): Dir8 {
    if (record[requested]) return requested;
    if (record.S) return "S";
    for (const dir of DIR_FALLBACK_PRIORITY) {
        if (record[dir]) return dir;
    }
    throw new Error("[spriteLoader] Missing direction in sprite pack");
}

function freezePack(pack: SpritePack): SpritePack {
    for (const anim of Object.values(pack.animations)) {
        for (const frames of Object.values(anim)) {
            if (frames) Object.freeze(frames);
        }
        Object.freeze(anim);
    }
    Object.freeze(pack.animations);
    Object.freeze(pack.rotations);
    Object.freeze(pack.size);
    Object.freeze(pack);
    return pack;
}

function packCacheKey(
    skin: string,
    source: SpriteLoaderSource,
    animKeys?: AnimKey[],
    frameCount?: number,
    paletteVariantKey?: string,
    darknessPercent?: SpriteDarknessPercent,
) {
    const animKey = animKeys ? animKeys.join(",") : "*";
    const frames = frameCount ?? DEFAULT_FRAME_COUNT;
    const pal = paletteVariantKey ?? "db32@@sw:0@@dk:0";
    const darknessKey = darknessPercent == null ? "active" : `${darknessPercent}`;
    return `${source.packRoot}:${skin}:${animKey}:${frames}:@@palv:${pal}:@@dk:${darknessKey}`;
}

function resolveVariantKeyForDarknessPercent(
    darknessPercent: SpriteDarknessPercent | undefined,
): string {
    if (darknessPercent == null) return resolveActivePaletteVariantKey();
    const paletteId = resolveActivePaletteId();
    const active = resolveActivePaletteSwapWeightPercents();
    return buildPaletteVariantKey(paletteId, {
        sWeightPercent: active.sWeightPercent,
        darknessPercent,
    });
}

export async function preloadSpritePack(
    skin: string,
    options?: {
        source?: SpriteLoaderSource;
        animKeys?: AnimKey[];
        frameCount?: number;
        darknessPercent?: SpriteDarknessPercent;
    },
): Promise<SpritePack> {
    const source = options?.source ?? ENEMY_SOURCE;
    const animKeys = options?.animKeys;
    const frameCount = options?.frameCount ?? DEFAULT_FRAME_COUNT;
    const darknessPercent = options?.darknessPercent;
    const paletteId = resolveActivePaletteId();
    const paletteVariantKey = resolveVariantKeyForDarknessPercent(darknessPercent);
    const cacheKey = packCacheKey(skin, source, animKeys, frameCount, paletteVariantKey, darknessPercent);
    const cached = packCache.get(cacheKey);
    if (cached) return cached;

    const job = (async () => {
        const rotations: Partial<Record<Dir8, HTMLImageElement>> = {};
        const rotationJobs = DIR_KEYS.map(async (dirKey) => {
            const img = await loadImage(
                packSuffix(source.packRoot, skin, `rotations/${dirKey}.png`),
                paletteId,
                paletteVariantKey,
                darknessPercent,
            );
            rotations[dirKeyToDir8(dirKey)] = img;
        });
        await Promise.all(rotationJobs);

        const south = rotations.S;
        if (!south) throw new Error(`[spriteLoader] Missing south rotation for ${skin}`);
        const size = { w: south.width, h: south.height };

        const animations: Record<AnimKey, Partial<Record<Dir8, HTMLImageElement[]>>> = {};
        const keys = animKeys ?? [];

        for (const animKey of keys) {
            const perDir: Partial<Record<Dir8, HTMLImageElement[]>> = {};
            const animJobs: Promise<void>[] = [];
            for (const dirKey of DIR_KEYS) {
                const dir8 = dirKeyToDir8(dirKey);
                const frames: HTMLImageElement[] = new Array(frameCount);
                for (let i = 0; i < frameCount; i++) {
                    const frameName = `frame_${String(i).padStart(3, "0")}.png`;
                    animJobs.push(
                        loadImage(
                            packSuffix(source.packRoot, skin, `animations/${animKey}/${dirKey}/${frameName}`),
                            paletteId,
                            paletteVariantKey,
                            darknessPercent,
                        ).then((img) => {
                            frames[i] = img;
                        }),
                    );
                }
                perDir[dir8] = frames;
            }
            await Promise.all(animJobs);
            animations[animKey] = perDir;
        }

        return freezePack({
            skin,
            size,
            frameCount,
            rotations,
            animations,
        });
    })();

    packCache.set(cacheKey, job);

    try {
        return await job;
    } catch (err) {
        packCache.delete(cacheKey);
        throw err;
    }
}

export function getSpriteFrame(
    pack: SpritePack,
    opts: {
        dir: Dir8;
        anim?: AnimKey;
        t: number;
        fps?: number;
        useRotationIfNoAnim?: boolean;
    },
): HTMLImageElement {
    const fps = opts.fps ?? DEFAULT_FPS;
    const frameCount = Math.max(1, pack.frameCount || DEFAULT_FRAME_COUNT);
    const frameIndex = Math.floor(Math.max(0, opts.t) * fps) % frameCount;
    const useRotation = opts.useRotationIfNoAnim ?? true;

    if (opts.anim && pack.animations[opts.anim]) {
        const anim = pack.animations[opts.anim];
        const dir = pickDir(anim, opts.dir);
        const frames = anim[dir];
        if (!frames || frames.length < frameCount) {
            throw new Error(`[spriteLoader] Missing frames for ${pack.skin}:${opts.anim}:${dir}`);
        }
        return frames[frameIndex];
    }

    if (!useRotation) {
        throw new Error(`[spriteLoader] Missing animation ${opts.anim ?? ""} for ${pack.skin}`);
    }

    const dir = pickDir(pack.rotations, opts.dir);
    const img = pack.rotations[dir];
    if (!img) throw new Error(`[spriteLoader] Missing rotation for ${pack.skin}:${dir}`);
    return img;
}
