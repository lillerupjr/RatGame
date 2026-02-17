// src/game/content/runtimeFloorConfig.ts
// Runtime floor variant counts for public assets under /assets-runtime/tiles/floor.

export type RuntimeFloorFamily = "sidewalk" | "asphalt" | "park";

export const RUNTIME_FLOOR_VARIANT_COUNTS: Record<RuntimeFloorFamily, number> = {
    sidewalk: 1,
    asphalt: 1,
    park: 1,
};

/**
 * Get the variant count for a given floor family.
 */
export function getFloorVariantCount(family: RuntimeFloorFamily): number {
    return RUNTIME_FLOOR_VARIANT_COUNTS[family];
}
