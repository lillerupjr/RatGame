import type { ShadowCasterMode } from "../../../../settings/settingsTypes";
import type { ShadowSunModel } from "../renderShadow";
import type {
  HybridSemanticMaskBucket,
  StructureHybridShadowProjectedTriangle,
  StructureShadowHybridCacheEntry,
} from "../structureShadowHybridTriangles";
import type {
  StructureShadowCacheEntry,
  StructureShadowProjectedTriangle,
} from "../structureShadowV1";
import type { StructureShadowV2CacheEntry } from "../structureShadowV2AlphaSilhouette";
import type { ShadowTriangleCorrespondence, StructureShadowV4CacheEntry } from "../structureShadowV4";

export type StructureShadowVersionId = ShadowCasterMode;

export type StructureShadowRenderMode = {
  mode: StructureShadowVersionId;
  usesV1: boolean;
  usesV2: boolean;
  usesHybrid: boolean;
  usesV4: boolean;
  usesV5: boolean;
  usesV6: boolean;
  usesV6Debug: boolean;
};

export type StructureShadowFrameInputs = {
  mapId: string;
  shadowCasterMode: ShadowCasterMode;
  shadowSunTimeHour: number;
  shadowSunAzimuthDeg: number;
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
};

export type StructureShadowContextKeys = {
  v1: string;
  v2: string;
  hybrid: string;
  v4: string;
};

export type StructureShadowFrameResult = {
  sunModel: ShadowSunModel;
  routing: StructureShadowRenderMode;
  contextKeys: StructureShadowContextKeys;
};

export type StructureShadowScratchCanvasContext = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

export type StructureShadowV5MaskScratchBundle = {
  topMaskCtx: CanvasRenderingContext2D;
  eastWestMaskCtx: CanvasRenderingContext2D;
  southNorthMaskCtx: CanvasRenderingContext2D;
  coverageMaskCtx: CanvasRenderingContext2D;
  finalMaskCtx: CanvasRenderingContext2D;
  topMaskCanvas: HTMLCanvasElement;
  eastWestMaskCanvas: HTMLCanvasElement;
  southNorthMaskCanvas: HTMLCanvasElement;
  coverageMaskCanvas: HTMLCanvasElement;
  finalMaskCanvas: HTMLCanvasElement;
  width: number;
  height: number;
};

export type StructureShadowScratchBundle = StructureShadowV5MaskScratchBundle;

export type StructureShadowScreenPoint = {
  x: number;
  y: number;
};

export type StructureV5ShadowMaskTriangle = {
  stableId: number;
  semanticBucket: HybridSemanticMaskBucket;
  srcTriangle: [StructureShadowScreenPoint, StructureShadowScreenPoint, StructureShadowScreenPoint];
  dstTriangle: [StructureShadowScreenPoint, StructureShadowScreenPoint, StructureShadowScreenPoint];
};

export type StructureV5ShadowRenderPiece = {
  structureInstanceId: string;
  sourceImage: CanvasImageSource;
  sourceImageWidth: number;
  sourceImageHeight: number;
  triangles: readonly StructureV5ShadowMaskTriangle[];
  buildingDrawOrigin: StructureShadowScreenPoint;
  buildingAnchor: StructureShadowScreenPoint;
  maskAnchor: StructureShadowScreenPoint;
};

export type StructureV6ShadowDebugCandidate = {
  structureInstanceId: string;
  geometrySignature: string;
  sourceImage: CanvasImageSource;
  sourceImageWidth: number;
  sourceImageHeight: number;
  triangles: readonly StructureV5ShadowMaskTriangle[];
  zBand: number;
};

export type StructureHybridShadowRenderPiece = {
  sourceImage: CanvasImageSource;
  sourceImageWidth: number;
  sourceImageHeight: number;
  projectedMappings: readonly StructureHybridShadowProjectedTriangle[];
};

export type StructureV4ShadowRenderPiece = {
  sourceImage: CanvasImageSource;
  sourceImageWidth: number;
  sourceImageHeight: number;
  topCapTriangles: readonly StructureShadowProjectedTriangle[];
  triangleCorrespondence: readonly ShadowTriangleCorrespondence[];
};

export type StructureShadowOverlayQueueResult = {
  structureShadowBand: number;
  projectedTriangles: readonly StructureShadowProjectedTriangle[] | null;
  projectedVisible: boolean;
  hybridPiece: StructureHybridShadowRenderPiece | null;
  v4Piece: StructureV4ShadowRenderPiece | null;
  v5Piece: StructureV5ShadowRenderPiece | null;
  v6Candidate: StructureV6ShadowDebugCandidate | null;
  structureShadowV1CacheEntry: StructureShadowCacheEntry | null;
  structureShadowV2CacheEntry: StructureShadowV2CacheEntry | null;
  structureShadowHybridCacheEntry: StructureShadowHybridCacheEntry | null;
  structureShadowV4CacheEntry: StructureShadowV4CacheEntry | null;
  structureShadowCacheHit: boolean;
};
