
import type { World } from "../../engine/world/world";

export type BgAsset = {
    img: HTMLImageElement | null;
    ready: boolean;
    src?: string;
};

// FloorIndex (0-based) -> background file mapping
// floorIndex: 0=Floor1, 1=Floor2, 2=Floor3
export const BG_BY_FLOOR_INDEX: Record<number, string> = {
    0: "tiles/animated/water2/1.png", // DOCKS
    1: "tiles/animated/water2/1.png", // SEWERS
    2: "tiles/animated/water2/1.png", // CHINATOWN
};

const DEFAULT_BG_FILE = "tiles/animated/water2/1.png";

// Cache by floorIndex
const cache: Record<number, BgAsset> = {};

function resolveBgUrl(file: string): string | null {
    if (!file) return null;
    return `${import.meta.env.BASE_URL}assets-runtime/${file}`;
}

function ensureLoadedForIndex(floorIndex: number): BgAsset {
    if (cache[floorIndex]) return cache[floorIndex];

    const file = BG_BY_FLOOR_INDEX[floorIndex] ?? DEFAULT_BG_FILE;
    const url = resolveBgUrl(file);

    if (!url) {
        console.warn(`[background] ${file} not found in /assets-runtime/backgrounds/`);
        cache[floorIndex] = { img: null, ready: false };
        return cache[floorIndex];
    }

    const img = new Image();
    const asset: BgAsset = { img, ready: false, src: url };
    cache[floorIndex] = asset;

    img.onload = () => {
        asset.ready = true;
    };
    img.onerror = () => {
        console.warn(`[background] Failed to load: ${url}`);
        asset.ready = false;
    };

    img.src = url;
    return asset;
}

// Preload all mapped backgrounds (called in game.ts)
export function preloadBackgrounds() {
    for (const key of Object.keys(BG_BY_FLOOR_INDEX)) {
        ensureLoadedForIndex(Number(key));
    }
}

// Render-time getter (uses world.floorIndex)
export function getBackground(w: World): BgAsset {
    const idx = (w.floorIndex ?? 0) | 0;
    return ensureLoadedForIndex(idx);
}
