export const ROAD_AXIS_NONE = 0;
export const ROAD_AXIS_EW = 1;
export const ROAD_AXIS_NS = 2;

export type RoadAxis = "EW" | "NS" | "NONE";

export type RoadBand = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  orient: "H" | "V";
  roadW: number;
  roadL: number;
};

export interface RoadContext {
  readonly w: number;
  readonly h: number;
  readonly originTx: number;
  readonly originTy: number;
  readonly isRoad: Uint8Array;
  readonly axis: Uint8Array;
  readonly neighborsMask?: Uint8Array;
  readonly laneCount?: Uint8Array;
}

export interface MarkingPiece {
  readonly tx: number;
  readonly ty: number;
  readonly variant: number;
  readonly rot: 0 | 1 | 2 | 3;
  readonly pass: "ROAD_MARKINGS";
  readonly key?: string;
  readonly zBase?: number;
  readonly zLogical?: number;
}

export interface RoadMarkingInputs {
  w: number;
  h: number;
  originTx: number;
  originTy: number;
  isRoadFromSemantics: (x: number, y: number) => boolean;
  getCellTags?: (x: number, y: number) => readonly string[] | null;

  // Parity inputs for milestone 1.
  roadBands: RoadBand[];
  roadIntersectionMaskWorld: Uint8Array;
  roadCrossingMaskWorld: Uint8Array;
  roadStopMaskWorld?: Uint8Array;
  roadStopDirWorld?: Uint8Array;
  emitStopbarCrossingOverlay?: boolean;
  getTileZAt: (x: number, y: number) => number;
}
