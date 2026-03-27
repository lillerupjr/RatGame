import type { StructureV6VerticalShadowMaskDebugData } from "./structureShadowV6Slices";
import type { RawCacheMetricSample } from "../cacheMetricsRegistry";

export type StructureV6ShadowCacheEntry = {
  structureInstanceId: string;
  geometrySignature: string;
  sunStepKey: string;
  requestedSliceCount: number;
  includeVertical: boolean;
  includeTop: boolean;
  mergedShadowMask: StructureV6VerticalShadowMaskDebugData;
};

export type StructureV6ShadowCacheFrameReset = {
  sunStepChanged: boolean;
  cleared: boolean;
};

export type StructureV6ShadowCacheLookupInput = {
  structureInstanceId: string;
  expectedGeometrySignature: string;
  expectedSunStepKey: string;
  expectedSliceCount: number;
  expectedIncludeVertical: boolean;
  expectedIncludeTop: boolean;
};

export type StructureV6ShadowCacheFrameStats = {
  sunStepKey: string;
  cacheHits: number;
  cacheMisses: number;
  rebuiltStructures: number;
  reusedStructures: number;
  sunStepChanged: boolean;
  forceRefresh: boolean;
  cacheSize: number;
};

export class StructureShadowV6CacheStore {
  private mapId = "";
  private sunStepKey = "";
  private fullMapPopulationKey = "";
  private readonly entries = new Map<string, StructureV6ShadowCacheEntry>();
  private hitCount = 0;
  private missCount = 0;
  private insertCount = 0;
  private clearCount = 0;

  beginFrame(nextMapId: string, nextSunStepKey: string, forceRefresh = false): StructureV6ShadowCacheFrameReset {
    const mapChanged = nextMapId !== this.mapId;
    if (mapChanged) this.mapId = nextMapId;
    const sunStepChanged = nextSunStepKey !== this.sunStepKey;
    if (sunStepChanged) {
      this.sunStepKey = nextSunStepKey;
      this.entries.clear();
      this.fullMapPopulationKey = "";
      this.clearCount += 1;
    } else if (mapChanged) {
      this.entries.clear();
      this.fullMapPopulationKey = "";
      this.clearCount += 1;
    } else if (forceRefresh) {
      this.entries.clear();
      this.fullMapPopulationKey = "";
      this.clearCount += 1;
    }
    return {
      sunStepChanged,
      cleared: sunStepChanged || mapChanged || forceRefresh,
    };
  }

  clear(): void {
    this.entries.clear();
    this.fullMapPopulationKey = "";
    this.clearCount += 1;
  }

  getContextSunStepKey(): string {
    return this.sunStepKey;
  }

  get(input: StructureV6ShadowCacheLookupInput): StructureV6ShadowCacheEntry | undefined {
    const cached = this.entries.get(input.structureInstanceId);
    if (!cached) {
      this.missCount += 1;
      return undefined;
    }
    if (cached.geometrySignature !== input.expectedGeometrySignature) {
      this.entries.delete(input.structureInstanceId);
      this.missCount += 1;
      return undefined;
    }
    if (cached.sunStepKey !== input.expectedSunStepKey) {
      this.entries.delete(input.structureInstanceId);
      this.missCount += 1;
      return undefined;
    }
    if (cached.requestedSliceCount !== input.expectedSliceCount) {
      this.entries.delete(input.structureInstanceId);
      this.missCount += 1;
      return undefined;
    }
    if (cached.includeVertical !== input.expectedIncludeVertical) {
      this.entries.delete(input.structureInstanceId);
      this.missCount += 1;
      return undefined;
    }
    if (cached.includeTop !== input.expectedIncludeTop) {
      this.entries.delete(input.structureInstanceId);
      this.missCount += 1;
      return undefined;
    }
    this.hitCount += 1;
    return cached;
  }

  set(entry: StructureV6ShadowCacheEntry): void {
    this.entries.set(entry.structureInstanceId, entry);
    this.insertCount += 1;
  }

  isFullyPopulatedForKey(key: string): boolean {
    return key.length > 0 && this.fullMapPopulationKey === key;
  }

  markFullyPopulatedForKey(key: string): void {
    this.fullMapPopulationKey = key;
  }

  size(): number {
    return this.entries.size;
  }

  getDebugCacheMetrics(): RawCacheMetricSample {
    let approxBytes = 0;
    let hasKnownBytes = false;
    for (const entry of this.entries.values()) {
      const bytes = estimateVerticalShadowMaskBytes(entry.mergedShadowMask);
      if (bytes > 0) {
        approxBytes += bytes;
        hasKnownBytes = true;
      }
    }
    return {
      name: "structureShadowMasks",
      kind: "scene",
      entryCount: this.entries.size,
      approxBytes: hasKnownBytes ? approxBytes : null,
      hits: this.hitCount,
      misses: this.missCount,
      inserts: this.insertCount,
      evictions: 0,
      clears: this.clearCount,
      bounded: false,
      hasEviction: false,
      contextKey: this.fullMapPopulationKey || this.mapId,
      notes: this.fullMapPopulationKey ? "full population cached" : "partial population",
    };
  }
}

function estimateCanvasBytes(canvas: HTMLCanvasElement | null | undefined): number {
  if (!canvas) return 0;
  const width = Number(canvas.width);
  const height = Number(canvas.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  return width * height * 4;
}

function estimateFaceSliceBytes(data: any): number {
  if (!data) return 0;
  let bytes = 0;
  bytes += estimateCanvasBytes(data.faceCanvas);
  bytes += estimateCanvasBytes(data.displacedSlicesCanvas);
  bytes += estimateCanvasBytes(data.mergedShadowCanvas);
  const slices = Array.isArray(data.slices) ? data.slices : [];
  for (let i = 0; i < slices.length; i++) bytes += estimateCanvasBytes(slices[i]?.canvas);
  const displacedSlices = Array.isArray(data.displacedSlices) ? data.displacedSlices : [];
  for (let i = 0; i < displacedSlices.length; i++) bytes += estimateCanvasBytes(displacedSlices[i]?.canvas);
  return bytes;
}

function estimateVerticalShadowMaskBytes(data: StructureV6VerticalShadowMaskDebugData | null | undefined): number {
  if (!data) return 0;
  return estimateCanvasBytes(data.mergedVerticalShadowCanvas)
    + estimateFaceSliceBytes(data.bucketAShadow)
    + estimateFaceSliceBytes(data.bucketBShadow)
    + estimateFaceSliceBytes(data.topShadow);
}
