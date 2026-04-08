import { configurePixelPerfect } from "../../../engine/render/pixelPerfect";
import { registerCacheMetricSource } from "./cacheMetricsRegistry";
import { setRenderPerfDrawTag, type DrawTag } from "./renderPerfCounters";

const flippedOverlayImageCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
const runtimeIsoTopCache = new WeakMap<HTMLImageElement, Map<0 | 1 | 2 | 3, HTMLCanvasElement>>();
const runtimeIsoDecalCache = new WeakMap<object, Map<string, HTMLCanvasElement>>();
const runtimeDiamondCanvasCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

type WeakCanvasCacheStats = {
  entryCount: number;
  approxBytes: number;
  hits: number;
  misses: number;
  inserts: number;
  notes?: string;
};

const flippedOverlayStats: WeakCanvasCacheStats = { entryCount: 0, approxBytes: 0, hits: 0, misses: 0, inserts: 0 };
const runtimeIsoTopStats: WeakCanvasCacheStats = { entryCount: 0, approxBytes: 0, hits: 0, misses: 0, inserts: 0 };
const runtimeIsoDecalStats: WeakCanvasCacheStats = { entryCount: 0, approxBytes: 0, hits: 0, misses: 0, inserts: 0 };
const runtimeDiamondStats: WeakCanvasCacheStats = { entryCount: 0, approxBytes: 0, hits: 0, misses: 0, inserts: 0 };

function noteWeakCanvasCacheInsert(stats: WeakCanvasCacheStats, canvas: HTMLCanvasElement): void {
  stats.entryCount += 1;
  stats.inserts += 1;
  stats.approxBytes += canvas.width * canvas.height * 4;
}

function registerWeakCanvasMetric(name: string, budgetBytes: number, stats: WeakCanvasCacheStats): void {
  registerCacheMetricSource({
    name,
    budgetBytes,
    sample: () => ({
      name,
      kind: "derived",
      entryCount: stats.entryCount,
      approxBytes: stats.approxBytes,
      hits: stats.hits,
      misses: stats.misses,
      inserts: stats.inserts,
      evictions: 0,
      clears: 0,
      bounded: false,
      hasEviction: false,
      notes: stats.notes ?? "WeakMap-backed cumulative insert count",
    }),
  });
}

registerWeakCanvasMetric("imageTransforms:flippedOverlay", 6 * 1024 * 1024, flippedOverlayStats);
registerWeakCanvasMetric("imageTransforms:isoTop", 6 * 1024 * 1024, runtimeIsoTopStats);
registerWeakCanvasMetric("imageTransforms:isoDecal", 6 * 1024 * 1024, runtimeIsoDecalStats);
registerWeakCanvasMetric("imageTransforms:diamondFit", 6 * 1024 * 1024, runtimeDiamondStats);

function withPerfDrawTag<T>(tag: DrawTag, draw: () => T): T {
  setRenderPerfDrawTag(tag);
  try {
    return draw();
  } finally {
    setRenderPerfDrawTag(null);
  }
}

export function getFlippedOverlayImage(img: HTMLImageElement): HTMLCanvasElement {
  const cached = flippedOverlayImageCache.get(img);
  if (cached) {
    flippedOverlayStats.hits += 1;
    return cached;
  }
  flippedOverlayStats.misses += 1;
  return withPerfDrawTag("entities", () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const c2d = canvas.getContext("2d");
    if (!c2d) return canvas;
    configurePixelPerfect(c2d);
    c2d.translate(canvas.width, 0);
    c2d.scale(-1, 1);
    c2d.drawImage(img, 0, 0);
    flippedOverlayImageCache.set(img, canvas);
    noteWeakCanvasCacheInsert(flippedOverlayStats, canvas);
    return canvas;
  });
}

