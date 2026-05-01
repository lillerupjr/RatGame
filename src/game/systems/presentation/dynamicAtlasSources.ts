import { getSpriteByIdForVariantKey } from "../../../engine/render/sprites/renderSprites";
import { listPlayerDynamicAtlasSpriteIds } from "../../../engine/render/sprites/playerSprites";
import { listEnemyDynamicAtlasSpriteIds } from "../../../engine/render/sprites/enemySprites";
import { listBossDynamicAtlasSpriteIds } from "../../../engine/render/sprites/bossSprites";
import { listVendorNpcDynamicAtlasSpriteIds } from "../../../engine/render/sprites/vendorSprites";
import { listNeutralMobDynamicAtlasSpriteIds } from "../../../engine/render/sprites/neutralSprites";
import { listCurrencyDynamicAtlasSpriteIds } from "../../content/loot/currencyVisual";
import { listVfxSpriteIds } from "../../content/vfxRegistry";
import { listProjectileTravelSpriteIds } from "../../content/projectilePresentationRegistry";

export type DynamicAtlasImageSource = HTMLImageElement | HTMLCanvasElement;

export type DynamicAtlasSourceKind = "directFrame" | "spritePackFrame";

export type ReadyDynamicAtlasSource = {
  sourceKey: string;
  image: DynamicAtlasImageSource;
  kind: DynamicAtlasSourceKind;
};

export type DynamicAtlasSourceSnapshot = {
  readySources: ReadyDynamicAtlasSource[];
  pendingSourceKeys: Set<string>;
  fallbackSourceKeys: Set<string>;
};

type DynamicAtlasSourceAccumulator = {
  readyByKey: Map<string, ReadyDynamicAtlasSource>;
  pendingSourceKeys: Set<string>;
  fallbackSourceKeys: Set<string>;
};

function isReadyImageSource(value: unknown): value is DynamicAtlasImageSource {
  if (!value || typeof value !== "object") return false;
  const width = Number((value as { width?: number }).width ?? 0);
  const height = Number((value as { height?: number }).height ?? 0);
  return width > 0 && height > 0;
}

function addSpriteIdFamilySources(
  accumulator: DynamicAtlasSourceAccumulator,
  entries: readonly string[],
  paletteVariantKey: string,
  kind: DynamicAtlasSourceKind,
): void {
  for (let i = 0; i < entries.length; i++) {
    const spriteId = entries[i];
    const sourceKey = `${kind}:${spriteId}`;
    const rec = getSpriteByIdForVariantKey(spriteId, paletteVariantKey);
    if (rec?.ready && isReadyImageSource(rec.img)) {
      accumulator.readyByKey.set(sourceKey, {
        sourceKey,
        image: rec.img,
        kind,
      });
      continue;
    }
    if (rec && !rec.ready && !rec.failed && !rec.unsupported) {
      accumulator.pendingSourceKeys.add(sourceKey);
    } else {
      accumulator.fallbackSourceKeys.add(sourceKey);
    }
  }
}

function listVfxDynamicAtlasSpriteIds(): string[] {
  return listVfxSpriteIds();
}

export function collectDynamicAtlasSources(paletteVariantKey: string): DynamicAtlasSourceSnapshot {
  const accumulator: DynamicAtlasSourceAccumulator = {
    readyByKey: new Map(),
    pendingSourceKeys: new Set(),
    fallbackSourceKeys: new Set(),
  };

  addSpriteIdFamilySources(accumulator, listCurrencyDynamicAtlasSpriteIds(), paletteVariantKey, "directFrame");
  addSpriteIdFamilySources(accumulator, listProjectileTravelSpriteIds(), paletteVariantKey, "directFrame");
  addSpriteIdFamilySources(accumulator, listVfxDynamicAtlasSpriteIds(), paletteVariantKey, "directFrame");
  addSpriteIdFamilySources(accumulator, listVendorNpcDynamicAtlasSpriteIds(), paletteVariantKey, "directFrame");
  addSpriteIdFamilySources(accumulator, listNeutralMobDynamicAtlasSpriteIds(), paletteVariantKey, "directFrame");
  addSpriteIdFamilySources(accumulator, listPlayerDynamicAtlasSpriteIds(), paletteVariantKey, "spritePackFrame");
  addSpriteIdFamilySources(accumulator, listEnemyDynamicAtlasSpriteIds(), paletteVariantKey, "spritePackFrame");
  addSpriteIdFamilySources(accumulator, listBossDynamicAtlasSpriteIds(), paletteVariantKey, "spritePackFrame");

  return {
    readySources: Array.from(accumulator.readyByKey.values()).sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
    pendingSourceKeys: accumulator.pendingSourceKeys,
    fallbackSourceKeys: accumulator.fallbackSourceKeys,
  };
}
