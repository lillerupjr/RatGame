import { resolveMapSkin, resolveSemanticSprite, type MapSkinId } from "../../../game/content/mapSkins";
import { isKnownRenderableSpriteId } from "./spriteIdRegistry";
import { getFloorVariantCount, RUNTIME_FLOOR_VARIANT_COUNTS, type RuntimeFloorFamily } from "../../../game/content/runtimeFloorConfig";
import {
    getDecalSpriteId,
    RUNTIME_DECAL_SPRITE_IDS,
    type RuntimeDecalSetId,
} from "../../../game/content/runtimeDecalConfig";

export type LoadedImg = {
    img: HTMLImageElement;
    ready: boolean;
};

const cache: Record<string, LoadedImg> = Object.create(null);
const WATER_FRAME_COUNT = 6;
const WATER_FRAME_MS = 150;

function normalizeSpriteId(spriteId: string): string {
    const trimmed = spriteId.trim();
    return trimmed.toLowerCase().endsWith(".png") ? trimmed.slice(0, -4) : trimmed;
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
    const id = trimmed.toLowerCase().endsWith(".png") ? trimmed.slice(0, -4) : trimmed;
    if (!isKnownRenderableSpriteId(id)) return null;

    if (id.startsWith("tiles/") || id.startsWith("structures/") || id.startsWith("props/")) {
        return `/assets-runtime/${id}.png`;
    }
    return null;
}

function loadById(spriteId: string): LoadedImg {
    const key = spriteId.trim();
    if (!key) return { img: new Image(), ready: false };
    if (cache[key]) return cache[key];

    const url = resolveUrl(key);
    if (!url) {
        console.warn(`[renderSprites] Missing tile sprite: ${spriteId}`);
        const rec = { img: new Image(), ready: false };
        cache[key] = rec;
        return rec;
    }

    const img = new Image();
    const rec: LoadedImg = { img, ready: false };
    cache[key] = rec;

    img.onload = () => (rec.ready = true);
    img.onerror = () => (rec.ready = false);
    img.src = url;

    return rec;
}

function loadByUrl(cacheKey: string, url: string | null): LoadedImg {
    const key = cacheKey.trim();
    if (!key) return { img: new Image(), ready: false };
    if (cache[key]) return cache[key];

    if (!url) {
        const rec = { img: new Image(), ready: false };
        cache[key] = rec;
        return rec;
    }

    const img = new Image();
    const rec: LoadedImg = { img, ready: false };
    cache[key] = rec;
    img.onload = () => (rec.ready = true);
    img.onerror = () => (rec.ready = false);
    img.src = url;
    return rec;
}

export function getTileSpriteById(spriteId: string): LoadedImg {
    return loadById(spriteId);
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
    if (!spriteId) return { img: new Image(), ready: false };
    const url = `/assets-runtime/${spriteId}.png`;
    return loadByUrl(spriteId, url);
}

let _activeMapSkinId: MapSkinId | undefined = undefined;

export function setActiveMapSkinId(id?: MapSkinId): void {
    _activeMapSkinId = id;
}

export function getVoidTop(nowMs: number = performance.now(), flowRate: number = 1): LoadedImg {
    const semantic = resolveSemanticSprite(_activeMapSkinId, "VOID_TOP");
    const skin = resolveMapSkin(_activeMapSkinId);
    const bg = semantic || skin.background;
    if (isWaterBackgroundId(bg)) {
        return getAnimatedWaterSprite(nowMs, flowRate);
    }
    return loadById(bg);
}

export function getAnimatedWaterSprite(nowMs: number, flowRate: number): LoadedImg {
    const rate = Number.isFinite(flowRate) ? Math.max(0.05, flowRate) : 1;
    const frame = (Math.floor(nowMs / (WATER_FRAME_MS / rate)) % WATER_FRAME_COUNT) + 1;
    return loadById(`tiles/animated/water2/${frame}`);
}
// IMPORTANT: this must be a named export (your render.ts imports it by name)
export function preloadRenderSprites(): void {
    void getVoidTop();
    for (let i = 1; i <= WATER_FRAME_COUNT; i++) {
        void loadById(`tiles/animated/water2/${i}`);
    }
    for (const [family, count] of Object.entries(RUNTIME_FLOOR_VARIANT_COUNTS) as [RuntimeFloorFamily, number][]) {
        for (let i = 1; i <= count; i++) void getRuntimeSquareFloorSprite(family, i);
    }
    for (const [setId, spriteIds] of Object.entries(RUNTIME_DECAL_SPRITE_IDS) as [RuntimeDecalSetId, string[]][]) {
        for (let i = 0; i < spriteIds.length; i++) {
            void getRuntimeDecalSprite(setId, i + 1);
        }
    }
}
