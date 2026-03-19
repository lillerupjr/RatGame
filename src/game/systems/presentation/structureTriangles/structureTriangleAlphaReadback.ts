import { type StructureSliceDebugAlphaMap } from "./structureTriangleTypes";

let structureSliceDebugReadbackCanvas: HTMLCanvasElement | null = null;
let structureSliceDebugReadbackCtx: CanvasRenderingContext2D | null = null;
const structureSliceDebugAlphaMapCache = new WeakMap<object, StructureSliceDebugAlphaMap | null>();

export function getStructureSliceDebugAlphaMap(
  sourceImg: CanvasImageSource,
): StructureSliceDebugAlphaMap | null {
  if (!(sourceImg instanceof HTMLImageElement || sourceImg instanceof HTMLCanvasElement)) return null;
  const key = sourceImg as object;
  if (structureSliceDebugAlphaMapCache.has(key)) {
    return structureSliceDebugAlphaMapCache.get(key) ?? null;
  }
  const width = sourceImg instanceof HTMLImageElement
    ? (sourceImg.naturalWidth || sourceImg.width || 0)
    : sourceImg.width;
  const height = sourceImg instanceof HTMLImageElement
    ? (sourceImg.naturalHeight || sourceImg.height || 0)
    : sourceImg.height;
  if (width <= 0 || height <= 0) {
    structureSliceDebugAlphaMapCache.set(key, null);
    return null;
  }
  const canvas = structureSliceDebugReadbackCanvas ?? document.createElement("canvas");
  structureSliceDebugReadbackCanvas = canvas;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const readbackCtx = structureSliceDebugReadbackCtx ?? canvas.getContext("2d", { willReadFrequently: true });
  structureSliceDebugReadbackCtx = readbackCtx;
  if (!readbackCtx) {
    structureSliceDebugAlphaMapCache.set(key, null);
    return null;
  }
  try {
    readbackCtx.setTransform(1, 0, 0, 1, 0, 0);
    readbackCtx.clearRect(0, 0, width, height);
    readbackCtx.drawImage(sourceImg, 0, 0, width, height);
    const imgData = readbackCtx.getImageData(0, 0, width, height);
    const resolved = {
      width,
      height,
      data: imgData.data,
    };
    structureSliceDebugAlphaMapCache.set(key, resolved);
    return resolved;
  } catch {
    structureSliceDebugAlphaMapCache.set(key, null);
    return null;
  }
}
