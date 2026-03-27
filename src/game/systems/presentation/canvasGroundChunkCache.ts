import type { CompiledKenneyMap, ViewRect } from "../../map/compile/kenneyMap";
import { configurePixelPerfect } from "../../../engine/render/pixelPerfect";
import type { RawCacheMetricSample } from "./cacheMetricsRegistry";
import { drawTexturedTriangle } from "./renderPrimitives/drawTexturedTriangle";
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
  sortSlice: number;
  sortWithin: number;
  drawX: number;
  drawY: number;
  canvas: HTMLCanvasElement;
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

function createChunkCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  configurePixelPerfect(ctx);
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function boundsForCommand(command: ResolvedGroundProjectedCommand): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const triangles = command.payload.triangles;
  for (let i = 0; i < triangles.length; i++) {
    const points = triangles[i].dstPoints;
    for (let j = 0; j < points.length; j++) {
      const point = points[j];
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }
  return {
    minX: Math.floor(minX),
    maxX: Math.ceil(maxX),
    minY: Math.floor(minY),
    maxY: Math.ceil(maxY),
  };
}

function viewIntersectsChunk(view: ViewRect, entry: CanvasGroundChunkCacheEntry): boolean {
  return !(
    entry.maxTx < view.minTx
    || entry.minTx > view.maxTx
    || entry.maxTy < view.minTy
    || entry.minTy > view.maxTy
  );
}

function translatePoint(point: { x: number; y: number }, dx: number, dy: number): { x: number; y: number } {
  return { x: point.x + dx, y: point.y + dy };
}

function renderBucketToEntry(bucket: CanvasGroundChunkBuildBucket): CanvasGroundChunkCacheEntry | null {
  setRenderPerfDrawTag("floors");
  try {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < bucket.commands.length; i++) {
      const bounds = boundsForCommand(bucket.commands[i]);
      if (bounds.minX < minX) minX = bounds.minX;
      if (bounds.maxX > maxX) maxX = bounds.maxX;
      if (bounds.minY < minY) minY = bounds.minY;
      if (bounds.maxY > maxY) maxY = bounds.maxY;
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }

    const target = createChunkCanvas(Math.max(1, maxX - minX), Math.max(1, maxY - minY));
    if (!target) return null;

    for (let i = 0; i < bucket.commands.length; i++) {
      const command = bucket.commands[i];
      const triangles = command.payload.triangles;
      const image = command.payload.image;
      const sourceWidth = Number(command.payload.sourceWidth);
      const sourceHeight = Number(command.payload.sourceHeight);
      for (let ti = 0; ti < triangles.length; ti++) {
        const triangle = triangles[ti];
        const [s0, s1, s2] = triangle.srcPoints;
        const [d0, d1, d2] = triangle.dstPoints;
        const alpha = Number.isFinite(Number(triangle.alpha)) ? Number(triangle.alpha) : 1;
        if (alpha < 1) {
          target.ctx.save();
          target.ctx.globalAlpha = target.ctx.globalAlpha * alpha;
        }
        drawTexturedTriangle(
          target.ctx,
          image,
          sourceWidth,
          sourceHeight,
          s0,
          s1,
          s2,
          translatePoint(d0, -minX, -minY),
          translatePoint(d1, -minX, -minY),
          translatePoint(d2, -minX, -minY),
        );
        if (alpha < 1) target.ctx.restore();
      }
    }

    return {
      zBand: bucket.zBand,
      chunkX: bucket.chunkX,
      chunkY: bucket.chunkY,
      minTx: bucket.minTx,
      maxTx: bucket.maxTx,
      minTy: bucket.minTy,
      maxTy: bucket.maxTy,
      sortSlice: bucket.minTx + bucket.minTy,
      sortWithin: bucket.minTx,
      drawX: minX,
      drawY: minY,
      canvas: target.canvas,
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
    const entry = renderBucketToEntry(bucket);
    if (!entry) continue;
    const bandEntries = entriesByBand.get(bucket.zBand) ?? [];
    bandEntries.push(entry);
    if (!entriesByBand.has(bucket.zBand)) entriesByBand.set(bucket.zBand, bandEntries);
  }

  for (const entries of entriesByBand.values()) {
    entries.sort((a, b) => a.sortSlice - b.sortSlice || a.sortWithin - b.sortWithin);
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

  private refreshAggregates(): void {
    const nextEntriesByBand = new Map<number, CanvasGroundChunkCacheEntry[]>();
    const nextCoveredStableIds = new Set<number>();
    let pendingLogicalChunkCount = 0;

    for (const logicalChunk of this.retainedLogicalChunks.values()) {
      if (logicalChunk.pendingRetryAtMs > 0) pendingLogicalChunkCount += 1;
      if (!logicalChunk.authoritative) continue;
      for (const stableId of logicalChunk.coveredStableIds) nextCoveredStableIds.add(stableId);
      for (const [zBand, entries] of logicalChunk.entriesByBand.entries()) {
        const bandEntries = nextEntriesByBand.get(zBand) ?? [];
        for (let i = 0; i < entries.length; i++) bandEntries.push(entries[i]);
        if (!nextEntriesByBand.has(zBand)) nextEntriesByBand.set(zBand, bandEntries);
      }
    }

    for (const entries of nextEntriesByBand.values()) {
      entries.sort((a, b) => a.sortSlice - b.sortSlice || a.sortWithin - b.sortWithin);
    }

    this.entriesByBand = nextEntriesByBand;
    this.coveredStableIds = nextCoveredStableIds;
    this.lastRetainedLogicalChunkCount = this.retainedLogicalChunks.size;
    this.lastPendingLogicalChunkCount = pendingLogicalChunkCount;
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
          approxBytes += entries[i].canvas.width * entries[i].canvas.height * 4;
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
        `avg:${avgBytes}`,
        `logical:${this.lastRetainedLogicalChunkCount}`,
        `target:${this.lastTargetLogicalChunkCount}`,
        `grace:${this.lastGraceLogicalChunkCount}`,
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
