import type { RenderKey } from "../worldRenderOrdering";

export type RenderPass = "GROUND" | "WORLD" | "SCREEN";

export type SemanticFamily =
  | "groundSurface"
  | "groundDecal"
  | "worldSprite"
  | "worldGeometry"
  | "worldPrimitive"
  | "screenOverlay"
  | "debug";

export type FinalForm = "quad" | "projectedSurface" | "triangles" | "primitive";

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

export type RenderTriangle = {
  stableId?: number;
  srcPoints: RenderTrianglePoints;
  dstPoints: RenderTrianglePoints;
  alpha: number;
};

export type RenderPieceDrawPayload = {
  img: CanvasImageSource;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  flipX?: boolean;
  scale?: number;
};

export type RenderProjectedSurfaceTriangles = readonly [RenderTriangle, RenderTriangle];

export type ProjectedSurfacePayload = CommandPayloadBase & {
  image: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  triangles: RenderProjectedSurfaceTriangles;
};

export type GroundSurfaceProjectedSurfacePayload = ProjectedSurfacePayload;

export type GroundDecalProjectedSurfacePayload = ProjectedSurfacePayload;

export type WorldSpriteQuadPayload = CommandPayloadBase & {
  image?: CanvasImageSource;
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
  dx?: number;
  dy?: number;
  dw?: number;
  dh?: number;
  alpha?: number;
  rotationRad?: number;
  flipX?: boolean;
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
  sparkStyle?: boolean;
  vfxIndex?: number;
  draw?: RenderPieceDrawPayload;
};

export type WorldGeometryTrianglesPayload = CommandPayloadBase & {
  image: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  triangles: RenderTriangle[];
};

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
  lightPiece?: unknown;
  zone?: unknown;
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
      finalForm: "projectedSurface";
      payload: GroundSurfaceProjectedSurfacePayload;
    }
  | {
      pass: RenderPass;
      key: RenderKey;
      semanticFamily: "groundDecal";
      finalForm: "projectedSurface";
      payload: GroundDecalProjectedSurfacePayload;
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
      semanticFamily: "worldGeometry";
      finalForm: "triangles";
      payload: WorldGeometryTrianglesPayload;
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
