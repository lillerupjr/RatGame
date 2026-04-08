/**
 * Heightmap asset loader for per-pixel shadow casting.
 *
 * Loads heightmap PNGs alongside structure sprites for assets that provide them.
 * Heightmaps are grayscale images where R=G=B=height (0-255 → 0.0-1.0 world units)
 * and A=sprite alpha mask.
 *
 * Detection is based on sprite ID patterns: if a sprite ID contains "/images/",
 * the loader checks whether a sibling "/heightmaps/" directory is expected
 * (via the HEIGHTMAP_ENABLED_PREFIXES manifest).
 */

export type HeightmapData = {
  width: number;
  height: number;
  /** Per-pixel height values (0-255), row-major. */
  heights: Uint8Array;
  /** Per-pixel alpha mask from the heightmap PNG, row-major. */
  alpha: Uint8Array;
  /** The loaded HTMLImageElement (for direct canvas/WebGL texture use). */
  img: HTMLImageElement;
};

type HeightmapCacheEntry = {
  data: HeightmapData | null;
  loading: boolean;
  failed: boolean;
};

/**
 * Asset folder prefixes known to contain heightmaps alongside their images.
 * The prefix is matched against the sprite ID (before "/images/").
 * Extend this list as more batches get heightmaps baked.
 */
const HEIGHTMAP_ENABLED_PREFIXES: ReadonlyArray<string> = [
  "structures/buildings/batch1/",
];

const heightmapCache: Record<string, HeightmapCacheEntry> = Object.create(null);

let scratchCanvas: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function getScratchCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!scratchCanvas || !scratchCtx) {
    scratchCanvas = document.createElement("canvas");
    scratchCtx = scratchCanvas.getContext("2d", { willReadFrequently: true });
    if (!scratchCtx) throw new Error("[heightmapLoader] Failed to create 2d context for scratch canvas.");
  }
  return { canvas: scratchCanvas, ctx: scratchCtx };
}

/**
 * Derives the heightmap sprite ID from a color sprite ID.
 * Returns null if the sprite ID doesn't follow the images/heightmaps pattern.
 *
 * Example:
 *   "structures/buildings/batch1/building1/images/se"
 *   → "structures/buildings/batch1/building1/heightmaps/se"
 */
export function deriveHeightmapSpriteId(spriteId: string): string | null {
  const imagesSegment = "/images/";
  const idx = spriteId.indexOf(imagesSegment);
  if (idx < 0) return null;
  return spriteId.slice(0, idx) + "/heightmaps/" + spriteId.slice(idx + imagesSegment.length);
}

/**
 * Checks whether a sprite ID belongs to an asset folder that provides heightmaps.
 */
export function hasHeightmapSupport(spriteId: string): boolean {
  for (let i = 0; i < HEIGHTMAP_ENABLED_PREFIXES.length; i++) {
    if (spriteId.startsWith(HEIGHTMAP_ENABLED_PREFIXES[i])) {
      return deriveHeightmapSpriteId(spriteId) !== null;
    }
  }
  return false;
}

/**
 * Resolves the URL for a heightmap sprite ID, following the same convention
 * as the main sprite loader for structures/ prefixed assets.
 */
function resolveHeightmapUrl(heightmapSpriteId: string): string {
  return `${import.meta.env.BASE_URL}assets-runtime/base_db32/${heightmapSpriteId}.png`;
}

/**
 * Extracts per-pixel height and alpha data from a loaded image.
 */
function extractHeightmapData(img: HTMLImageElement): HeightmapData {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const { canvas, ctx } = getScratchCanvas();
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  const count = w * h;
  const heights = new Uint8Array(count);
  const alpha = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    heights[i] = pixels[offset]; // R channel = height
    alpha[i] = pixels[offset + 3]; // A channel = mask
  }
  return { width: w, height: h, heights, alpha, img };
}

/**
 * Triggers loading of a heightmap for a given color sprite ID.
 * Returns immediately; the heightmap data becomes available asynchronously.
 * No-op if the sprite ID doesn't support heightmaps or is already loading/loaded.
 */
export function requestHeightmapForSprite(spriteId: string): void {
  if (!hasHeightmapSupport(spriteId)) return;
  const heightmapId = deriveHeightmapSpriteId(spriteId);
  if (!heightmapId) return;
  const cacheKey = heightmapId;
  if (heightmapCache[cacheKey]) return;

  const entry: HeightmapCacheEntry = { data: null, loading: true, failed: false };
  heightmapCache[cacheKey] = entry;

  const url = resolveHeightmapUrl(heightmapId);
  const img = new Image();
  img.onload = () => {
    try {
      entry.data = extractHeightmapData(img);
      entry.loading = false;
    } catch (err) {
      entry.loading = false;
      entry.failed = true;
      if (import.meta.env.DEV) {
        console.warn("[heightmapLoader] Failed to extract heightmap data:", heightmapId, err);
      }
    }
  };
  img.onerror = () => {
    entry.loading = false;
    entry.failed = true;
    if (import.meta.env.DEV) {
      console.warn("[heightmapLoader] Failed to load heightmap:", url);
    }
  };
  img.src = url;
}

/**
 * Returns the loaded heightmap data for a color sprite ID, or null if
 * not yet loaded, not available, or the sprite doesn't support heightmaps.
 */
export function getHeightmapForSprite(spriteId: string): HeightmapData | null {
  const heightmapId = deriveHeightmapSpriteId(spriteId);
  if (!heightmapId) return null;
  const entry = heightmapCache[heightmapId];
  if (!entry || entry.loading || entry.failed) return null;
  return entry.data;
}

/**
 * Returns true if a heightmap is loaded and ready for the given color sprite ID.
 */
export function isHeightmapReady(spriteId: string): boolean {
  return getHeightmapForSprite(spriteId) !== null;
}

/**
 * Clears the entire heightmap cache. Useful on map/skin transitions.
 */
export function clearHeightmapCache(): void {
  for (const key in heightmapCache) {
    delete heightmapCache[key];
  }
}
