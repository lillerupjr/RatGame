import type {
  CommandStage,
  QuadRenderPiece,
  RenderCommand,
  RenderQuadPointsPayload,
} from "../../../game/systems/presentation/contracts/renderCommands";
import type { RenderKey } from "../../../game/systems/presentation/worldRenderOrdering";
import {
  buildRectDestinationQuad,
  buildRotatedRectDestinationQuad,
  hasExplicitQuadGeometry,
} from "../shared/quadMath";

export type StaticWorldFamily = "groundSurface" | "groundDecal" | "structures";
export type StaticWorldGeometry = "iso" | "projected";
export type DynamicRectFamily = "entities" | "drops" | "projectiles" | "vfx" | "props";

type BaseWorldQuadRenderPiece = Omit<QuadRenderPiece, "kind" | "stage" | "zBand"> & {
  key: RenderKey;
  stableId: number;
  stage: CommandStage;
  zBand?: number | "FIRST";
  semanticFamily: "groundSurface" | "groundDecal" | "worldSprite";
  auditFamily?: "structures";
};

export type StaticWorldQuadRenderPiece = BaseWorldQuadRenderPiece & {
  pieceType: "static-world";
  kind: "iso" | "rect";
  staticFamily: StaticWorldFamily;
  worldGeometry: StaticWorldGeometry;
};

export type DynamicRectRenderPiece = BaseWorldQuadRenderPiece & {
  pieceType: "dynamic-rect";
  kind: "rect";
  dynamicFamily: DynamicRectFamily;
};

export type WorldQuadRenderPiece = StaticWorldQuadRenderPiece | DynamicRectRenderPiece;

export type CreatedRenderWorld = {
  orderedPieces: WorldQuadRenderPiece[];
  auxiliaryWorldCommands: RenderCommand[];
  screenCommands: RenderCommand[];
  auditWorldCommands: RenderCommand[];
};

function cloneQuadPayload(payload: QuadRenderPiece): QuadRenderPiece {
  return {
    ...payload,
  };
}

function payloadImageWidth(payload: QuadRenderPiece): number {
  if (Number.isFinite(Number(payload.sw)) && Number(payload.sw) > 0) return Number(payload.sw);
  return Number((payload.image as { width?: number } | undefined)?.width ?? 0);
}

function payloadImageHeight(payload: QuadRenderPiece): number {
  if (Number.isFinite(Number(payload.sh)) && Number(payload.sh) > 0) return Number(payload.sh);
  return Number((payload.image as { height?: number } | undefined)?.height ?? 0);
}

function normalizeImageQuadPayload(
  payload: QuadRenderPiece,
  kind: "iso" | "rect",
): QuadRenderPiece {
  const normalized = cloneQuadPayload(payload);
  const draw = normalized.draw;
  if (!normalized.image && draw?.img) {
    const scale = Number.isFinite(Number(draw.scale)) ? Number(draw.scale) : 1;
    normalized.image = draw.img;
    normalized.sx = 0;
    normalized.sy = 0;
    normalized.sw = Number(draw.dw ?? 0);
    normalized.sh = Number(draw.dh ?? 0);
    normalized.dx = Number(draw.dx ?? 0);
    normalized.dy = Number(draw.dy ?? 0);
    normalized.dw = Number(draw.dw ?? 0) * scale;
    normalized.dh = Number(draw.dh ?? 0) * scale;
    normalized.flipX = !!draw.flipX;
  }
  normalized.kind = kind;

  if (normalized.image && !hasExplicitQuadGeometry(normalized as unknown as Record<string, unknown>)) {
    const dx = Number(normalized.dx ?? 0);
    const dy = Number(normalized.dy ?? 0);
    const dw = Number(normalized.dw ?? 0);
    const dh = Number(normalized.dh ?? 0);
    if (Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(dw) && Number.isFinite(dh) && dw > 0 && dh > 0) {
      const destinationQuad = buildRotatedRectDestinationQuad(
        dx,
        dy,
        dw,
        dh,
        Number.isFinite(Number(normalized.rotationRad)) ? Number(normalized.rotationRad) : 0,
        !!normalized.flipX,
      );
      normalized.x0 = destinationQuad.nw.x;
      normalized.y0 = destinationQuad.nw.y;
      normalized.x1 = destinationQuad.ne.x;
      normalized.y1 = destinationQuad.ne.y;
      normalized.x2 = destinationQuad.se.x;
      normalized.y2 = destinationQuad.se.y;
      normalized.x3 = destinationQuad.sw.x;
      normalized.y3 = destinationQuad.sw.y;
    }
  }

  if (normalized.image && !normalized.sourceQuad) {
    const sx = Number.isFinite(Number(normalized.sx)) ? Number(normalized.sx) : 0;
    const sy = Number.isFinite(Number(normalized.sy)) ? Number(normalized.sy) : 0;
    const sw = payloadImageWidth(normalized);
    const sh = payloadImageHeight(normalized);
    const left = !!normalized.flipX ? sx + sw : sx;
    const right = !!normalized.flipX ? sx : sx + sw;
    normalized.sourceQuad = {
      nw: { x: left, y: sy },
      ne: { x: right, y: sy },
      se: { x: right, y: sy + sh },
      sw: { x: left, y: sy + sh },
    };
    normalized.sx = sx;
    normalized.sy = sy;
    normalized.sw = sw;
    normalized.sh = sh;
  }

  return normalized;
}

