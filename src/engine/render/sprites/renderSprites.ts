import { resolveMapSkin, resolveSemanticSprite, type MapSkinId } from "../../../game/content/mapSkins";
import { isKnownRenderableSpriteId } from "./spriteIdRegistry";
import { getFloorVariantCount, RUNTIME_FLOOR_VARIANT_COUNTS, type RuntimeFloorFamily } from "../../../game/content/runtimeFloorConfig";
import { getUserSettings } from "../../../userSettings";
import { applyPaletteSwapToCanvas } from "../palette/paletteSwap";
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

function effectivePaletteId(forcedPaletteId?: string): string {
    if (forcedPaletteId && forcedPaletteId !== "db32") return forcedPaletteId;
    const s = getUserSettings();
    if (s.render.paletteSwapEnabled && s.render.paletteId !== "db32") {
        return s.render.paletteId;
    }
    return "db32";
}

function normalizeSpriteId(spriteId: string): string {
    const trimmed = spriteId.trim();
    return trimmed.toLowerCase().endsWith(".png") ? trimmed.slice(0, -4) : trimmed;
}

function remapLegacySpriteId(id: string): string {
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

        "tiles/backgrounds/green_water": "tiles/animated/water2/1",
        "tiles/backgrounds/water": "tiles/animated/water2/1",
        "tiles/backgrounds/water1": "tiles/animated/water1/1",
        "tiles/backgrounds/water2": "tiles/animated/water2/1",
        "tiles/backgrounds/water3": "tiles/animated/water2/1",
    };
    return directMap[id] ?? id;
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
    if (!isKnownRenderableSpriteId(id)) return null;

    if (id.startsWith("tiles/") || id.startsWith("structures/") || id.startsWith("props/")) {
        return `/assets-runtime/base_db32/${id}.png`;
    }
    return null;
}

function loadByIdInternal(spriteId: string, forcedPaletteId?: string): LoadedImg {
    const rawId = spriteId.trim();
    const activePaletteId = effectivePaletteId(forcedPaletteId);
    const paletteKey = activePaletteId !== "db32"
        ? `@@pal:${activePaletteId}`
        : "@@pal:db32";
    const key = `${rawId}${paletteKey}`;
    if (!rawId) return { img: new Image(), ready: false };
    if (cache[key]) return cache[key];

    const url = resolveUrl(rawId);
    if (!url) {
        console.warn(`[renderSprites] Missing tile sprite: ${spriteId}`);
        const rec = { img: new Image(), ready: false };
        cache[key] = rec;
        return rec;
    }

    const img = new Image();
    const rec: LoadedImg = { img, ready: false };
    cache[key] = rec;

    img.onload = () => {
        const enabled = activePaletteId !== "db32";

        if (!enabled) {
            rec.ready = true;
            return;
        }

        // Swap into a canvas, then convert to an Image so downstream types remain unchanged.
        try {
            const swappedCanvas = applyPaletteSwapToCanvas(img, activePaletteId);

            const swappedImg = new Image();
            swappedImg.onload = () => {
                rec.img = swappedImg;
                rec.ready = true;
            };
            swappedImg.onerror = () => {
                rec.ready = true; // fallback to original image if conversion fails
            };
            swappedImg.src = swappedCanvas.toDataURL("image/png");
        } catch {
            rec.ready = true;
        }
    };
    img.onerror = () => (rec.ready = false);
    img.src = url;

    return rec;
}

function loadById(spriteId: string): LoadedImg {
    return loadByIdInternal(spriteId);
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
    return loadById(spriteId);
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

/**
 * Prewarm remapped runtime sprites for a given palette.
 * This is a best-effort helper to reduce first-frame palette hitching.
 *
 * Notes:
 * - In-memory only (cache resets on reload).
 * - Safe to call multiple times; cache prevents duplicate work.
 * - Intended to be called during loading/transition screens.
 */
export async function prewarmPaletteSprites(
    paletteId: string,
    spriteIds: string[],
): Promise<void> {
    const ids = Array.from(new Set(spriteIds.map((s) => s.trim()).filter(Boolean)));
    if (ids.length === 0) return;

    // Kick all loads; allow browser to schedule decode work.
    for (const id of ids) {
        void loadByIdInternal(id, paletteId);
    }

    // Wait until all are either ready or failed (bounded wait per sprite).
    // This keeps the API deterministic and avoids hanging forever on a bad URL.
    const start = performance.now();
    const MAX_WAIT_MS = 1500;

    await new Promise<void>((resolve) => {
        const tick = () => {
            const allDone = ids.every((id) => {
                const rec = loadByIdInternal(id, paletteId);
                return rec.ready;
            });

            const elapsed = performance.now() - start;
            if (allDone || elapsed >= MAX_WAIT_MS) {
                resolve();
                return;
            }

            requestAnimationFrame(tick);
        };

        tick();
    });
}
