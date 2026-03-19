import { getStructureSliceDebugAlphaMap } from "./structureTriangleAlphaReadback";
import { triangleHasVisibleSpritePixels } from "./structureTriangleCulling";
import {
  hashStructureTriangleStableId,
  positiveMod,
  resolveTriangleCentroidOwnerTile,
} from "./structureTriangleOwnership";
import {
  type RuntimeStructureTrianglePiece,
  type StructureSliceDebugRect,
  type StructureSliceDebugTriangleStats,
} from "./structureTriangleTypes";

const STRUCTURE_SLICE_TRI_LADDER_STEP_PX = 64;
const STRUCTURE_SLICE_TRI_LADDER_STAGGER_PX = 32;
const STRUCTURE_SLICE_TRI_PARITY_FLIP = false;
const STRUCTURE_SLICE_TRI_CULL_ALPHA_THRESHOLD = 1;

export function buildRuntimeStructureTriangleDebugPieces(
  rect: StructureSliceDebugRect,
  progressionIndex: number,
  tileWorld: number,
  structureInstanceId: string,
  bandIndex: number,
  sourceImg?: CanvasImageSource,
  srcRect?: StructureSliceDebugRect,
): { pieces: RuntimeStructureTrianglePiece[]; stats: StructureSliceDebugTriangleStats } {
  let beforeCull = 0;
  let afterCull = 0;
  const pieces: RuntimeStructureTrianglePiece[] = [];
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.w;
  const y1 = rect.y + rect.h;
  if (!(x1 > x0) || !(y1 > y0)) return { pieces, stats: { beforeCull, afterCull } };
  const ladderStep = Math.max(1, STRUCTURE_SLICE_TRI_LADDER_STEP_PX);
  const ladderStagger = Math.max(1, Math.min(ladderStep - 1, STRUCTURE_SLICE_TRI_LADDER_STAGGER_PX));
  const alphaMap = sourceImg && srcRect ? getStructureSliceDebugAlphaMap(sourceImg) : null;
  const canCullByAlpha = !!alphaMap && !!srcRect;

  const parityBias = STRUCTURE_SLICE_TRI_PARITY_FLIP ? 1 : 0;
  const phasedProgression = progressionIndex + parityBias;
  // 64px ladder step on both sides; each progression step shifts phase by 32px.
  const rightPhase = positiveMod(phasedProgression * ladderStagger, ladderStep);
  const leftPhase = positiveMod(rightPhase - ladderStagger, ladderStep);

  const zigZagPoints: Array<{ x: number; y: number; side: "L" | "R" }> = [];
  const collectLadder = (x: number, phase: number, side: "L" | "R") => {
    // Start one ladder point below the rect so clipped bottom-edge wedges are still generated.
    let first = y1 - positiveMod(y1 - phase, ladderStep);
    if (first < y1) first += ladderStep;
    for (let y = first; y >= y0 - ladderStep; y -= ladderStep) {
      zigZagPoints.push({ x, y, side });
    }
  };
  collectLadder(x1, rightPhase, "R");
  collectLadder(x0, leftPhase, "L");
  zigZagPoints.sort((a, b) => {
    if (a.y !== b.y) return b.y - a.y;
    if (a.side === b.side) return 0;
    return a.side === "R" ? -1 : 1;
  });

  for (let i = 0; i + 2 < zigZagPoints.length; i++) {
    const a = zigZagPoints[i];
    const b = zigZagPoints[i + 1];
    const c = zigZagPoints[i + 2];
    const minX = Math.min(a.x, b.x, c.x);
    const maxX = Math.max(a.x, b.x, c.x);
    const minY = Math.min(a.y, b.y, c.y);
    const maxY = Math.max(a.y, b.y, c.y);
    if (maxX <= x0 || minX >= x1 || maxY <= y0 || minY >= y1) continue;
    beforeCull++;
    if (canCullByAlpha && !triangleHasVisibleSpritePixels(a, b, c, rect, srcRect!, alphaMap!, STRUCTURE_SLICE_TRI_CULL_ALPHA_THRESHOLD)) {
      continue;
    }
    const owner = resolveTriangleCentroidOwnerTile(a, b, c, tileWorld);
    const triangleOrdinal = pieces.length;
    pieces.push({
      points: [
        { x: a.x, y: a.y },
        { x: b.x, y: b.y },
        { x: c.x, y: c.y },
      ],
      parentTx: owner.tx,
      parentTy: owner.ty,
      bandIndex,
      structureInstanceId,
      stableId: hashStructureTriangleStableId(structureInstanceId, bandIndex, triangleOrdinal),
      bounds: { minX, minY, maxX, maxY },
    });
    afterCull++;
  }
  return {
    pieces,
    stats: { beforeCull, afterCull },
  };
}