export function createStaticWorldQuadRenderPiece(input: {
  key: RenderKey;
  semanticFamily: "groundSurface" | "groundDecal" | "worldSprite";
  staticFamily: StaticWorldFamily;
  worldGeometry: StaticWorldGeometry;
  kind: "iso" | "rect";
  payload: QuadRenderPiece;
}): StaticWorldQuadRenderPiece {
  const normalized = normalizeImageQuadPayload(input.payload, input.kind);
  return {
    ...normalized,
    key: input.key,
    stableId: Number(input.key.stableId),
    stage: normalized.stage ?? "slice",
    zBand: normalized.zBand,
    semanticFamily: input.semanticFamily,
    pieceType: "static-world",
    kind: input.kind,
    staticFamily: input.staticFamily,
    worldGeometry: input.worldGeometry,
  };
}

export function createDynamicRectRenderPiece(input: {
  key: RenderKey;
  dynamicFamily: DynamicRectFamily;
  payload: QuadRenderPiece;
}): DynamicRectRenderPiece {
  const normalized = normalizeImageQuadPayload(input.payload, "rect");
  return {
    ...normalized,
    key: input.key,
    stableId: Number(input.key.stableId),
    stage: normalized.stage ?? "slice",
    zBand: normalized.zBand,
    semanticFamily: "worldSprite",
    pieceType: "dynamic-rect",
    kind: "rect",
    dynamicFamily: input.dynamicFamily,
  };
}

export function pieceDestinationQuad(piece: WorldQuadRenderPiece): RenderQuadPointsPayload | null {
  if (
    Number.isFinite(Number(piece.x0))
    && Number.isFinite(Number(piece.y0))
    && Number.isFinite(Number(piece.x1))
    && Number.isFinite(Number(piece.y1))
    && Number.isFinite(Number(piece.x2))
    && Number.isFinite(Number(piece.y2))
    && Number.isFinite(Number(piece.x3))
    && Number.isFinite(Number(piece.y3))
  ) {
    return {
      nw: { x: Number(piece.x0), y: Number(piece.y0) },
      ne: { x: Number(piece.x1), y: Number(piece.y1) },
      se: { x: Number(piece.x2), y: Number(piece.y2) },
      sw: { x: Number(piece.x3), y: Number(piece.y3) },
    };
  }
  if (
    Number.isFinite(Number(piece.dx))
    && Number.isFinite(Number(piece.dy))
    && Number.isFinite(Number(piece.dw))
    && Number.isFinite(Number(piece.dh))
  ) {
    return buildRectDestinationQuad(Number(piece.dx), Number(piece.dy), Number(piece.dw), Number(piece.dh));
  }
  return null;
}

export function toAuditRenderCommand(piece: WorldQuadRenderPiece): RenderCommand {
  const payload: QuadRenderPiece = {
    ...piece,
    kind: piece.kind,
    stage: piece.stage,
    zBand: piece.zBand,
  };
  if (piece.semanticFamily === "groundSurface") {
    return {
      pass: "WORLD",
      key: piece.key,
      semanticFamily: "groundSurface",
      finalForm: "quad",
      payload,
    };
  }
  if (piece.semanticFamily === "groundDecal") {
    return {
      pass: "WORLD",
      key: piece.key,
      semanticFamily: "groundDecal",
      finalForm: "quad",
      payload,
    };
  }
  return {
    pass: "WORLD",
    key: piece.key,
    semanticFamily: "worldSprite",
    finalForm: "quad",
    payload,
  };
}
