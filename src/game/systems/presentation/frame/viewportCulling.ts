export type ScreenRect = { minX: number; maxX: number; minY: number; maxY: number };
export type TileBounds = { minTx: number; maxTx: number; minTy: number; maxTy: number };
export type CullingView = { screenRect: ScreenRect; tileBounds: TileBounds };

export interface ViewportCullingInput {
  camTx: number;
  camTy: number;
  visibleWorldWidth: number;
  visibleWorldHeight: number;
  tileWorld: number;
  isoX: number;
  isoY: number;
  renderPaddingFactor: number;
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  screenToWorld: (x: number, y: number) => { x: number; y: number };
}

export interface ViewportCullingResult {
  baseCulling: CullingView;
  viewRect: TileBounds;
  projectedViewportRect: { x: number; y: number; w: number; h: number };
  strictViewportTileBounds: TileBounds;
  getCullingView: (extraPadTiles: number) => CullingView;
  isTileInRenderRadius: (tx: number, ty: number) => boolean;
  isTileInRenderRadiusPadded: (tx: number, ty: number, padTiles: number) => boolean;
  tileRectIntersectsRenderRadius: (
    minRectTx: number,
    maxRectTx: number,
    minRectTy: number,
    maxRectTy: number,
  ) => boolean;
  tileRectIntersectsBounds: (
    minRectTx: number,
    maxRectTx: number,
    minRectTy: number,
    maxRectTy: number,
    bounds: TileBounds,
  ) => boolean;
}

function pointInRect(px: number, py: number, r: ScreenRect): boolean {
  return px >= r.minX && px <= r.maxX && py >= r.minY && py <= r.maxY;
}

function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function pointInConvexQuad(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): boolean {
  const c0 = cross(x0, y0, x1, y1, px, py);
  const c1 = cross(x1, y1, x2, y2, px, py);
  const c2 = cross(x2, y2, x3, y3, px, py);
  const c3 = cross(x3, y3, x0, y0, px, py);
  const hasPos = c0 > 0 || c1 > 0 || c2 > 0 || c3 > 0;
  const hasNeg = c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0;
  return !(hasPos && hasNeg);
}

function onSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number): boolean {
  return px >= Math.min(ax, bx)
    && px <= Math.max(ax, bx)
    && py >= Math.min(ay, by)
    && py <= Math.max(ay, by);
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const o1 = cross(ax, ay, bx, by, cx, cy);
  const o2 = cross(ax, ay, bx, by, dx, dy);
  const o3 = cross(cx, cy, dx, dy, ax, ay);
  const o4 = cross(cx, cy, dx, dy, bx, by);

  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
  if (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  if (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  return false;
}

function tileDiamondIntersectsScreenRect(
  tx: number,
  ty: number,
  rect: ScreenRect,
  tileWorld: number,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
): boolean {
  const x0w = tx * tileWorld;
  const y0w = ty * tileWorld;
  const p0 = worldToScreen(x0w, y0w);
  const p1 = worldToScreen(x0w + tileWorld, y0w);
  const p2 = worldToScreen(x0w + tileWorld, y0w + tileWorld);
  const p3 = worldToScreen(x0w, y0w + tileWorld);

  if (
    pointInRect(p0.x, p0.y, rect)
    || pointInRect(p1.x, p1.y, rect)
    || pointInRect(p2.x, p2.y, rect)
    || pointInRect(p3.x, p3.y, rect)
  ) {
    return true;
  }

  const rx0 = rect.minX;
  const ry0 = rect.minY;
  const rx1 = rect.maxX;
  const ry1 = rect.minY;
  const rx2 = rect.maxX;
  const ry2 = rect.maxY;
  const rx3 = rect.minX;
  const ry3 = rect.maxY;

  if (
    pointInConvexQuad(rx0, ry0, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    || pointInConvexQuad(rx1, ry1, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    || pointInConvexQuad(rx2, ry2, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    || pointInConvexQuad(rx3, ry3, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
  ) {
    return true;
  }

  const quadEdges: Array<[number, number, number, number]> = [
    [p0.x, p0.y, p1.x, p1.y],
    [p1.x, p1.y, p2.x, p2.y],
    [p2.x, p2.y, p3.x, p3.y],
    [p3.x, p3.y, p0.x, p0.y],
  ];
  const rectEdges: Array<[number, number, number, number]> = [
    [rx0, ry0, rx1, ry1],
    [rx1, ry1, rx2, ry2],
    [rx2, ry2, rx3, ry3],
    [rx3, ry3, rx0, ry0],
  ];
  for (let i = 0; i < quadEdges.length; i++) {
    const [ax, ay, bx, by] = quadEdges[i];
    for (let j = 0; j < rectEdges.length; j++) {
      const [cx, cy, dx, dy] = rectEdges[j];
      if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return true;
    }
  }
  return false;
}

export function buildViewportCulling(input: ViewportCullingInput): ViewportCullingResult {
  const {
    camTx,
    camTy,
    visibleWorldWidth,
    visibleWorldHeight,
    tileWorld,
    isoX,
    isoY,
    renderPaddingFactor,
    worldToScreen,
    screenToWorld,
  } = input;

  const cullingCache = new Map<number, CullingView>();
  const getCullingView = (extraPadTiles: number): CullingView => {
    const p = Math.floor(extraPadTiles);
    const cached = cullingCache.get(p);
    if (cached) return cached;

    const baseMinX = -camTx;
    const baseMaxX = -camTx + visibleWorldWidth;
    const baseMinY = -camTy;
    const baseMaxY = -camTy + visibleWorldHeight;
    const centerX = (baseMinX + baseMaxX) * 0.5;
    const centerY = (baseMinY + baseMaxY) * 0.5;
    const baseHalfW = (baseMaxX - baseMinX) * 0.5;
    const baseHalfH = (baseMaxY - baseMinY) * 0.5;
    const padFactorExtra = p / 12;
    const scale = Math.max(0.1, 1 + renderPaddingFactor + padFactorExtra);
    const minHalfW = tileWorld * isoX;
    const minHalfH = tileWorld * isoY;
    const halfW = Math.max(minHalfW, baseHalfW * scale);
    const halfH = Math.max(minHalfH, baseHalfH * scale);
    const sx0 = centerX - halfW;
    const sx1 = centerX + halfW;
    const sy0 = centerY - halfH;
    const sy1 = centerY + halfH;
    const screenRect: ScreenRect = {
      minX: Math.min(sx0, sx1),
      maxX: Math.max(sx0, sx1),
      minY: Math.min(sy0, sy1),
      maxY: Math.max(sy0, sy1),
    };

    const c0 = screenToWorld(screenRect.minX, screenRect.minY);
    const c1 = screenToWorld(screenRect.maxX, screenRect.minY);
    const c2 = screenToWorld(screenRect.minX, screenRect.maxY);
    const c3 = screenToWorld(screenRect.maxX, screenRect.maxY);
    const minWx = Math.min(c0.x, c1.x, c2.x, c3.x);
    const maxWx = Math.max(c0.x, c1.x, c2.x, c3.x);
    const minWy = Math.min(c0.y, c1.y, c2.y, c3.y);
    const maxWy = Math.max(c0.y, c1.y, c2.y, c3.y);
    const tileBounds: TileBounds = {
      minTx: Math.floor(minWx / tileWorld),
      maxTx: Math.floor(maxWx / tileWorld),
      minTy: Math.floor(minWy / tileWorld),
      maxTy: Math.floor(maxWy / tileWorld),
    };
    const view: CullingView = { screenRect, tileBounds };
    cullingCache.set(p, view);
    return view;
  };

  const baseCulling = getCullingView(0);
  const viewRect = baseCulling.tileBounds;
  const projectedViewportRect = {
    x: -camTx,
    y: -camTy,
    w: visibleWorldWidth,
    h: visibleWorldHeight,
  };

  const vx0 = projectedViewportRect.x;
  const vy0 = projectedViewportRect.y;
  const vx1 = projectedViewportRect.x + projectedViewportRect.w;
  const vy1 = projectedViewportRect.y + projectedViewportRect.h;
  const c0 = screenToWorld(vx0, vy0);
  const c1 = screenToWorld(vx1, vy0);
  const c2 = screenToWorld(vx0, vy1);
  const c3 = screenToWorld(vx1, vy1);
  const strictViewportTileBounds: TileBounds = {
    minTx: Math.floor(Math.min(c0.x, c1.x, c2.x, c3.x) / tileWorld),
    maxTx: Math.floor(Math.max(c0.x, c1.x, c2.x, c3.x) / tileWorld),
    minTy: Math.floor(Math.min(c0.y, c1.y, c2.y, c3.y) / tileWorld),
    maxTy: Math.floor(Math.max(c0.y, c1.y, c2.y, c3.y) / tileWorld),
  };

  const minTx = viewRect.minTx;
  const maxTx = viewRect.maxTx;
  const minTy = viewRect.minTy;
  const maxTy = viewRect.maxTy;

  const isTileInRenderRadius = (tx: number, ty: number): boolean => {
    if (tx < minTx || tx > maxTx || ty < minTy || ty > maxTy) return false;
    return tileDiamondIntersectsScreenRect(tx, ty, baseCulling.screenRect, tileWorld, worldToScreen);
  };

  const isTileInRenderRadiusPadded = (tx: number, ty: number, padTiles: number): boolean => {
    const culling = getCullingView(Math.max(0, Math.floor(padTiles)));
    const bounds = culling.tileBounds;
    if (tx < bounds.minTx || tx > bounds.maxTx || ty < bounds.minTy || ty > bounds.maxTy) return false;
    return tileDiamondIntersectsScreenRect(tx, ty, culling.screenRect, tileWorld, worldToScreen);
  };

  const tileRectIntersectsRenderRadius = (
    minRectTx: number,
    maxRectTx: number,
    minRectTy: number,
    maxRectTy: number,
  ): boolean => {
    return !(maxRectTx < minTx || minRectTx > maxTx || maxRectTy < minTy || minRectTy > maxTy);
  };

  const tileRectIntersectsBounds = (
    minRectTx: number,
    maxRectTx: number,
    minRectTy: number,
    maxRectTy: number,
    bounds: TileBounds,
  ): boolean => {
    return !(maxRectTx < bounds.minTx || minRectTx > bounds.maxTx || maxRectTy < bounds.minTy || minRectTy > bounds.maxTy);
  };

  return {
    baseCulling,
    viewRect,
    projectedViewportRect,
    strictViewportTileBounds,
    getCullingView,
    isTileInRenderRadius,
    isTileInRenderRadiusPadded,
    tileRectIntersectsRenderRadius,
    tileRectIntersectsBounds,
  };
}

export function isTileInPlayerSouthWedge(
  tx: number,
  ty: number,
  playerTx: number,
  playerTy: number,
): boolean {
  const dx = tx - playerTx;
  const dy = ty - playerTy;

  if (dx === 0 && dy === 0) return false;

  const sum = dx + dy;
  if (sum <= 0) return false;

  const diff = Math.abs(dx - dy);

  return diff <= sum;
}
