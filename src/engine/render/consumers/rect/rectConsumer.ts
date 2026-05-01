import type { DynamicRectRenderPiece } from "../../creator/renderPieceTypes";
import { drawDynamicRectPieceCanvas } from "./rectCanvas";
import { appendDynamicRectPieceWebGL } from "./rectWebGL";
import { WorldQuadWebGLBatcher } from "../../shared/batching/worldQuadWebGLBatcher";

type RectCanvasFallbackDeps = Parameters<typeof drawDynamicRectPieceCanvas>[2];

export function renderDynamicRectPieceCanvas(
  ctx: CanvasRenderingContext2D,
  piece: DynamicRectRenderPiece,
  deps: RectCanvasFallbackDeps,
): boolean {
  return drawDynamicRectPieceCanvas(ctx, piece, deps);
}

export function renderDynamicRectPieceWebGL(
  batcher: WorldQuadWebGLBatcher,
  piece: DynamicRectRenderPiece,
): boolean {
  return appendDynamicRectPieceWebGL(batcher, piece);
}

