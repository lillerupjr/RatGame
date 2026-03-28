import type {
  GroundDecalQuadPayload,
  GroundSurfaceQuadPayload,
  QuadRenderPiece,
  RenderPoint,
  RenderTrianglePoints,
  WorldSpriteQuadPayload,
} from "./contracts/renderCommands";

export type RenderQuadPoints = {
  nw: RenderPoint;
  ne: RenderPoint;
  se: RenderPoint;
  sw: RenderPoint;
};

type FlatTileQuadPointInput = {
  tx: number;
  ty: number;
  zBase: number;
  renderAnchorY: number;
  tileWorld: number;
  elevPx: number;
  isoHeight: number;
  camX: number;
  camY: number;
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
  snapPoint: (value: number) => number;
  extraDy?: number;
};

type CutoutAlphaInput = {
  cutoutEnabled: boolean;
  buildingDirectionalEligible: boolean;
  groupParentAfterPlayer: boolean;
  cutoutAlpha: number;
  cutoutScreenRect: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null;
};

function point(x: number, y: number): RenderPoint {
  return { x, y };
}

export function buildDiamondSourceQuad(sourceWidth: number, sourceHeight: number): RenderQuadPoints {
  const halfWidth = sourceWidth * 0.5;
  const halfHeight = sourceHeight * 0.5;
  return {
    nw: point(halfWidth, 0),
    ne: point(sourceWidth, halfHeight),
    se: point(halfWidth, sourceHeight),
    sw: point(0, halfHeight),
  };
}

export function buildRectSourceQuad(
  sourceWidth: number,
  sourceHeight: number,
  flipX = false,
): RenderQuadPoints {
  if (!flipX) {
    return {
      nw: point(0, 0),
      ne: point(sourceWidth, 0),
      se: point(sourceWidth, sourceHeight),
      sw: point(0, sourceHeight),
    };
  }

  return {
    nw: point(sourceWidth, 0),
    ne: point(0, 0),
    se: point(0, sourceHeight),
    sw: point(sourceWidth, sourceHeight),
  };
}

export function buildRectDestinationQuad(
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): RenderQuadPoints {
  return {
    nw: point(dx, dy),
    ne: point(dx + dw, dy),
    se: point(dx + dw, dy + dh),
    sw: point(dx, dy + dh),
  };
}

export function buildDiamondDestinationQuad(
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): RenderQuadPoints {
  const halfWidth = dw * 0.5;
  const halfHeight = dh * 0.5;
  return {
    nw: point(dx + halfWidth, dy),
    ne: point(dx + dw, dy + halfHeight),
    se: point(dx + halfWidth, dy + dh),
    sw: point(dx, dy + halfHeight),
  };
}

export function buildFlatTileDestinationQuad(input: FlatTileQuadPointInput): RenderQuadPoints {
  const {
    tx,
    ty,
    zBase,
    renderAnchorY,
    tileWorld,
    elevPx,
    isoHeight,
    camX,
    camY,
    worldToScreen,
    snapPoint,
    extraDy = 0,
  } = input;
  const anchorYOffset = isoHeight * (renderAnchorY - 0.5);
  const sample = (worldX: number, worldY: number): RenderPoint => {
    const p = worldToScreen(worldX, worldY);
    return {
      x: snapPoint(p.x + camX),
      y: snapPoint(p.y + camY - zBase * elevPx - anchorYOffset + extraDy),
    };
  };
  const x0 = tx * tileWorld;
  const y0 = ty * tileWorld;
  return {
    nw: sample(x0, y0),
    ne: sample(x0 + tileWorld, y0),
    se: sample(x0 + tileWorld, y0 + tileWorld),
    sw: sample(x0, y0 + tileWorld),
  };
}

export function buildQuadRenderPieceFromPoints(input: {
  image: CanvasImageSource;
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
  sourceQuad?: RenderQuadPoints;
  destinationQuad: RenderQuadPoints;
  kind: "iso" | "rect";
  alpha?: number;
  flipX?: boolean;
  auditFamily?: "structures";
}): QuadRenderPiece {
  const sourceWidth = Number.isFinite(Number(input.sw))
    ? Number(input.sw)
    : Number((input.image as { width?: number }).width ?? 0);
  const sourceHeight = Number.isFinite(Number(input.sh))
    ? Number(input.sh)
    : Number((input.image as { height?: number }).height ?? 0);
  return {
    image: input.image,
    sx: Number.isFinite(Number(input.sx)) ? Number(input.sx) : 0,
    sy: Number.isFinite(Number(input.sy)) ? Number(input.sy) : 0,
    sw: sourceWidth,
    sh: sourceHeight,
    sourceQuad: input.sourceQuad,
    x0: input.destinationQuad.nw.x,
    y0: input.destinationQuad.nw.y,
    x1: input.destinationQuad.ne.x,
    y1: input.destinationQuad.ne.y,
    x2: input.destinationQuad.se.x,
    y2: input.destinationQuad.se.y,
    x3: input.destinationQuad.sw.x,
    y3: input.destinationQuad.sw.y,
    kind: input.kind,
    alpha: input.alpha ?? 1,
    flipX: !!input.flipX,
    auditFamily: input.auditFamily,
  };
}

