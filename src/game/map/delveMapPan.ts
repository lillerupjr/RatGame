export type PanBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export function computePanBounds(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): PanBounds {
  const cw = Math.max(1, Math.floor(contentWidth));
  const ch = Math.max(1, Math.floor(contentHeight));
  const vw = Math.max(1, Math.floor(viewportWidth));
  const vh = Math.max(1, Math.floor(viewportHeight));
  return {
    minX: Math.min(0, vw - cw),
    maxX: 0,
    minY: Math.min(0, vh - ch),
    maxY: 0,
  };
}

export function clampPan(value: { x: number; y: number }, bounds: PanBounds): { x: number; y: number } {
  const x = Math.max(bounds.minX, Math.min(bounds.maxX, Number.isFinite(value.x) ? value.x : 0));
  const y = Math.max(bounds.minY, Math.min(bounds.maxY, Number.isFinite(value.y) ? value.y : 0));
  return { x, y };
}

export function hasDragExceededThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  thresholdPx: number,
): boolean {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return dx * dx + dy * dy >= thresholdPx * thresholdPx;
}
