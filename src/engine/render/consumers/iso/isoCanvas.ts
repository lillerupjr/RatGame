import { drawTexturedQuad } from "../../../../game/systems/presentation/renderPrimitives/drawTexturedQuad";
import type { StaticWorldQuadRenderPiece } from "../../creator/renderPieceTypes";
import { pieceDestinationQuad } from "../../creator/renderPieceTypes";

export function drawStaticIsoPieceCanvas(
  ctx: CanvasRenderingContext2D,
  piece: StaticWorldQuadRenderPiece,
): boolean {
  const image = piece.image;
  const destinationQuad = pieceDestinationQuad(piece);
  if (!image || !destinationQuad) return false;
  const alpha = Number.isFinite(Number(piece.alpha)) ? Number(piece.alpha) : 1;
  const draw = () => {
    drawTexturedQuad(
      ctx,
      image,
      Number(piece.sx ?? 0),
      Number(piece.sy ?? 0),
      Number(piece.sw ?? 0),
      Number(piece.sh ?? 0),
      destinationQuad,
      piece.sourceQuad,
    );
  };
  if (alpha >= 1) {
    draw();
    return true;
  }
  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = previousAlpha * alpha;
  try {
    draw();
  } finally {
    ctx.globalAlpha = previousAlpha;
  }
  return true;
}
