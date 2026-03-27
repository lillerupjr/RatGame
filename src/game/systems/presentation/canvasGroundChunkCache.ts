import type { CompiledKenneyMap, ViewRect } from "../../map/compile/kenneyMap";
import { configurePixelPerfect } from "../../../engine/render/pixelPerfect";
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

const GROUND_CHUNK_SIZE = 16;
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

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
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

function buildGroundChunkBuckets(input: SyncCanvasGroundChunkCacheInput): CanvasGroundChunkBuildResult {
  const buckets = new Map<string, CanvasGroundChunkBuildBucket>();
  const coveredStableIds = new Set<number>();
  let pendingVisualChange = false;
  const onPendingVisualChange = () => {
    pendingVisualChange = true;
  };

  const pushCommand = (command: ResolvedGroundProjectedCommand): void => {
    const zBand = resolveRenderZBand(command.key, input.rampRoadTiles);
    const chunkX = floorDiv(command.tx, GROUND_CHUNK_SIZE);
    const chunkY = floorDiv(command.ty, GROUND_CHUNK_SIZE);
    const bucketKey = `${zBand}|${chunkX}|${chunkY}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      const minTx = chunkX * GROUND_CHUNK_SIZE;
      const minTy = chunkY * GROUND_CHUNK_SIZE;
      bucket = {
        zBand,
        chunkX,
        chunkY,
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
  private entriesByBand = new Map<number, CanvasGroundChunkCacheEntry[]>();
  private coveredStableIds = new Set<number>();
  private pendingContextKey = "";
  private pendingRetryAtMs = 0;
  private rebuildGeneration = 0;

  get generation(): number {
    return this.rebuildGeneration;
  }

  clear(): void {
    this.contextKey = "";
    this.entriesByBand = new Map();
    this.coveredStableIds = new Set();
    this.pendingContextKey = "";
    this.pendingRetryAtMs = 0;
    this.rebuildGeneration += 1;
  }

  hasCoveredStableId(stableId: number | undefined): boolean {
    if (!Number.isFinite(Number(stableId))) return false;
    return this.coveredStableIds.has(Number(stableId));
  }

  getVisibleEntries(zBand: number, viewRect: ViewRect): readonly CanvasGroundChunkCacheEntry[] {
    const entries = this.entriesByBand.get(zBand) ?? [];
    if (entries.length === 0) return [];
    return entries.filter((entry) => viewIntersectsChunk(viewRect, entry));
  }

  sync(input: SyncCanvasGroundChunkCacheInput): { rebuiltChunkCount: number } {
    const nextContextKey = input.contextKey;
    const contextChanged = nextContextKey !== this.contextKey;
    if (!contextChanged) {
      if (this.pendingContextKey !== nextContextKey) return { rebuiltChunkCount: 0 };
      if (nowMs() < this.pendingRetryAtMs) return { rebuiltChunkCount: 0 };
    }

    const built = buildGroundChunkBuckets(input);
    this.contextKey = nextContextKey;
    this.entriesByBand = built.entriesByBand;
    this.coveredStableIds = built.coveredStableIds;
    this.rebuildGeneration += 1;
    if (built.pendingVisualChange) {
      this.pendingContextKey = nextContextKey;
      this.pendingRetryAtMs = nowMs() + CHUNK_RETRY_INTERVAL_MS;
    } else {
      this.pendingContextKey = "";
      this.pendingRetryAtMs = 0;
    }
    return { rebuiltChunkCount: built.rebuiltChunkCount };
  }
}

export function syncCanvasGroundChunkCacheForFrame(
  input: SyncCanvasGroundChunkCacheInput,
): { rebuiltChunkCount: number } {
  return input.cacheStore.sync(input);
}
