import type { AmbientSunLightingState } from "../../../../shadowSunV1";
import type { StructureV6SemanticBucket } from "../structureShadowV6FaceSlices";
import type { ShadowSunModel } from "../renderShadow";

export type StructureShadowRenderMode = {
  usesV6Sweep: boolean;
};

export type StructureShadowFrameInputs = {
  mapId: string;
  shadowSunTimeHour: number;
  shadowSunStepKeyOverride?: string;
  shadowSunAzimuthDeg: number;
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
};

export type StructureShadowFrameResult = {
  sunModel: ShadowSunModel;
  ambientSunLighting: AmbientSunLightingState;
  routing: StructureShadowRenderMode;
};

export type StructureShadowScreenPoint = {
  x: number;
  y: number;
};

export type StructureV6SemanticTriangle = {
  stableId: number;
  semanticBucket: StructureV6SemanticBucket;
  srcTriangle: [
    StructureShadowScreenPoint,
    StructureShadowScreenPoint,
    StructureShadowScreenPoint,
  ];
  dstTriangle: [
    StructureShadowScreenPoint,
    StructureShadowScreenPoint,
    StructureShadowScreenPoint,
  ];
};

export type StructureV6ShadowDebugCandidate = {
  structureInstanceId: string;
  geometrySignature: string;
  sourceImage: CanvasImageSource;
  sourceImageWidth: number;
  sourceImageHeight: number;
  triangles: StructureV6SemanticTriangle[];
  zBand: number;
};
