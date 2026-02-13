/**
 * Sprite metadata registry.
 *
 * Maps sprite IDs to their tile-footprint and Z-height information,
 * allowing the renderer to draw multi-tile / multi-Z sprites as a
 * single image instead of repeating a 1×1 tile sprite.
 *
 * Sprites without an entry default to { tileWidth: 1, tileHeight: 1, zHeight: 1 }.
 */

export type SpriteMeta = {
    /** Width in tile columns along +x (default 1). */
    tileWidth: number;
    /** Depth in tile rows along +y (default 1). */
    tileHeight: number;
    /** Number of Z-levels this sprite covers vertically (default 1). */
    zHeight: number;
    /** Optional manual distribution adjustment for runtime slice extra width. */
    sliceAlignAdjustPx?: number;
};

const DEFAULT_META: SpriteMeta = { tileWidth: 1, tileHeight: 1, zHeight: 1 };

const REGISTRY: Record<string, SpriteMeta> = Object.create(null);

export function registerSpriteMeta(id: string, meta: SpriteMeta): void {
    REGISTRY[id] = meta;
}

export function getSpriteMeta(id: string): SpriteMeta {
    return REGISTRY[id] ?? DEFAULT_META;
}

export function hasSpriteMeta(id: string): boolean {
    return id in REGISTRY;
}

// ── Test sprites ────────────────────────────────────────────────────
registerSpriteMeta("structures/buildings/test/test1", {
    tileWidth: 3,
    tileHeight: 2,
    zHeight: 5,
    sliceAlignAdjustPx: 0,
});
registerSpriteMeta("structures/buildings/test/test2", { tileWidth: 3, tileHeight: 2, zHeight: 8 });
registerSpriteMeta("structures/buildings/test/test3", { tileWidth: 3, tileHeight: 2, zHeight: 6 });
