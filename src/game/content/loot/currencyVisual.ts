import {
  getSpriteById,
  getSpriteByIdForDarknessPercent,
  type LoadedImg,
} from "../../../engine/render/sprites/renderSprites";

const COIN_FPS = 10;
const GEM_FPS = 10;
const COIN_FRAMES = 5;
const GEM_FRAMES = 4;

export type CurrencyTierInfo = {
  dir: "coins" | "gems";
  n: number;
  frameCount: number;
  fps: number;
};

export type CurrencyAtlasFrame = {
  image: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

type CurrencyAtlasVariantKey = "raw" | `darkness:${0 | 25 | 50 | 75 | 100}`;
type CurrencyAtlasRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};
type CurrencyAtlasCacheEntry = {
  canvas: HTMLCanvasElement;
  frameRects: Map<string, CurrencyAtlasRect>;
  sourceImages: HTMLImageElement[];
};

const currencyAtlasCache = new Map<CurrencyAtlasVariantKey, CurrencyAtlasCacheEntry>();

export function currencyTierForValue(value: number): CurrencyTierInfo {
  const v = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
  if (v <= 3) {
    return { dir: "coins", n: v, frameCount: COIN_FRAMES, fps: COIN_FPS };
  }
  const gemTier = Math.min(5, v - 3);
  return { dir: "gems", n: gemTier, frameCount: GEM_FRAMES, fps: GEM_FPS };
}

function frameSpriteId(dir: string, n: number, frame: number): string {
  const pad = String(frame).padStart(2, "0");
  return `loot/currency/${dir}/${n}/${n}_frame_${pad}`;
}

function allCurrencyFrameSpriteIds(): string[] {
  const spriteIds: string[] = [];
  for (let n = 1; n <= 3; n++) {
    for (let f = 1; f <= COIN_FRAMES; f++) {
      spriteIds.push(frameSpriteId("coins", n, f));
    }
  }
  for (let n = 1; n <= 5; n++) {
    for (let f = 1; f <= GEM_FRAMES; f++) {
      spriteIds.push(frameSpriteId("gems", n, f));
    }
  }
  return spriteIds;
}

const ALL_CURRENCY_FRAME_SPRITE_IDS = allCurrencyFrameSpriteIds();

function createAtlasCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function resolveCurrencyAtlasVariantKey(
  darknessPercent?: 0 | 25 | 50 | 75 | 100,
): CurrencyAtlasVariantKey {
  return darknessPercent === undefined ? "raw" : `darkness:${darknessPercent}`;
}

function loadCurrencyFrameBySpriteId(
  spriteId: string,
  darknessPercent?: 0 | 25 | 50 | 75 | 100,
): LoadedImg {
  return darknessPercent === undefined
    ? getSpriteById(spriteId)
    : getSpriteByIdForDarknessPercent(spriteId, darknessPercent);
}

function buildCurrencyAtlas(
  darknessPercent?: 0 | 25 | 50 | 75 | 100,
): CurrencyAtlasCacheEntry | null {
  const variantKey = resolveCurrencyAtlasVariantKey(darknessPercent);
  const loadedFrames = ALL_CURRENCY_FRAME_SPRITE_IDS.map((spriteId) => ({
    spriteId,
    loaded: loadCurrencyFrameBySpriteId(spriteId, darknessPercent),
  }));
  if (loadedFrames.some(({ loaded }) => !loaded.ready || !loaded.img)) return null;

  const images = loadedFrames.map(({ loaded }) => loaded.img);
  const cached = currencyAtlasCache.get(variantKey) ?? null;
  if (
    cached
    && cached.sourceImages.length === images.length
    && cached.sourceImages.every((image, index) => image === images[index])
  ) {
    return cached;
  }

  const cellWidth = images.reduce((maxWidth, image) => Math.max(maxWidth, image.width || 0), 0);
  const cellHeight = images.reduce((maxHeight, image) => Math.max(maxHeight, image.height || 0), 0);
  if (!(cellWidth > 0 && cellHeight > 0)) return null;

  const columns = Math.max(1, Math.ceil(Math.sqrt(images.length)));
  const rows = Math.ceil(images.length / columns);
  const canvas = createAtlasCanvas(columns * cellWidth, rows * cellHeight);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;

  const frameRects = new Map<string, CurrencyAtlasRect>();
  for (let i = 0; i < loadedFrames.length; i++) {
    const { spriteId, loaded } = loadedFrames[i];
    const image = loaded.img;
    const col = i % columns;
    const row = Math.floor(i / columns);
    const sx = col * cellWidth;
    const sy = row * cellHeight;
    ctx.drawImage(image, sx, sy);
    frameRects.set(spriteId, {
      sx,
      sy,
      sw: image.width,
      sh: image.height,
    });
  }

  const atlas = {
    canvas,
    frameRects,
    sourceImages: images,
  };
  currencyAtlasCache.set(variantKey, atlas);
  return atlas;
}

function getCurrencyFrameSpriteIdForTime(value: number, time: number): string {
  const tier = currencyTierForValue(value);
  const frameIndex = Math.floor(Math.max(0, time) * tier.fps) % tier.frameCount;
  return frameSpriteId(tier.dir, tier.n, frameIndex + 1);
}

export function getCurrencyFrame(value: number, time: number): LoadedImg {
  return getSpriteById(getCurrencyFrameSpriteIdForTime(value, time));
}

export function getCurrencyFrameForDarknessPercent(
  value: number,
  time: number,
  darknessPercent: 0 | 25 | 50 | 75 | 100,
): LoadedImg {
  return getSpriteByIdForDarknessPercent(
    getCurrencyFrameSpriteIdForTime(value, time),
    darknessPercent,
  );
}

export function getCurrencyAtlasFrame(
  value: number,
  time: number,
  darknessPercent?: 0 | 25 | 50 | 75 | 100,
): CurrencyAtlasFrame | null {
  const spriteId = getCurrencyFrameSpriteIdForTime(value, time);
  const atlas = buildCurrencyAtlas(darknessPercent);
  if (!atlas) return null;
  const rect = atlas.frameRects.get(spriteId) ?? null;
  if (!rect) return null;
  return {
    image: atlas.canvas,
    sx: rect.sx,
    sy: rect.sy,
    sw: rect.sw,
    sh: rect.sh,
  };
}

export function preloadCurrencySprites(): void {
  for (let n = 1; n <= 3; n++) {
    for (let f = 1; f <= COIN_FRAMES; f++) {
      getSpriteById(frameSpriteId("coins", n, f));
    }
  }
  for (let n = 1; n <= 5; n++) {
    for (let f = 1; f <= GEM_FRAMES; f++) {
      getSpriteById(frameSpriteId("gems", n, f));
    }
  }
}
