// src/game/content/runtimeFloorConfig.ts
// Dynamically determines floor tile variant counts by scanning available files at build time.

export type RuntimeFloorFamily = "sidewalk" | "asphalt" | "park";

const RUNTIME_FLOOR_FAMILIES: RuntimeFloorFamily[] = ["sidewalk", "asphalt", "park"];

// Scan floor tile assets at build time using Vite's glob import
const FLOOR_TILE_MODULES = import.meta.glob("../../assets/tiles/floor/**/*.png", {
    eager: true,
    query: "?url",
    import: "default",
}) as Record<string, string>;

/**
 * Dynamically computed variant counts based on files present in each floor family folder.
 * Files are expected to be named 1.png, 2.png, ..., <n>.png
 */
function computeVariantCounts(): Record<RuntimeFloorFamily, number> {
    const counts: Record<string, number> = {};

    for (const family of RUNTIME_FLOOR_FAMILIES) {
        const prefix = `../../assets/tiles/floor/${family}/`;
        let max = 0;
        for (const path of Object.keys(FLOOR_TILE_MODULES)) {
            if (path.startsWith(prefix)) {
                const filename = path.slice(prefix.length);
                const match = filename.match(/^(\d+)\.png$/);
                if (match) {
                    max = Math.max(max, parseInt(match[1], 10));
                }
            }
        }
        counts[family] = Math.max(1, max); // At least 1 to avoid zero-division issues
    }

    return counts as Record<RuntimeFloorFamily, number>;
}

export const RUNTIME_FLOOR_VARIANT_COUNTS: Record<RuntimeFloorFamily, number> = computeVariantCounts();

/**
 * Get the variant count for a given floor family.
 */
export function getFloorVariantCount(family: RuntimeFloorFamily): number {
    return RUNTIME_FLOOR_VARIANT_COUNTS[family];
}


