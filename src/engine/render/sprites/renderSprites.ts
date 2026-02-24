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
import { resolveActivePaletteId } from "../../../game/render/activePalette";
import {
    getDecalSpriteId,
    RUNTIME_DECAL_SPRITE_IDS,
    type RuntimeDecalSetId,
} from "../../../game/content/runtimeDecalConfig";

export type LoadedImg = {
    img: HTMLImageElement;
    ready: boolean;
};
export type PaletteId = ReturnType<typeof resolveActivePaletteId>;

const cache: Record<string, LoadedImg> = Object.create(null);
const WATER_FRAME_COUNT = 6;
const WATER_FRAME_MS = 150;
const prewarmQueue: { spriteId: string; paletteId: PaletteId }[] = [];
let prewarmActive = false;

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

    if (id.startsWith("entities/")) {
        return `/assets-runtime/${id}.png`;
    }
    if (
        id.startsWith("tiles/")
        || id.startsWith("structures/")
        || id.startsWith("props/")
    ) {
        return `/assets-runtime/base_db32/${id}.png`;
    }
    return null;
}

function loadByIdInternal(spriteId: string, forcedPaletteId?: string): LoadedImg {
    const rawId = spriteId.trim();
    const paletteId = effectivePaletteId(forcedPaletteId);
    const paletteKey = `@@pal:${paletteId}`;
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

    // IMPORTANT:
    // If palette swap is active, never expose the db32 image to rendering.
    // Keep a transparent placeholder until the swapped image is ready.
    const enabledNow = paletteId !== "db32";
    const rec: LoadedImg = {
        img: enabledNow ? makeTransparent1x1() : new Image(),
        ready: false,
    };
    cache[key] = rec;

    const baseImg = new Image();
    baseImg.onload = () => {
        const paletteId2 = effectivePaletteId(forcedPaletteId);
        const enabled = paletteId2 !== "db32";

        if (!enabled) {
            // db32 path: expose base immediately
            rec.img = baseImg;
            rec.ready = true;
            return;
        }

        try {
            const swappedCanvas = applyPaletteSwapToCanvas(baseImg, paletteId2);

            const swappedImg = new Image();
            swappedImg.onload = () => {
                rec.img = swappedImg;
                rec.ready = true;
            };
            swappedImg.onerror = () => {
                rec.img = baseImg;
                rec.ready = true;
            };
            swappedImg.src = swappedCanvas.toDataURL("image/png");
        } catch {
            rec.img = baseImg;
            rec.ready = true;
        }
    };
    baseImg.onerror = () => {
        rec.ready = false;
    };
    baseImg.src = url;

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

export function getSpriteById(spriteId: string): LoadedImg {
    return loadById(spriteId);
}

export function getSpriteByIdForPalette(spriteId: string, paletteId: string): LoadedImg {
    return loadByIdInternal(spriteId, paletteId);
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

export function enqueueSpritePrewarm(
    spriteIds: string[],
    paletteId: PaletteId,
): void {
    const ids = Array.from(new Set(spriteIds.map((s) => s.trim()).filter(Boolean)));
    for (const id of ids) {
        prewarmQueue.push({ spriteId: id, paletteId });
    }
    prewarmActive = prewarmQueue.length > 0;
}

export function tickSpritePrewarm(budgetMs: number): boolean {
    if (!prewarmActive) return true;

    const start = performance.now();
    while (prewarmQueue.length > 0) {
        const item = prewarmQueue.shift()!;
        void loadByIdInternal(item.spriteId, item.paletteId);
        if (performance.now() - start >= budgetMs) {
            return false;
        }
    }

    prewarmActive = false;
    return true;
}
