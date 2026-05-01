import type { ViewRect } from "../../../game/map/compile/kenneyMap";
import type { RenderFrameContext } from "../../../game/systems/presentation/contracts/renderFrameContext";
import { resolveRenderZBand } from "../../../game/systems/presentation/worldRenderOrdering";
import { renderStaticIsoPieceCanvas, renderStaticIsoPieceWebGL } from "./iso/isoConsumer";
import { renderDynamicRectPieceCanvas, renderDynamicRectPieceWebGL } from "./rect/rectConsumer";
import type { CanvasGroundChunkCacheStore } from "../../../game/systems/presentation/canvasGroundChunkCache";
import { WorldQuadWebGLBatcher } from "../shared/batching/worldQuadWebGLBatcher";
import type { DynamicRectRenderPiece, WorldQuadRenderPiece } from "../creator/renderPieceTypes";

type ChunkDeps = {
  viewRect: ViewRect;
  rampRoadTiles: ReadonlySet<string>;
  countVisible?: (n?: number) => void;
  countDraw?: (n?: number) => void;
};

type RectCanvasDeps = Parameters<typeof renderDynamicRectPieceCanvas>[2];

type CanvasInput = {
  frameContext: RenderFrameContext;
  orderedPieces: readonly WorldQuadRenderPiece[];
  groundChunkCache: CanvasGroundChunkCacheStore;
  chunkDeps: ChunkDeps;
  rectCanvasDeps: RectCanvasDeps;
};

type WebGLInput = {
  frameContext: RenderFrameContext;
  orderedPieces: readonly WorldQuadRenderPiece[];
  groundChunkCache: CanvasGroundChunkCacheStore;
  chunkDeps: ChunkDeps;
  rectCanvasDeps: RectCanvasDeps;
  batcher: WorldQuadWebGLBatcher;
};

function isGroundPiece(piece: WorldQuadRenderPiece): boolean {
  return piece.semanticFamily === "groundSurface" || piece.semanticFamily === "groundDecal";
}

function pieceZBand(piece: WorldQuadRenderPiece, rampRoadTiles: ReadonlySet<string>): number {
  return resolveRenderZBand(piece.key, rampRoadTiles);
}

function drawVisibleChunkPiecesCanvas(
  ctx: CanvasRenderingContext2D,
  cache: CanvasGroundChunkCacheStore,
  zBand: number,
  deps: ChunkDeps,
): void {
  const entries = cache.getVisibleEntries(zBand, deps.viewRect);
  const pieces = cache.getVisiblePieces(zBand, deps.viewRect);
  if (entries.length <= 0 || pieces.length <= 0) return;
  deps.countVisible?.(entries.length);
  deps.countDraw?.(entries.length);
  for (let i = 0; i < pieces.length; i++) renderStaticIsoPieceCanvas(ctx, pieces[i]);
}

function appendVisibleChunkPiecesWebGL(
  batcher: WorldQuadWebGLBatcher,
  cache: CanvasGroundChunkCacheStore,
  zBand: number,
  deps: ChunkDeps,
): void {
  const entries = cache.getVisibleEntries(zBand, deps.viewRect);
  const pieces = cache.getVisiblePieces(zBand, deps.viewRect);
  if (entries.length <= 0 || pieces.length <= 0) return;
  deps.countVisible?.(entries.length);
  deps.countDraw?.(entries.length);
  for (let i = 0; i < pieces.length; i++) renderStaticIsoPieceWebGL(batcher, pieces[i]);
}

export function renderWorldPiecesCanvas(input: CanvasInput): void {
  const { ctx, viewport } = input.frameContext;
  ctx.save();
  viewport.applyWorld(ctx);
  let lastZBand: number | null = null;
  for (let i = 0; i < input.orderedPieces.length; i++) {
    const piece = input.orderedPieces[i];
    const zBand = pieceZBand(piece, input.chunkDeps.rampRoadTiles);
    if (zBand !== lastZBand) {
      drawVisibleChunkPiecesCanvas(ctx, input.groundChunkCache, zBand, input.chunkDeps);
      lastZBand = zBand;
    }
    if (isGroundPiece(piece) && input.groundChunkCache.hasCoveredStableId(piece.stableId)) continue;
    if (piece.pieceType === "static-world") {
      renderStaticIsoPieceCanvas(ctx, piece);
      continue;
    }
    renderDynamicRectPieceCanvas(ctx, piece, input.rectCanvasDeps);
  }
  ctx.restore();
}

export function renderDynamicFallbackPiecesCanvas(
  frameContext: RenderFrameContext,
  pieces: readonly DynamicRectRenderPiece[],
  deps: RectCanvasDeps,
): void {
  const { ctx, viewport } = frameContext;
  ctx.save();
  viewport.applyWorld(ctx);
  for (let i = 0; i < pieces.length; i++) {
    renderDynamicRectPieceCanvas(ctx, pieces[i], deps);
  }
  ctx.restore();
}

export function renderWorldPiecesWebGL(input: WebGLInput): DynamicRectRenderPiece[] {
  const canvasFallbackPieces: DynamicRectRenderPiece[] = [];
  input.batcher.setFrameContext(input.frameContext);
  input.batcher.beginFrame();
  let lastZBand: number | null = null;
  for (let i = 0; i < input.orderedPieces.length; i++) {
    const piece = input.orderedPieces[i];
    const zBand = pieceZBand(piece, input.chunkDeps.rampRoadTiles);
    if (zBand !== lastZBand) {
      input.batcher.flush();
      appendVisibleChunkPiecesWebGL(input.batcher, input.groundChunkCache, zBand, input.chunkDeps);
      lastZBand = zBand;
    }
    if (isGroundPiece(piece) && input.groundChunkCache.hasCoveredStableId(piece.stableId)) continue;
    if (piece.pieceType === "static-world") {
      renderStaticIsoPieceWebGL(input.batcher, piece);
      continue;
    }
    const handled = renderDynamicRectPieceWebGL(input.batcher, piece);
    if (!handled) canvasFallbackPieces.push(piece);
  }
  input.batcher.flush();
  return canvasFallbackPieces;
}
