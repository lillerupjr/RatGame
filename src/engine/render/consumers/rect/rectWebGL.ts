import type { DynamicRectRenderPiece } from "../../creator/renderPieceTypes";
import { WorldQuadWebGLBatcher } from "../../shared/batching/worldQuadWebGLBatcher";

export function appendDynamicRectPieceWebGL(
  batcher: WorldQuadWebGLBatcher,
  piece: DynamicRectRenderPiece,
): boolean {
  return batcher.appendPiece(piece);
}

