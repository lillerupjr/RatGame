import { markStableTextureSource, setTextureDebugLabel } from "./stableTextureSource";

export type AtlasImageSource = HTMLImageElement | HTMLCanvasElement;

export type AtlasFrameRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

type AtlasPlacement = {
  sourceKey: string;
  image: AtlasImageSource;
  rect: AtlasFrameRect;
};

type AtlasPageLayout = {
  width: number;
  height: number;
  placements: AtlasPlacement[];
};

const ATLAS_BLEED_PX = 1;
const ATLAS_SAFE_BORDER_PX = 64;
const MAX_PAGE_SIZE_PX = 4096;

function nextPowerOfTwo(value: number): number {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

function drawBleed(
  ctx: CanvasRenderingContext2D,
  image: AtlasImageSource,
  x: number,
  y: number,
): void {
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

function buildAtlasPageLayouts(
  sources: readonly { sourceKey: string; image: AtlasImageSource }[],
): AtlasPageLayout[] {
  if (sources.length <= 0) return [];

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
    Math.min(MAX_PAGE_SIZE_PX, nextPowerOfTwo(Math.ceil(Math.sqrt(totalArea)))),
  );

  const pages: AtlasPageLayout[] = [];
  let currentPlacements: AtlasPlacement[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let usedWidth = 0;

  const flushPage = () => {
    if (currentPlacements.length <= 0) return;
    pages.push({
      width: usedWidth,
      height: y + rowHeight,
      placements: currentPlacements,
    });
    currentPlacements = [];
    x = 0;
    y = 0;
    rowHeight = 0;
    usedWidth = 0;
  };

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const cellWidth = source.image.width + (ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX) * 2;
    const cellHeight = source.image.height + (ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX) * 2;
    if (x > 0 && x + cellWidth > targetRowWidth) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    if (currentPlacements.length > 0 && y + cellHeight > MAX_PAGE_SIZE_PX) {
      flushPage();
    }
    currentPlacements.push({
      sourceKey: source.sourceKey,
      image: source.image,
      rect: {
        sx: x + ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX,
        sy: y + ATLAS_BLEED_PX + ATLAS_SAFE_BORDER_PX,
        sw: source.image.width,
        sh: source.image.height,
      },
    });
    x += cellWidth;
    if (x > usedWidth) usedWidth = x;
    if (cellHeight > rowHeight) rowHeight = cellHeight;
  }

  flushPage();
  return pages;
}

export function buildAtlasPages(
  sources: readonly { sourceKey: string; image: AtlasImageSource }[],
  textureLabelPrefix: string,
): {
  pageCanvases: HTMLCanvasElement[];
  frameBySourceKey: Map<string, AtlasFrameRect & { image: HTMLCanvasElement }>;
  frameByImage: WeakMap<object, AtlasFrameRect & { image: HTMLCanvasElement }>;
} {
  const layouts = buildAtlasPageLayouts(sources);
  if (layouts.length <= 0) {
    return {
      pageCanvases: [],
      frameBySourceKey: new Map(),
      frameByImage: new WeakMap(),
    };
  }
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return {
      pageCanvases: [],
      frameBySourceKey: new Map(),
      frameByImage: new WeakMap(),
    };
  }

  const pageCanvases: HTMLCanvasElement[] = [];
  const frameBySourceKey = new Map<string, AtlasFrameRect & { image: HTMLCanvasElement }>();
  const frameByImage = new WeakMap<object, AtlasFrameRect & { image: HTMLCanvasElement }>();
  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i];
    if (!(layout.width > 0 && layout.height > 0)) continue;
    const canvas = setTextureDebugLabel(
      markStableTextureSource(document.createElement("canvas")),
      `${textureLabelPrefix}:p${i}`,
    );
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = false;
    for (let j = 0; j < layout.placements.length; j++) {
      const placement = layout.placements[j];
      drawBleed(ctx, placement.image, placement.rect.sx, placement.rect.sy);
      const frame = {
        image: canvas,
        sx: placement.rect.sx,
        sy: placement.rect.sy,
        sw: placement.rect.sw,
        sh: placement.rect.sh,
      };
      frameBySourceKey.set(placement.sourceKey, frame);
      frameByImage.set(placement.image, frame);
    }
    pageCanvases.push(canvas);
  }
  return {
    pageCanvases,
    frameBySourceKey,
    frameByImage,
  };
}
