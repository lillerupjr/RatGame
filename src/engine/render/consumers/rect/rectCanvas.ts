import type { DynamicRectRenderPiece } from "../../creator/renderPieceTypes";
import { pieceDestinationQuad } from "../../creator/renderPieceTypes";
import { drawTexturedQuad } from "../../../../game/systems/presentation/renderPrimitives/drawTexturedQuad";

type RectCanvasFallbackDeps = {
  ISO_X: number;
  ISO_Y: number;
  coinColorFromValue?: (value: number) => string;
  w: any;
};

export function drawDynamicRectPieceCanvas(
  ctx: CanvasRenderingContext2D,
  piece: DynamicRectRenderPiece,
  deps: RectCanvasFallbackDeps,
): boolean {
  const image = piece.image;
  const destinationQuad = pieceDestinationQuad(piece);
  if (image && destinationQuad) {
    const alpha = Number.isFinite(Number(piece.alpha)) ? Number(piece.alpha) : 1;
    const blendMode = piece.blendMode === "additive" ? "lighter" : "source-over";
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
    const previousAlpha = ctx.globalAlpha;
    const previousBlendMode = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = blendMode;
    try {
      if (alpha >= 1) {
        draw();
        return true;
      }
      ctx.globalAlpha = previousAlpha * alpha;
      draw();
      return true;
    } finally {
      ctx.globalAlpha = previousAlpha;
      ctx.globalCompositeOperation = previousBlendMode;
    }
  }

  if (piece.pickupIndex !== undefined) {
    const x = Number(piece.screenX ?? piece.dx ?? 0);
    const y = Number(piece.screenY ?? piece.dy ?? 0);
    const value = Math.max(1, Math.floor(deps.w.xValue?.[Number(piece.pickupIndex)] ?? 1));
    ctx.fillStyle = deps.coinColorFromValue?.(value) ?? "#ffd700";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }

  if (piece.projectileIndex !== undefined) {
    const x = Number(piece.screenX ?? piece.dx ?? 0);
    const y = Number(piece.screenY ?? piece.dy ?? 0) - Number(piece.zLift ?? 0);
    ctx.fillStyle = "#bbb";
    ctx.beginPath();
    ctx.ellipse(x, y, 4 * deps.ISO_X, 4 * deps.ISO_Y, 0, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }

  if (
    piece.enemyIndex !== undefined
    || piece.npcIndex !== undefined
    || piece.neutralMobIndex !== undefined
    || piece.feet
  ) {
    const feet = piece.feet as { screenX?: number; screenY?: number } | undefined;
    const x = Number(feet?.screenX ?? piece.screenX ?? 0);
    const y = Number(feet?.screenY ?? piece.screenY ?? 0);
    ctx.fillStyle = typeof piece.baseColor === "string" ? piece.baseColor : "#eaeaf2";
    ctx.beginPath();
    ctx.ellipse(x, y, 8 * deps.ISO_X, 8 * deps.ISO_Y, 0, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }

  return false;
}