export function getDiamondFitCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const cached = runtimeDiamondCanvasCache.get(src);
  if (cached) {
    runtimeDiamondStats.hits += 1;
    return cached;
  }
  runtimeDiamondStats.misses += 1;
  return withPerfDrawTag("decals", () => {
    const out = document.createElement("canvas");
    out.width = 128;
    out.height = 64;
    const c2d = out.getContext("2d");
    if (c2d) {
      configurePixelPerfect(c2d);
      c2d.imageSmoothingEnabled = false;
      c2d.drawImage(src, Math.round((128 - src.width) * 0.5), Math.round((64 - src.height) * 0.5));
    }
    runtimeDiamondCanvasCache.set(src, out);
    noteWeakCanvasCacheInsert(runtimeDiamondStats, out);
    return out;
  });
}

export function getRuntimeIsoTopCanvas(
  srcImg: HTMLImageElement,
  rotationQuarterTurns: 0 | 1 | 2 | 3,
): HTMLCanvasElement | null {
  if (!srcImg || srcImg.width <= 0 || srcImg.height <= 0) return null;

  let byRot = runtimeIsoTopCache.get(srcImg);
  if (!byRot) {
    byRot = new Map();
    runtimeIsoTopCache.set(srcImg, byRot);
  }

  const cached = byRot.get(rotationQuarterTurns);
  if (cached) {
    runtimeIsoTopStats.hits += 1;
    return cached;
  }
  runtimeIsoTopStats.misses += 1;

  return withPerfDrawTag("floors", () => {
    const outW = 128;
    const outH = 64;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const c2d = canvas.getContext("2d");
    if (!c2d) return null;
    configurePixelPerfect(c2d);

    c2d.save();
    c2d.translate(outW * 0.5, outH * 0.5);
    c2d.transform(0.5, 0.25, -0.5, 0.25, 0, 0);
    c2d.rotate(rotationQuarterTurns * (Math.PI * 0.5));
    c2d.translate(-(128 * 0.5), -(128 * 0.5));
    c2d.drawImage(srcImg, 0, 0, 128, 128);
    c2d.restore();

    byRot.set(rotationQuarterTurns, canvas);
    noteWeakCanvasCacheInsert(runtimeIsoTopStats, canvas);
    return canvas;
  });
}

export function getRuntimeIsoDecalCanvas(
  srcImg: CanvasImageSource & { width?: number; height?: number },
  rotationQuarterTurns: 0 | 1 | 2 | 3,
  scale: number,
): HTMLCanvasElement | null {
  if (!srcImg || Number(srcImg.width ?? 0) <= 0 || Number(srcImg.height ?? 0) <= 0) return null;
  if (!(scale > 0)) return null;

  let byKey = runtimeIsoDecalCache.get(srcImg as object);
  if (!byKey) {
    byKey = new Map();
    runtimeIsoDecalCache.set(srcImg as object, byKey);
  }

  const scaleQ = Math.round(scale * 1000) / 1000;
  const key = `${rotationQuarterTurns}|${scaleQ}`;
  const cached = byKey.get(key);
  if (cached) {
    runtimeIsoDecalStats.hits += 1;
    return cached;
  }
  runtimeIsoDecalStats.misses += 1;

  return withPerfDrawTag("decals", () => {
    const srcW = Number(srcImg.width ?? 0) * scaleQ;
    const srcH = Number(srcImg.height ?? 0) * scaleQ;
    const rotOdd = (rotationQuarterTurns & 1) === 1;
    const rotW = rotOdd ? srcH : srcW;
    const rotH = rotOdd ? srcW : srcH;
    const span = rotW + rotH;
    const outW = Math.max(1, Math.ceil(span * 0.5));
    const outH = Math.max(1, Math.ceil(span * 0.25));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const c2d = canvas.getContext("2d");
    if (!c2d) return null;
    configurePixelPerfect(c2d);

    c2d.save();
    c2d.translate(outW * 0.5, outH * 0.5);
    c2d.transform(0.5, 0.25, -0.5, 0.25, 0, 0);
    c2d.rotate(rotationQuarterTurns * (Math.PI * 0.5));
    c2d.translate(-(srcW * 0.5), -(srcH * 0.5));
    c2d.drawImage(srcImg, 0, 0, srcW, srcH);
    c2d.restore();

    byKey.set(key, canvas);
    noteWeakCanvasCacheInsert(runtimeIsoDecalStats, canvas);
    return canvas;
  });
}
