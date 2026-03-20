import { blockedTilesInView } from "../../../map/compile/kenneyMap";
import type {
  RenderDebugWorldPassInput,
  StructureV6FaceSliceDebugData,
  StructureV6VerticalShadowMaskDebugData,
} from "./debugRenderTypes";

const STRUCTURE_SHADOW_V6_DEBUG_PANEL_PADDING_PX = 8;

export function renderDebugStructureOverlays(input: RenderDebugWorldPassInput): void {
  const {
    ctx,
    viewRect,
    toScreen,
    tileWorld,
    flags,
    deferredStructureSliceDebugDraws,
  } = input;

  if (flags.showStructureCollision) {
    const blocked = blockedTilesInView(viewRect);
    if (blocked.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 80, 80, 0.95)";
      ctx.fillStyle = "rgba(255, 80, 80, 0.12)";
      ctx.lineWidth = 1;
      for (let i = 0; i < blocked.length; i++) {
        const t = blocked[i];
        const p0 = toScreen(t.tx * tileWorld, t.ty * tileWorld);
        const p1 = toScreen((t.tx + 1) * tileWorld, t.ty * tileWorld);
        const p2 = toScreen((t.tx + 1) * tileWorld, (t.ty + 1) * tileWorld);
        const p3 = toScreen(t.tx * tileWorld, (t.ty + 1) * tileWorld);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  for (let i = 0; i < deferredStructureSliceDebugDraws.length; i++) {
    deferredStructureSliceDebugDraws[i]();
  }
}

export function drawStructureV65MergedShadowMaskInWorld(
  ctx: CanvasRenderingContext2D,
  debugData: StructureV6VerticalShadowMaskDebugData,
): void {
  if (debugData.mergedVerticalShadowCanvas.width <= 0 || debugData.mergedVerticalShadowCanvas.height <= 0) return;
  const drawX = Math.round(debugData.mergedVerticalShadowDrawOrigin.x);
  const drawY = Math.round(debugData.mergedVerticalShadowDrawOrigin.y);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(
    debugData.mergedVerticalShadowCanvas,
    drawX,
    drawY,
  );
  ctx.restore();
}

export function drawStructureV6FaceSliceDebugPanel(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  debugData: StructureV6VerticalShadowMaskDebugData,
): void {
  const panelPadding = STRUCTURE_SHADOW_V6_DEBUG_PANEL_PADDING_PX;
  const panelW = Math.max(420, Math.min(900, cssW - panelPadding * 2));
  const panelH = Math.max(300, Math.min(560, cssH - panelPadding * 2));
  const panelX = cssW - panelW - panelPadding;
  const panelY = panelPadding;

  const drawViewFrame = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
  ): { contentX: number; contentY: number; contentW: number; contentH: number } => {
    ctx.fillStyle = "rgba(32, 38, 52, 0.60)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(160, 186, 238, 0.52)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = "rgba(210, 228, 255, 0.92)";
    ctx.font = "10px monospace";
    ctx.fillText(label, x + 4, y + 11);
    return {
      contentX: x + 4,
      contentY: y + 14,
      contentW: Math.max(1, w - 8),
      contentH: Math.max(1, h - 18),
    };
  };

  const drawFittedCanvas = (
    canvas: HTMLCanvasElement,
    target: { contentX: number; contentY: number; contentW: number; contentH: number },
  ): { x: number; y: number; w: number; h: number } | null => {
    const srcW = Math.max(1, canvas.width);
    const srcH = Math.max(1, canvas.height);
    const scale = Math.min(target.contentW / srcW, target.contentH / srcH);
    if (!(scale > 0)) return null;
    const drawW = Math.max(1, Math.floor(srcW * scale));
    const drawH = Math.max(1, Math.floor(srcH * scale));
    const drawX = target.contentX + Math.floor((target.contentW - drawW) * 0.5);
    const drawY = target.contentY + Math.floor((target.contentH - drawH) * 0.5);
    ctx.drawImage(canvas, drawX, drawY, drawW, drawH);
    return { x: drawX, y: drawY, w: drawW, h: drawH };
  };

  const drawEmptyFrameLabel = (
    frame: { contentX: number; contentY: number; contentW: number; contentH: number },
    label: string,
  ): void => {
    ctx.fillStyle = "rgba(245, 245, 245, 0.85)";
    ctx.font = "11px monospace";
    ctx.fillText(label, frame.contentX + 4, frame.contentY + 14);
  };

  const drawTopCollected = (
    frame: { contentX: number; contentY: number; contentW: number; contentH: number },
    topShadow: StructureV6FaceSliceDebugData | null,
  ): void => {
    if (!topShadow) {
      drawEmptyFrameLabel(frame, "No TOP triangles");
      return;
    }
    drawFittedCanvas(topShadow.faceCanvas, frame);
  };

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(12, 14, 18, 0.88)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "rgba(185, 210, 255, 0.48)";
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

  const titleX = panelX + 10;
  let textY = panelY + 16;
  ctx.font = "12px monospace";
  ctx.fillStyle = "rgba(240, 245, 255, 0.96)";
  ctx.fillText("V6.7 TOP Face Shadow Cast (No Top Slicing)", titleX, textY);
  textY += 14;
  const trimmedId = debugData.structureInstanceId.length > 52
    ? `${debugData.structureInstanceId.slice(0, 49)}...`
    : debugData.structureInstanceId;
  ctx.fillStyle = "rgba(210, 228, 255, 0.9)";
  ctx.fillText(
    `id:${trimmedId} sel:${debugData.selectedStructureIndex}/${Math.max(0, debugData.candidateCount - 1)} req:${debugData.requestedStructureIndex} reqBucket:${debugData.requestedSemanticBucket}`,
    titleX,
    textY,
  );
  textY += 14;
  const bucketATris = debugData.bucketAShadow?.sourceTriangleCount ?? 0;
  const bucketBTriCount = debugData.bucketBShadow?.sourceTriangleCount ?? 0;
  const topTriCount = debugData.topShadow?.sourceTriangleCount ?? 0;
  const bucketACastSlices = debugData.bucketAShadow?.nonEmptySliceCount ?? 0;
  const bucketBCastSlices = debugData.bucketBShadow?.nonEmptySliceCount ?? 0;
  const topCastSlices = debugData.topShadow?.nonEmptySliceCount ?? 0;
  ctx.fillStyle = "rgba(195, 214, 246, 0.88)";
  ctx.fillText(
    `EW tris:${bucketATris} cast:${bucketACastSlices}  SN tris:${bucketBTriCount} cast:${bucketBCastSlices}  TOP tris:${topTriCount} cast:${topCastSlices}`,
    titleX,
    textY,
  );
  textY += 14;
  const requestedBucketShadow = debugData.requestedSemanticBucket === "SOUTH_NORTH"
    ? debugData.bucketBShadow
    : debugData.requestedSemanticBucket === "TOP"
      ? debugData.topShadow
      : debugData.bucketAShadow;
  ctx.fillStyle = "rgba(196, 255, 220, 0.90)";
  if (requestedBucketShadow) {
    ctx.fillText(
      `reqSliceSpace h:${requestedBucketShadow.sliceSpaceHeightPx.toFixed(2)} minS:${requestedBucketShadow.sliceSpaceMinS.toFixed(2)} maxS:${requestedBucketShadow.sliceSpaceMaxS.toFixed(2)} thick:${requestedBucketShadow.desiredSliceThicknessPx} slices:${requestedBucketShadow.sliceCountUsed} occPx:${requestedBucketShadow.occupiedPixelCount}`,
      titleX,
      textY,
    );
  } else {
    ctx.fillText("reqSliceSpace h:n/a (no bucket content)", titleX, textY);
  }
  textY += 14;
  ctx.fillStyle = "rgba(255, 221, 168, 0.86)";
  ctx.fillText(
    `shadowVector(${debugData.shadowVector.x.toFixed(1)},${debugData.shadowVector.y.toFixed(1)}) zBand:${debugData.zBand} worldOrigin(${debugData.mergedVerticalShadowDrawOrigin.x.toFixed(1)},${debugData.mergedVerticalShadowDrawOrigin.y.toFixed(1)})`,
    titleX,
    textY,
  );

  const bodyTop = textY + 10;
  const bodyBottom = panelY + panelH - 10;
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);
  const bodyWidth = panelW - 20;
  const columnGap = 8;
  const rowGap = 8;
  const topRowH = Math.max(110, Math.floor((bodyHeight - rowGap) * 0.5));
  const bottomRowH = Math.max(110, bodyHeight - topRowH - rowGap);
  const columnW = Math.max(120, Math.floor((bodyWidth - columnGap) * 0.5));
  const leftX = panelX + 10;
  const rightX = leftX + columnW + columnGap;
  const topY = bodyTop;
  const bottomY = topY + topRowH + rowGap;

  const topCollectedFrame = drawViewFrame(leftX, topY, columnW, topRowH, "TOP Collected");
  const topModeFrame = drawViewFrame(rightX, topY, columnW, topRowH, "TOP Mode");
  const topCastFrame = drawViewFrame(leftX, bottomY, columnW, bottomRowH, "TOP Cast Shadow");
  const mergedFrame = drawViewFrame(rightX, bottomY, columnW, bottomRowH, "Merged Shadow (Vertical + TOP)");

  drawTopCollected(topCollectedFrame, debugData.topShadow);
  drawEmptyFrameLabel(topModeFrame, "whole-face move (no slicing)");
  ctx.fillStyle = "rgba(245, 245, 245, 0.92)";
  ctx.font = "10px monospace";
  ctx.fillText(
    `offset = shadowVector`,
    topModeFrame.contentX + 4,
    topModeFrame.contentY + 30,
  );
  if (debugData.topShadow) {
    drawFittedCanvas(debugData.topShadow.mergedShadowCanvas, topCastFrame);
  } else {
    drawEmptyFrameLabel(topCastFrame, "No TOP cast");
  }
  drawFittedCanvas(debugData.mergedVerticalShadowCanvas, mergedFrame);
  ctx.fillStyle = "rgba(245, 245, 245, 0.94)";
  ctx.font = "10px monospace";
  ctx.fillText(
    `single-tint merged mask (non-additive overlap)`,
    mergedFrame.contentX + 4,
    mergedFrame.contentY + mergedFrame.contentH - 2,
  );
  ctx.restore();
}
