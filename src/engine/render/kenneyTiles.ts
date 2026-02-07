// src/game/visual/kenneyTiles.ts
// Minimal loader for Kenney-style tiles (placeholder for Milestone A).
// Expects: src/game/assets/tiles/landscape_13.png

export type Loaded = { img: HTMLImageElement; ready: boolean; src?: string };

const modules = import.meta.glob("../../../assets/tiles/*test.png", {
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
    GROUND: "edges_landscape_28.png",

    // Directional stairs (maps.ts tokens are authoritative; loader sets tile.skin)
    STAIRS_N: "edges_landscape_20.png",
    STAIRS_W: "edges_landscape_23.png",
    STAIRS_E: "edges_landscape_19.png",
    STAIRS_S: "edges_landscape_16.png",
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

function skinToFile(skin?: string): string | null {
    if (!skin) return null;
    // Loader currently stores e.g. "landscape_23" (no extension). Accept both.
    const s = skin.trim();
    if (!s) return null;
    return s.toLowerCase().endsWith("test.png") ? s : `${s}.png`;
}

export function preloadKenneyTiles() {
    for (const file of Object.values(FILES)) loadByFile(file);
}

export function getKenneyGroundTile(): Loaded {
    return loadByFile(FILES.GROUND);
}

// New: load by authored skin (tile.skin), with fallback to ground
export function getKenneyTileBySkin(skin?: string): Loaded {
    const file = skinToFile(skin);
    return file ? loadByFile(file) : loadByFile(FILES.GROUND);
}

// Back-compat: keep old API (defaults to "north" stairs art)
export function getKenneyStairsTile(): Loaded {
    return loadByFile(FILES.STAIRS_N);
}

