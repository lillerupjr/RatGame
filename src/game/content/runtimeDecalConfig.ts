export type RuntimeDecalSetId = "sidewalk" | "asphalt";

export const RUNTIME_DECAL_SPRITE_IDS: Record<RuntimeDecalSetId, string[]> = {
    sidewalk: [
        "tiles/floor/decals/sidewalk_1",
        "tiles/floor/decals/sidewalk_2",
    ],
    asphalt: [
        "tiles/floor/decals/asphalt_1",
    ],
};

export const RUNTIME_DECAL_VARIANT_COUNTS: Record<RuntimeDecalSetId, number> = {
    sidewalk: RUNTIME_DECAL_SPRITE_IDS.sidewalk.length,
    asphalt: RUNTIME_DECAL_SPRITE_IDS.asphalt.length,
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
