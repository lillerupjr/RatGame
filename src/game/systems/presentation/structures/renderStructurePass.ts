import { resolveRuntimeStructureBandProgressionIndex } from "../runtimeStructureTriangles";
import { drawStructureSliceTriangleDebugOverlay } from "../structureTriangles/structureTriangleDebug";
import { drawTexturedTriangle } from "../renderPrimitives/drawTexturedTriangle";
import type { StructureDrawablePayload } from "./structurePresentationTypes";

export type RenderStructurePassInput = {
  ctx: CanvasRenderingContext2D;
  payload: StructureDrawablePayload;
  showStructureSliceDebug: boolean;
  tileWorld: number;
  deferredStructureSliceDebugDraws: Array<() => void>;
  resolveRelitCanvas: (pieceKey: string | null) => HTMLCanvasElement | null;
  drawOverlayRenderPiece: (draw: {
    img: HTMLImageElement;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    flipX?: boolean;
    scale?: number;
  }) => void;
};

export function renderStructurePass(input: RenderStructurePassInput): void {
  const {
    ctx,
    payload,
    showStructureSliceDebug,
    tileWorld,
    deferredStructureSliceDebugDraws,
    resolveRelitCanvas,
    drawOverlayRenderPiece,
  } = input;

  if (payload.kind === "overlay") {
    drawOverlayRenderPiece(payload.piece.draw);
    return;
  }

  if (payload.kind === "triangleGroup") {
    const piece = payload.piece;
    ctx.imageSmoothingEnabled = false;
    for (let ti = 0; ti < piece.finalVisibleTriangles.length; ti++) {
      const tri = piece.finalVisibleTriangles[ti];
      const [s0, s1, s2] = tri.srcPoints;
      const [d0, d1, d2] = tri.points;
      const cutoutEligible = piece.cutoutEnabled
        && piece.buildingDirectionalEligible
        && piece.groupParentAfterPlayer
        && piece.isPointInsideStructureCutoutScreenRect(
          (tri.points[0].x + tri.points[1].x + tri.points[2].x) / 3,
          (tri.points[0].y + tri.points[1].y + tri.points[2].y) / 3,
        );
      if (cutoutEligible && piece.cutoutAlpha < 1) {
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * piece.cutoutAlpha;
        drawTexturedTriangle(
          ctx,
          piece.sourceImage,
          piece.draw.dw,
          piece.draw.dh,
          s0,
          s1,
          s2,
          d0,
          d1,
          d2,
        );
        ctx.restore();
      } else {
        drawTexturedTriangle(
          ctx,
          piece.sourceImage,
          piece.draw.dw,
          piece.draw.dh,
          s0,
          s1,
          s2,
          d0,
          d1,
          d2,
        );
      }
      const compareDistanceOnly = piece.compareDistanceOnlyTriangles.includes(tri);
      if (compareDistanceOnly) {
        const [a, b, c] = tri.points;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,120,40,0.28)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,120,40,0.9)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      if (showStructureSliceDebug && cutoutEligible) {
        const [a, b, c] = tri.points;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(160,90,255,0.18)";
        ctx.fill();
        ctx.strokeStyle = "rgba(190,130,255,0.95)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }
    return;
  }

  const piece = payload.piece;
  const x0 = Math.round(piece.band.dstRect.x);
  const y0 = Math.round(piece.band.dstRect.y);
  const x1 = Math.round(piece.band.dstRect.x + piece.band.dstRect.w);
  const y1 = Math.round(piece.band.dstRect.y + piece.band.dstRect.h);
  const snappedW = Math.max(0, x1 - x0);
  const snappedH = Math.max(0, y1 - y0);
  if (snappedW <= 0 || snappedH <= 0) return;
  ctx.imageSmoothingEnabled = false;

  const relitCanvas = resolveRelitCanvas(payload.staticRelightPieceKey);
  if (relitCanvas) {
    ctx.drawImage(relitCanvas, x0, y0, snappedW, snappedH);
  } else {
    ctx.drawImage(
      piece.sourceImage,
      piece.band.srcRect.x,
      piece.band.srcRect.y,
      piece.band.srcRect.w,
      piece.band.srcRect.h,
      x0,
      y0,
      snappedW,
      snappedH,
    );
  }

  if (!showStructureSliceDebug) return;

  deferredStructureSliceDebugDraws.push(() => {
    ctx.save();
    ctx.strokeStyle = "#00ffd5";
    ctx.lineWidth = 1;
    ctx.strokeRect(piece.band.dstRect.x, piece.band.dstRect.y, piece.band.dstRect.w, piece.band.dstRect.h);
    const progressionIndex = resolveRuntimeStructureBandProgressionIndex(
      piece.band.index,
      piece.overlay.w,
      piece.overlay.h,
    );
    drawStructureSliceTriangleDebugOverlay(
      ctx,
      piece.band.dstRect,
      progressionIndex,
      tileWorld,
      piece.overlay.id,
      piece.band.index,
      piece.sourceImage,
      piece.band.srcRect,
    );
    ctx.fillStyle = "#00ffd5";
    ctx.font = "10px monospace";
    const topY = piece.band.dstRect.y + 12;
    ctx.fillText(`#${piece.band.index}`, piece.band.dstRect.x + 2, topY);
    ctx.restore();
  });
}
