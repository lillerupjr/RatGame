import { configurePixelPerfect } from "../../../engine/render/pixelPerfect";
import { setRenderPerfDrawTag, type DrawTag } from "./renderPerfCounters";

const flippedOverlayImageCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
const runtimeIsoTopCache = new WeakMap<HTMLImageElement, Map<0 | 1 | 2 | 3, HTMLCanvasElement>>();
const runtimeIsoDecalCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();
const runtimeDiamondCanvasCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

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
  if (cached) return cached;
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
    return canvas;
  });
}

export function getDiamondFitCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const cached = runtimeDiamondCanvasCache.get(src);
  if (cached) return cached;
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
  if (cached) return cached;

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
    return canvas;
  });
}

export function getRuntimeIsoDecalCanvas(
  srcImg: HTMLImageElement,
  rotationQuarterTurns: 0 | 1 | 2 | 3,
  scale: number,
): HTMLCanvasElement | null {
  if (!srcImg || srcImg.width <= 0 || srcImg.height <= 0) return null;
  if (!(scale > 0)) return null;

  let byKey = runtimeIsoDecalCache.get(srcImg);
  if (!byKey) {
    byKey = new Map();
    runtimeIsoDecalCache.set(srcImg, byKey);
  }

  const scaleQ = Math.round(scale * 1000) / 1000;
  const key = `${rotationQuarterTurns}|${scaleQ}`;
  const cached = byKey.get(key);
  if (cached) return cached;

  return withPerfDrawTag("decals", () => {
    const srcW = srcImg.width * scaleQ;
    const srcH = srcImg.height * scaleQ;
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
    return canvas;
  });
}
