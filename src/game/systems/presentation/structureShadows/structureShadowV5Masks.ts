import { ISO_X, ISO_Y } from "../../../../engine/math/iso";
import type { ShadowV5DebugView, ShadowV5TransformDebugMode } from "../../../../settings/settingsTypes";
import { drawTexturedTriangle } from "../renderPrimitives/drawTexturedTriangle";
import { getStructureShadowV5MaskScratchContexts } from "./structureShadowScratch";
import type { StructureV5ShadowRenderPiece } from "./structureShadowTypes";

type ScreenPt = { x: number; y: number };

type MutableBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type V5FaceLocalAxis = {
  centerBottom: ScreenPt;
  centerTop: ScreenPt;
  heightDir: ScreenPt;
  faceHeight: number;
};

type V5StripDebugBand = {
  tMid: number;
  lowerCenter: ScreenPt;
  upperCenter: ScreenPt;
};

const STRUCTURE_SHADOW_V5_LENGTH_PX = 220;
const STRUCTURE_SHADOW_V5_PIXEL_SLICE_STEP_PX = 1;
const STRUCTURE_SHADOW_V5_EAST_WEST_FIXED_AXIS: ScreenPt = {
  x: ISO_X / Math.hypot(ISO_X, ISO_Y),
  y: -ISO_Y / Math.hypot(ISO_X, ISO_Y),
};
const STRUCTURE_SHADOW_V5_SOUTH_NORTH_FIXED_AXIS: ScreenPt = {
  x: -ISO_X / Math.hypot(ISO_X, ISO_Y),
  y: -ISO_Y / Math.hypot(ISO_X, ISO_Y),
};

export type StructureV5ShadowAnchorDiagnostic = {
  structureInstanceId: string;
  triangleDestinationSpace: "screen";
  rawBounds: { minX: number; minY: number; maxX: number; maxY: number };
  transformedBounds: { minX: number; minY: number; maxX: number; maxY: number };
  maskCanvasOrigin: ScreenPt;
  maskAnchor: ScreenPt;
  buildingDrawOrigin: ScreenPt;
  buildingAnchor: ScreenPt;
  transformedAnchor: ScreenPt;
  transformedMaskDrawOrigin: ScreenPt;
  finalShadowDrawOrigin: ScreenPt;
  offset: ScreenPt;
};

export type DrawStructureV5ShadowMaskOutput = {
  piecesDrawn: number;
  trianglesDrawn: number;
  finalShadowDrawCalls: number;
  anchorDiagnostic: StructureV5ShadowAnchorDiagnostic | null;
};

function includeTriangleInBounds(bounds: MutableBounds, triangle: [ScreenPt, ScreenPt, ScreenPt], dx: number, dy: number): void {
  for (let i = 0; i < triangle.length; i++) {
    const p = triangle[i];
    if (p.x < bounds.minX) bounds.minX = p.x;
    if (p.y < bounds.minY) bounds.minY = p.y;
    if (p.x > bounds.maxX) bounds.maxX = p.x;
    if (p.y > bounds.maxY) bounds.maxY = p.y;
    const px = p.x + dx;
    const py = p.y + dy;
    if (px < bounds.minX) bounds.minX = px;
    if (py < bounds.minY) bounds.minY = py;
    if (px > bounds.maxX) bounds.maxX = px;
    if (py > bounds.maxY) bounds.maxY = py;
  }
}

function includePointInBounds(bounds: MutableBounds, point: ScreenPt): void {
  if (point.x < bounds.minX) bounds.minX = point.x;
  if (point.y < bounds.minY) bounds.minY = point.y;
  if (point.x > bounds.maxX) bounds.maxX = point.x;
  if (point.y > bounds.maxY) bounds.maxY = point.y;
}

