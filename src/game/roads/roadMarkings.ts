import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";

export const ROAD_CENTER_MARKING_VARIANT_INDEX = 1;
export const DOUBLE_LINE_GAP_PX = 0; //good
export const LINE_WIDTH_PX = 12; // good
export const DOUBLE_LINE_OFFSET_TILES =
  (DOUBLE_LINE_GAP_PX * 0.5 + LINE_WIDTH_PX * 0.5) / KENNEY_TILE_WORLD;

export type RoadCenterMarkingAnchor = {
  tx: number;
  ty: number;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
};

export function buildRoadCenterDoubleYellowAnchorsForTile(params: {
  tx: number;
  ty: number;
  worldInBounds: (x: number, y: number) => boolean;
  worldIndex: (x: number, y: number) => number;
  roadCenterMaskWorld: Uint8Array;
  roadCenterMaskHWorld: Uint8Array;
  roadCenterMaskVWorld: Uint8Array;
}): RoadCenterMarkingAnchor[] {
  const { tx, ty, worldInBounds, worldIndex, roadCenterMaskWorld, roadCenterMaskHWorld, roadCenterMaskVWorld } = params;
  if (!worldInBounds(tx, ty)) return [];
  const wi = worldIndex(tx, ty);
  if (roadCenterMaskWorld[wi] !== 1) return [];

  const isCenterH = (x: number, y: number): boolean => {
    if (!worldInBounds(x, y)) return false;
    return roadCenterMaskHWorld[worldIndex(x, y)] === 1;
  };
  const isCenterV = (x: number, y: number): boolean => {
    if (!worldInBounds(x, y)) return false;
    return roadCenterMaskVWorld[worldIndex(x, y)] === 1;
  };

  const hasH = roadCenterMaskHWorld[wi] === 1;
  const hasV = roadCenterMaskVWorld[wi] === 1;
  const baseCenterX = tx + 0.5;
  const baseCenterY = ty + 0.5;
  let offsetX = 0;
  let offsetY = 0;
  let rotationQuarterTurns: 0 | 1 | 2 | 3 = 0;

  if (hasH && !hasV) {
    const south = isCenterH(tx, ty + 1);
    const north = isCenterH(tx, ty - 1);
    if (south) offsetY = 0.5;
    else if (north) return [];
  } else if (hasV && !hasH) {
    const east = isCenterV(tx + 1, ty);
    const west = isCenterV(tx - 1, ty);
    if (east) offsetX = 0.5;
    else if (west) return [];
    rotationQuarterTurns = 1;
  } else if (hasH && hasV) {
    const hSpan =
      (worldInBounds(tx - 1, ty) && roadCenterMaskHWorld[worldIndex(tx - 1, ty)] === 1 ? 1 : 0) +
      (worldInBounds(tx + 1, ty) && roadCenterMaskHWorld[worldIndex(tx + 1, ty)] === 1 ? 1 : 0);
    const vSpan =
      (worldInBounds(tx, ty - 1) && roadCenterMaskVWorld[worldIndex(tx, ty - 1)] === 1 ? 1 : 0) +
      (worldInBounds(tx, ty + 1) && roadCenterMaskVWorld[worldIndex(tx, ty + 1)] === 1 ? 1 : 0);
    if (vSpan > hSpan) rotationQuarterTurns = 1;
  }

  const anchorX = baseCenterX + offsetX;
  const anchorY = baseCenterY + offsetY;
  const offsets = rotationQuarterTurns === 1
    ? [
      { dx: -DOUBLE_LINE_OFFSET_TILES, dy: 0 },
      { dx: DOUBLE_LINE_OFFSET_TILES, dy: 0 },
    ]
    : [
      { dx: 0, dy: -DOUBLE_LINE_OFFSET_TILES },
      { dx: 0, dy: DOUBLE_LINE_OFFSET_TILES },
    ];

  const out: RoadCenterMarkingAnchor[] = [];
  for (let i = 0; i < offsets.length; i++) {
    out.push({
      tx: anchorX + offsets[i].dx,
      ty: anchorY + offsets[i].dy,
      rotationQuarterTurns,
    });
  }
  return out;
}

