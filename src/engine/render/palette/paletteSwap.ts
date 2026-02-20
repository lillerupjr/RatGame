import { DB32, type HexColor, getPaletteById } from "./palettes";

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: HexColor): RGB {
  const h = hex.slice(1);
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbKey(r: number, g: number, b: number): number {
  // 24-bit key
  return (r << 16) | (g << 8) | b;
}

function distSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Build a mapping from each DB32 color (0..31) to the nearest target palette color index.
 * Target palette can be any length >= 1 (Divination is 7).
 */
export function buildDb32ToTargetIndexLut(targetPaletteId: string): Uint8Array {
  const target = getPaletteById(targetPaletteId);
  const srcRgb = DB32.colors.map(hexToRgb);
  const tgtRgb = target.colors.map(hexToRgb);

  const lut = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    let bestJ = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let j = 0; j < tgtRgb.length; j++) {
      const d = distSq(srcRgb[i], tgtRgb[j]);
      if (d < bestD) {
        bestD = d;
        bestJ = j;
      }
    }
    lut[i] = bestJ;
  }
  return lut;
}

export function applyPaletteSwapToCanvas(
  srcImg: HTMLImageElement,
  targetPaletteId: string,
): HTMLCanvasElement {
  const target = getPaletteById(targetPaletteId);
  const targetRgb = target.colors.map(hexToRgb);

  // Map exact DB32 RGB -> db32 index
  const db32IndexByRgb = new Map<number, number>();
  for (let i = 0; i < DB32.colors.length; i++) {
    const c = hexToRgb(DB32.colors[i]);
    db32IndexByRgb.set(rgbKey(c.r, c.g, c.b), i);
  }

  const db32ToTarget = buildDb32ToTargetIndexLut(targetPaletteId);

  const canvas = document.createElement("canvas");
  canvas.width = srcImg.naturalWidth || srcImg.width;
  canvas.height = srcImg.naturalHeight || srcImg.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcImg, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const key = rgbKey(data[i], data[i + 1], data[i + 2]);
    const srcIndex = db32IndexByRgb.get(key);
    if (srcIndex === undefined) continue; // non-DB32 pixel: leave as-is

    const tgtIndex = db32ToTarget[srcIndex];
    const tgt = targetRgb[tgtIndex];

    data[i] = tgt.r;
    data[i + 1] = tgt.g;
    data[i + 2] = tgt.b;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
