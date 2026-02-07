import { type Dir8 } from "./dir8";

export type AnimKey = string;

export type SpritePack = {
    skin: string;
    size: { w: number; h: number };
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
const FRAME_COUNT = 4;
const DEFAULT_FPS = 10;

const ENEMY_ASSET_MODULES = import.meta.glob("../../../assets/enemies/**/*", {
    eager: true,
    import: "default",
}) as Record<string, string>;

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

function resolveUrlBySuffix(suffix: string): string | null {
    for (const [path, url] of Object.entries(ENEMY_ASSET_MODULES)) {
        if (normalizePath(path).endsWith(suffix)) return url;
    }
    return null;
}

function requireUrl(suffix: string): string {
    const url = resolveUrlBySuffix(suffix);
    if (!url) throw new Error(`[spriteLoader] Missing asset: ${suffix}`);
    return url;
}

function packSuffix(skin: string, relative: string): string {
    return `/enemies/${skin}/${relative}`;
}

function discoverAnimKeys(skin: string): AnimKey[] {
    const marker = `/enemies/${skin}/animations/`;
    const keys = new Set<AnimKey>();
    for (const path of Object.keys(ENEMY_ASSET_MODULES)) {
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

export async function preloadSpritePack(skin: string): Promise<SpritePack> {
    const cached = packCache.get(skin);
    if (cached) return cached;

    const job = (async () => {
        const rotations: Partial<Record<Dir8, HTMLImageElement>> = {};
        const rotationJobs = DIR_KEYS.map(async (dirKey) => {
            const url = requireUrl(packSuffix(skin, `rotations/${dirKey}.png`));
            const img = await loadImage(url);
            rotations[dirKeyToDir8(dirKey)] = img;
        });
        await Promise.all(rotationJobs);

        const south = rotations.S;
        if (!south) throw new Error(`[spriteLoader] Missing south rotation for ${skin}`);
        const size = { w: south.width, h: south.height };

        const animations: Record<AnimKey, Partial<Record<Dir8, HTMLImageElement[]>>> = {};
        const animKeys = discoverAnimKeys(skin);

        for (const animKey of animKeys) {
            const perDir: Partial<Record<Dir8, HTMLImageElement[]>> = {};
            const animJobs: Promise<void>[] = [];
            for (const dirKey of DIR_KEYS) {
                const dir8 = dirKeyToDir8(dirKey);
                const frames: HTMLImageElement[] = new Array(FRAME_COUNT);
                for (let i = 0; i < FRAME_COUNT; i++) {
                    const frameName = `frame_${String(i).padStart(3, "0")}.png`;
                    const url = requireUrl(
                        packSuffix(skin, `animations/${animKey}/${dirKey}/${frameName}`),
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
            rotations,
            animations,
        });
    })();

    packCache.set(skin, job);

    try {
        return await job;
    } catch (err) {
        packCache.delete(skin);
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
    const frameIndex = Math.floor(Math.max(0, opts.t) * fps) % FRAME_COUNT;
    const useRotation = opts.useRotationIfNoAnim ?? true;

    if (opts.anim && pack.animations[opts.anim]) {
        const anim = pack.animations[opts.anim];
        const dir = pickDir(anim, opts.dir);
        const frames = anim[dir];
        if (!frames || frames.length < FRAME_COUNT) {
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
