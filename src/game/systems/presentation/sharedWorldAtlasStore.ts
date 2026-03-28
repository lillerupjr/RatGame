import { getTileSpriteById } from "../../../engine/render/sprites/renderSprites";
import type { RawCacheMetricSample } from "./cacheMetricsRegistry";
import { buildAtlasPages } from "./atlasPageBuilder";
import {
  collectDynamicAtlasSources,
  type DynamicAtlasImageSource,
  type DynamicAtlasSourceSnapshot,
} from "./dynamicAtlasSources";
import { buildUniqueStaticStructureSpriteIds } from "./staticStructureSpriteInventory";

type SharedWorldAtlasRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export type SharedWorldAtlasFrame = SharedWorldAtlasRect & {
  image: HTMLCanvasElement;
};

type SharedWorldAtlasSyncInput = {
  compiledMap: {
    id: string;
    originTx: number;
    originTy: number;
    width: number;
    height: number;
  };
  paletteVariantKey: string;
};

type SharedWorldAtlasSnapshot = {
  spriteIds: string[];
  readySources: { sourceKey: string; image: DynamicAtlasImageSource }[];
  pendingSourceKeys: Set<string>;
  fallbackSourceKeys: Set<string>;
};

function buildContextKey(input: SharedWorldAtlasSyncInput): string {
  return `map:${input.compiledMap.id}||palv:${input.paletteVariantKey}`;
}

function spriteSourceKey(spriteId: string): string {
  return `sprite:${spriteId}`;
}

function sameStringSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export class SharedWorldAtlasStore {
  private contextKey = "";
  private pageCanvases: HTMLCanvasElement[] = [];
  private frameBySourceKey = new Map<string, SharedWorldAtlasFrame>();
  private frameByImage = new WeakMap<object, SharedWorldAtlasFrame>();
  private readyImageBySourceKey = new Map<string, DynamicAtlasImageSource>();
  private overlaySpriteIds: string[] = [];
  private pendingSourceKeys = new Set<string>();
  private fallbackSourceKeys = new Set<string>();
  private hitCount = 0;
  private missCount = 0;
  private insertCount = 0;
  private clearCount = 0;
  private generationValue = 0;

  get generation(): number {
    return this.generationValue;
  }

  getPageCount(): number {
    return this.pageCanvases.length;
  }

  sync(input: SharedWorldAtlasSyncInput): void {
    const nextContextKey = buildContextKey(input);
    const snapshot = this.collectSnapshot(input);
    if (nextContextKey !== this.contextKey) {
      if (this.contextKey || this.pageCanvases.length > 0 || this.frameBySourceKey.size > 0) {
        this.clearCount += 1;
      }
      this.contextKey = nextContextKey;
      this.rebuildFromSnapshot(snapshot);
      return;
    }

    if (!this.snapshotChanged(snapshot)) return;
    this.rebuildFromSnapshot(snapshot);
  }

  getSpriteFrame(spriteId: string): SharedWorldAtlasFrame | null {
    return this.getFrameBySourceKey(spriteSourceKey(spriteId));
  }

  getFrameForImage(image: object | null | undefined): SharedWorldAtlasFrame | null {
    if (!image || typeof image !== "object") {
      this.missCount += 1;
      return null;
    }
    const frame = this.frameByImage.get(image) ?? null;
    if (!frame) {
      this.missCount += 1;
      return null;
    }
    this.hitCount += 1;
    return frame;
  }

  clear(): void {
    this.pageCanvases = [];
    this.frameBySourceKey.clear();
    this.frameByImage = new WeakMap();
    this.readyImageBySourceKey.clear();
    this.overlaySpriteIds = [];
    this.pendingSourceKeys.clear();
    this.fallbackSourceKeys.clear();
    this.clearCount += 1;
    this.generationValue += 1;
  }

  getDebugCacheMetrics(): RawCacheMetricSample {
    const approxBytes = this.pageCanvases.reduce((total, canvas) => (
      total + canvas.width * canvas.height * 4
    ), 0);
    return {
      name: "sharedWorldAtlas",
      kind: "derived",
      entryCount: this.frameBySourceKey.size,
      approxBytes,
      hits: this.hitCount,
      misses: this.missCount,
      inserts: this.insertCount,
      evictions: 0,
      clears: this.clearCount,
      bounded: true,
      hasEviction: false,
      contextKey: this.contextKey,
      generation: this.generationValue,
      notes: `pages:${this.pageCanvases.length} sprites:${this.overlaySpriteIds.length} pending:${this.pendingSourceKeys.size} fallback:${this.fallbackSourceKeys.size}`,
    };
  }

  private getFrameBySourceKey(sourceKey: string): SharedWorldAtlasFrame | null {
    const frame = this.frameBySourceKey.get(sourceKey) ?? null;
    if (!frame) {
      this.missCount += 1;
      return null;
    }
    this.hitCount += 1;
    return frame;
  }

  private collectSnapshot(input: SharedWorldAtlasSyncInput): SharedWorldAtlasSnapshot {
    const spriteIds = buildUniqueStaticStructureSpriteIds(input.compiledMap);
    const readyByKey = new Map<string, { sourceKey: string; image: DynamicAtlasImageSource }>();
    const pendingSourceKeys = new Set<string>();
    const fallbackSourceKeys = new Set<string>();

    for (let i = 0; i < spriteIds.length; i++) {
      const spriteId = spriteIds[i];
      const sourceKey = spriteSourceKey(spriteId);
      const rec = getTileSpriteById(spriteId);
      if (rec?.ready && rec.img && rec.img.width > 0 && rec.img.height > 0) {
        readyByKey.set(sourceKey, {
          sourceKey,
          image: rec.img,
        });
        continue;
      }
      if (rec && !rec.ready && !rec.failed && !rec.unsupported) pendingSourceKeys.add(sourceKey);
      else fallbackSourceKeys.add(sourceKey);
    }

    const dynamicSnapshot: DynamicAtlasSourceSnapshot = collectDynamicAtlasSources(input.paletteVariantKey);
    for (let i = 0; i < dynamicSnapshot.readySources.length; i++) {
      const source = dynamicSnapshot.readySources[i];
      readyByKey.set(source.sourceKey, {
        sourceKey: source.sourceKey,
        image: source.image,
      });
    }
    for (const sourceKey of dynamicSnapshot.pendingSourceKeys) pendingSourceKeys.add(sourceKey);
    for (const sourceKey of dynamicSnapshot.fallbackSourceKeys) fallbackSourceKeys.add(sourceKey);

    return {
      spriteIds,
      readySources: Array.from(readyByKey.values()).sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
      pendingSourceKeys,
      fallbackSourceKeys,
    };
  }

  private snapshotChanged(snapshot: SharedWorldAtlasSnapshot): boolean {
    if (!sameStringArray(this.overlaySpriteIds, snapshot.spriteIds)) return true;
    if (this.readyImageBySourceKey.size !== snapshot.readySources.length) return true;
    if (!sameStringSet(this.pendingSourceKeys, snapshot.pendingSourceKeys)) return true;
    if (!sameStringSet(this.fallbackSourceKeys, snapshot.fallbackSourceKeys)) return true;
    for (let i = 0; i < snapshot.readySources.length; i++) {
      const source = snapshot.readySources[i];
      if (this.readyImageBySourceKey.get(source.sourceKey) !== source.image) return true;
    }
    return false;
  }

  private rebuildFromSnapshot(snapshot: SharedWorldAtlasSnapshot): void {
    const { pageCanvases, frameBySourceKey, frameByImage } = buildAtlasPages(snapshot.readySources, "sharedWorldAtlas");
    const previousHadAtlas = this.pageCanvases.length > 0;
    this.pageCanvases = pageCanvases;
    this.frameBySourceKey = frameBySourceKey as Map<string, SharedWorldAtlasFrame>;
    this.frameByImage = frameByImage as WeakMap<object, SharedWorldAtlasFrame>;
    this.readyImageBySourceKey = new Map(snapshot.readySources.map((source) => [source.sourceKey, source.image]));
    this.overlaySpriteIds = [...snapshot.spriteIds];
    this.pendingSourceKeys = new Set(snapshot.pendingSourceKeys);
    this.fallbackSourceKeys = new Set(snapshot.fallbackSourceKeys);
    if (previousHadAtlas || this.pageCanvases.length > 0 || this.clearCount === 0) {
      this.insertCount += this.frameBySourceKey.size;
      this.generationValue += 1;
    }
  }
}
