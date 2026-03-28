import type { CompiledKenneyMap, ViewRect } from "../../map/compile/kenneyMap";
import type { RawCacheMetricSample } from "./cacheMetricsRegistry";
import type { RenderCommand } from "./contracts/renderCommands";
import {
  resolveGroundDecalProjectedCommand,
  resolveGroundSurfaceProjectedCommand,
  shouldRenderGroundDecalForFrame,
  shouldRenderGroundSurfaceForFrame,
  type GroundCommandResolverDeps,
  type ResolvedGroundProjectedCommand,
} from "./groundCommandResolver";
import { setRenderPerfDrawTag } from "./renderPerfCounters";
import { compareRenderKeys, resolveRenderZBand } from "./worldRenderOrdering";

const GROUND_CHUNK_SIZE = 8;
const VISIBLE_WINDOW_GRACE_MARGIN = 1;
const CHUNK_RETRY_INTERVAL_MS = 50;

export type CanvasGroundChunkCacheEntry = {
  zBand: number;
  chunkX: number;
  chunkY: number;
  minTx: number;
  maxTx: number;
  minTy: number;
  maxTy: number;
  commands: readonly RenderCommand[];
};

export type SyncCanvasGroundChunkCacheInput = GroundCommandResolverDeps & {
  cacheStore: CanvasGroundChunkCacheStore;
  contextKey: string;
  compiledMap: CompiledKenneyMap;
  renderAllHeights: boolean;
  activeH: number;
  viewRect: ViewRect;
  shouldCullBuildingAt: (tx: number, ty: number, w?: number, h?: number) => boolean;
};

type CanvasGroundChunkBuildBucket = {
  zBand: number;
  chunkX: number;
  chunkY: number;
  minTx: number;
  maxTx: number;
  minTy: number;
  maxTy: number;
  commands: ResolvedGroundProjectedCommand[];
};

type CanvasGroundChunkBuildResult = {
  entriesByBand: Map<number, CanvasGroundChunkCacheEntry[]>;
  coveredStableIds: Set<number>;
  pendingVisualChange: boolean;
  rebuiltChunkCount: number;
};

type LogicalChunkCoord = {
  chunkX: number;
  chunkY: number;
};

type LogicalChunkBounds = {
  minChunkX: number;
  maxChunkX: number;
  minChunkY: number;
  maxChunkY: number;
};

type RetainedLogicalChunk = {
  chunkX: number;
  chunkY: number;
  entriesByBand: Map<number, CanvasGroundChunkCacheEntry[]>;
  coveredStableIds: Set<number>;
  authoritative: boolean;
  pendingRetryAtMs: number;
};

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

function logicalChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

function resolveLogicalChunkCoord(tx: number, ty: number): LogicalChunkCoord {
  return {
    chunkX: floorDiv(tx, GROUND_CHUNK_SIZE),
    chunkY: floorDiv(ty, GROUND_CHUNK_SIZE),
  };
}

function buildLogicalChunkCoords(bounds: LogicalChunkBounds): LogicalChunkCoord[] {
  const coords: LogicalChunkCoord[] = [];
  for (let chunkY = bounds.minChunkY; chunkY <= bounds.maxChunkY; chunkY++) {
    for (let chunkX = bounds.minChunkX; chunkX <= bounds.maxChunkX; chunkX++) {
      coords.push({
        chunkX,
        chunkY,
      });
    }
  }
  return coords;
}

function resolveLogicalChunkBoundsForView(viewRect: ViewRect): LogicalChunkBounds {
  return {
    minChunkX: floorDiv(viewRect.minTx, GROUND_CHUNK_SIZE),
    maxChunkX: floorDiv(viewRect.maxTx, GROUND_CHUNK_SIZE),
    minChunkY: floorDiv(viewRect.minTy, GROUND_CHUNK_SIZE),
    maxChunkY: floorDiv(viewRect.maxTy, GROUND_CHUNK_SIZE),
  };
}

function expandLogicalChunkBounds(bounds: LogicalChunkBounds, margin: number): LogicalChunkBounds {
  return {
    minChunkX: bounds.minChunkX - margin,
    maxChunkX: bounds.maxChunkX + margin,
    minChunkY: bounds.minChunkY - margin,
    maxChunkY: bounds.maxChunkY + margin,
  };
}

