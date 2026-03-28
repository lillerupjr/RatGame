import type { CompiledKenneyMap, ViewRect } from "../../map/compile/kenneyMap";
import type { RawCacheMetricSample } from "./cacheMetricsRegistry";
import type { RenderCommand } from "./contracts/renderCommands";
import type { StaticWorldQuadRenderPiece } from "../../../engine/render/creator/renderPieceTypes";
import { buildRectQuadPayload, type RenderQuadPoints } from "./renderCommandGeometry";
import { drawTexturedQuad } from "./renderPrimitives/drawTexturedQuad";
import {
  resolveGroundDecalProjectedCommand,
  resolveGroundSurfaceProjectedCommand,
  shouldRenderGroundDecalForFrame,
  shouldRenderGroundSurfaceForFrame,
  type GroundCommandResolverDeps,
  type ResolvedGroundProjectedCommand,
} from "./groundCommandResolver";
import {
  createStaticWorldQuadRenderPiece,
  toAuditRenderCommand,
} from "../../../engine/render/creator/renderPieceTypes";
import { setRenderPerfDrawTag } from "./renderPerfCounters";
import {
  markGroundChunkTextureSource,
  markStableTextureSource,
  setTextureDebugLabel,
} from "./stableTextureSource";
import { compareRenderKeys, resolveRenderZBand } from "./worldRenderOrdering";

const GROUND_CHUNK_SIZE = 8;
const VISIBLE_WINDOW_GRACE_MARGIN = 1;
const CHUNK_RETRY_INTERVAL_MS = 50;
const CHUNK_RASTER_PADDING_PX = 1;

type RasterBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type CanvasGroundChunkCacheEntry = {
  zBand: number;
  chunkX: number;
  chunkY: number;
  minTx: number;
  maxTx: number;
  minTy: number;
  maxTy: number;
  piece: StaticWorldQuadRenderPiece;
  rasterCanvas: HTMLCanvasElement;
  sourceQuadCount: number;
  approxBytes: number;
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

export function buildRampRoadTiles(compiledMap: CompiledKenneyMap): Set<string> {
  const rampRoadTiles = new Set<string>();
  if (!compiledMap?.roadSemanticRects) return rampRoadTiles;
  for (let i = 0; i < compiledMap.roadSemanticRects.length; i++) {
    const rect = compiledMap.roadSemanticRects[i];
    const semantic = rect.semantic?.trim().toLowerCase() ?? "";
    if (!(semantic === "ramp" || semantic.startsWith("ramp_"))) continue;
    const minX = rect.x | 0;
    const minY = rect.y | 0;
    const maxX = minX + Math.max(1, rect.w | 0) - 1;
    const maxY = minY + Math.max(1, rect.h | 0) - 1;
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        rampRoadTiles.add(`${tx},${ty}`);
      }
    }
  }
  return rampRoadTiles;
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

function stableRasterChunkId(chunkX: number, chunkY: number, zBand: number): number {
  return (chunkX * 73856093 ^ chunkY * 19349663 ^ (zBand * 100 | 0) * 83492791) + 101;
}

function boundsFromQuad(quad: RenderQuadPoints): RasterBounds {
  return {
    minX: Math.min(quad.nw.x, quad.ne.x, quad.se.x, quad.sw.x),
    maxX: Math.max(quad.nw.x, quad.ne.x, quad.se.x, quad.sw.x),
    minY: Math.min(quad.nw.y, quad.ne.y, quad.se.y, quad.sw.y),
    maxY: Math.max(quad.nw.y, quad.ne.y, quad.se.y, quad.sw.y),
  };
}

