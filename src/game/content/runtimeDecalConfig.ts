export type RuntimeDecalSetId = "sidewalk" | "asphalt" | "road_markings";

export const RUNTIME_DECAL_SPRITE_IDS: Record<RuntimeDecalSetId, string[]> = {
    sidewalk: [
        "tiles/floor/decals/sidewalk_1",
        "tiles/floor/decals/sidewalk_2",
        "tiles/floor/decals/sidewalk_3",
        "tiles/floor/decals/sidewalk_4",
        "tiles/floor/decals/sidewalk_5",
        "tiles/floor/decals/sidewalk_6",
    ],
    asphalt: [
        "tiles/floor/decals/asphalt_1",
        "tiles/floor/decals/asphalt_2",
    ],
    road_markings: [
        "tiles/floor/decals/road_line_yellow2",
        "tiles/floor/decals/road_line",
        "tiles/floor/decals/road_crossing",
        "tiles/floor/decals/road_line",
        "tiles/floor/decals/road_crossing_full",
    ],
};

export const RUNTIME_DECAL_VARIANT_COUNTS: Record<RuntimeDecalSetId, number> = {
    sidewalk: RUNTIME_DECAL_SPRITE_IDS.sidewalk.length,
    asphalt: RUNTIME_DECAL_SPRITE_IDS.asphalt.length,
    road_markings: RUNTIME_DECAL_SPRITE_IDS.road_markings.length,
};

export function getDecalVariantCount(setId: RuntimeDecalSetId): number {
    return RUNTIME_DECAL_VARIANT_COUNTS[setId] ?? 0;
}

export function getDecalSpriteId(
    setId: RuntimeDecalSetId,
    variantIndex: number,
): string | null {
    const variants = RUNTIME_DECAL_SPRITE_IDS[setId] ?? [];
    if (variants.length === 0) return null;
    const idx = Math.max(1, Math.min(variants.length, Math.floor(variantIndex)));
    return variants[idx - 1] ?? null;
}
