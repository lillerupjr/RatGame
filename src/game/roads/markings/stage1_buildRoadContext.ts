import {
  ROAD_AXIS_EW,
  ROAD_AXIS_NONE,
  ROAD_AXIS_NS,
  type RoadContext,
  type RoadMarkingInputs,
} from "./types";

export function buildRoadContext(inputs: RoadMarkingInputs): RoadContext {
  const { w, h, originTx, originTy, isRoadFromSemantics, roadBands } = inputs;
  const total = w * h;
  const isRoad = new Uint8Array(total);
  const axis = new Uint8Array(total);
  const neighborsMask = new Uint8Array(total);

  const inBounds = (tx: number, ty: number): boolean => {
    return tx >= originTx && tx < originTx + w && ty >= originTy && ty < originTy + h;
  };
  const indexOf = (tx: number, ty: number): number => {
    return (tx - originTx) + (ty - originTy) * w;
  };

  for (let ty = originTy; ty < originTy + h; ty++) {
    for (let tx = originTx; tx < originTx + w; tx++) {
      if (!isRoadFromSemantics(tx, ty)) continue;
      const i = indexOf(tx, ty);
      isRoad[i] = 1;
    }
  }

  for (let ty = originTy; ty < originTy + h; ty++) {
    for (let tx = originTx; tx < originTx + w; tx++) {
      const i = indexOf(tx, ty);
      if (isRoad[i] !== 1) continue;
      const n = inBounds(tx, ty - 1) && isRoad[indexOf(tx, ty - 1)] === 1;
      const e = inBounds(tx + 1, ty) && isRoad[indexOf(tx + 1, ty)] === 1;
      const s = inBounds(tx, ty + 1) && isRoad[indexOf(tx, ty + 1)] === 1;
      const wv = inBounds(tx - 1, ty) && isRoad[indexOf(tx - 1, ty)] === 1;
      neighborsMask[i] = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (wv ? 8 : 0);

      const ew = (e ? 1 : 0) + (wv ? 1 : 0);
      const ns = (n ? 1 : 0) + (s ? 1 : 0);
      if (ew > ns) axis[i] = ROAD_AXIS_EW;
      else if (ns > ew) axis[i] = ROAD_AXIS_NS;
      else axis[i] = ROAD_AXIS_NONE;
    }
  }

  // Parity fallback: seed ambiguous tiles from authored road band orientation.
  for (let bi = 0; bi < roadBands.length; bi++) {
    const band = roadBands[bi];
    const bandAxis = band.orient === "H" ? ROAD_AXIS_EW : ROAD_AXIS_NS;
    for (let ty = band.y0; ty <= band.y1; ty++) {
      for (let tx = band.x0; tx <= band.x1; tx++) {
        if (!inBounds(tx, ty)) continue;
        const i = indexOf(tx, ty);
        if (isRoad[i] !== 1) continue;
        if (axis[i] === ROAD_AXIS_NONE) axis[i] = bandAxis;
      }
    }
  }

  return {
    w,
    h,
    originTx,
    originTy,
    isRoad,
    axis,
    neighborsMask,
  };
}
