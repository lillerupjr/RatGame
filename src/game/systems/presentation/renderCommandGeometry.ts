import type {
  GroundDecalProjectedSurfacePayload,
  GroundSurfaceProjectedSurfacePayload,
  RenderPoint,
  RenderProjectedSurfaceTriangles,
  RenderTriangle,
  RenderTrianglePoints,
  WorldGeometryTrianglesPayload,
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

function trianglePoints(a: RenderPoint, b: RenderPoint, c: RenderPoint): RenderTrianglePoints {
  return [a, b, c];
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

export function buildTrianglePairFromQuad(
  sourceQuad: RenderQuadPoints,
  destinationQuad: RenderQuadPoints,
  alpha = 1,
  stableId?: number,
): RenderProjectedSurfaceTriangles {
  return [
    {
      stableId,
      srcPoints: trianglePoints(sourceQuad.nw, sourceQuad.ne, sourceQuad.se),
      dstPoints: trianglePoints(destinationQuad.nw, destinationQuad.ne, destinationQuad.se),
      alpha,
    },
    {
      stableId: stableId === undefined ? undefined : Number(stableId) + 0.01,
      srcPoints: trianglePoints(sourceQuad.nw, sourceQuad.se, sourceQuad.sw),
      dstPoints: trianglePoints(destinationQuad.nw, destinationQuad.se, destinationQuad.sw),
      alpha,
    },
  ];
}

export function buildProjectedSurfacePayload(input: {
  image: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  destinationQuad: RenderQuadPoints;
  alpha?: number;
  stableId?: number;
}): GroundSurfaceProjectedSurfacePayload {
  return {
    image: input.image,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    triangles: buildTrianglePairFromQuad(
      buildDiamondSourceQuad(input.sourceWidth, input.sourceHeight),
      input.destinationQuad,
      input.alpha ?? 1,
      input.stableId,
    ),
  };
}

export function buildGroundDecalProjectedSurfacePayload(input: {
  image: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  destinationQuad: RenderQuadPoints;
  alpha?: number;
  stableId?: number;
}): GroundDecalProjectedSurfacePayload {
  return buildProjectedSurfacePayload(input);
}

export function buildTriangleMeshPayload(input: {
  image: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  triangles: RenderTriangle[];
}): WorldGeometryTrianglesPayload {
  return {
    image: input.image,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    triangles: input.triangles,
  };
}

export function buildTriangleMeshFromRect(input: {
  image: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  flipX?: boolean;
  alpha?: number;
  stableId?: number;
}): WorldGeometryTrianglesPayload {
  const sourceQuad = buildRectSourceQuad(input.sourceWidth, input.sourceHeight, !!input.flipX);
  const destinationQuad = buildRectDestinationQuad(input.dx, input.dy, input.dw, input.dh);
  return buildTriangleMeshPayload({
    image: input.image,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    triangles: [...buildTrianglePairFromQuad(sourceQuad, destinationQuad, input.alpha ?? 1, input.stableId)],
  });
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
