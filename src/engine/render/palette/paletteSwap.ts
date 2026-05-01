import { hsvToRgb, hueDistanceDegrees, rgbToHsv } from "./colorMath";
import { getPaletteHsvAnchors, type PaletteHsvAnchor } from "./palettes";

export type PaletteSwapWeights = {
  sWeight: number;
  darkness: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function mix(a: number, b: number, t: number): number {
  const weight = clamp01(t);
  return a * (1 - weight) + b * weight;
}

export function resolvePaletteSwapWeights(weights?: Partial<PaletteSwapWeights> | null): PaletteSwapWeights {
  return {
    sWeight: clamp01(weights?.sWeight ?? 0),
    darkness: clamp01(weights?.darkness ?? 0),
  };
}

export function pickNearestHueAnchor(sourceHue: number, paletteHueAnchors: readonly number[]): number {
  if (paletteHueAnchors.length === 0) return sourceHue;

  let nearest = paletteHueAnchors[0];
  let nearestDist = hueDistanceDegrees(sourceHue, nearest);
  for (let i = 1; i < paletteHueAnchors.length; i++) {
    const candidate = paletteHueAnchors[i];
    const candidateDist = hueDistanceDegrees(sourceHue, candidate);
    if (candidateDist < nearestDist) {
      nearest = candidate;
      nearestDist = candidateDist;
    }
  }
  return nearest;
}

export function pickNearestPaletteHsvAnchor(
  sourceHue: number,
  paletteHsvAnchors: readonly PaletteHsvAnchor[],
): PaletteHsvAnchor {
  if (paletteHsvAnchors.length === 0) {
    return {
      h: sourceHue,
      s: 0,
      v: 0,
    };
  }

  let nearest = paletteHsvAnchors[0];
  let nearestDist = hueDistanceDegrees(sourceHue, nearest.h);
  for (let i = 1; i < paletteHsvAnchors.length; i++) {
    const candidate = paletteHsvAnchors[i];
    const candidateDist = hueDistanceDegrees(sourceHue, candidate.h);
    if (candidateDist < nearestDist) {
      nearest = candidate;
      nearestDist = candidateDist;
    }
  }
  return nearest;
}

export function remapRgbaByHueLockInPlace(
  data: Uint8ClampedArray,
  paletteHsvAnchors: readonly PaletteHsvAnchor[],
  weights?: Partial<PaletteSwapWeights> | null,
): void {
  if (paletteHsvAnchors.length === 0) return;
  const remapWeights = resolvePaletteSwapWeights(weights);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const hsv = rgbToHsv({ r: data[i], g: data[i + 1], b: data[i + 2] });
    const nearestPalette = pickNearestPaletteHsvAnchor(hsv.h, paletteHsvAnchors);
    const darknessBrightness = 1 - Math.pow(remapWeights.darkness, 1.8);
    const valueAfterDarkness = hsv.v * darknessBrightness;
    const remappedRgb = hsvToRgb({
      h: nearestPalette.h,
      s: mix(hsv.s, nearestPalette.s, remapWeights.sWeight),
      v: valueAfterDarkness,
    });

    data[i] = remappedRgb.r;
    data[i + 1] = remappedRgb.g;
    data[i + 2] = remappedRgb.b;
  }
}

export function applyPaletteSwapToCanvas(
  srcImg: HTMLImageElement,
  targetPaletteId: string,
  weights?: Partial<PaletteSwapWeights> | null,
): HTMLCanvasElement {
  const paletteHsvAnchors = getPaletteHsvAnchors(targetPaletteId);

  const canvas = document.createElement("canvas");
  canvas.width = srcImg.naturalWidth || srcImg.width;
  canvas.height = srcImg.naturalHeight || srcImg.height;

  // `willReadFrequently` reduces GPU readback stalls for getImageData-heavy paths.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcImg, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  remapRgbaByHueLockInPlace(data, paletteHsvAnchors, weights);

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