export function computeFaceLocalAxisFromFixedIsoDirection(
  triangles: StructureV5ShadowRenderPiece["triangles"],
  originX: number,
  originY: number,
  fixedHeightDir: ScreenPt,
): V5FaceLocalAxis | null {
  if (triangles.length <= 0) return null;
  const points: ScreenPt[] = [];
  let maxY = Number.NEGATIVE_INFINITY;
  for (let ti = 0; ti < triangles.length; ti++) {
    const tri = triangles[ti].dstTriangle;
    for (let vi = 0; vi < tri.length; vi++) {
      const local = { x: tri[vi].x - originX, y: tri[vi].y - originY };
      points.push(local);
      if (local.y > maxY) maxY = local.y;
    }
  }
  if (points.length <= 0 || !Number.isFinite(maxY)) return null;
  const dirLen = Math.hypot(fixedHeightDir.x, fixedHeightDir.y);
  if (!(dirLen > 1e-4)) return null;
  const heightDir = { x: fixedHeightDir.x / dirLen, y: fixedHeightDir.y / dirLen };
  let minY = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) if (points[i].y < minY) minY = points[i].y;
  const eps = Math.max(1, (maxY - minY) * 0.04);
  const bottomCandidates = points.filter((p) => p.y >= maxY - eps);
  const bottomPoints = bottomCandidates.length > 0 ? bottomCandidates : points.filter((p) => p.y >= maxY - 1e-3);
  if (bottomPoints.length <= 0) return null;
  const avgPoint = (arr: readonly ScreenPt[]): ScreenPt => {
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < arr.length; i++) {
      sx += arr[i].x;
      sy += arr[i].y;
    }
    return { x: sx / arr.length, y: sy / arr.length };
  };
  const centerBottom = avgPoint(bottomPoints);
  let maxAlong = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const along = (p.x - centerBottom.x) * heightDir.x + (p.y - centerBottom.y) * heightDir.y;
    if (along > maxAlong) maxAlong = along;
  }
  const fallbackHeight = Math.max(1, maxY - minY);
  const faceHeight = Math.max(maxAlong, fallbackHeight);
  return {
    centerBottom,
    centerTop: {
      x: centerBottom.x + heightDir.x * faceHeight,
      y: centerBottom.y + heightDir.y * faceHeight,
    },
    heightDir,
    faceHeight,
  };
}

function drawMaskTranslated(
  targetCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
): void {
  targetCtx.drawImage(maskCanvas, offsetX, offsetY);
}

export function drawMaskHeightDeformedByFaceAxis(
  targetCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  axis: V5FaceLocalAxis,
  shadowVector: ScreenPt,
  sliceStepPx: number,
): V5StripDebugBand[] {
  const debugBands: V5StripDebugBand[] = [];
  if (!(axis.faceHeight > 1e-4)) {
    targetCtx.drawImage(maskCanvas, 0, 0);
    return debugBands;
  }
  const sliceStep = Math.max(1, Math.floor(sliceStepPx));
  const strips = Math.max(1, Math.ceil(axis.faceHeight / sliceStep));
  const tangent = { x: -axis.heightDir.y, y: axis.heightDir.x };
  const extent = Math.max(maskCanvas.width, maskCanvas.height) * 2 + 8;
  for (let i = 0; i < strips; i++) {
    const h0 = Math.min(axis.faceHeight, i * sliceStep);
    const h1 = Math.min(axis.faceHeight, h0 + sliceStep);
    if (!(h1 > h0)) continue;
    const lowerCenter = {
      x: axis.centerBottom.x + axis.heightDir.x * h0,
      y: axis.centerBottom.y + axis.heightDir.y * h0,
    };
    const upperCenter = {
      x: axis.centerBottom.x + axis.heightDir.x * h1,
      y: axis.centerBottom.y + axis.heightDir.y * h1,
    };
    const q0 = { x: lowerCenter.x + tangent.x * extent, y: lowerCenter.y + tangent.y * extent };
    const q1 = { x: lowerCenter.x - tangent.x * extent, y: lowerCenter.y - tangent.y * extent };
    const q2 = { x: upperCenter.x - tangent.x * extent, y: upperCenter.y - tangent.y * extent };
    const q3 = { x: upperCenter.x + tangent.x * extent, y: upperCenter.y + tangent.y * extent };
    let t = h0 / axis.faceHeight;
    if (h1 >= axis.faceHeight - 1e-4) t = 1;
    const stripOffset = {
      x: shadowVector.x * t,
      y: shadowVector.y * t,
    };
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.moveTo(q0.x, q0.y);
    targetCtx.lineTo(q1.x, q1.y);
    targetCtx.lineTo(q2.x, q2.y);
    targetCtx.lineTo(q3.x, q3.y);
    targetCtx.closePath();
    targetCtx.clip();
    targetCtx.drawImage(maskCanvas, stripOffset.x, stripOffset.y);
    targetCtx.restore();
    debugBands.push({
      tMid: t,
      lowerCenter,
      upperCenter,
    });
  }
  return debugBands;
}

