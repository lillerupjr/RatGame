import type { StructureV6VerticalShadowMaskDebugData } from "./structureShadowV6Slices";

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

  beginFrame(nextMapId: string, nextSunStepKey: string, forceRefresh = false): StructureV6ShadowCacheFrameReset {
    const mapChanged = nextMapId !== this.mapId;
    if (mapChanged) this.mapId = nextMapId;
    const sunStepChanged = nextSunStepKey !== this.sunStepKey;
    if (sunStepChanged) {
      this.sunStepKey = nextSunStepKey;
      this.entries.clear();
      this.fullMapPopulationKey = "";
    } else if (mapChanged) {
      this.entries.clear();
      this.fullMapPopulationKey = "";
    } else if (forceRefresh) {
      this.entries.clear();
      this.fullMapPopulationKey = "";
    }
    return {
      sunStepChanged,
      cleared: sunStepChanged || mapChanged || forceRefresh,
    };
  }

  clear(): void {
    this.entries.clear();
    this.fullMapPopulationKey = "";
  }

  getContextSunStepKey(): string {
    return this.sunStepKey;
  }

  get(input: StructureV6ShadowCacheLookupInput): StructureV6ShadowCacheEntry | undefined {
    const cached = this.entries.get(input.structureInstanceId);
    if (!cached) return undefined;
    if (cached.geometrySignature !== input.expectedGeometrySignature) {
      this.entries.delete(input.structureInstanceId);
      return undefined;
    }
    if (cached.sunStepKey !== input.expectedSunStepKey) {
      this.entries.delete(input.structureInstanceId);
      return undefined;
    }
    if (cached.requestedSliceCount !== input.expectedSliceCount) {
      this.entries.delete(input.structureInstanceId);
      return undefined;
    }
    if (cached.includeVertical !== input.expectedIncludeVertical) {
      this.entries.delete(input.structureInstanceId);
      return undefined;
    }
    if (cached.includeTop !== input.expectedIncludeTop) {
      this.entries.delete(input.structureInstanceId);
      return undefined;
    }
    return cached;
  }

  set(entry: StructureV6ShadowCacheEntry): void {
    this.entries.set(entry.structureInstanceId, entry);
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
}
