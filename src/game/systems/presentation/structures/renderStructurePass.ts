import { drawTexturedTriangle } from "../renderPrimitives/drawTexturedTriangle";
import type { StructureDrawablePayload } from "./structurePresentationTypes";

export type RenderStructurePassInput = {
  ctx: CanvasRenderingContext2D;
  payload: StructureDrawablePayload;
  showStructureTriangleFootprintDebug: boolean;
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
    showStructureTriangleFootprintDebug,
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
    }
    return;
  }
}