export function buildProjectedSurfacePayload(input: {
  image: CanvasImageSource;
  destinationQuad: RenderQuadPoints;
  alpha?: number;
  sourceOffsetX?: number;
  sourceOffsetY?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}): GroundSurfaceQuadPayload {
  const imageWidth = Number((input.image as { width?: number }).width ?? 0);
  const imageHeight = Number((input.image as { height?: number }).height ?? 0);
  const sourceOffsetX = Number.isFinite(Number(input.sourceOffsetX)) ? Number(input.sourceOffsetX) : 0;
  const sourceOffsetY = Number.isFinite(Number(input.sourceOffsetY)) ? Number(input.sourceOffsetY) : 0;
  const sourceWidth = Number.isFinite(Number(input.sourceWidth)) ? Number(input.sourceWidth) : imageWidth;
  const sourceHeight = Number.isFinite(Number(input.sourceHeight)) ? Number(input.sourceHeight) : imageHeight;
  const diamondSourceQuad = buildDiamondSourceQuad(sourceWidth, sourceHeight);
  return buildQuadRenderPieceFromPoints({
    image: input.image,
    sx: sourceOffsetX,
    sy: sourceOffsetY,
    sw: sourceWidth,
    sh: sourceHeight,
    sourceQuad: {
      nw: point(sourceOffsetX + diamondSourceQuad.nw.x, sourceOffsetY + diamondSourceQuad.nw.y),
      ne: point(sourceOffsetX + diamondSourceQuad.ne.x, sourceOffsetY + diamondSourceQuad.ne.y),
      se: point(sourceOffsetX + diamondSourceQuad.se.x, sourceOffsetY + diamondSourceQuad.se.y),
      sw: point(sourceOffsetX + diamondSourceQuad.sw.x, sourceOffsetY + diamondSourceQuad.sw.y),
    },
    destinationQuad: input.destinationQuad,
    kind: "iso",
    alpha: input.alpha,
  });
}

export function buildGroundDecalProjectedSurfacePayload(input: {
  image: CanvasImageSource;
  destinationQuad: RenderQuadPoints;
  alpha?: number;
  sourceOffsetX?: number;
  sourceOffsetY?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}): GroundDecalQuadPayload {
  return buildProjectedSurfacePayload(input);
}

export function buildRectQuadPayload(input: {
  image: CanvasImageSource;
  sourceRectWidth?: number;
  sourceRectHeight?: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  flipX?: boolean;
  alpha?: number;
  sourceOffsetX?: number;
  sourceOffsetY?: number;
  auditFamily?: "structures";
}): WorldSpriteQuadPayload {
  const sourceWidth = Number((input.image as { width?: number }).width ?? 0);
  const sourceHeight = Number((input.image as { height?: number }).height ?? 0);
  const sourceRectWidth = Number.isFinite(Number(input.sourceRectWidth)) ? Number(input.sourceRectWidth) : sourceWidth;
  const sourceRectHeight = Number.isFinite(Number(input.sourceRectHeight)) ? Number(input.sourceRectHeight) : sourceHeight;
  const sourceOffsetX = Number(input.sourceOffsetX ?? 0);
  const sourceOffsetY = Number(input.sourceOffsetY ?? 0);
  const destinationQuad = buildRectDestinationQuad(input.dx, input.dy, input.dw, input.dh);
  const payload = buildQuadRenderPieceFromPoints({
    image: input.image,
    sx: sourceOffsetX,
    sy: sourceOffsetY,
    sw: sourceRectWidth,
    sh: sourceRectHeight,
    sourceQuad: {
      nw: point(sourceOffsetX + (input.flipX ? sourceRectWidth : 0), sourceOffsetY),
      ne: point(sourceOffsetX + (input.flipX ? 0 : sourceRectWidth), sourceOffsetY),
      se: point(sourceOffsetX + (input.flipX ? 0 : sourceRectWidth), sourceOffsetY + sourceRectHeight),
      sw: point(sourceOffsetX + (input.flipX ? sourceRectWidth : 0), sourceOffsetY + sourceRectHeight),
    },
    destinationQuad,
    kind: "rect",
    alpha: input.alpha ?? 1,
    flipX: !!input.flipX,
    auditFamily: input.auditFamily,
  });
  payload.dx = input.dx;
  payload.dy = input.dy;
  payload.dw = input.dw;
  payload.dh = input.dh;
  return payload;
}

export function resolveTriangleCutoutAlpha(
  points: RenderTrianglePoints,
  input: CutoutAlphaInput,
): number {
  if (
    !input.cutoutEnabled
    || !input.buildingDirectionalEligible
    || !input.groupParentAfterPlayer
    || !input.cutoutScreenRect
  ) {
    return 1;
  }

  const centroidX = (points[0].x + points[1].x + points[2].x) / 3;
  const centroidY = (points[0].y + points[1].y + points[2].y) / 3;
  const inside = centroidX >= input.cutoutScreenRect.minX
    && centroidX <= input.cutoutScreenRect.maxX
    && centroidY >= input.cutoutScreenRect.minY
    && centroidY <= input.cutoutScreenRect.maxY;
  if (!inside) return 1;
  if (!Number.isFinite(input.cutoutAlpha)) return 1;
  return Math.max(0, Math.min(1, input.cutoutAlpha));
}
