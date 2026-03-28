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
  groupLocalBounds: RuntimeStructureTriangleRect;
  groupTriangleCount: number;
  allTrianglesVisible: boolean;
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

export type HybridSemanticClass = "TOP" | "LEFT_SOUTH" | "RIGHT_EAST" | "UNCLASSIFIED" | "CONFLICT";

export type StructureProjectedViewportRect = RuntimeStructureTriangleRect;
