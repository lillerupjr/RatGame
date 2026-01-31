// src/game/visual/kenneyTiles.ts
// Minimal loader for Kenney-style tiles (placeholder for Milestone A).
// Expects: src/game/assets/tiles/landscape_13.png

export type Loaded = { img: HTMLImageElement; ready: boolean; src?: string };

const modules = import.meta.glob("../../assets/tiles/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

// World-size of ONE tile in your physics world units.
// Tune later; for now keep it simple and stable.
export const KENNEY_TILE_WORLD = 64;

// Simple anchor tweak so the tile “sits” nicer (adjust later per tile set).
export const KENNEY_TILE_ANCHOR_Y = 0.55;

// ---- Configure expected filenames here ----
const FILES = {
    GROUND: "landscape_28.png",
    STAIRS: "landscape_20.png",
} as const;

const cache: Record<string, Loaded> = Object.create(null);

function resolveUrl(file: string): string | null {
    for (const [path, url] of Object.entries(modules)) {
        if (path.endsWith(`/tiles/${file}`)) return url;
    }
    return null;
}

function loadByFile(file: string): Loaded {
    const key = file;
    if (cache[key]) return cache[key];

    const url = resolveUrl(file);
    if (!url) {
        console.warn(`[kenneyTiles] Missing tile: ${file}`);
        cache[key] = { img: new Image(), ready: false };
        return cache[key];
    }

    const img = new Image();
    const rec: Loaded = { img, ready: false, src: url };
    cache[key] = rec;

    img.onload = () => (rec.ready = true);
    img.onerror = () => (rec.ready = false);
    img.src = url;

    return rec;
}

export function preloadKenneyTiles() {
    for (const file of Object.values(FILES)) loadByFile(file);
}

export function getKenneyGroundTile(): Loaded {
    return loadByFile(FILES.GROUND);
}

export function getKenneyStairsTile(): Loaded {
    return loadByFile(FILES.STAIRS);
}
