import {
    getActiveMapSkinId,
    resolveMapSkin,
    resolveSemanticSprite,
    setActiveMapSkinId as setActiveMapSkinIdInContent,
    type MapSkinId,
} from "../../../game/content/mapSkins";
import { isKnownRenderableSpriteId } from "./spriteIdRegistry";
import { getFloorVariantCount, RUNTIME_FLOOR_VARIANT_COUNTS, type RuntimeFloorFamily } from "../../../game/content/runtimeFloorConfig";
import { applyPaletteSwapToCanvas } from "../palette/paletteSwap";
import {
    buildPaletteVariantKey,
    resolveActivePaletteId,
    resolveActivePaletteSwapWeightPercents,
    resolvePaletteVariantKeyForPaletteId,
} from "../../../game/render/activePalette";
import {
    getDecalSpriteId,
    RUNTIME_DECAL_SPRITE_IDS,
    type RuntimeDecalSetId,
} from "../../../game/content/runtimeDecalConfig";
import { preloadCurrencySprites } from "../../../game/content/loot/currencyVisual";
import { preloadVfxSprites } from "../../../game/content/vfxRegistry";
import { listProjectilePresentationSpriteIds } from "../../../game/content/projectilePresentationRegistry";

export type LoadedImg = {
    img: HTMLImageElement;
    ready: boolean;
    failed?: boolean;
    unsupported?: boolean;
    error?: string;
};
export type SpriteCacheDebugState = "PENDING" | "READY" | "FAILED" | "UNSUPPORTED";
export type SpriteCacheDebugSnapshot = {
    cacheKey: string;
    spriteId: string;
    paletteVariantKey: string | null;
    requestCount: number;
    state: SpriteCacheDebugState;
    createdAtMs: number;
    updatedAtMs: number;
    lastError?: string;
};
export type PaletteId = ReturnType<typeof resolveActivePaletteId>;
type PaletteSwapWeightPercents = {
    sWeightPercent: number;
    darknessPercent: number;
};

const cache: Record<string, LoadedImg> = Object.create(null);
const ANIMATED_TILE_SETS = {
    water1: { fps: 6, frameCount: 4, playback: "pingpong" },
    water2: { fps: 6, frameCount: 6, playback: "pingpong" },
} as const;
const animatedTileFramesBySetAndPalette = new Map<string, LoadedImg[]>();
const prewarmQueue: { spriteId: string; paletteVariantKey: string }[] = [];
let prewarmActive = false;
const spriteCacheDebugByKey = new Map<string, SpriteCacheDebugSnapshot>();
const PALETTE_MANAGED_PREFIXES = [
    "tiles/",
    "structures/",
    "props/",
    "entities/",
] as const;

export type AnimatedTileSetId = keyof typeof ANIMATED_TILE_SETS;

function getAnimatedTileFrames(setId: AnimatedTileSetId): LoadedImg[] {
    const paletteId = effectivePaletteId();
    const variantKey = effectivePaletteVariantKey(paletteId);
    const cacheKey = `${setId}@@palv:${variantKey}`;
    const cached = animatedTileFramesBySetAndPalette.get(cacheKey);
    if (cached) return cached;

    const spec = ANIMATED_TILE_SETS[setId];
    const frames = new Array<LoadedImg>(spec.frameCount);
    for (let i = 0; i < spec.frameCount; i++) {
        frames[i] = loadByIdInternal(`tiles/animated/${setId}/${i + 1}`, paletteId);
    }
    animatedTileFramesBySetAndPalette.set(cacheKey, frames);
    return frames;
}

function makeTransparent1x1(): HTMLImageElement {
    const img = new Image();
    img.src =
        "data:image/png;base64," +
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax2nZkAAAAASUVORK5CYII=";
    return img;
}

function effectivePaletteId(forcedPaletteId?: string): string {
    if (forcedPaletteId) return forcedPaletteId;
    return resolveActivePaletteId();
}

function effectivePaletteVariantKey(forcedPaletteId?: string): string {
    return resolvePaletteVariantKeyForPaletteId(effectivePaletteId(forcedPaletteId));
}

function clampWeightPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeWeightPercents(weights: PaletteSwapWeightPercents): PaletteSwapWeightPercents {
    return {
        sWeightPercent: clampWeightPercent(weights.sWeightPercent),
        darknessPercent: clampWeightPercent(weights.darknessPercent),
    };
}

function toPaletteSwapWeights(weights: PaletteSwapWeightPercents): {
    sWeight: number;
    darkness: number;
} {
    const normalized = normalizeWeightPercents(weights);
    return {
        sWeight: normalized.sWeightPercent / 100,
        darkness: normalized.darknessPercent / 100,
    };
}

function normalizeSpriteId(spriteId: string): string {
    const trimmed = spriteId.trim();
    return trimmed.toLowerCase().endsWith(".png") ? trimmed.slice(0, -4) : trimmed;
}

function parsePaletteVariantKey(variantKey: string): {
    paletteId: string;
    sWeightPercent: number;
    darknessPercent: number;
} | null {
    const trimmed = variantKey.trim();
    const match = /^(.+)@@sw:(\d+)@@dk:(\d+)$/.exec(trimmed);
    if (!match) return null;
    return {
        paletteId: match[1],
        sWeightPercent: clampWeightPercent(Number(match[2])),
        darknessPercent: clampWeightPercent(Number(match[3])),
    };
}

function remapLegacySpriteId(id: string): string {
    if (id.startsWith("tiles/stairs/sidewalk_apron_")) {
        return id.replace("tiles/stairs/sidewalk_apron_", "tiles/stairs/stone/stone_");
    }
    if (id.startsWith("tiles/stairs/sidewalk_")) {
        return id.replace("tiles/stairs/sidewalk_", "tiles/stairs/stone/stone_");
    }

    const directMap: Record<string, string> = {
        "tiles/floor/top/sidewalk": "tiles/floor/sidewalk/1",
        "tiles/floor/top/road": "tiles/floor/asphalt/1",
        "tiles/floor/top/asphalt": "tiles/floor/asphalt/1",
        "tiles/floor/top/park": "tiles/floor/park/1",
        "tiles/floor/top/stone": "tiles/floor/asphalt/1",
        "tiles/floor/top/green": "tiles/floor/park/1",

        "tiles/floor/curtain/sidewalk": "tiles/walls/sidewalk",
        "tiles/floor/curtain/asphalt": "tiles/walls/asphalt",
        "tiles/floor/curtain/park": "tiles/walls/green",
        "tiles/floor/curtain/stone": "tiles/walls/stone",
        "tiles/floor/curtain/green": "tiles/walls/green",
        "tiles/floor/curtain/docks": "tiles/walls/docks",

        "tiles/stairs/top/stone": "tiles/stairs/stone/stone",
        "tiles/stairs/sidewalk": "tiles/stairs/stone/stone",
        "tiles/stairs/sidewalk_apron": "tiles/stairs/stone/stone",

        "tiles/backgrounds/green_water": "tiles/animated/water2/1",
        "tiles/backgrounds/water": "tiles/animated/water2/1",
        "tiles/backgrounds/water1": "tiles/animated/water1/1",
        "tiles/backgrounds/water2": "tiles/animated/water2/1",
        "tiles/backgrounds/water3": "tiles/animated/water2/1",
    };
    return directMap[id] ?? id;
}

