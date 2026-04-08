import type { RenderKey } from "../worldRenderOrdering";

export type RenderPass = "GROUND" | "WORLD" | "SCREEN";

export type SemanticFamily =
  | "groundSurface"
  | "groundDecal"
  | "worldSprite"
  | "worldPrimitive"
  | "screenOverlay"
  | "debug";

export type FinalForm = "quad" | "primitive";

export type CommandStage = "slice" | "band" | "tail";

export type CommandPayloadBase = {
  stage?: CommandStage;
  zBand?: number | "FIRST";
};

export type RenderPoint = {
  x: number;
  y: number;
};

export type RenderTrianglePoints = [RenderPoint, RenderPoint, RenderPoint];

export type RenderPieceDrawPayload = {
  img: CanvasImageSource;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  flipX?: boolean;
  scale?: number;
};

export type QuadRenderPieceKind = "iso" | "rect";

export type RenderQuadPointsPayload = {
  nw: RenderPoint;
  ne: RenderPoint;
  se: RenderPoint;
  sw: RenderPoint;
};

export type QuadRenderPiece = CommandPayloadBase & {
  auditFamily?: "structures";
  image?: CanvasImageSource;
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
  sourceQuad?: RenderQuadPointsPayload;
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x3?: number;
  y3?: number;
  kind?: QuadRenderPieceKind;
  alpha?: number;
  rotationRad?: number;
  flipX?: boolean;
  dx?: number;
  dy?: number;
  dw?: number;
  dh?: number;
  blendMode?: "normal" | "additive";
  color?: string;
  pickupIndex?: number;
  pickupKind?: number;
  screenX?: number;
  screenY?: number;
  enemyIndex?: number;
  feet?: unknown;
  baseColor?: string;
  isBoss?: boolean;
  npcIndex?: number;
  neutralMobIndex?: number;
  projectileIndex?: number;
  zLift?: number;
  vfxIndex?: number;
  draw?: RenderPieceDrawPayload;
};

export type GroundSurfaceQuadPayload = QuadRenderPiece;

export type GroundDecalQuadPayload = QuadRenderPiece;

export type WorldSpriteQuadPayload = QuadRenderPiece;

export type WorldPrimitivePayload = CommandPayloadBase & {
  shadowParams?: unknown;
  zoneIndex?: number;
  zoneKind?: number;
  radius?: number;
  worldX?: number;
  worldY?: number;
  screenX?: number;
  screenY?: number;
  radiusScreenX?: number;
  radiusScreenY?: number;
  start?: RenderPoint;
  end?: RenderPoint;
  zone?: unknown;
  arenaTileEffect?: unknown;
  groundVfx?: unknown;
};

export type ScreenOverlayQuadPayload = CommandPayloadBase & {
  color: string;
  alpha: number;
  width: number;
  height: number;
};

export type ScreenOverlayPrimitivePayload = CommandPayloadBase & {
  darknessAlpha?: number;
  ambientTint?: string;
  ambientTintStrength?: number;
};

export type DebugPrimitivePayload = CommandPayloadBase & {
  phase?: string;
  input?: Record<string, unknown>;
  sweepShadowMap?: unknown;
  cells?: Array<{ x: number; y: number; w: number; h: number }>;
  triangleOverlay?: Array<{
    points: RenderTrianglePoints;
    fillStyle: string;
    strokeStyle: string;
    lineWidth?: number;
  }>;
};

export type RenderCommand =
  | {
      pass: RenderPass;
      key: RenderKey;
      semanticFamily: "groundSurface";
      finalForm: "quad";
      payload: GroundSurfaceQuadPayload;
    }
  | {
      pass: RenderPass;
      key: RenderKey;
      semanticFamily: "groundDecal";
      finalForm: "quad";
      payload: GroundDecalQuadPayload;
    }
  | {
      pass: RenderPass;
      key: RenderKey;
      semanticFamily: "worldSprite";
      finalForm: "quad";
      payload: WorldSpriteQuadPayload;
    }
  | {
      pass: RenderPass;
      key: RenderKey;
      semanticFamily: "screenOverlay";
      finalForm: "quad";
      payload: ScreenOverlayQuadPayload;
    }
  | {
      pass: RenderPass;
      key: RenderKey;
      semanticFamily: "screenOverlay";
      finalForm: "primitive";
      payload: ScreenOverlayPrimitivePayload;
    }
  | {
      pass: RenderPass;
      key: RenderKey;
      semanticFamily: "worldPrimitive";
      finalForm: "primitive";
      payload: WorldPrimitivePayload;
    }
  | {
      pass: RenderPass;
      key: RenderKey;
      semanticFamily: "debug";
      finalForm: "primitive";
      payload: DebugPrimitivePayload;
    };

export type RenderCommandPayload = RenderCommand["payload"];

export function renderCommandAxesKey(command: Pick<RenderCommand, "semanticFamily" | "finalForm">): string {
  return `${command.semanticFamily}:${command.finalForm}`;
}

export function renderCommandStage(command: Pick<RenderCommand, "payload">): CommandStage {
  return command.payload.stage ?? "slice";
}

export interface RenderFrame {
  ground: RenderCommand[];
  world: RenderCommand[];
  screen: RenderCommand[];
}
