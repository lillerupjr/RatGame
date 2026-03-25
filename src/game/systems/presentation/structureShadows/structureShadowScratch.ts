import { configurePixelPerfect } from "../../../../engine/render/pixelPerfect";

type StructureShadowScratchCanvasContext = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

let structureShadowV6FaceScratch: HTMLCanvasElement | null = null;

function ensureScratchCanvas2D(
  existing: HTMLCanvasElement | null,
  width: number,
  height: number,
): StructureShadowScratchCanvasContext | null {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const canvas = existing ?? document.createElement("canvas");
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  configurePixelPerfect(ctx);
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export function getStructureShadowV6FaceScratchContext(
  width: number,
  height: number,
): StructureShadowScratchCanvasContext | null {
  const scratch = ensureScratchCanvas2D(structureShadowV6FaceScratch, width, height);
  if (!scratch) return null;
  structureShadowV6FaceScratch = scratch.canvas;
  return scratch;
}
