import { configurePixelPerfect } from "../../../../engine/render/pixelPerfect";
import { type PieceLocalRelightPlan } from "../staticRelightPoc";

let staticRelightPieceScratch: HTMLCanvasElement | null = null;
let staticRelightMaskScratch: HTMLCanvasElement | null = null;

function getStaticRelightPieceScratchContext(
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const canvas = staticRelightPieceScratch ?? document.createElement("canvas");
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  staticRelightPieceScratch = canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  configurePixelPerfect(ctx);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function getStaticRelightMaskScratchContext(
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const canvas = staticRelightMaskScratch ?? document.createElement("canvas");
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  staticRelightMaskScratch = canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  configurePixelPerfect(ctx);
  ctx.imageSmoothingEnabled = true;
  return ctx;
}

export function drawPieceLocalRelightMask(
  maskCtx: CanvasRenderingContext2D,
  plan: PieceLocalRelightPlan,
  pieceW: number,
  pieceH: number,
): boolean {
  let hasMask = false;
  maskCtx.setTransform(1, 0, 0, 1, 0, 0);
  maskCtx.globalCompositeOperation = "source-over";
  maskCtx.globalAlpha = 1;
  maskCtx.clearRect(0, 0, pieceW, pieceH);
  maskCtx.globalCompositeOperation = "lighter";
  for (let i = 0; i < plan.masks.length; i++) {
    const mask = plan.masks[i];
    const maskAlpha = Math.max(0, Math.min(1, mask.alpha));
    const radiusPx = Math.max(1, mask.radiusPx);
    const yScale = Math.max(0.1, Math.min(2, Number(mask.yScale ?? 1)));
    if (maskAlpha <= 0 || radiusPx <= 0) continue;
    maskCtx.save();
    maskCtx.translate(mask.centerX, mask.centerY);
    maskCtx.scale(1, yScale);
    const grad = maskCtx.createRadialGradient(0, 0, 0, 0, 0, radiusPx);
    grad.addColorStop(0, `rgba(255,255,255,${maskAlpha})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    maskCtx.fillStyle = grad;
    maskCtx.fillRect(-radiusPx, -radiusPx, radiusPx * 2, radiusPx * 2);
    maskCtx.restore();
    hasMask = true;
  }
  return hasMask;
}

export function composePieceLocalRelightBakedCanvas(
  plan: PieceLocalRelightPlan,
  pieceW: number,
  pieceH: number,
  drawBaseLocal: (target: CanvasRenderingContext2D, width: number, height: number) => void,
  drawVariantLocal: (target: CanvasRenderingContext2D, width: number, height: number) => void,
): HTMLCanvasElement | null {
  if (!(pieceW > 0) || !(pieceH > 0)) return null;
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.ceil(pieceW));
  output.height = Math.max(1, Math.ceil(pieceH));
  const outputCtx = output.getContext("2d");
  if (!outputCtx) return null;
  configurePixelPerfect(outputCtx);
  outputCtx.imageSmoothingEnabled = false;
  drawBaseLocal(outputCtx, pieceW, pieceH);

  if (!(plan.blendAlpha > 0) || plan.masks.length === 0) return output;
  const clampedBlendAlpha = Math.max(0, Math.min(1, plan.blendAlpha));
  if (clampedBlendAlpha <= 0) return output;
  const scratchCtx = getStaticRelightPieceScratchContext(pieceW, pieceH);
  if (!scratchCtx) return output;
  const maskCtx = getStaticRelightMaskScratchContext(pieceW, pieceH);
  if (!maskCtx) return output;

  scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
  scratchCtx.globalCompositeOperation = "source-over";
  scratchCtx.globalAlpha = 1;
  scratchCtx.clearRect(0, 0, pieceW, pieceH);
  drawVariantLocal(scratchCtx, pieceW, pieceH);
  const hasMask = drawPieceLocalRelightMask(maskCtx, plan, pieceW, pieceH);
  if (!hasMask) return output;
  scratchCtx.globalCompositeOperation = "destination-in";
  scratchCtx.globalAlpha = 1;
  scratchCtx.drawImage(staticRelightMaskScratch!, 0, 0, pieceW, pieceH);

  outputCtx.save();
  outputCtx.globalCompositeOperation = "source-over";
  outputCtx.globalAlpha = clampedBlendAlpha;
  outputCtx.drawImage(staticRelightPieceScratch!, 0, 0, pieceW, pieceH);
  outputCtx.restore();
  return output;
}
