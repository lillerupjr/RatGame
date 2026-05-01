import type { RawCacheMetricSample } from "./cacheMetricsRegistry";
import { buildAtlasPages } from "./atlasPageBuilder";
import {
  collectDynamicAtlasSources,
  type DynamicAtlasImageSource,
  type DynamicAtlasSourceSnapshot,
} from "./dynamicAtlasSources";

type DynamicAtlasRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export type DynamicAtlasFrame = DynamicAtlasRect & {
  image: HTMLCanvasElement;
};

type DynamicAtlasSyncInput = {
  paletteVariantKey: string;
};

function buildContextKey(input: DynamicAtlasSyncInput): string {
  return `palv:${input.paletteVariantKey}`;
}

function sameStringSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

export class DynamicAtlasStore {
  private contextKey = "";
  private pageCanvases: HTMLCanvasElement[] = [];
  private frameBySourceKey = new Map<string, DynamicAtlasFrame>();
  private frameByImage = new WeakMap<object, DynamicAtlasFrame>();
  private readyImageBySourceKey = new Map<string, DynamicAtlasImageSource>();
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

  sync(input: DynamicAtlasSyncInput): void {
    const nextContextKey = buildContextKey(input);
    const snapshot = collectDynamicAtlasSources(input.paletteVariantKey);
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

  getFrameForImage(image: object | null | undefined): DynamicAtlasFrame | null {
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

  getFrameForSourceKey(sourceKey: string): DynamicAtlasFrame | null {
    const frame = this.frameBySourceKey.get(sourceKey) ?? null;
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
      name: "dynamicAtlas",
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
      notes: `pages:${this.pageCanvases.length} pending:${this.pendingSourceKeys.size} fallback:${this.fallbackSourceKeys.size}`,
    };
  }

  private snapshotChanged(snapshot: DynamicAtlasSourceSnapshot): boolean {
    if (this.readyImageBySourceKey.size !== snapshot.readySources.length) return true;
    if (!sameStringSet(this.pendingSourceKeys, snapshot.pendingSourceKeys)) return true;
    if (!sameStringSet(this.fallbackSourceKeys, snapshot.fallbackSourceKeys)) return true;
    for (let i = 0; i < snapshot.readySources.length; i++) {
      const source = snapshot.readySources[i];
      if (this.readyImageBySourceKey.get(source.sourceKey) !== source.image) return true;
    }
    return false;
  }

  private rebuildFromSnapshot(snapshot: DynamicAtlasSourceSnapshot): void {
    const nextPages = this.buildPageCanvases(snapshot.readySources);
    const previousHadAtlas = this.pageCanvases.length > 0;
    this.pageCanvases = nextPages.pageCanvases;
    this.frameBySourceKey = nextPages.frameBySourceKey;
    this.frameByImage = nextPages.frameByImage;
    this.readyImageBySourceKey = new Map(snapshot.readySources.map((source) => [source.sourceKey, source.image]));
    this.pendingSourceKeys = new Set(snapshot.pendingSourceKeys);
    this.fallbackSourceKeys = new Set(snapshot.fallbackSourceKeys);
    if (previousHadAtlas || this.pageCanvases.length > 0 || this.clearCount === 0) {
      this.insertCount += this.frameBySourceKey.size;
      this.generationValue += 1;
    }
  }

  private buildPageCanvases(sources: readonly { sourceKey: string; image: DynamicAtlasImageSource }[]): {
    pageCanvases: HTMLCanvasElement[];
    frameBySourceKey: Map<string, DynamicAtlasFrame>;
    frameByImage: WeakMap<object, DynamicAtlasFrame>;
  } {
    const { pageCanvases, frameBySourceKey, frameByImage } = buildAtlasPages(sources, "dynamicAtlas");
    return {
      pageCanvases,
      frameBySourceKey: frameBySourceKey as Map<string, DynamicAtlasFrame>,
      frameByImage: frameByImage as WeakMap<object, DynamicAtlasFrame>,
    };
  }
}
