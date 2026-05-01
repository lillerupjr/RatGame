import type { RenderQuadPoints } from "../renderCommandGeometry";

function buildRectSourceQuad(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): RenderQuadPoints {
  return {
    nw: { x: sx, y: sy },
    ne: { x: sx + sw, y: sy },
    se: { x: sx + sw, y: sy + sh },
    sw: { x: sx, y: sy + sh },
  };
}

export function drawTexturedQuad(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  quad: RenderQuadPoints,
  sourceQuad?: RenderQuadPoints,
): void {
  if (!(sw > 0 && sh > 0)) return;

  const src = sourceQuad ?? buildRectSourceQuad(sx, sy, sw, sh);
  const srcU = {
    x: src.ne.x - src.nw.x,
    y: src.ne.y - src.nw.y,
  };
  const srcV = {
    x: src.sw.x - src.nw.x,
    y: src.sw.y - src.nw.y,
  };
  const dstU = {
    x: quad.ne.x - quad.nw.x,
    y: quad.ne.y - quad.nw.y,
  };
  const dstV = {
    x: quad.sw.x - quad.nw.x,
    y: quad.sw.y - quad.nw.y,
  };
  const determinant = srcU.x * srcV.y - srcU.y * srcV.x;
  if (Math.abs(determinant) <= 1e-9) return;
  const inv00 = srcV.y / determinant;
  const inv01 = -srcV.x / determinant;
  const inv10 = -srcU.y / determinant;
  const inv11 = srcU.x / determinant;
  const scaleXx = dstU.x * inv00 + dstV.x * inv10;
  const scaleYx = dstU.x * inv01 + dstV.x * inv11;
  const scaleXy = dstU.y * inv00 + dstV.y * inv10;
  const scaleYy = dstU.y * inv01 + dstV.y * inv11;
  const translateX = quad.nw.x - scaleXx * src.nw.x - scaleYx * src.nw.y;
  const translateY = quad.nw.y - scaleXy * src.nw.x - scaleYy * src.nw.y;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(quad.nw.x, quad.nw.y);
  ctx.lineTo(quad.ne.x, quad.ne.y);
  ctx.lineTo(quad.se.x, quad.se.y);
  ctx.lineTo(quad.sw.x, quad.sw.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(scaleXx, scaleXy, scaleYx, scaleYy, translateX, translateY);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}
