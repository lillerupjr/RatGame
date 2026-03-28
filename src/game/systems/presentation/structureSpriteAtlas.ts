import { getTileSpriteById } from "../../../engine/render/sprites/renderSprites";
import {
  collectMapWideStructureOverlays,
} from "../../structures/monolithicStructureGeometry";
import type { RawCacheMetricSample } from "./cacheMetricsRegistry";
import { markStableTextureSource } from "./stableTextureSource";

type StructureSpriteAtlasRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export type StructureSpriteAtlasFrame = StructureSpriteAtlasRect & {
  image: HTMLCanvasElement;
};

type StructureAtlasReadySource = {
  spriteId: string;
  image: HTMLImageElement;
};

type StructureSpriteAtlasSyncInput = {
  compiledMap: {
    id: string;
  };
  paletteVariantKey: string;
};

const ATLAS_BLEED_PX = 1;
const ATLAS_SAFE_BORDER_PX = 64;
const MAX_ROW_WIDTH = 4096;

function nextPowerOfTwo(value: number): number {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

function buildContextKey(input: StructureSpriteAtlasSyncInput): string {
  return `map:${input.compiledMap.id}||palv:${input.paletteVariantKey}`;
}

function buildUniqueStructureSpriteIds(compiledMap: StructureSpriteAtlasSyncInput["compiledMap"]): string[] {
  const overlays = collectMapWideStructureOverlays(compiledMap as any);
  const unique = new Set<string>();
  for (let i = 0; i < overlays.length; i++) {
    const spriteId = String(overlays[i].spriteId ?? "");
    if (!spriteId) continue;
    unique.add(spriteId);
  }
  return Array.from(unique).sort();
}

function buildAtlasLayout(sources: readonly StructureAtlasReadySource[]): {
  width: number;
  height: number;
  rectBySpriteId: Map<string, StructureSpriteAtlasRect>;
} {
  const rectBySpriteId = new Map<string, StructureSpriteAtlasRect>();
  if (sources.length <= 0) {
    return {
      width: 0,
      height: 0,
      rectBySpriteId,
    };
  }

  let totalArea = 0;
  let maxCellWidth = 0;
  for (let i = 0; i < sources.length; i++) {
    const cellWidth = sources[i].image.width + (ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX) * 2;
    const cellHeight = sources[i].image.height + (ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX) * 2;
    totalArea += cellWidth * cellHeight;
    if (cellWidth > maxCellWidth) maxCellWidth = cellWidth;
  }
  const targetRowWidth = Math.max(
    maxCellWidth,
    Math.min(MAX_ROW_WIDTH, nextPowerOfTwo(Math.ceil(Math.sqrt(totalArea)))),
  );

  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let usedWidth = 0;
  for (let i = 0; i < sources.length; i++) {
    const image = sources[i].image;
    const cellWidth = image.width + (ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX) * 2;
    const cellHeight = image.height + (ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX) * 2;
    if (x > 0 && x + cellWidth > targetRowWidth) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    rectBySpriteId.set(sources[i].spriteId, {
      sx: x + ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX,
      sy: y + ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX,
      sw: image.width,
      sh: image.height,
    });
    x += cellWidth;
    if (x > usedWidth) usedWidth = x;
    if (cellHeight > rowHeight) rowHeight = cellHeight;
  }

  return {
    width: usedWidth,
    height: y + rowHeight,
    rectBySpriteId,
  };
}

function drawBleed(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number): void {
  ctx.drawImage(image, x, y);
  if (ATLAS_BLEED_PX <= 0) return;
  const left = x - ATLAS_BLEED_PX;
  const top = y - ATLAS_BLEED_PX;
  const right = x + image.width;
  const bottom = y + image.height;

  ctx.drawImage(image, 0, 0, image.width, 1, x, top, image.width, 1);
  ctx.drawImage(image, 0, image.height - 1, image.width, 1, x, bottom, image.width, 1);
  ctx.drawImage(image, 0, 0, 1, image.height, left, y, 1, image.height);
  ctx.drawImage(image, image.width - 1, 0, 1, image.height, right, y, 1, image.height);
  ctx.drawImage(image, 0, 0, 1, 1, left, top, 1, 1);
  ctx.drawImage(image, image.width - 1, 0, 1, 1, right, top, 1, 1);
  ctx.drawImage(image, 0, image.height - 1, 1, 1, left, bottom, 1, 1);
  ctx.drawImage(image, image.width - 1, image.height - 1, 1, 1, right, bottom, 1, 1);
}

export function remapStructureTrianglePointToAtlas(
  point: { x: number; y: number },
  atlasFrame: Pick<StructureSpriteAtlasFrame, "sx" | "sy">,
): { x: number; y: number } {
  return {
    x: atlasFrame.sx + Number(point.x ?? 0),
    y: atlasFrame.sy + Number(point.y ?? 0),
  };
}

export class StructureSpriteAtlasStore {
  private contextKey = "";
  private atlasCanvas: HTMLCanvasElement | null = null;
  private rectBySpriteId = new Map<string, StructureSpriteAtlasRect>();
  private allSpriteIds: string[] = [];
  private pendingSpriteIds = new Set<string>();
  private fallbackSpriteIds = new Set<string>();
  private hitCount = 0;
  private missCount = 0;
  private insertCount = 0;
  private clearCount = 0;
  private generationValue = 0;

  get generation(): number {
    return this.generationValue;
  }

  sync(input: StructureSpriteAtlasSyncInput): void {
    const nextContextKey = buildContextKey(input);
    if (nextContextKey !== this.contextKey) {
      if (this.contextKey || this.atlasCanvas || this.rectBySpriteId.size > 0) {
        this.clearCount += 1;
      }
      this.contextKey = nextContextKey;
      this.allSpriteIds = buildUniqueStructureSpriteIds(input.compiledMap);
      this.rebuildFromAllSpriteIds();
      return;
    }

    if (this.pendingSpriteIds.size <= 0) return;
    let needsRebuild = false;
    for (const spriteId of this.pendingSpriteIds) {
      const rec = getTileSpriteById(spriteId);
      if (rec?.ready || rec?.failed || rec?.unsupported) {
        needsRebuild = true;
        break;
      }
    }
    if (needsRebuild) this.rebuildFromAllSpriteIds();
  }

  getAtlasFrame(spriteId: string): StructureSpriteAtlasFrame | null {
    const rect = this.rectBySpriteId.get(spriteId) ?? null;
    if (!rect || !this.atlasCanvas) {
      this.missCount += 1;
      return null;
    }
    this.hitCount += 1;
    return {
      image: this.atlasCanvas,
      sx: rect.sx,
      sy: rect.sy,
      sw: rect.sw,
      sh: rect.sh,
    };
  }

  clear(): void {
    this.atlasCanvas = null;
    this.rectBySpriteId.clear();
    this.pendingSpriteIds.clear();
    this.fallbackSpriteIds.clear();
    this.allSpriteIds = [];
    this.clearCount += 1;
    this.generationValue += 1;
  }

  getDebugCacheMetrics(): RawCacheMetricSample {
    const approxBytes = this.atlasCanvas ? this.atlasCanvas.width * this.atlasCanvas.height * 4 : 0;
    return {
      name: "structureSpriteAtlas",
      kind: "derived",
      entryCount: this.rectBySpriteId.size,
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
      notes: `pending:${this.pendingSpriteIds.size} fallback:${this.fallbackSpriteIds.size}`,
    };
  }

  private rebuildFromAllSpriteIds(): void {
    const readySources: StructureAtlasReadySource[] = [];
    const nextPending = new Set<string>();
    const nextFallback = new Set<string>();

    for (let i = 0; i < this.allSpriteIds.length; i++) {
      const spriteId = this.allSpriteIds[i];
      const rec = getTileSpriteById(spriteId);
      if (rec?.ready && rec.img && rec.img.width > 0 && rec.img.height > 0) {
        readySources.push({
          spriteId,
          image: rec.img,
        });
        continue;
      }
      if (rec && !rec.ready && !rec.failed && !rec.unsupported) {
        nextPending.add(spriteId);
      } else {
        nextFallback.add(spriteId);
      }
    }

    const nextCanvas = this.buildAtlasCanvas(readySources);
    const previousHadAtlas = !!this.atlasCanvas;
    this.atlasCanvas = nextCanvas.canvas;
    this.rectBySpriteId = nextCanvas.rectBySpriteId;
    this.pendingSpriteIds = nextPending;
    this.fallbackSpriteIds = nextFallback;
    if (previousHadAtlas || nextCanvas.canvas || this.clearCount === 0) {
      this.insertCount += this.rectBySpriteId.size;
      this.generationValue += 1;
    }
  }

  private buildAtlasCanvas(sources: readonly StructureAtlasReadySource[]): {
    canvas: HTMLCanvasElement | null;
    rectBySpriteId: Map<string, StructureSpriteAtlasRect>;
  } {
    const layout = buildAtlasLayout(sources);
    if (!(layout.width > 0 && layout.height > 0)) {
      return {
        canvas: null,
        rectBySpriteId: layout.rectBySpriteId,
      };
    }

    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return {
        canvas: null,
        rectBySpriteId: new Map(),
      };
    }

    const canvas = markStableTextureSource(document.createElement("canvas"));
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        canvas: null,
        rectBySpriteId: new Map(),
      };
    }
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < sources.length; i++) {
      const rect = layout.rectBySpriteId.get(sources[i].spriteId);
      if (!rect) continue;
      drawBleed(ctx, sources[i].image, rect.sx, rect.sy);
    }
    return {
      canvas,
      rectBySpriteId: layout.rectBySpriteId,
    };
  }
}
