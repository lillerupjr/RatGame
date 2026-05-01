import type { RawCacheMetricSample } from "../cacheMetricsRegistry";
import { drawTexturedQuad } from "../renderPrimitives/drawTexturedQuad";
import { markStableTextureSource, setTextureDebugLabel } from "../stableTextureSource";
import type { RuntimeStructureTriangleRect } from "../../../structures/monolithicStructureGeometry";
import type { QuadRenderPiece } from "../contracts/renderCommands";
import type { RenderQuadPoints } from "../renderCommandGeometry";

type StructureMergedSliceQuad = Pick<
  QuadRenderPiece,
  "image"
  | "sx"
  | "sy"
  | "sw"
  | "sh"
  | "sourceQuad"
  | "x0"
  | "y0"
  | "x1"
  | "y1"
  | "x2"
  | "y2"
  | "x3"
  | "y3"
  | "alpha"
>;

export type StructureMergedSliceCacheEntry = {
  structureInstanceId: string;
  groupStableId: number;
  geometrySignature: string;
  sourceFrameKey: string;
  canvas: HTMLCanvasElement;
  bounds: RuntimeStructureTriangleRect;
  quadCount: number;
  triangleCount: number;
  approxBytes: number;
};

export type StructureMergedSliceCacheLookupInput = {
  structureInstanceId: string;
  groupStableId: number;
  expectedGeometrySignature: string;
  expectedSourceFrameKey: string;
};

export type BuildStructureMergedSliceCacheEntryInput = {
  structureInstanceId: string;
  groupStableId: number;
  geometrySignature: string;
  sourceFrameKey: string;
  quads: readonly StructureMergedSliceQuad[];
  triangleCount: number;
};

type QuadBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function cacheEntryKey(structureInstanceId: string, groupStableId: number): string {
  return `${structureInstanceId}:${groupStableId}`;
}

function quadPointsFromPayload(payload: StructureMergedSliceQuad): RenderQuadPoints | null {
  const x0 = Number(payload.x0);
  const y0 = Number(payload.y0);
  const x1 = Number(payload.x1);
  const y1 = Number(payload.y1);
  const x2 = Number(payload.x2);
  const y2 = Number(payload.y2);
  const x3 = Number(payload.x3);
  const y3 = Number(payload.y3);
  if (
    !Number.isFinite(x0)
    || !Number.isFinite(y0)
    || !Number.isFinite(x1)
    || !Number.isFinite(y1)
    || !Number.isFinite(x2)
    || !Number.isFinite(y2)
    || !Number.isFinite(x3)
    || !Number.isFinite(y3)
  ) {
    return null;
  }
  return {
    nw: { x: x0, y: y0 },
    ne: { x: x1, y: y1 },
    se: { x: x2, y: y2 },
    sw: { x: x3, y: y3 },
  };
}

function quadBounds(quad: RenderQuadPoints): QuadBounds {
  return {
    minX: Math.min(quad.nw.x, quad.ne.x, quad.se.x, quad.sw.x),
    minY: Math.min(quad.nw.y, quad.ne.y, quad.se.y, quad.sw.y),
    maxX: Math.max(quad.nw.x, quad.ne.x, quad.se.x, quad.sw.x),
    maxY: Math.max(quad.nw.y, quad.ne.y, quad.se.y, quad.sw.y),
  };
}

function translatedQuad(quad: RenderQuadPoints, offsetX: number, offsetY: number): RenderQuadPoints {
  return {
    nw: { x: quad.nw.x - offsetX, y: quad.nw.y - offsetY },
    ne: { x: quad.ne.x - offsetX, y: quad.ne.y - offsetY },
    se: { x: quad.se.x - offsetX, y: quad.se.y - offsetY },
    sw: { x: quad.sw.x - offsetX, y: quad.sw.y - offsetY },
  };
}

function createRasterCanvas(width: number, height: number, debugLabel: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return setTextureDebugLabel(markStableTextureSource(canvas), debugLabel);
}

