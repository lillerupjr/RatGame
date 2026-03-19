export type StructureSliceDebugRect = { x: number; y: number; w: number; h: number };
export type StructureSliceDebugPoint = { x: number; y: number };
export type StructureSliceDebugTriangleStats = { beforeCull: number; afterCull: number };

export type StructureSliceDebugAlphaMap = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type RuntimeStructureTriangleBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type RuntimeStructureTrianglePiece = {
  points: [StructureSliceDebugPoint, StructureSliceDebugPoint, StructureSliceDebugPoint];
  parentTx: number;
  parentTy: number;
  bandIndex: number;
  structureInstanceId: string;
  stableId: number;
  bounds: RuntimeStructureTriangleBounds;
};

export type RuntimeStructureTriangleParentTileGroup = {
  parentTx: number;
  parentTy: number;
  triangles: RuntimeStructureTrianglePiece[];
  bounds: StructureSliceDebugRect;
};

export type RuntimeStructureTriangleProjectedDraw = {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  flipX: boolean;
  scale: number;
};

export type RuntimeStructureTriangleAssetState = "READY" | "PENDING" | "FAILED";

export type RuntimeStructureTriangleBuildResult = {
  pendingCount: number;
  failedCount: number;
  builtCount: number;
  fallbackCount: number;
  pendingKeys: string[];
};
