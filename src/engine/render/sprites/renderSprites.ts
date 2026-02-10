import { resolveMapSkin, type MapSkinId } from "../../../game/content/mapSkins";

export type LoadedImg = {
    img: HTMLImageElement;
    ready: boolean;
};

const TILE_MODULES = import.meta.glob("../../../assets/tiles/**/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const BUILDING_MODULES = import.meta.glob("../../../assets/buildings/**/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const cache: Record<string, LoadedImg> = Object.create(null);

function resolveUrl(spriteId: string): string | null {
    const trimmed = spriteId.trim();
    if (!trimmed) return null;
    const file = trimmed.toLowerCase().endsWith(".png") ? trimmed : `${trimmed}.png`;
    const findIn = (modules: Record<string, string>) => {
        for (const [path, url] of Object.entries(modules)) {
            const normalized = path.replace(/\\/g, "/");
            if (normalized.endsWith(`/assets/${file}`)) return url;
        }
        return null;
    };
    const tileHit = findIn(TILE_MODULES);
    if (tileHit) return tileHit;
    const buildingHit = findIn(BUILDING_MODULES);
    if (buildingHit) return buildingHit;
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
    const skin = resolveMapSkin(_activeMapSkinId);
    const bg = skin.background;
    return loadById(bg);
}
// IMPORTANT: this must be a named export (your render.ts imports it by name)
export function preloadRenderSprites(): void {
    void getVoidTop();
}