export function buildStructureMergedSliceCacheEntry(
  input: BuildStructureMergedSliceCacheEntryInput,
): StructureMergedSliceCacheEntry | null {
  if (input.quads.length <= 1) return null;

  let aggregateBounds: QuadBounds | null = null;
  const quads: Array<{ payload: StructureMergedSliceQuad; destinationQuad: RenderQuadPoints }> = [];

  for (let i = 0; i < input.quads.length; i++) {
    const payload = input.quads[i];
    const image = payload.image;
    if (!image) return null;
    const destinationQuad = quadPointsFromPayload(payload);
    if (!destinationQuad) return null;
    const bounds = quadBounds(destinationQuad);
    aggregateBounds = aggregateBounds == null
      ? bounds
      : {
          minX: Math.min(aggregateBounds.minX, bounds.minX),
          minY: Math.min(aggregateBounds.minY, bounds.minY),
          maxX: Math.max(aggregateBounds.maxX, bounds.maxX),
          maxY: Math.max(aggregateBounds.maxY, bounds.maxY),
        };
    quads.push({ payload, destinationQuad });
  }

  if (!aggregateBounds) return null;

  const rasterMinX = Math.floor(aggregateBounds.minX);
  const rasterMinY = Math.floor(aggregateBounds.minY);
  const rasterMaxX = Math.ceil(aggregateBounds.maxX);
  const rasterMaxY = Math.ceil(aggregateBounds.maxY);
  const width = rasterMaxX - rasterMinX;
  const height = rasterMaxY - rasterMinY;
  if (!(width > 0 && height > 0)) return null;

  const canvas = createRasterCanvas(
    width,
    height,
    `structureMergedSlice:${input.structureInstanceId}:${input.groupStableId}`,
  );
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  for (let i = 0; i < quads.length; i++) {
    const { payload, destinationQuad } = quads[i];
    const image = payload.image;
    if (!image) return null;
    const sx = Number.isFinite(Number(payload.sx)) ? Number(payload.sx) : 0;
    const sy = Number.isFinite(Number(payload.sy)) ? Number(payload.sy) : 0;
    const sw = Number.isFinite(Number(payload.sw)) ? Number(payload.sw) : Number((image as { width?: number }).width ?? 0);
    const sh = Number.isFinite(Number(payload.sh)) ? Number(payload.sh) : Number((image as { height?: number }).height ?? 0);
    if (!(sw > 0 && sh > 0)) return null;
    const alpha = Number.isFinite(Number(payload.alpha)) ? Math.max(0, Math.min(1, Number(payload.alpha))) : 1;
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = previousAlpha * alpha;
    try {
      drawTexturedQuad(
        ctx,
        image,
        sx,
        sy,
        sw,
        sh,
        translatedQuad(destinationQuad, rasterMinX, rasterMinY),
        payload.sourceQuad,
      );
    } finally {
      ctx.globalAlpha = previousAlpha;
    }
  }

  return {
    structureInstanceId: input.structureInstanceId,
    groupStableId: input.groupStableId,
    geometrySignature: input.geometrySignature,
    sourceFrameKey: input.sourceFrameKey,
    canvas,
    bounds: {
      x: rasterMinX,
      y: rasterMinY,
      w: width,
      h: height,
    },
    quadCount: input.quads.length,
    triangleCount: input.triangleCount,
    approxBytes: canvas.width * canvas.height * 4,
  };
}

export class StructureMergedSliceCacheStore {
  private contextKey = "";
  private readonly entries = new Map<string, StructureMergedSliceCacheEntry>();
  private hitCount = 0;
  private missCount = 0;
  private insertCount = 0;
  private clearCount = 0;

  resetIfContextChanged(nextContextKey: string): boolean {
    if (this.contextKey === nextContextKey) return false;
    this.contextKey = nextContextKey;
    this.entries.clear();
    this.clearCount += 1;
    return true;
  }

  clear(): void {
    this.entries.clear();
    this.clearCount += 1;
  }

  get(input: StructureMergedSliceCacheLookupInput): StructureMergedSliceCacheEntry | undefined {
    const entry = this.entries.get(cacheEntryKey(input.structureInstanceId, input.groupStableId));
    if (!entry) {
      this.missCount += 1;
      return undefined;
    }
    if (entry.geometrySignature !== input.expectedGeometrySignature) {
      this.entries.delete(cacheEntryKey(input.structureInstanceId, input.groupStableId));
      this.missCount += 1;
      return undefined;
    }
    if (entry.sourceFrameKey !== input.expectedSourceFrameKey) {
      this.entries.delete(cacheEntryKey(input.structureInstanceId, input.groupStableId));
      this.missCount += 1;
      return undefined;
    }
    this.hitCount += 1;
    return entry;
  }

  set(entry: StructureMergedSliceCacheEntry): void {
    this.entries.set(cacheEntryKey(entry.structureInstanceId, entry.groupStableId), entry);
    this.insertCount += 1;
  }

  getDebugCacheMetrics(): RawCacheMetricSample {
    let approxBytes = 0;
    for (const entry of this.entries.values()) approxBytes += entry.approxBytes;
    return {
      name: "structureMergedSlices",
      kind: "scene",
      entryCount: this.entries.size,
      approxBytes,
      hits: this.hitCount,
      misses: this.missCount,
      inserts: this.insertCount,
      evictions: 0,
      clears: this.clearCount,
      bounded: false,
      hasEviction: false,
      contextKey: this.contextKey,
      notes: this.entries.size > 0 ? "stable slice rasters" : "empty",
    };
  }
}
