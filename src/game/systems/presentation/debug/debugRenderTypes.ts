import type { DebugOverlayContext } from "../../../../engine/render/debug/renderDebug";
import type { ViewRect } from "../../../map/compile/kenneyMap";
import type {
  ShadowCasterMode,
  ShadowDebugMode,
  ShadowHybridDiagnosticMode,
  ShadowV1DebugGeometryMode,
  ShadowV5DebugView,
  ShadowV5TransformDebugMode,
  ShadowV6SemanticBucket,
  StructureTriangleAdmissionMode,
} from "../../../../settings/settingsTypes";
import type { StructureShadowRenderMode } from "../structureShadows/structureShadowTypes";
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
  showEnemyAimOverlay: boolean;
  showLootGoblinOverlay: boolean;
  showMapOverlays: boolean;
  showZoneObjectiveBounds: boolean;
  shadowV1DebugGeometryMode: ShadowV1DebugGeometryMode;
  shadowCasterMode: ShadowCasterMode;
  shadowHybridDiagnosticMode: ShadowHybridDiagnosticMode;
  shadowDebugMode: ShadowDebugMode;
  shadowV5DebugView: ShadowV5DebugView;
  shadowV5TransformDebugMode: ShadowV5TransformDebugMode;
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
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
};

export type RenderDebugFrameContext = {
  enabled: boolean;
  flags: RenderDebugFlags;
};

export type StructureV5ShadowDrawStats = {
  piecesDrawn: number;
  trianglesDrawn: number;
  finalShadowDrawCalls: number;
};

export type StructureV5ShadowAnchorDiagnostic = {
  structureInstanceId: string;
  triangleDestinationSpace: "screen";
  rawBounds: { minX: number; minY: number; maxX: number; maxY: number };
  transformedBounds: { minX: number; minY: number; maxX: number; maxY: number };
  maskCanvasOrigin: ScreenPt;
  maskAnchor: ScreenPt;
  buildingDrawOrigin: ScreenPt;
  buildingAnchor: ScreenPt;
  transformedAnchor: ScreenPt;
  transformedMaskDrawOrigin: ScreenPt;
  finalShadowDrawOrigin: ScreenPt;
  offset: ScreenPt;
};

export type DrawStructureV5ShadowMaskOutput = StructureV5ShadowDrawStats & {
  anchorDiagnostic: StructureV5ShadowAnchorDiagnostic | null;
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

export type HybridShadowDiagnosticStats = {
  cacheHits: number;
  cacheMisses: number;
  casterTriangles: number;
  projectedTriangles: number;
  piecesQueued: number;
  trianglesQueued: number;
  piecesDrawnShadowPass: number;
  trianglesDrawnShadowPass: number;
  piecesDrawnMainCanvas: number;
  trianglesDrawnMainCanvas: number;
  piecesComposited: number;
  trianglesComposited: number;
};

export type V4ShadowDiagnosticStats = {
  cacheHits: number;
  cacheMisses: number;
  correspondences: number;
  strips: number;
  layerEdges: number;
  layerBands: number;
  sourceBandTriangles: number;
  destinationBandEntries: number;
  correspondencePairs: number;
  correspondenceMismatches: number;
  topCapTriangles: number;
  destinationBandPairs: number;
  destinationTriangles: number;
  diagonalA: number;
  diagonalB: number;
  diagonalRule: string;
  deltaConstPass: number;
  deltaConstFail: number;
  firstSliceSummary: string;
  sampleRoofHeightPx: number | null;
  sampleLayerHeights: string;
  sampleSliceCount: number;
  sampleLayerEdges: number;
  sampleLayerBands: number;
  sampleSelectedSlice: string;
  sampleSelectedBand: string;
  renderMode: string;
  piecesQueued: number;
  trianglesQueued: number;
  topCapTrianglesQueued: number;
  topCapTrianglesDrawnShadowPass: number;
  topCapTrianglesDrawnMainCanvas: number;
  warpedTrianglesDrawnShadowPass: number;
  flatTrianglesDrawnShadowPass: number;
  flatTrianglesDrawnMainCanvas: number;
  warpedDrawCalls: number;
  flatDrawCalls: number;
  piecesComposited: number;
  trianglesComposited: number;
};

export type V5ShadowDiagnosticStats = {
  piecesQueued: number;
  trianglesQueued: number;
  piecesDrawn: number;
  trianglesDrawn: number;
  finalShadowDrawCalls: number;
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
  v5ShadowAnchorDiagnostic: StructureV5ShadowAnchorDiagnostic | null;
  shadowSunModel: ShadowSunDebugModel;
  structureTriangleAdmissionMode: StructureTriangleAdmissionMode;
  sliderPadding: number;
  playerCameraTx: number;
  playerCameraTy: number;
  structureTriangleCutoutEnabled: boolean;
  structureTriangleCutoutHalfWidth: number;
  structureTriangleCutoutHalfHeight: number;
  structureTriangleCutoutAlpha: number;
  roadWidthAtPlayer: number;
  hybridShadowDiagnosticStats: HybridShadowDiagnosticStats;
  v4ShadowDiagnosticStats: V4ShadowDiagnosticStats;
  v5ShadowDiagnosticStats: V5ShadowDiagnosticStats;
};
