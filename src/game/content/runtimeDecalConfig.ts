export type RuntimeDecalSetId = "sidewalk" | "asphalt";

const RUNTIME_DECAL_SET_IDS: RuntimeDecalSetId[] = ["sidewalk", "asphalt"];

const DECAL_TILE_MODULES = import.meta.glob("../../assets/tiles/floor/decals/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function computeDecalSpriteIds(): Record<RuntimeDecalSetId, string[]> {
  const out: Record<RuntimeDecalSetId, Array<{ index: number; spriteId: string }>> = {
    sidewalk: [],
    asphalt: [],
  };

  for (const path of Object.keys(DECAL_TILE_MODULES)) {
    const filename = path.split("/").pop() ?? "";
    const match = filename.match(/^(sidewalk|asphalt)_(\d+)\.png$/i);
    if (!match) continue;

    const setId = match[1].toLowerCase() as RuntimeDecalSetId;
    const idx = Number.parseInt(match[2], 10);
    if (!Number.isFinite(idx) || idx <= 0) continue;

    out[setId].push({
      index: idx,
      spriteId: `tiles/floor/decals/${setId}_${idx}`,
    });
  }

  const normalized = {} as Record<RuntimeDecalSetId, string[]>;
  for (let i = 0; i < RUNTIME_DECAL_SET_IDS.length; i++) {
    const setId = RUNTIME_DECAL_SET_IDS[i];
    const entries = out[setId].sort((a, b) => a.index - b.index);
    normalized[setId] = entries.map((entry) => entry.spriteId);
  }

  return normalized;
}

export const RUNTIME_DECAL_SPRITE_IDS: Record<RuntimeDecalSetId, string[]> =
  computeDecalSpriteIds();

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
