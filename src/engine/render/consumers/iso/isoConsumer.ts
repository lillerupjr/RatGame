import type { StaticWorldQuadRenderPiece } from "../../creator/renderPieceTypes";
import { drawStaticIsoPieceCanvas } from "./isoCanvas";
import { appendStaticIsoPieceWebGL } from "./isoWebGL";
import { WorldQuadWebGLBatcher } from "../../shared/batching/worldQuadWebGLBatcher";

export function renderStaticIsoPieceCanvas(
  ctx: CanvasRenderingContext2D,
  piece: StaticWorldQuadRenderPiece,
): boolean {
  return drawStaticIsoPieceCanvas(ctx, piece);
}

export function renderStaticIsoPieceWebGL(
  batcher: WorldQuadWebGLBatcher,
  piece: StaticWorldQuadRenderPiece,
): boolean {
  return appendStaticIsoPieceWebGL(batcher, piece);
}
