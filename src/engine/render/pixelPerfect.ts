export function snapPx(n: number): number {
  return Math.floor(n);
}

export const MIN_GAME_WIDTH = 640;
export const MIN_GAME_HEIGHT = 360;

export function normalizePixelScale(pixelScale: number): number {
  if (!Number.isFinite(pixelScale)) return 1;
  return Math.max(1, Math.floor(pixelScale));
}

export function defaultPixelScaleForViewport(cssW: number, cssH: number): number {
  const scaleByWidth = Math.floor(cssW / MIN_GAME_WIDTH);
  const scaleByHeight = Math.floor(cssH / MIN_GAME_HEIGHT);
  return normalizePixelScale(Math.max(1, Math.min(scaleByWidth, scaleByHeight)));
}

export function configurePixelPerfect(ctx: CanvasRenderingContext2D): void {
  ctx.imageSmoothingEnabled = false;

  const ctxWithVendorFlags = ctx as CanvasRenderingContext2D & {
    mozImageSmoothingEnabled?: boolean;
    webkitImageSmoothingEnabled?: boolean;
    msImageSmoothingEnabled?: boolean;
  };

  ctxWithVendorFlags.mozImageSmoothingEnabled = false;
  ctxWithVendorFlags.webkitImageSmoothingEnabled = false;
  ctxWithVendorFlags.msImageSmoothingEnabled = false;
}

export function resizeCanvasPixelPerfect(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  pixelScale: number = defaultPixelScaleForViewport(cssW, cssH),
): number {
  // Pixel-perfect uses integer pixelScale >= 1; default keeps game resolution >= 640x360.
  const resolvedPixelScale = normalizePixelScale(pixelScale);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = snapPx(cssW * dpr);
  canvas.height = snapPx(cssH * dpr);
  canvas.style.width = `${snapPx(cssW)}px`;
  canvas.style.height = `${snapPx(cssH)}px`;
  canvas.dataset.pixelScale = String(resolvedPixelScale);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  configurePixelPerfect(ctx);

  return resolvedPixelScale;
}

export function snapZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}
