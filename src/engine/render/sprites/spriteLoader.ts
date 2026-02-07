import { type Dir8 } from "./dir8";

export type AnimKey = string;
export type SpriteLoaderSource = {
    packRoot: string;
    modules: Record<string, string>;
};

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

const ENEMY_ASSET_MODULES = import.meta.glob("../../../assets/enemies/**/*", {
    eager: true,
    import: "default",
}) as Record<string, string>;
const ENEMY_SOURCE: SpriteLoaderSource = { packRoot: "/enemies", modules: ENEMY_ASSET_MODULES };

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

function resolveUrlBySuffix(suffix: string, modules: Record<string, string>): string | null {
    for (const [path, url] of Object.entries(modules)) {
        if (normalizePath(path).endsWith(suffix)) return url;
    }
    return null;
}

function requireUrl(suffix: string, modules: Record<string, string>): string {
    const url = resolveUrlBySuffix(suffix, modules);
    if (!url) throw new Error(`[spriteLoader] Missing asset: ${suffix}`);
    return url;
}

function packSuffix(packRoot: string, skin: string, relative: string): string {
    return `${packRoot}/${skin}/${relative}`;
}

function discoverAnimKeys(skin: string, source: SpriteLoaderSource): AnimKey[] {
    const marker = `${source.packRoot}/${skin}/animations/`;
    const keys = new Set<AnimKey>();
    for (const path of Object.keys(source.modules)) {
        const normalized = normalizePath(path);
        const idx = normalized.indexOf(marker);
        if (idx === -1) continue;
        const rest = normalized.slice(idx + marker.length);
        const parts = rest.split("/");
        if (parts.length < 3) continue;
        const animKey = parts[0];
        if (animKey) keys.add(animKey);
    }
    return Array.from(keys).sort();
}

async function loadImage(url: string): Promise<HTMLImageElement> {
    const existing = imageCache.get(url);
    if (existing) return existing;

    const job = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`[spriteLoader] Failed to load: ${url}`));
        img.src = url;
    });

    imageCache.set(url, job);

    try {
        const img = await job;
        if (img.decode) await img.decode();
        return img;
    } catch (err) {
        imageCache.delete(url);
        throw err;
    }
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
) {
    const animKey = animKeys ? animKeys.join(",") : "*";
    const frames = frameCount ?? DEFAULT_FRAME_COUNT;
    return `${source.packRoot}:${skin}:${animKey}:${frames}`;
}

export async function preloadSpritePack(
    skin: string,
    options?: {
        source?: SpriteLoaderSource;
        animKeys?: AnimKey[];
        frameCount?: number;
    },
): Promise<SpritePack> {
    const source = options?.source ?? ENEMY_SOURCE;
    const animKeys = options?.animKeys;
    const frameCount = options?.frameCount ?? DEFAULT_FRAME_COUNT;
    const cacheKey = packCacheKey(skin, source, animKeys, frameCount);
    const cached = packCache.get(cacheKey);
    if (cached) return cached;

    const job = (async () => {
        const rotations: Partial<Record<Dir8, HTMLImageElement>> = {};
        const rotationJobs = DIR_KEYS.map(async (dirKey) => {
            const url = requireUrl(
                packSuffix(source.packRoot, skin, `rotations/${dirKey}.png`),
                source.modules,
            );
            const img = await loadImage(url);
            rotations[dirKeyToDir8(dirKey)] = img;
        });
        await Promise.all(rotationJobs);

        const south = rotations.S;
        if (!south) throw new Error(`[spriteLoader] Missing south rotation for ${skin}`);
        const size = { w: south.width, h: south.height };

        const animations: Record<AnimKey, Partial<Record<Dir8, HTMLImageElement[]>>> = {};
        const keys = animKeys ?? discoverAnimKeys(skin, source);

        for (const animKey of keys) {
            const perDir: Partial<Record<Dir8, HTMLImageElement[]>> = {};
            const animJobs: Promise<void>[] = [];
            for (const dirKey of DIR_KEYS) {
                const dir8 = dirKeyToDir8(dirKey);
                const frames: HTMLImageElement[] = new Array(frameCount);
                for (let i = 0; i < frameCount; i++) {
                    const frameName = `frame_${String(i).padStart(3, "0")}.png`;
                    const url = requireUrl(
                        packSuffix(source.packRoot, skin, `animations/${animKey}/${dirKey}/${frameName}`),
                        source.modules,
                    );
                    animJobs.push(
                        loadImage(url).then((img) => {
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
