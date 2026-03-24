import type { StampOverlay, ViewRect } from "../../../map/compile/kenneyMap";
import type {
  RuntimeStructureAnchorPlacementDebug,
  RuntimeStructureTriangleCache,
  RuntimeStructureTrianglePiece,
  RuntimeStructureTriangleRect,
} from "../../../structures/monolithicStructureGeometry";
import type {
  KindOrder,
  RenderKey,
} from "../worldRenderOrdering";
import type { StructureShadowProjectedTriangle } from "../structureShadowV1";
import type {
  StructureHybridShadowRenderPiece,
  StructureV4ShadowRenderPiece,
  StructureV5ShadowRenderPiece,
  StructureV6ShadowDebugCandidate,
} from "../structureShadows/structureShadowTypes";

export type StructureOverlayDraw = {
  img: HTMLImageElement;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  flipX?: boolean;
  scale?: number;
  anchorPlacementDebugNoCamera?: RuntimeStructureAnchorPlacementDebug;
};

export type StructureTileBounds = {
  minTx: number;
  maxTx: number;
  minTy: number;
  maxTy: number;
};

export type StructureAdmissionMode = "viewport" | "renderDistance" | "hybrid" | "compare";

export type StructureOverlayAdmissionContext = {
  triangleOverlayPrefilterBounds: StructureTileBounds;
  overlayPrefilterViewRect: ViewRect;
};

export type StructureSouthTieBreak = Pick<RenderKey, "structureSouthSlice" | "structureSouthWithin">;

export type StructureOverlayCandidate = {
  overlayIndex: number;
  overlay: StampOverlay;
  draw: StructureOverlayDraw;
  structureSouthTieBreak: StructureSouthTieBreak | null;
  useRuntimeStructureSlicing: boolean;
};

export type StructureTriangleSlicePiece = {
  kind: "triangleGroup";
  overlay: StampOverlay;
  draw: StructureOverlayDraw;
  sourceImage: CanvasImageSource;
  geometrySignature: string;
  triangleCache: RuntimeStructureTriangleCache;
  parentTx: number;
  parentTy: number;
  feetSortY: number;
  stableId: number;
  finalVisibleTriangles: RuntimeStructureTrianglePiece[];
  compareDistanceOnlyTriangles: RuntimeStructureTrianglePiece[];
  structureSouthTieBreak: StructureSouthTieBreak | null;
  cutoutEnabled: boolean;
  cutoutAlpha: number;
  buildingDirectionalEligible: boolean;
  groupParentAfterPlayer: boolean;
  isPointInsideStructureCutoutScreenRect: (x: number, y: number) => boolean;
};

export type StructureDirectOverlaySlicePiece = {
  kind: "overlay";
  overlayIndex: number;
  overlay: StampOverlay;
  draw: StructureOverlayDraw;
};

export type StructureSlicePiece =
  | StructureTriangleSlicePiece
  | StructureDirectOverlaySlicePiece;

export type StructureSliceBuildResult = {
  pieces: StructureSlicePiece[];
  didQueueStructureCutoutDebugRect: boolean;
};

export type StructureDrawablePayload =
  | {
      kind: "triangleGroup";
      piece: StructureTriangleSlicePiece;
    }
  | {
      kind: "overlay";
      piece: StructureDirectOverlaySlicePiece;
      kindOrder: KindOrder;
      stableId: number;
    };

export type StructureDrawable = {
  slice: number;
  key: RenderKey;
  payload: StructureDrawablePayload;
};

export type HybridShadowDiagnosticStats = {
  cacheHits: number;
  cacheMisses: number;
  casterTriangles: number;
  projectedTriangles: number;
  piecesQueued: number;
  trianglesQueued: number;
  [key: string]: number;
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
  piecesQueued: number;
  trianglesQueued: number;
  topCapTrianglesQueued: number;
  [key: string]: number | string | null;
};

export type V5ShadowDiagnosticStats = {
  piecesQueued: number;
  trianglesQueued: number;
  [key: string]: number;
};

export type StructureShadowQueueCallbacks = {
  queueStructureShadowTrianglesForBand: (
    zBand: number,
    triangles: readonly StructureShadowProjectedTriangle[],
  ) => void;
  queueStructureHybridShadowForBand: (
    zBand: number,
    piece: StructureHybridShadowRenderPiece,
  ) => void;
  queueStructureV4ShadowForBand: (
    zBand: number,
    piece: StructureV4ShadowRenderPiece,
  ) => void;
  queueStructureV5ShadowForBand: (
    zBand: number,
    piece: StructureV5ShadowRenderPiece,
  ) => void;
  structureV6ShadowDebugCandidates: StructureV6ShadowDebugCandidate[];
};

export type StructureProjectedViewportRect = RuntimeStructureTriangleRect;
