import { resolveMapSkin, resolveSemanticSprite, type MapSkinId } from "../../../game/content/mapSkins";
import { isKnownRenderableSpriteId } from "./spriteIdRegistry";

export type LoadedImg = {
    img: HTMLImageElement;
    ready: boolean;
};

const TILE_MODULES = import.meta.glob("../../../assets/tiles/**/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const STRUCTURE_MODULES = import.meta.glob("../../../assets/structures/**/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const PROP_MODULES = import.meta.glob("../../../assets/props/**/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const cache: Record<string, LoadedImg> = Object.create(null);

function resolveUrl(spriteId: string): string | null {
    const trimmed = spriteId.trim();
    if (!trimmed) return null;
    const id = trimmed.toLowerCase().endsWith(".png") ? trimmed.slice(0, -4) : trimmed;
    if (!isKnownRenderableSpriteId(id)) return null;

    if (id.startsWith("tiles/")) {
        const key = `../../../assets/${id}.png`;
        return TILE_MODULES[key] ?? null;
    }
    if (id.startsWith("structures/")) {
        const key = `../../../assets/${id}.png`;
        return STRUCTURE_MODULES[key] ?? null;
    }
    if (id.startsWith("props/")) {
        const key = `../../../assets/${id}.png`;
        return PROP_MODULES[key] ?? null;
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

export function getTileSpriteById(spriteId: string): LoadedImg {
    return loadById(spriteId);
}

let _activeMapSkinId: MapSkinId | undefined = undefined;

export function setActiveMapSkinId(id?: MapSkinId): void {
    _activeMapSkinId = id;
}

export function getVoidTop(): LoadedImg {
    const semantic = resolveSemanticSprite(_activeMapSkinId, "VOID_TOP");
    const skin = resolveMapSkin(_activeMapSkinId);
    const bg = semantic || skin.background;
    return loadById(bg);
}
// IMPORTANT: this must be a named export (your render.ts imports it by name)
export function preloadRenderSprites(): void {
    void getVoidTop();
}
