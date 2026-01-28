// src/game/visual/background.ts
import type { World } from "../world";

export type BgAsset = {
    img: HTMLImageElement | null;
    ready: boolean;
    src?: string;
};

// background.ts is in src/game/visual
// assets are in src/assets/backgrounds
const modules = import.meta.glob("../../assets/backgrounds/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

// ─────────────────────────────────────────────────────────────
// FloorIndex (0-based) → background file mapping
// floorIndex: 0=Floor1, 1=Floor2, 2=Floor3
// ─────────────────────────────────────────────────────────────
export const BG_BY_FLOOR_INDEX: Record<number, string> = {
    0: "test2.png",   // DOCKS
    1: "test.png",  // SEWERS
    2: "test3.png",  // CHINATOWN
};

const DEFAULT_BG_FILE = "";

// Cache by floorIndex
const cache: Record<number, BgAsset> = {};

function resolveBgUrl(file: string): string | null {
    for (const [path, url] of Object.entries(modules)) {
        if (path.endsWith(`/backgrounds/${file}`)) return url;
    }
    return null;
}

function ensureLoadedForIndex(floorIndex: number): BgAsset {
    if (cache[floorIndex]) return cache[floorIndex];

    const file = BG_BY_FLOOR_INDEX[floorIndex] ?? DEFAULT_BG_FILE;
    const url = resolveBgUrl(file);

    if (!url) {
        console.warn(`[background] ${file} not found in src/assets/backgrounds/`);
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