function logicalChunkBoundsEqual(a: LogicalChunkBounds | null, b: LogicalChunkBounds | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.minChunkX === b.minChunkX
    && a.maxChunkX === b.maxChunkX
    && a.minChunkY === b.minChunkY
    && a.maxChunkY === b.maxChunkY;
}

function logicalChunkBoundsCount(bounds: LogicalChunkBounds | null): number {
  if (!bounds) return 0;
  return (bounds.maxChunkX - bounds.minChunkX + 1) * (bounds.maxChunkY - bounds.minChunkY + 1);
}

function isLogicalChunkWithinBounds(bounds: LogicalChunkBounds, chunkX: number, chunkY: number): boolean {
  return chunkX >= bounds.minChunkX
    && chunkX <= bounds.maxChunkX
    && chunkY >= bounds.minChunkY
    && chunkY <= bounds.maxChunkY;
}

function viewIntersectsChunk(view: ViewRect, entry: CanvasGroundChunkCacheEntry): boolean {
  return !(
    entry.maxTx < view.minTx
    || entry.minTx > view.maxTx
    || entry.maxTy < view.minTy
    || entry.minTy > view.maxTy
  );
}

function toCachedGroundRenderCommand(command: ResolvedGroundProjectedCommand): RenderCommand {
  return {
    pass: "GROUND",
    key: command.key,
    semanticFamily: command.semanticFamily,
    finalForm: "quad",
    payload: command.payload,
  };
}

function buildBucketToEntry(bucket: CanvasGroundChunkBuildBucket): CanvasGroundChunkCacheEntry | null {
  if (bucket.commands.length <= 0) return null;
  setRenderPerfDrawTag("floors");
  try {
    return {
      zBand: bucket.zBand,
      chunkX: bucket.chunkX,
      chunkY: bucket.chunkY,
      minTx: bucket.minTx,
      maxTx: bucket.maxTx,
      minTy: bucket.minTy,
      maxTy: bucket.maxTy,
      commands: bucket.commands.map((command) => toCachedGroundRenderCommand(command)),
    };
  } finally {
    setRenderPerfDrawTag(null);
  }
}

