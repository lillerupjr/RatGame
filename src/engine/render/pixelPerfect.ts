export function snapPx(n: number): number {
  return Math.floor(n);
}

// Base (design) resolution for pixelScale selection.
// Option B: view expands within a bucket; this only chooses 1..4 sensibly across devices.
export const BASE_GAME_WIDTH = 960;
export const BASE_GAME_HEIGHT = 540;

// Hard limits to keep assets/UI sane
export const MIN_PIXEL_SCALE = 1;
export const MAX_PIXEL_SCALE = 4;

export function normalizePixelScale(pixelScale: number): number {
  if (!Number.isFinite(pixelScale)) return 1;
  return Math.max(MIN_PIXEL_SCALE, Math.min(MAX_PIXEL_SCALE, Math.floor(pixelScale)));
}

export function defaultPixelScaleForViewport(cssW: number, cssH: number): number {
  const scaleByWidth = Math.floor(cssW / BASE_GAME_WIDTH);
  const scaleByHeight = Math.floor(cssH / BASE_GAME_HEIGHT);

  const raw = Math.max(1, Math.min(scaleByWidth, scaleByHeight));
  const snapped = normalizePixelScale(raw);

  return Math.max(MIN_PIXEL_SCALE, Math.min(MAX_PIXEL_SCALE, snapped));
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
  pixelScale?: number,
): number {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, rect.width);
  const cssH = Math.max(1, rect.height);
  // Pixel-perfect uses integer pixelScale in the configured clamp range.
  const resolvedPixelScale = normalizePixelScale(pixelScale ?? defaultPixelScaleForViewport(cssW, cssH));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  // Let CSS control layout size (#c/#ui use width/height: 100%).
  // Avoid locking inline pixel width/height, which can break reactions to viewport changes.
  if (canvas.style.width) canvas.style.width = "";
  if (canvas.style.height) canvas.style.height = "";
  canvas.dataset.pixelScale = String(resolvedPixelScale);
  canvas.dataset.effectiveDpr = String(dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  configurePixelPerfect(ctx);

  return resolvedPixelScale;
}

export function attachCanvasAutoResize(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  onResized?: () => void,
): () => void {
  let lastCssW = 0;
  let lastCssH = 0;
  let lastDpr = 0;
  let rafId = 0;
  let disposed = false;

  const recompute = () => {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    if (cssW === lastCssW && cssH === lastCssH && dpr === lastDpr) return;

    lastCssW = cssW;
    lastCssH = cssH;
    lastDpr = dpr;

    const pixelScale = defaultPixelScaleForViewport(cssW, cssH);
    resizeCanvasPixelPerfect(canvas, ctx, pixelScale);
    onResized?.();
  };

  const resizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => recompute())
    : null;
  resizeObserver?.observe(canvas);
  window.addEventListener("resize", recompute);

  const tick = () => {
    if (disposed) return;
    recompute();
    rafId = window.requestAnimationFrame(tick);
  };
  rafId = window.requestAnimationFrame(tick);
  recompute();

  return () => {
    disposed = true;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    resizeObserver?.disconnect();
    window.removeEventListener("resize", recompute);
  };
}

export function snapZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}
