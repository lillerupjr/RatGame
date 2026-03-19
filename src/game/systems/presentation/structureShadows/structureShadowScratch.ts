import { configurePixelPerfect } from "../../../../engine/render/pixelPerfect";
import type {
  StructureShadowScratchCanvasContext,
  StructureShadowV5MaskScratchBundle,
} from "./structureShadowTypes";

let structureShadowV5TopMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV5EastWestMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV5SouthNorthMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV5CoverageMaskScratch: HTMLCanvasElement | null = null;
let structureShadowV5FinalMaskScratch: HTMLCanvasElement | null = null;
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

export function getStructureShadowV5MaskScratchContexts(
  width: number,
  height: number,
): StructureShadowV5MaskScratchBundle | null {
  const top = ensureScratchCanvas2D(structureShadowV5TopMaskScratch, width, height);
  const eastWest = ensureScratchCanvas2D(structureShadowV5EastWestMaskScratch, width, height);
  const southNorth = ensureScratchCanvas2D(structureShadowV5SouthNorthMaskScratch, width, height);
  const coverage = ensureScratchCanvas2D(structureShadowV5CoverageMaskScratch, width, height);
  const finalMask = ensureScratchCanvas2D(structureShadowV5FinalMaskScratch, width, height);
  if (!top || !eastWest || !southNorth || !coverage || !finalMask) return null;

  structureShadowV5TopMaskScratch = top.canvas;
  structureShadowV5EastWestMaskScratch = eastWest.canvas;
  structureShadowV5SouthNorthMaskScratch = southNorth.canvas;
  structureShadowV5CoverageMaskScratch = coverage.canvas;
  structureShadowV5FinalMaskScratch = finalMask.canvas;

  return {
    topMaskCtx: top.ctx,
    eastWestMaskCtx: eastWest.ctx,
    southNorthMaskCtx: southNorth.ctx,
    coverageMaskCtx: coverage.ctx,
    finalMaskCtx: finalMask.ctx,
    topMaskCanvas: top.canvas,
    eastWestMaskCanvas: eastWest.canvas,
    southNorthMaskCanvas: southNorth.canvas,
    coverageMaskCanvas: coverage.canvas,
    finalMaskCanvas: finalMask.canvas,
    width: top.canvas.width,
    height: top.canvas.height,
  };
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
