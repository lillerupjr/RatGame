import { getSpriteByIdForVariantKey } from "../../../engine/render/sprites/renderSprites";
import {
  collectProjectileDynamicAtlasSources,
  type ProjectileAtlasSourceRecord,
} from "../../../engine/render/sprites/projectileSprites";
import { listPlayerDynamicAtlasSpriteIds } from "../../../engine/render/sprites/playerSprites";
import { listEnemyDynamicAtlasSpriteIds } from "../../../engine/render/sprites/enemySprites";
import { listVendorNpcDynamicAtlasSpriteIds } from "../../../engine/render/sprites/vendorSprites";
import { listNeutralMobDynamicAtlasSpriteIds } from "../../../engine/render/sprites/neutralSprites";
import { listCurrencyDynamicAtlasSpriteIds } from "../../content/loot/currencyVisual";
import { VFX_CLIPS } from "../../content/vfxRegistry";

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

function addProjectileSources(
  accumulator: DynamicAtlasSourceAccumulator,
  records: readonly ProjectileAtlasSourceRecord[],
): void {
  for (let i = 0; i < records.length; i++) {
    const { sourceKey, record } = records[i];
    if (record?.ready && isReadyImageSource(record.img)) {
      accumulator.readyByKey.set(sourceKey, {
        sourceKey,
        image: record.img,
        kind: "directFrame",
      });
      continue;
    }
    accumulator.pendingSourceKeys.add(sourceKey);
  }
}

function listVfxDynamicAtlasSpriteIds(): string[] {
  const ids = new Set<string>();
  for (let i = 0; i < VFX_CLIPS.length; i++) {
    const clip = VFX_CLIPS[i];
    for (let j = 0; j < clip.spriteIds.length; j++) ids.add(clip.spriteIds[j]);
  }
  return Array.from(ids).sort();
}

export function collectDynamicAtlasSources(paletteVariantKey: string): DynamicAtlasSourceSnapshot {
  const accumulator: DynamicAtlasSourceAccumulator = {
    readyByKey: new Map(),
    pendingSourceKeys: new Set(),
    fallbackSourceKeys: new Set(),
  };

  addSpriteIdFamilySources(accumulator, listCurrencyDynamicAtlasSpriteIds(), paletteVariantKey, "directFrame");
  addProjectileSources(accumulator, collectProjectileDynamicAtlasSources());
  addSpriteIdFamilySources(accumulator, listVfxDynamicAtlasSpriteIds(), paletteVariantKey, "directFrame");
  addSpriteIdFamilySources(accumulator, listVendorNpcDynamicAtlasSpriteIds(), paletteVariantKey, "directFrame");
  addSpriteIdFamilySources(accumulator, listNeutralMobDynamicAtlasSpriteIds(), paletteVariantKey, "directFrame");
  addSpriteIdFamilySources(accumulator, listPlayerDynamicAtlasSpriteIds(), paletteVariantKey, "spritePackFrame");
  addSpriteIdFamilySources(accumulator, listEnemyDynamicAtlasSpriteIds(), paletteVariantKey, "spritePackFrame");

  return {
    readySources: Array.from(accumulator.readyByKey.values()).sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
    pendingSourceKeys: accumulator.pendingSourceKeys,
    fallbackSourceKeys: accumulator.fallbackSourceKeys,
  };
}
