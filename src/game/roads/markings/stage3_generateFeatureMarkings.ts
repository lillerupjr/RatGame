import {
  ROAD_CROSSING_FULL_VARIANT_INDEX,
  ROAD_CROSSING_VARIANT_INDEX,
  ROAD_STOP_CROSSING_OFFSET_TILES,
} from "../roadMarkings";
import { ROAD_AXIS_EW, ROAD_AXIS_NS, type MarkingPiece, type RoadContext, type RoadMarkingInputs } from "./types";

const ROAD_DIR_N = 1;
const ROAD_DIR_E = 2;
const ROAD_DIR_S = 3;
const ROAD_DIR_W = 4;

function stopbarRotationFromDir(dir: number): 0 | 1 {
  if (dir === ROAD_DIR_N || dir === ROAD_DIR_S) return 0;
  if (dir === ROAD_DIR_E || dir === ROAD_DIR_W) return 1;
  return 0;
}

function dirToDelta(dir: number): { dx: number; dy: number } {
  if (dir === ROAD_DIR_N) return { dx: 0, dy: -1 };
  if (dir === ROAD_DIR_E) return { dx: 1, dy: 0 };
  if (dir === ROAD_DIR_S) return { dx: 0, dy: 1 };
  if (dir === ROAD_DIR_W) return { dx: -1, dy: 0 };
  return { dx: 0, dy: 0 };
}

export function generateFeatureMarkings(context: RoadContext, inputs: RoadMarkingInputs): MarkingPiece[] {
  const out: MarkingPiece[] = [];
  const dedupe = new Set<string>();
  const inBounds = (tx: number, ty: number): boolean => {
    return tx >= inputs.originTx
      && tx < inputs.originTx + inputs.w
      && ty >= inputs.originTy
      && ty < inputs.originTy + inputs.h;
  };
  const idx = (tx: number, ty: number): number => (tx - inputs.originTx) + (ty - inputs.originTy) * inputs.w;
  const crossingRotationAt = (tx: number, ty: number, dir: number): 0 | 1 => {
    const axis = context.axis[idx(tx, ty)] | 0;
    if (axis === ROAD_AXIS_EW) return 0;
    if (axis === ROAD_AXIS_NS) return 1;
    if (dir === ROAD_DIR_N || dir === ROAD_DIR_S) return 1;
    return 0;
  };
  const push = (
    anchorTx: number,
    anchorTy: number,
    sampleTx: number,
    sampleTy: number,
    variant: number,
    rot: 0 | 1,
    key: string,
  ) => {
    const z = inputs.getTileZAt(sampleTx, sampleTy);
    const dk = `${variant}:${Math.round(anchorTx * 1024)}:${Math.round(anchorTy * 1024)}:${z}:${rot}`;
    if (dedupe.has(dk)) return;
    dedupe.add(dk);
    out.push({
      tx: anchorTx,
      ty: anchorTy,
      variant,
      rot,
      pass: "ROAD_MARKINGS",
      key,
      zBase: z,
      zLogical: z,
    });
  };

  for (let ty = inputs.originTy; ty < inputs.originTy + inputs.h; ty++) {
    for (let tx = inputs.originTx; tx < inputs.originTx + inputs.w; tx++) {
      if (!inBounds(tx, ty)) continue;
      const i = idx(tx, ty);

      if (inputs.roadCrossingMaskWorld[i] === 1) {
        const dir = inputs.roadCrossingDirWorld[i] | 0;
        const rot = crossingRotationAt(tx, ty, dir);
        push(
          tx + 0.5,
          ty + 0.5,
          tx,
          ty,
          ROAD_CROSSING_FULL_VARIANT_INDEX,
          rot,
          `crossing_full_${tx}_${ty}`,
        );
      }

      if (inputs.emitStopbarCrossingOverlay && inputs.roadStopMaskWorld && inputs.roadStopDirWorld && inputs.roadStopMaskWorld[i] === 1) {
        const dir = inputs.roadStopDirWorld[i] | 0;
        const stopRot = stopbarRotationFromDir(dir);
        const v = dirToDelta(dir);
        const baseTx = tx + 0.5;
        const baseTy = ty + 0.5;
        const emitTx = baseTx + (v.dx * ROAD_STOP_CROSSING_OFFSET_TILES);
        const emitTy = baseTy + (v.dy * ROAD_STOP_CROSSING_OFFSET_TILES);
        push(
          emitTx,
          emitTy,
          tx,
          ty,
          ROAD_CROSSING_VARIANT_INDEX,
          stopRot,
          `stop_crossing_${tx}_${ty}`,
        );
      }
    }
  }

  return out;
}
