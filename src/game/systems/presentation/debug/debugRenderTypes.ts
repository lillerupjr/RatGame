import type { AmbientSunLightingState } from "../../../../shadowSunV1";
import type { DebugOverlayContext } from "../../../../engine/render/debug/renderDebug";
import type { ViewRect } from "../../../map/compile/kenneyMap";
import type {
  DebugStructureRenderMode,
  PerfOverlayMode,
  ShadowCasterMode,
  ShadowV6SemanticBucket,
  StructureTriangleAdmissionMode,
} from "../../../../settings/settingsTypes";
import type { StructureShadowRenderMode } from "../structureShadows/structureShadowTypes";
import type { ShadowSunDayCycleDebugStatus } from "../shadowSunDayCycleRuntime";
import type { WorldBatchAudit } from "./worldBatchAudit";
import type {
  StructureV6FaceSlice,
  StructureV6SliceAxis,
} from "../structureShadowV6FaceSlices";

export type ScreenPt = { x: number; y: number };

export type RenderDebugFlags = {
  showGrid: boolean;
  showEntityAnchorOverlay: boolean;
  showWalkMask: boolean;
  showRamps: boolean;
  showOccluders: boolean;
  showDecals: boolean;
  showProjectileFaces: boolean;
  showTriggers: boolean;
  showRoadSemantic: boolean;
  showStructureHeights: boolean;
  showStructureCollision: boolean;
  showStructureSlices: boolean;
  showStructureTriangleFootprint: boolean;
  showStructureAnchors: boolean;
  showStructureTriangleOwnershipSort: boolean;
  debugStructureRenderMode: DebugStructureRenderMode;
  perfOverlayMode: PerfOverlayMode;
  showEnemyAimOverlay: boolean;
  showLootGoblinOverlay: boolean;
  showMapOverlays: boolean;
  showZoneObjectiveBounds: boolean;
  showSweepShadowDebug: boolean;
  showTileHeightMap: boolean;
  shadowCasterMode: ShadowCasterMode;
  shadowV6RequestedSemanticBucket: ShadowV6SemanticBucket;
  shadowV6PrimarySemanticBucket: ShadowV6SemanticBucket;
  shadowV6SecondarySemanticBucket: ShadowV6SemanticBucket;
  shadowV6TopSemanticBucket: ShadowV6SemanticBucket;
  shadowV6StructureIndex: number;
  shadowV6SliceCount: number;
  shadowV6AllStructures: boolean;
  shadowV6OneStructureOnly: boolean;
  shadowV6VerticalOnly: boolean;
  shadowV6TopOnly: boolean;
  shadowV6ForceRefresh: boolean;
  shadowV6FaceSliceDebugOverlay: boolean;
  shadowSunTimeHour: number;
  shadowSunAzimuthDeg: number;
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
};

export type RenderDebugFrameContext = {
  enabled: boolean;
  flags: RenderDebugFlags;
};

export type StructureV6ExtrudedSliceDebug = {
  slice: StructureV6FaceSlice;
  t: number;
  offsetX: number;
  offsetY: number;
  canvas: HTMLCanvasElement;
  pixelCount: number;
  contentBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
};

export type StructureV6FaceSliceDebugData = {
  structureInstanceId: string;
  zBand: number;
  requestedSemanticBucket: ShadowV6SemanticBucket;
  semanticBucket: ShadowV6SemanticBucket;
  requestedStructureIndex: number;
  selectedStructureIndex: number;
  candidateCount: number;
  sourceTriangleCount: number;
  occupiedPixelCount: number;
  sliceSpaceMinS: number;
  sliceSpaceMaxS: number;
  sliceSpaceHeightPx: number;
  desiredSliceThicknessPx: number;
  sliceCountUsed: number;
  nonEmptySliceCount: number;
  faceBounds: { minX: number; minY: number; maxX: number; maxY: number };
  faceCanvas: HTMLCanvasElement;
  axis: StructureV6SliceAxis;
  slices: ReadonlyArray<{
    slice: StructureV6FaceSlice;
    canvas: HTMLCanvasElement;
    pixelCount: number;
    contentBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  }>;
  shadowVector: ScreenPt;
  displacedCanvasOrigin: ScreenPt;
  faceCanvasOrigin: ScreenPt;
  mergedShadowDrawOrigin: ScreenPt;
  displacedSlices: readonly StructureV6ExtrudedSliceDebug[];
  displacedSlicesCanvas: HTMLCanvasElement;
  mergedShadowCanvas: HTMLCanvasElement;
};

export type StructureV6FaceSliceCastMode = "baselineToTop" | "constantMax";

export type StructureV6VerticalShadowMaskDebugData = {
  structureInstanceId: string;
  zBand: number;
  requestedSemanticBucket: ShadowV6SemanticBucket;
  requestedStructureIndex: number;
  selectedStructureIndex: number;
  candidateCount: number;
  shadowVector: ScreenPt;
  bucketAShadow: StructureV6FaceSliceDebugData | null;
  bucketBShadow: StructureV6FaceSliceDebugData | null;
  topShadow: StructureV6FaceSliceDebugData | null;
  mergedVerticalShadowDrawOrigin: ScreenPt;
  mergedVerticalShadowCanvas: HTMLCanvasElement;
};

export type RenderDebugWorldPassInput = {
  ctx: CanvasRenderingContext2D;
  debugContext: DebugOverlayContext;
  viewRect: ViewRect;
  toScreen: (x: number, y: number) => ScreenPt;
  tileWorld: number;
  isTileInRenderRadius: (tx: number, ty: number) => boolean;
  deferredStructureSliceDebugDraws: ReadonlyArray<() => void>;
  flags: RenderDebugFlags;
};

export type ShadowSunDebugModel = {
  timeLabel: string;
  elevationDeg: number;
  directionLabel: string;
  forward: { x: number; y: number; z: number };
  projectionDirection: { x: number; y: number };
  stepKey: string;
};

export type RenderDebugScreenPassInput = {
  ctx: CanvasRenderingContext2D;
  cssW: number;
  cssH: number;
  dpr: number;
  flags: RenderDebugFlags;
  fps: number;
  frameTimeMs: number;
  renderPerfCountersEnabled: boolean;
  structureShadowRouting: StructureShadowRenderMode;
  structureV6VerticalShadowDebugData: StructureV6VerticalShadowMaskDebugData | null;
  structureV6ShadowDebugCandidateCount: number;
  structureV6ShadowCastCount: number;
  structureV6ShadowCacheStats: {
    sunStepKey: string;
    cacheHits: number;
    cacheMisses: number;
    rebuiltStructures: number;
    reusedStructures: number;
    sunStepChanged: boolean;
    forceRefresh: boolean;
    cacheSize: number;
  } | null;
  shadowSunModel: ShadowSunDebugModel;
  ambientSunLighting: AmbientSunLightingState;
  shadowSunDayCycleStatus: ShadowSunDayCycleDebugStatus;
  structureTriangleAdmissionMode: StructureTriangleAdmissionMode;
  sliderPadding: number;
  playerCameraTx: number;
  playerCameraTy: number;
  structureTriangleCutoutEnabled: boolean;
  structureTriangleCutoutHalfWidth: number;
  structureTriangleCutoutHalfHeight: number;
  structureTriangleCutoutAlpha: number;
  roadWidthAtPlayer: number;
  worldBatchAudit?: WorldBatchAudit | null;
};