function unionBounds(a: RasterBounds | null, b: RasterBounds): RasterBounds {
  if (!a) return b;
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function translateQuad(quad: RenderQuadPoints, dx: number, dy: number): RenderQuadPoints {
  return {
    nw: { x: quad.nw.x + dx, y: quad.nw.y + dy },
    ne: { x: quad.ne.x + dx, y: quad.ne.y + dy },
    se: { x: quad.se.x + dx, y: quad.se.y + dy },
    sw: { x: quad.sw.x + dx, y: quad.sw.y + dy },
  };
}

function createChunkRasterCanvas(
  width: number,
  height: number,
  chunkLabel: string,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = setTextureDebugLabel(
    markStableTextureSource(markGroundChunkTextureSource(document.createElement("canvas"))),
    chunkLabel,
  );
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

function rasterizeBucketCommands(
  bucket: CanvasGroundChunkBuildBucket,
): {
  canvas: HTMLCanvasElement;
  bounds: RasterBounds;
} | null {
  let bounds: RasterBounds | null = null;
  for (let i = 0; i < bucket.commands.length; i++) {
    bounds = unionBounds(bounds, boundsFromQuad(bucket.commands[i].destinationQuad));
  }
  if (!bounds) return null;

  const paddedBounds: RasterBounds = {
    minX: Math.floor(bounds.minX) - CHUNK_RASTER_PADDING_PX,
    maxX: Math.ceil(bounds.maxX) + CHUNK_RASTER_PADDING_PX,
    minY: Math.floor(bounds.minY) - CHUNK_RASTER_PADDING_PX,
    maxY: Math.ceil(bounds.maxY) + CHUNK_RASTER_PADDING_PX,
  };
  const width = Math.max(1, paddedBounds.maxX - paddedBounds.minX);
  const height = Math.max(1, paddedBounds.maxY - paddedBounds.minY);
  const canvas = createChunkRasterCanvas(
    width,
    height,
    `groundChunk:${bucket.chunkX},${bucket.chunkY},z${bucket.zBand}`,
  );
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < bucket.commands.length; i++) {
    const command = bucket.commands[i];
    const payload = command.payload as RenderCommand["payload"] & {
      image?: CanvasImageSource;
      sx?: number;
      sy?: number;
      sw?: number;
      sh?: number;
      sourceQuad?: RenderQuadPoints;
      alpha?: number;
    };
    const image = payload.image;
    if (!image) continue;
    const alpha = Number.isFinite(Number(payload.alpha)) ? Number(payload.alpha) : 1;
    const draw = () => {
      drawTexturedQuad(
        ctx,
        image,
        Number(payload.sx ?? 0),
        Number(payload.sy ?? 0),
        Number(payload.sw ?? 0),
        Number(payload.sh ?? 0),
        translateQuad(command.destinationQuad, -paddedBounds.minX, -paddedBounds.minY),
        payload.sourceQuad,
      );
    };
    if (alpha >= 1) {
      draw();
      continue;
    }
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = previousAlpha * alpha;
    try {
      draw();
    } finally {
      ctx.globalAlpha = previousAlpha;
    }
  }

  return {
    canvas,
    bounds: paddedBounds,
  };
}

function buildBucketToEntry(bucket: CanvasGroundChunkBuildBucket): CanvasGroundChunkCacheEntry | null {
  if (bucket.commands.length <= 0) return null;
  setRenderPerfDrawTag("floors");
  try {
    const rasterized = rasterizeBucketCommands(bucket);
    if (!rasterized) return null;
    const firstKey = bucket.commands[0].key;
    const stableId = stableRasterChunkId(bucket.chunkX, bucket.chunkY, bucket.zBand);
    return {
      zBand: bucket.zBand,
      chunkX: bucket.chunkX,
      chunkY: bucket.chunkY,
      minTx: bucket.minTx,
      maxTx: bucket.maxTx,
      minTy: bucket.minTy,
      maxTy: bucket.maxTy,
      piece: createStaticWorldQuadRenderPiece({
        key: {
          ...firstKey,
          stableId,
          kindOrder: firstKey.kindOrder,
        },
        semanticFamily: "groundSurface",
        staticFamily: "groundSurface",
        worldGeometry: "projected",
        kind: "rect",
        payload: buildRectQuadPayload({
          image: rasterized.canvas,
          dx: rasterized.bounds.minX,
          dy: rasterized.bounds.minY,
          dw: rasterized.canvas.width,
          dh: rasterized.canvas.height,
        }),
      }),
      rasterCanvas: rasterized.canvas,
      sourceQuadCount: bucket.commands.length,
      approxBytes: rasterized.canvas.width * rasterized.canvas.height * 4,
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
  private lastRasterSurfaceCount = 0;
  private lastRasterSourceQuadCount = 0;
  private lastApproxRasterBytes = 0;
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
    this.lastRasterSurfaceCount = 0;
    this.lastRasterSourceQuadCount = 0;
    this.lastApproxRasterBytes = 0;
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

  getVisiblePieces(zBand: number, viewRect: ViewRect): readonly StaticWorldQuadRenderPiece[] {
    const entries = this.getVisibleEntries(zBand, viewRect);
    if (entries.length <= 0) return [];
    const pieces = entries.map((entry) => entry.piece);
    pieces.sort((a, b) => compareRenderKeys(a.key, b.key));
    return pieces;
  }

  getVisibleCommands(zBand: number, viewRect: ViewRect): readonly RenderCommand[] {
    return this.getVisiblePieces(zBand, viewRect).map((piece) => toAuditRenderCommand(piece));
  }

  private refreshAggregates(): void {
    const nextEntriesByBand = new Map<number, CanvasGroundChunkCacheEntry[]>();
    const nextCoveredStableIds = new Set<number>();
    let pendingLogicalChunkCount = 0;
    let rasterSurfaceCount = 0;
    let rasterSourceQuadCount = 0;
    let approxRasterBytes = 0;

    for (const logicalChunk of this.retainedLogicalChunks.values()) {
      if (logicalChunk.pendingRetryAtMs > 0) pendingLogicalChunkCount += 1;
      if (!logicalChunk.authoritative) continue;
      for (const stableId of logicalChunk.coveredStableIds) nextCoveredStableIds.add(stableId);
      for (const [zBand, entries] of logicalChunk.entriesByBand.entries()) {
        const bandEntries = nextEntriesByBand.get(zBand) ?? [];
        for (let i = 0; i < entries.length; i++) {
          rasterSurfaceCount += 1;
          rasterSourceQuadCount += entries[i].sourceQuadCount;
          approxRasterBytes += entries[i].approxBytes;
          bandEntries.push(entries[i]);
        }
        if (!nextEntriesByBand.has(zBand)) nextEntriesByBand.set(zBand, bandEntries);
      }
    }

    this.entriesByBand = nextEntriesByBand;
    this.coveredStableIds = nextCoveredStableIds;
    this.lastRetainedLogicalChunkCount = this.retainedLogicalChunks.size;
    this.lastPendingLogicalChunkCount = pendingLogicalChunkCount;
    this.lastRasterSurfaceCount = rasterSurfaceCount;
    this.lastRasterSourceQuadCount = rasterSourceQuadCount;
    this.lastApproxRasterBytes = approxRasterBytes;
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
          approxBytes += entries[i].approxBytes;
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
        "mode:raster",
        `avg:${avgBytes}`,
        `logical:${this.lastRetainedLogicalChunkCount}`,
        `target:${this.lastTargetLogicalChunkCount}`,
        `grace:${this.lastGraceLogicalChunkCount}`,
        `surfaces:${this.lastRasterSurfaceCount}`,
        `sourceQuads:${this.lastRasterSourceQuadCount}`,
        `bytes:${this.lastApproxRasterBytes}`,
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
