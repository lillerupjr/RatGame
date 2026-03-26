import type { AmbientSunLightingState } from "../../../../shadowSunV1";
import type { ShadowCasterMode, ShadowV6SemanticBucket } from "../../../../settings/settingsTypes";
import type { ShadowSunModel } from "../renderShadow";

export type StructureShadowVersionId = ShadowCasterMode;

export type StructureShadowRenderMode = {
  mode: StructureShadowVersionId;
  usesV6Sweep: boolean;
  usesV6Debug: boolean;
};

export type StructureShadowFrameInputs = {
  mapId: string;
  shadowCasterMode: ShadowCasterMode;
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
  semanticBucket: ShadowV6SemanticBucket;
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
  triangles: readonly StructureV6SemanticTriangle[];
  zBand: number;
};

export type StructureShadowOverlayQueueResult = {
  structureShadowBand: number;
  v6Candidate: StructureV6ShadowDebugCandidate | null;
};