function buildGroundChunkBucketsForLogicalChunk(
  input: SyncCanvasGroundChunkCacheInput,
  targetChunkX: number,
  targetChunkY: number,
): CanvasGroundChunkBuildResult {
  const buckets = new Map<string, CanvasGroundChunkBuildBucket>();
  const coveredStableIds = new Set<number>();
  let pendingVisualChange = false;
  const onPendingVisualChange = () => {
    pendingVisualChange = true;
  };

  const pushCommand = (command: ResolvedGroundProjectedCommand): void => {
    const zBand = resolveRenderZBand(command.key, input.rampRoadTiles);
    const bucketKey = `${zBand}|${targetChunkX}|${targetChunkY}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      const minTx = targetChunkX * GROUND_CHUNK_SIZE;
      const minTy = targetChunkY * GROUND_CHUNK_SIZE;
      bucket = {
        zBand,
        chunkX: targetChunkX,
        chunkY: targetChunkY,
        minTx,
        maxTx: minTx + GROUND_CHUNK_SIZE - 1,
        minTy,
        maxTy: minTy + GROUND_CHUNK_SIZE - 1,
        commands: [],
      };
      buckets.set(bucketKey, bucket);
    }
    bucket.commands.push(command);
    coveredStableIds.add(command.stableId);
  };

  const seenSurfaceIds = new Set<string>();
  for (const surfaces of input.compiledMap.surfacesByKey.values()) {
    for (let i = 0; i < surfaces.length; i++) {
      const surface = surfaces[i];
      if (seenSurfaceIds.has(surface.id)) continue;
      seenSurfaceIds.add(surface.id);
      const coord = resolveLogicalChunkCoord(surface.tx, surface.ty);
      if (coord.chunkX !== targetChunkX || coord.chunkY !== targetChunkY) continue;
      if (!shouldRenderGroundSurfaceForFrame(surface, input.renderAllHeights, input.activeH, input.shouldCullBuildingAt)) {
        continue;
      }
      const resolved = resolveGroundSurfaceProjectedCommand(surface, input, {
        staticOnly: true,
        onPendingVisualChange,
      });
      if (!resolved) continue;
      pushCommand(resolved);
    }
  }

  for (let i = 0; i < input.compiledMap.decals.length; i++) {
    const decal = input.compiledMap.decals[i];
    const coord = resolveLogicalChunkCoord(decal.tx, decal.ty);
    if (coord.chunkX !== targetChunkX || coord.chunkY !== targetChunkY) continue;
    if (!shouldRenderGroundDecalForFrame(decal, input.renderAllHeights, input.activeH)) continue;
    const resolved = resolveGroundDecalProjectedCommand(decal, input, {
      staticOnly: true,
      onPendingVisualChange,
    });
    if (!resolved) continue;
    pushCommand(resolved);
  }

  const entriesByBand = new Map<number, CanvasGroundChunkCacheEntry[]>();
  for (const bucket of buckets.values()) {
    bucket.commands.sort((a, b) => compareRenderKeys(a.key, b.key));
    const entry = buildBucketToEntry(bucket);
    if (!entry) continue;
    const bandEntries = entriesByBand.get(bucket.zBand) ?? [];
    bandEntries.push(entry);
    if (!entriesByBand.has(bucket.zBand)) entriesByBand.set(bucket.zBand, bandEntries);
  }

  return {
    entriesByBand,
    coveredStableIds,
    pendingVisualChange,
    rebuiltChunkCount: Array.from(entriesByBand.values()).reduce((sum, entries) => sum + entries.length, 0),
  };
}

export class CanvasGroundChunkCacheStore {
  readonly chunkSize = GROUND_CHUNK_SIZE;

  private contextKey = "";
  private currentTargetBounds: LogicalChunkBounds | null = null;
  private currentGraceBounds: LogicalChunkBounds | null = null;
  private retainedLogicalChunks = new Map<string, RetainedLogicalChunk>();
  private entriesByBand = new Map<number, CanvasGroundChunkCacheEntry[]>();
  private coveredStableIds = new Set<number>();
  private rebuildGeneration = 0;
  private clearCount = 0;
  private insertedChunkCount = 0;
  private lastRebuiltChunkCount = 0;
  private evictedLogicalChunkCount = 0;
  private lastRetainedLogicalChunkCount = 0;
  private lastTargetLogicalChunkCount = 0;
  private lastGraceLogicalChunkCount = 0;
  private lastPendingLogicalChunkCount = 0;
  private builtLogicalChunkCount = 0;
  private lastCachedQuadCount = 0;
  private lastCoveredStableIdCount = 0;

  get generation(): number {
    return this.rebuildGeneration;
  }

  clear(): void {
    this.clearCount += 1;
    this.contextKey = "";
    this.currentTargetBounds = null;
    this.currentGraceBounds = null;
    this.retainedLogicalChunks = new Map();
    this.entriesByBand = new Map();
    this.coveredStableIds = new Set();
    this.rebuildGeneration += 1;
    this.lastRebuiltChunkCount = 0;
    this.lastRetainedLogicalChunkCount = 0;
    this.lastTargetLogicalChunkCount = 0;
    this.lastGraceLogicalChunkCount = 0;
    this.lastPendingLogicalChunkCount = 0;
    this.lastCachedQuadCount = 0;
    this.lastCoveredStableIdCount = 0;
  }

  hasCoveredStableId(stableId: number | undefined): boolean {
    if (!Number.isFinite(Number(stableId))) return false;
    return this.coveredStableIds.has(Number(stableId));
  }

  isLogicalChunkAuthoritative(chunkX: number, chunkY: number): boolean {
    const retained = this.retainedLogicalChunks.get(logicalChunkKey(chunkX, chunkY));
    return retained?.authoritative === true;
  }

  isTileAuthoritative(tx: number, ty: number): boolean {
    const coord = resolveLogicalChunkCoord(tx, ty);
    return this.isLogicalChunkAuthoritative(coord.chunkX, coord.chunkY);
  }

  getVisibleEntries(zBand: number, viewRect: ViewRect): readonly CanvasGroundChunkCacheEntry[] {
    const entries = this.entriesByBand.get(zBand) ?? [];
    if (entries.length === 0) return [];
    return entries.filter((entry) => viewIntersectsChunk(viewRect, entry));
  }

  getVisibleCommands(zBand: number, viewRect: ViewRect): readonly RenderCommand[] {
    const entries = this.getVisibleEntries(zBand, viewRect);
    if (entries.length <= 0) return [];
    const commands: RenderCommand[] = [];
    for (let i = 0; i < entries.length; i++) {
      for (let j = 0; j < entries[i].commands.length; j++) commands.push(entries[i].commands[j]);
    }
    commands.sort((a, b) => compareRenderKeys(a.key, b.key));
    return commands;
  }

  private refreshAggregates(): void {
    const nextEntriesByBand = new Map<number, CanvasGroundChunkCacheEntry[]>();
    const nextCoveredStableIds = new Set<number>();
    let pendingLogicalChunkCount = 0;
    let cachedQuadCount = 0;

    for (const logicalChunk of this.retainedLogicalChunks.values()) {
      if (logicalChunk.pendingRetryAtMs > 0) pendingLogicalChunkCount += 1;
      if (!logicalChunk.authoritative) continue;
      for (const stableId of logicalChunk.coveredStableIds) nextCoveredStableIds.add(stableId);
      for (const [zBand, entries] of logicalChunk.entriesByBand.entries()) {
        const bandEntries = nextEntriesByBand.get(zBand) ?? [];
        for (let i = 0; i < entries.length; i++) {
          cachedQuadCount += entries[i].commands.length;
          bandEntries.push(entries[i]);
        }
        if (!nextEntriesByBand.has(zBand)) nextEntriesByBand.set(zBand, bandEntries);
      }
    }

    this.entriesByBand = nextEntriesByBand;
    this.coveredStableIds = nextCoveredStableIds;
    this.lastRetainedLogicalChunkCount = this.retainedLogicalChunks.size;
    this.lastPendingLogicalChunkCount = pendingLogicalChunkCount;
    this.lastCachedQuadCount = cachedQuadCount;
    this.lastCoveredStableIdCount = nextCoveredStableIds.size;
  }

  private replaceLogicalChunk(
    chunkX: number,
    chunkY: number,
    built: CanvasGroundChunkBuildResult,
  ): void {
    const key = logicalChunkKey(chunkX, chunkY);
    this.retainedLogicalChunks.set(key, {
      chunkX,
      chunkY,
      entriesByBand: built.entriesByBand,
      coveredStableIds: built.coveredStableIds,
      authoritative: !built.pendingVisualChange,
      pendingRetryAtMs: built.pendingVisualChange ? nowMs() + CHUNK_RETRY_INTERVAL_MS : 0,
    });
    this.insertedChunkCount += built.rebuiltChunkCount;
    this.builtLogicalChunkCount += 1;
    this.lastRebuiltChunkCount += built.rebuiltChunkCount;
  }

  private ensureLogicalChunk(
    input: SyncCanvasGroundChunkCacheInput,
    chunkX: number,
    chunkY: number,
  ): void {
    const built = buildGroundChunkBucketsForLogicalChunk(input, chunkX, chunkY);
    this.replaceLogicalChunk(chunkX, chunkY, built);
  }

  private evictOutsideGrace(graceBounds: LogicalChunkBounds): boolean {
    let evicted = false;
    for (const [key, retained] of this.retainedLogicalChunks) {
      if (isLogicalChunkWithinBounds(graceBounds, retained.chunkX, retained.chunkY)) continue;
      this.retainedLogicalChunks.delete(key);
      this.evictedLogicalChunkCount += 1;
      evicted = true;
    }
    return evicted;
  }

  sync(input: SyncCanvasGroundChunkCacheInput): { rebuiltChunkCount: number } {
    const nextContextKey = input.contextKey;
    const nextTargetBounds = resolveLogicalChunkBoundsForView(input.viewRect);
    const nextGraceBounds = expandLogicalChunkBounds(nextTargetBounds, VISIBLE_WINDOW_GRACE_MARGIN);
    const contextChanged = nextContextKey !== this.contextKey;
    const targetBoundsChanged = !logicalChunkBoundsEqual(nextTargetBounds, this.currentTargetBounds);

    this.lastRebuiltChunkCount = 0;
    this.lastTargetLogicalChunkCount = logicalChunkBoundsCount(nextTargetBounds);
    this.lastGraceLogicalChunkCount = logicalChunkBoundsCount(nextGraceBounds);

    let changed = false;

    if (contextChanged) {
      const hadRetainedChunks = this.retainedLogicalChunks.size > 0 || this.contextKey.length > 0;
      if (hadRetainedChunks) this.clearCount += 1;
      this.contextKey = nextContextKey;
      this.currentTargetBounds = nextTargetBounds;
      this.currentGraceBounds = nextGraceBounds;
      this.retainedLogicalChunks = new Map();
      changed = true;
    } else if (targetBoundsChanged) {
      this.currentTargetBounds = nextTargetBounds;
      this.currentGraceBounds = nextGraceBounds;
    }

    const targetChunks = buildLogicalChunkCoords(nextTargetBounds);

    if (contextChanged || targetBoundsChanged) {
      for (let i = 0; i < targetChunks.length; i++) {
        const coord = targetChunks[i];
        const key = logicalChunkKey(coord.chunkX, coord.chunkY);
        if (this.retainedLogicalChunks.has(key)) continue;
        this.ensureLogicalChunk(input, coord.chunkX, coord.chunkY);
        changed = true;
      }
      if (this.evictOutsideGrace(nextGraceBounds)) changed = true;
    } else {
      const dueRetries: LogicalChunkCoord[] = [];
      const now = nowMs();
      for (const retained of this.retainedLogicalChunks.values()) {
        if (retained.pendingRetryAtMs <= 0) continue;
        if (retained.pendingRetryAtMs > now) continue;
        if (!this.currentGraceBounds || !isLogicalChunkWithinBounds(this.currentGraceBounds, retained.chunkX, retained.chunkY)) {
          continue;
        }
        dueRetries.push({ chunkX: retained.chunkX, chunkY: retained.chunkY });
      }
      for (let i = 0; i < dueRetries.length; i++) {
        const coord = dueRetries[i];
        this.ensureLogicalChunk(input, coord.chunkX, coord.chunkY);
        changed = true;
      }
    }

    if (!changed) {
      this.refreshAggregates();
      return { rebuiltChunkCount: 0 };
    }

    this.refreshAggregates();
    this.rebuildGeneration += 1;
    return { rebuiltChunkCount: this.lastRebuiltChunkCount };
  }

  getDebugCacheMetrics(): RawCacheMetricSample {
    let entryCount = 0;
    let approxBytes = 0;
    for (const retained of this.retainedLogicalChunks.values()) {
      for (const entries of retained.entriesByBand.values()) {
        entryCount += entries.length;
        for (let i = 0; i < entries.length; i++) {
          approxBytes += entries[i].commands.length * 96;
        }
      }
    }
    const avgBytes = entryCount > 0 ? Math.round(approxBytes / entryCount) : 0;
    return {
      name: "groundChunks",
      kind: "scene",
      entryCount,
      approxBytes,
      hits: 0,
      misses: 0,
      inserts: this.insertedChunkCount,
      evictions: this.evictedLogicalChunkCount,
      clears: this.clearCount,
      bounded: true,
      hasEviction: true,
      contextKey: this.contextKey,
      generation: this.rebuildGeneration,
      notes: [
        "mode:quad",
        `avg:${avgBytes}`,
        `logical:${this.lastRetainedLogicalChunkCount}`,
        `target:${this.lastTargetLogicalChunkCount}`,
        `grace:${this.lastGraceLogicalChunkCount}`,
        `quads:${this.lastCachedQuadCount}`,
        `covered:${this.lastCoveredStableIdCount}`,
        `rebuild:${this.lastRebuiltChunkCount}`,
        `built:${this.builtLogicalChunkCount}`,
        `pending:${this.lastPendingLogicalChunkCount}`,
      ].join(" "),
    };
  }
}

export function syncCanvasGroundChunkCacheForFrame(
  input: SyncCanvasGroundChunkCacheInput,
): { rebuiltChunkCount: number } {
  return input.cacheStore.sync(input);
}
