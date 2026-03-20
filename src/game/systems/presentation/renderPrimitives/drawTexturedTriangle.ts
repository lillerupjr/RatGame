import { computeTriToTriAffine, type TrianglePoint } from "./triangleAffine";

export function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  s0: TrianglePoint,
  s1: TrianglePoint,
  s2: TrianglePoint,
  d0: TrianglePoint,
  d1: TrianglePoint,
  d2: TrianglePoint,
): void {
  const m = computeTriToTriAffine(s0, s1, s2, d0, d1, d2);
  if (!m) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(img, 0, 0, imgW, imgH);
  ctx.restore();
}

export function drawShadowTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  s0: TrianglePoint,
  s1: TrianglePoint,
  s2: TrianglePoint,
  d0: TrianglePoint,
  d1: TrianglePoint,
  d2: TrianglePoint,
  shadowAlpha: number,
): void {
  const m = computeTriToTriAffine(s0, s1, s2, d0, d1, d2);
  if (!m) return;
  const alpha = Math.max(0, Math.min(1, shadowAlpha));
  if (alpha <= 0) return;
  const textureAlpha = Math.max(0.14, Math.min(0.48, alpha * 0.95));
  const darkenAlpha = Math.max(alpha, Math.min(0.9, alpha * 1.75));
  ctx.save();
  const baseAlpha = ctx.globalAlpha;
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = baseAlpha * textureAlpha;
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(img, 0, 0, imgW, imgH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Keep warped source variation visible while forcing a dark shadow treatment.
  ctx.globalAlpha = baseAlpha;
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = `rgba(0,0,0,${darkenAlpha})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