export function isPaletteManagedSpriteId(spriteId: string): boolean {
    const normalized = remapLegacySpriteId(normalizeSpriteId(spriteId));
    return PALETTE_MANAGED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isWaterBackgroundId(spriteId: string): boolean {
    const normalized = normalizeSpriteId(spriteId);
    return normalized.startsWith("tiles/backgrounds/water")
        || normalized.startsWith("tiles/animated/water")
        || normalized.endsWith("green_water");
}

function resolveUrl(spriteId: string): string | null {
    const trimmed = spriteId.trim();
    if (!trimmed) return null;
    const normalized = trimmed.toLowerCase().endsWith(".png") ? trimmed.slice(0, -4) : trimmed;
    const id = remapLegacySpriteId(normalized);

    if (id.startsWith("entities/") || id.startsWith("loot/") || id.startsWith("vfx/") || id.startsWith("projectiles/")) {
        return `${import.meta.env.BASE_URL}assets-runtime/${id}.png`;
    }
    if (
        id.startsWith("tiles/")
        || id.startsWith("structures/")
        || id.startsWith("props/")
    ) {
        return `${import.meta.env.BASE_URL}assets-runtime/base_db32/${id}.png`;
    }
    if (!isKnownRenderableSpriteId(id)) return null;
    return null;
}

function buildSpriteCacheKey(
    rawSpriteId: string,
    paletteManaged: boolean,
    paletteVariantKey: string,
): string {
    return paletteManaged
        ? `${rawSpriteId}@@palv:${paletteVariantKey}`
        : `${rawSpriteId}@@raw`;
}

function noteSpriteCacheRequest(
    cacheKey: string,
    spriteId: string,
    paletteVariantKey: string | null,
): void {
    const now = performance.now();
    const existing = spriteCacheDebugByKey.get(cacheKey);
    if (existing) {
        existing.requestCount += 1;
        existing.updatedAtMs = now;
        spriteCacheDebugByKey.set(cacheKey, existing);
        if (import.meta.env.DEV && existing.requestCount === 2) {
            console.debug("[renderSprites] cache hit", {
                cacheKey,
                spriteId,
                paletteVariantKey,
            });
        }
        return;
    }
    spriteCacheDebugByKey.set(cacheKey, {
        cacheKey,
        spriteId,
        paletteVariantKey,
        requestCount: 1,
        state: "PENDING",
        createdAtMs: now,
        updatedAtMs: now,
    });
    if (import.meta.env.DEV) {
        console.debug("[renderSprites] cache new", {
            cacheKey,
            spriteId,
            paletteVariantKey,
        });
    }
}

function noteSpriteCacheState(
    cacheKey: string,
    state: SpriteCacheDebugState,
    error?: string,
): void {
    const existing = spriteCacheDebugByKey.get(cacheKey);
    if (!existing) return;
    const previousState = existing.state;
    existing.state = state;
    existing.updatedAtMs = performance.now();
    existing.lastError = error;
    spriteCacheDebugByKey.set(cacheKey, existing);
    if (import.meta.env.DEV && previousState !== state) {
        console.debug("[renderSprites] cache state transition", {
            cacheKey,
            spriteId: existing.spriteId,
            paletteVariantKey: existing.paletteVariantKey,
            from: previousState,
            to: state,
            requestCount: existing.requestCount,
            error: error ?? null,
        });
    }
}

function loadByIdInternal(
    spriteId: string,
    forcedPaletteId?: string,
    forcedWeightPercents?: PaletteSwapWeightPercents,
): LoadedImg {
    const rawId = spriteId.trim();
    const paletteId = effectivePaletteId(forcedPaletteId);
    const defaultWeightPercents = resolveActivePaletteSwapWeightPercents();
    const effectiveWeightPercents = normalizeWeightPercents(forcedWeightPercents ?? defaultWeightPercents);
    const paletteVariantKey = buildPaletteVariantKey(paletteId, effectiveWeightPercents);
    const paletteSwapWeights = toPaletteSwapWeights(effectiveWeightPercents);
    const paletteManaged = isPaletteManagedSpriteId(rawId);
    const key = buildSpriteCacheKey(rawId, paletteManaged, paletteVariantKey);
    noteSpriteCacheRequest(key, rawId, paletteManaged ? paletteVariantKey : null);
    if (!rawId) return { img: new Image(), ready: false, failed: true, unsupported: true, error: "empty-id" };
    if (cache[key]) return cache[key];

    const url = resolveUrl(rawId);
    if (!url) {
        console.warn(`[renderSprites] Missing tile sprite: ${spriteId}`);
        const rec = { img: new Image(), ready: false, failed: true, unsupported: true, error: "missing-url" };
        cache[key] = rec;
        noteSpriteCacheState(key, "UNSUPPORTED", "missing-url");
        return rec;
    }

    // IMPORTANT:
    // If palette swap is active, never expose the db32 image to rendering.
    // Keep a transparent placeholder until the swapped image is ready.
    const enabledNow = paletteManaged && (paletteId !== "db32" || paletteSwapWeights.darkness > 0);
    const rec: LoadedImg = {
        img: enabledNow ? makeTransparent1x1() : new Image(),
        ready: false,
        failed: false,
        unsupported: false,
    };
    cache[key] = rec;

    const baseImg = new Image();
    baseImg.onload = () => {
        const enabled = paletteManaged && (paletteId !== "db32" || paletteSwapWeights.darkness > 0);

        if (!enabled) {
            // db32 path: expose base immediately
            rec.img = baseImg;
            rec.ready = true;
            rec.failed = false;
            rec.error = undefined;
            noteSpriteCacheState(key, "READY");
            return;
        }

        try {
            const swappedCanvas = applyPaletteSwapToCanvas(baseImg, paletteId, paletteSwapWeights);

            const swappedImg = new Image();
            swappedImg.onload = () => {
                rec.img = swappedImg;
                rec.ready = true;
                rec.failed = false;
                rec.error = undefined;
                noteSpriteCacheState(key, "READY");
            };
            swappedImg.onerror = () => {
                rec.img = baseImg;
                rec.ready = true;
                rec.failed = false;
                rec.error = undefined;
                noteSpriteCacheState(key, "READY");
            };
            swappedImg.src = swappedCanvas.toDataURL("image/png");
        } catch {
            rec.img = baseImg;
            rec.ready = true;
            rec.failed = false;
            rec.error = undefined;
            noteSpriteCacheState(key, "READY");
        }
    };
    baseImg.onerror = () => {
        rec.ready = false;
        rec.failed = true;
        rec.unsupported = false;
        rec.error = `decode-failed:${rawId}`;
        noteSpriteCacheState(key, "FAILED", rec.error);
    };
    baseImg.src = url;

    return rec;
}

function loadById(spriteId: string): LoadedImg {
    return loadByIdInternal(spriteId);
}

function loadByUrl(cacheKey: string, url: string | null): LoadedImg {
    const key = cacheKey.trim();
    if (!key) return { img: new Image(), ready: false, failed: true, unsupported: true, error: "empty-key" };
    if (cache[key]) return cache[key];

    if (!url) {
        const rec = { img: new Image(), ready: false, failed: true, unsupported: true, error: "missing-url" };
        cache[key] = rec;
        return rec;
    }

    const img = new Image();
    const rec: LoadedImg = { img, ready: false, failed: false, unsupported: false };
    cache[key] = rec;
    img.onload = () => {
        rec.ready = true;
        rec.failed = false;
        rec.error = undefined;
    };
    img.onerror = () => {
        rec.ready = false;
        rec.failed = true;
        rec.unsupported = false;
        rec.error = `decode-failed:${cacheKey}`;
    };
    img.src = url;
    return rec;
}

export function getTileSpriteById(spriteId: string): LoadedImg {
    return loadById(spriteId);
}

export function getSpriteById(spriteId: string): LoadedImg {
    return loadById(spriteId);
}

export function getSpriteByIdForPalette(spriteId: string, paletteId: string): LoadedImg {
    return loadByIdInternal(spriteId, paletteId);
}

export function getSpriteByIdForVariantKey(
    spriteId: string,
    paletteVariantKey: string,
): LoadedImg {
    const parsed = parsePaletteVariantKey(paletteVariantKey);
    if (!parsed) return loadByIdInternal(spriteId);
    return loadByIdInternal(spriteId, parsed.paletteId, {
        sWeightPercent: parsed.sWeightPercent,
        darknessPercent: parsed.darknessPercent,
    });
}

export function getSpriteByIdForDarknessPercent(
    spriteId: string,
    darknessPercent: 0 | 25 | 50 | 75 | 100,
): LoadedImg {
    const paletteId = effectivePaletteId();
    const activePercents = resolveActivePaletteSwapWeightPercents();
    return loadByIdInternal(spriteId, paletteId, {
        sWeightPercent: activePercents.sWeightPercent,
        darknessPercent,
    });
}

export function resolveSpriteCacheKeyForVariantKey(
    spriteId: string,
    paletteVariantKey: string,
): string {
    const rawSpriteId = spriteId.trim();
    const paletteManaged = isPaletteManagedSpriteId(rawSpriteId);
    return buildSpriteCacheKey(rawSpriteId, paletteManaged, paletteVariantKey);
}

export function hasSpriteRecordForCacheKey(cacheKey: string): boolean {
    return !!cache[cacheKey];
}

export function getSpriteCacheDebugSnapshotByKey(cacheKey: string): SpriteCacheDebugSnapshot | null {
    const existing = spriteCacheDebugByKey.get(cacheKey);
    if (!existing) return null;
    return { ...existing };
}

export function getRuntimeSquareFloorSprite(
    family: "sidewalk" | "asphalt" | "park",
    variantIndex: number,
): LoadedImg {
    const max = getFloorVariantCount(family);
    const idx = Math.max(1, Math.min(max, Math.floor(variantIndex)));
    return loadById(`tiles/floor/${family}/${idx}`);
}

export function getRuntimeDecalSprite(
    setId: RuntimeDecalSetId,
    variantIndex: number,
): LoadedImg {
    const spriteId = getDecalSpriteId(setId, variantIndex);
    if (!spriteId) return { img: new Image(), ready: false, failed: true, unsupported: true, error: "missing-decal-id" };
    return loadById(spriteId);
}

export function setActiveMapSkinId(id?: MapSkinId): void {
    setActiveMapSkinIdInContent(id);
}

export function getVoidTop(nowMs: number = performance.now(), flowRate: number = 1): LoadedImg {
    const skinId = getActiveMapSkinId();
    const semantic = resolveSemanticSprite(skinId, "VOID_TOP");
    const skin = resolveMapSkin(skinId);
    const bg = semantic || skin.background;
    if (isWaterBackgroundId(bg)) {
        return getAnimatedWaterSprite(nowMs, flowRate);
    }
    return loadById(bg);
}

export function getAnimatedWaterSprite(nowMs: number, flowRate: number): LoadedImg {
    const rate = Number.isFinite(flowRate) ? Math.max(0.05, flowRate) : 1;
    return getAnimatedTileFrame("water2", (nowMs / 1000) * rate);
}

export function getAnimatedTileFrame(setId: AnimatedTileSetId, timeSec: number): LoadedImg {
    const set = ANIMATED_TILE_SETS[setId];
    const t = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
    const step = Math.floor(t * set.fps);
    let frameIdx = step % set.frameCount;
    if (set.playback === "pingpong" && set.frameCount > 1) {
        const period = set.frameCount * 2 - 2;
        const phase = step % period;
        frameIdx = phase < set.frameCount ? phase : period - phase;
    }
    return getAnimatedTileFrames(setId)[frameIdx];
}
// IMPORTANT: this must be a named export (your render.ts imports it by name)
export function preloadRenderSprites(): void {
    void getVoidTop();
    void getAnimatedTileFrames("water1");
    void getAnimatedTileFrames("water2");
    for (const [family, count] of Object.entries(RUNTIME_FLOOR_VARIANT_COUNTS) as [RuntimeFloorFamily, number][]) {
        for (let i = 1; i <= count; i++) void getRuntimeSquareFloorSprite(family, i);
    }
    for (const [setId, spriteIds] of Object.entries(RUNTIME_DECAL_SPRITE_IDS) as [RuntimeDecalSetId, string[]][]) {
        for (let i = 0; i < spriteIds.length; i++) {
            void getRuntimeDecalSprite(setId, i + 1);
        }
    }
    preloadCurrencySprites();
    preloadVfxSprites();
    for (const spriteId of listProjectilePresentationSpriteIds()) void getSpriteById(spriteId);
}

export function enqueueSpritePrewarm(
    spriteIds: string[],
    paletteVariantKey: string,
): void {
    const ids = Array.from(new Set(spriteIds.map((s) => s.trim()).filter(Boolean)));
    for (const id of ids) {
        prewarmQueue.push({ spriteId: id, paletteVariantKey });
    }
    prewarmActive = prewarmQueue.length > 0;
}

export function tickSpritePrewarm(budgetMs: number): boolean {
    if (!prewarmActive) return true;

    const start = performance.now();
    while (prewarmQueue.length > 0) {
        const item = prewarmQueue.shift()!;
        void getSpriteByIdForVariantKey(item.spriteId, item.paletteVariantKey);
        if (performance.now() - start >= budgetMs) {
            return false;
        }
    }

    prewarmActive = false;
    return true;
}