export function drawStructureV5ShadowMasks(
  ctx: CanvasRenderingContext2D,
  pieces: readonly StructureV5ShadowRenderPiece[],
  projectionDirection: { x: number; y: number },
  debugView: ShadowV5DebugView,
  maxDarkness: number,
  anchorDebugEnabled: boolean,
  transformDebugMode: ShadowV5TransformDebugMode,
): DrawStructureV5ShadowMaskOutput {
  if (pieces.length <= 0) {
    return {
      piecesDrawn: 0,
      trianglesDrawn: 0,
      finalShadowDrawCalls: 0,
      anchorDiagnostic: null,
    };
  }
  const offsetX = projectionDirection.x * STRUCTURE_SHADOW_V5_LENGTH_PX;
  const offsetY = projectionDirection.y * STRUCTURE_SHADOW_V5_LENGTH_PX;
  const shadowAlpha = Math.max(0, Math.min(1, maxDarkness));
  let piecesDrawn = 0;
  let trianglesDrawn = 0;
  let finalShadowDrawCalls = 0;
  let anchorDiagnostic: StructureV5ShadowAnchorDiagnostic | null = null;

  for (let pi = 0; pi < pieces.length; pi++) {
    const piece = pieces[pi];
    if (piece.triangles.length <= 0) continue;
    const eastWestTriangles = piece.triangles.filter((tri) => tri.semanticBucket === "EAST_WEST");
    const southNorthTriangles = piece.triangles.filter((tri) => tri.semanticBucket === "SOUTH_NORTH");
    const bounds: MutableBounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };
    const rawBounds: MutableBounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };
    for (let ti = 0; ti < piece.triangles.length; ti++) {
      const triangle = piece.triangles[ti].dstTriangle;
      includeTriangleInBounds(bounds, triangle, offsetX, offsetY);
      for (let vi = 0; vi < triangle.length; vi++) {
        const p = triangle[vi];
        if (p.x < rawBounds.minX) rawBounds.minX = p.x;
        if (p.y < rawBounds.minY) rawBounds.minY = p.y;
        if (p.x > rawBounds.maxX) rawBounds.maxX = p.x;
        if (p.y > rawBounds.maxY) rawBounds.maxY = p.y;
      }
    }
    if (
      !Number.isFinite(bounds.minX)
      || !Number.isFinite(bounds.minY)
      || !Number.isFinite(bounds.maxX)
      || !Number.isFinite(bounds.maxY)
      || !Number.isFinite(rawBounds.minX)
      || !Number.isFinite(rawBounds.minY)
      || !Number.isFinite(rawBounds.maxX)
      || !Number.isFinite(rawBounds.maxY)
    ) {
      continue;
    }
    const pad = 2;
    const originX = Math.floor(bounds.minX) - pad;
    const originY = Math.floor(bounds.minY) - pad;
    const canvasW = Math.max(1, Math.ceil(bounds.maxX - bounds.minX) + pad * 2);
    const canvasH = Math.max(1, Math.ceil(bounds.maxY - bounds.minY) + pad * 2);
    const scratch = getStructureShadowV5MaskScratchContexts(canvasW, canvasH);
    if (!scratch) continue;

    const {
      topMaskCtx,
      eastWestMaskCtx,
      southNorthMaskCtx,
      coverageMaskCtx,
      finalMaskCtx,
      topMaskCanvas,
      eastWestMaskCanvas,
      southNorthMaskCanvas,
      coverageMaskCanvas,
      finalMaskCanvas,
      width,
      height,
    } = scratch;
    const topLocalPoints: ScreenPt[] = [];
    const eastWestLocalPoints: ScreenPt[] = [];
    const southNorthLocalPoints: ScreenPt[] = [];

    topMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    eastWestMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    southNorthMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    coverageMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    finalMaskCtx.setTransform(1, 0, 0, 1, 0, 0);

    topMaskCtx.globalCompositeOperation = "source-over";
    eastWestMaskCtx.globalCompositeOperation = "source-over";
    southNorthMaskCtx.globalCompositeOperation = "source-over";
    coverageMaskCtx.globalCompositeOperation = "source-over";
    finalMaskCtx.globalCompositeOperation = "source-over";

    topMaskCtx.clearRect(0, 0, width, height);
    eastWestMaskCtx.clearRect(0, 0, width, height);
    southNorthMaskCtx.clearRect(0, 0, width, height);
    coverageMaskCtx.clearRect(0, 0, width, height);
    finalMaskCtx.clearRect(0, 0, width, height);

    for (let ti = 0; ti < piece.triangles.length; ti++) {
      const tri = piece.triangles[ti];
      const targetCtx = tri.semanticBucket === "TOP"
        ? topMaskCtx
        : tri.semanticBucket === "EAST_WEST"
          ? eastWestMaskCtx
          : southNorthMaskCtx;
      const [s0, s1, s2] = tri.srcTriangle;
      const [d0, d1, d2] = tri.dstTriangle;
      drawTexturedTriangle(
        targetCtx,
        piece.sourceImage,
        piece.sourceImageWidth,
        piece.sourceImageHeight,
        s0,
        s1,
        s2,
        { x: d0.x - originX, y: d0.y - originY },
        { x: d1.x - originX, y: d1.y - originY },
        { x: d2.x - originX, y: d2.y - originY },
      );
      const localA = { x: d0.x - originX, y: d0.y - originY };
      const localB = { x: d1.x - originX, y: d1.y - originY };
      const localC = { x: d2.x - originX, y: d2.y - originY };
      if (tri.semanticBucket === "TOP") {
        topLocalPoints.push(localA, localB, localC);
      } else if (tri.semanticBucket === "EAST_WEST") {
        eastWestLocalPoints.push(localA, localB, localC);
      } else {
        southNorthLocalPoints.push(localA, localB, localC);
      }
      trianglesDrawn += 1;
    }

    const shiftedX = offsetX;
    const shiftedY = offsetY;
    const shadowVector = { x: shiftedX, y: shiftedY };
    const eastWestAxis = computeFaceLocalAxisFromFixedIsoDirection(
      eastWestTriangles,
      originX,
      originY,
      STRUCTURE_SHADOW_V5_EAST_WEST_FIXED_AXIS,
    );
    const southNorthAxis = computeFaceLocalAxisFromFixedIsoDirection(
      southNorthTriangles,
      originX,
      originY,
      STRUCTURE_SHADOW_V5_SOUTH_NORTH_FIXED_AXIS,
    );
    const drawTopMaskLocal = (targetCtx: CanvasRenderingContext2D, raw: boolean): void => {
      if (raw) {
        targetCtx.drawImage(topMaskCanvas, 0, 0);
      } else {
        drawMaskTranslated(targetCtx, topMaskCanvas, shadowVector.x, shadowVector.y);
      }
    };
    const drawEastWestMaskLocal = (
      targetCtx: CanvasRenderingContext2D,
      raw: boolean,
    ): V5StripDebugBand[] => {
      if (raw) {
        targetCtx.drawImage(eastWestMaskCanvas, 0, 0);
        return [];
      }
      if (!eastWestAxis) return [];
      return drawMaskHeightDeformedByFaceAxis(
        targetCtx,
        eastWestMaskCanvas,
        eastWestAxis,
        shadowVector,
        STRUCTURE_SHADOW_V5_PIXEL_SLICE_STEP_PX,
      );
    };
    const drawSouthNorthMaskLocal = (
      targetCtx: CanvasRenderingContext2D,
      raw: boolean,
    ): V5StripDebugBand[] => {
      if (raw) {
        targetCtx.drawImage(southNorthMaskCanvas, 0, 0);
        return [];
      }
      if (!southNorthAxis) return [];
      return drawMaskHeightDeformedByFaceAxis(
        targetCtx,
        southNorthMaskCanvas,
        southNorthAxis,
        shadowVector,
        STRUCTURE_SHADOW_V5_PIXEL_SLICE_STEP_PX,
      );
    };
    const drawLocalMaskToWorld = (drawLocal: (targetCtx: CanvasRenderingContext2D) => void): void => {
      ctx.save();
      ctx.translate(originX, originY);
      drawLocal(ctx);
      ctx.restore();
    };

    coverageMaskCtx.clearRect(0, 0, width, height);
    coverageMaskCtx.globalCompositeOperation = "source-over";
    drawTopMaskLocal(coverageMaskCtx, false);
    const eastWestBands = drawEastWestMaskLocal(coverageMaskCtx, false);
    const southNorthBands = drawSouthNorthMaskLocal(coverageMaskCtx, false);

    finalMaskCtx.clearRect(0, 0, width, height);
    if (shadowAlpha > 0) {
      finalMaskCtx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
      finalMaskCtx.fillRect(0, 0, width, height);
      finalMaskCtx.globalCompositeOperation = "destination-in";
      finalMaskCtx.drawImage(coverageMaskCanvas, 0, 0);
      finalMaskCtx.globalCompositeOperation = "source-over";
    }
    const showRawDebugMasks = transformDebugMode === "raw";

    if (debugView === "topMask") {
      drawLocalMaskToWorld((targetCtx) => drawTopMaskLocal(targetCtx, showRawDebugMasks));
    } else if (debugView === "eastWestMask") {
      drawLocalMaskToWorld((targetCtx) => {
        drawEastWestMaskLocal(targetCtx, showRawDebugMasks);
      });
    } else if (debugView === "southNorthMask") {
      drawLocalMaskToWorld((targetCtx) => {
        drawSouthNorthMaskLocal(targetCtx, showRawDebugMasks);
      });
    } else if (debugView === "all") {
      drawLocalMaskToWorld((targetCtx) => {
        drawTopMaskLocal(targetCtx, showRawDebugMasks);
        drawEastWestMaskLocal(targetCtx, showRawDebugMasks);
        drawSouthNorthMaskLocal(targetCtx, showRawDebugMasks);
      });
    } else {
      ctx.drawImage(finalMaskCanvas, originX, originY);
      finalShadowDrawCalls += 1;
    }
    if (anchorDebugEnabled && !anchorDiagnostic) {
      const rawW = Math.max(0, rawBounds.maxX - rawBounds.minX);
      const rawH = Math.max(0, rawBounds.maxY - rawBounds.minY);
      const transformedBounds: MutableBounds = {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      };
      const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
      const includeDisplacedLocalPoints = (
        points: readonly ScreenPt[],
        axis: V5FaceLocalAxis | null,
        fullOffset: boolean,
      ) => {
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const t = fullOffset || !axis || !(axis.faceHeight > 1e-4)
            ? 1
            : clamp01(
              ((p.x - axis.centerBottom.x) * axis.heightDir.x + (p.y - axis.centerBottom.y) * axis.heightDir.y)
                / axis.faceHeight,
            );
          includePointInBounds(transformedBounds, {
            x: originX + p.x + shadowVector.x * t,
            y: originY + p.y + shadowVector.y * t,
          });
        }
      };
      includeDisplacedLocalPoints(topLocalPoints, null, true);
      includeDisplacedLocalPoints(eastWestLocalPoints, eastWestAxis, false);
      includeDisplacedLocalPoints(southNorthLocalPoints, southNorthAxis, false);
      if (!Number.isFinite(transformedBounds.minX)) {
        transformedBounds.minX = rawBounds.minX;
        transformedBounds.minY = rawBounds.minY;
        transformedBounds.maxX = rawBounds.maxX;
        transformedBounds.maxY = rawBounds.maxY;
      }
      const transformedAnchor = { x: piece.maskAnchor.x, y: piece.maskAnchor.y };
      // Verification overlay: raw masks + face-local axis/strip scaffolding for one structure.
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.translate(originX, originY);
      drawTopMaskLocal(ctx, true);
      drawEastWestMaskLocal(ctx, true);
      drawSouthNorthMaskLocal(ctx, true);
      ctx.translate(-originX, -originY);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(80, 220, 255, 0.95)";
      ctx.strokeRect(rawBounds.minX, rawBounds.minY, rawW, rawH);
      ctx.strokeStyle = "rgba(255, 180, 70, 0.95)";
      ctx.strokeRect(
        transformedBounds.minX,
        transformedBounds.minY,
        Math.max(0, transformedBounds.maxX - transformedBounds.minX),
        Math.max(0, transformedBounds.maxY - transformedBounds.minY),
      );
      const drawAnchorPoint = (point: ScreenPt, color: string, label: string) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = "rgba(245, 245, 245, 0.96)";
        ctx.font = "10px monospace";
        ctx.fillText(label, point.x + 4, point.y - 4);
      };
      drawAnchorPoint(piece.maskAnchor, "rgba(70, 220, 255, 0.96)", "mask");
      drawAnchorPoint(piece.buildingAnchor, "rgba(110, 255, 135, 0.96)", "build");
      drawAnchorPoint(transformedAnchor, "rgba(255, 200, 80, 0.98)", "xform");
      drawAnchorPoint(piece.buildingDrawOrigin, "rgba(255, 120, 220, 0.95)", "draw0");
      const drawAxisDebug = (
        axis: V5FaceLocalAxis | null,
        bands: readonly V5StripDebugBand[],
        lineColor: string,
        bandColor: string,
        label: string,
      ) => {
        if (!axis) return;
        const bottom = { x: originX + axis.centerBottom.x, y: originY + axis.centerBottom.y };
        const top = { x: originX + axis.centerTop.x, y: originY + axis.centerTop.y };
        const tangent = { x: -axis.heightDir.y, y: axis.heightDir.x };
        ctx.beginPath();
        ctx.moveTo(bottom.x, bottom.y);
        ctx.lineTo(top.x, top.y);
        ctx.strokeStyle = lineColor;
        ctx.stroke();
        ctx.fillStyle = "rgba(245, 245, 245, 0.96)";
        ctx.fillText(label, bottom.x + 4, bottom.y + 10);
        const span = 24;
        for (let bi = 0; bi < bands.length; bi++) {
          const lower = { x: originX + bands[bi].lowerCenter.x, y: originY + bands[bi].lowerCenter.y };
          const upper = { x: originX + bands[bi].upperCenter.x, y: originY + bands[bi].upperCenter.y };
          ctx.beginPath();
          ctx.moveTo(lower.x - tangent.x * span, lower.y - tangent.y * span);
          ctx.lineTo(lower.x + tangent.x * span, lower.y + tangent.y * span);
          ctx.strokeStyle = bandColor;
          ctx.stroke();
          if (bi === bands.length - 1) {
            ctx.beginPath();
            ctx.moveTo(upper.x - tangent.x * span, upper.y - tangent.y * span);
            ctx.lineTo(upper.x + tangent.x * span, upper.y + tangent.y * span);
            ctx.stroke();
          }
        }
      };
      drawAxisDebug(
        eastWestAxis,
        eastWestBands,
        "rgba(120, 220, 255, 0.95)",
        "rgba(120, 220, 255, 0.38)",
        "EW axis (fixed)",
      );
      drawAxisDebug(
        southNorthAxis,
        southNorthBands,
        "rgba(255, 140, 120, 0.95)",
        "rgba(255, 140, 120, 0.38)",
        "SN axis (fixed)",
      );
      ctx.restore();
      anchorDiagnostic = {
        structureInstanceId: piece.structureInstanceId,
        triangleDestinationSpace: "screen",
        rawBounds: {
          minX: rawBounds.minX,
          minY: rawBounds.minY,
          maxX: rawBounds.maxX,
          maxY: rawBounds.maxY,
        },
        transformedBounds,
        maskCanvasOrigin: { x: originX, y: originY },
        maskAnchor: { x: piece.maskAnchor.x, y: piece.maskAnchor.y },
        buildingDrawOrigin: { x: piece.buildingDrawOrigin.x, y: piece.buildingDrawOrigin.y },
        buildingAnchor: { x: piece.buildingAnchor.x, y: piece.buildingAnchor.y },
        transformedAnchor,
        transformedMaskDrawOrigin: { x: originX + shiftedX, y: originY + shiftedY },
        finalShadowDrawOrigin: { x: originX, y: originY },
        offset: { x: shiftedX, y: shiftedY },
      };
    }
    piecesDrawn += 1;
  }

  return {
    piecesDrawn,
    trianglesDrawn,
    finalShadowDrawCalls,
    anchorDiagnostic,
  };
}
