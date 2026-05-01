import type { StaticWorldQuadRenderPiece } from "../../creator/renderPieceTypes";
import { WorldQuadWebGLBatcher } from "../../shared/batching/worldQuadWebGLBatcher";

export function appendStaticIsoPieceWebGL(
  batcher: WorldQuadWebGLBatcher,
  piece: StaticWorldQuadRenderPiece,
): boolean {
  return batcher.appendPiece(piece);
}
