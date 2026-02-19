import { getDecalSpriteId, type RuntimeDecalSetId } from "../../content/runtimeDecalConfig";

export type MarkingSpriteRef = {
  setId: RuntimeDecalSetId;
  spriteId: string;
  variantIndex: number;
};

export function resolveMarkingSprite(variant: number): MarkingSpriteRef | null {
  const setId: RuntimeDecalSetId = "road_markings";
  const spriteId = getDecalSpriteId(setId, variant);
  if (!spriteId) return null;
  return { setId, spriteId, variantIndex: variant };
}
