import { configurePixelPerfect } from "../../../../engine/render/pixelPerfect";
import type { ShadowV6SemanticBucket } from "../../../../settings/settingsTypes";
import { drawTexturedTriangle } from "../renderPrimitives/drawTexturedTriangle";
import {
  buildStructureV6FaceSlices,
  buildStructureV6SliceAxis,
  clampStructureV6SliceCount,
  resolveStructureV6SliceIndex,
  type StructureV6FaceSlice,
  type StructureV6SliceAxis,
} from "../structureShadowV6FaceSlices";
import { getStructureShadowV6FaceScratchContext } from "./structureShadowScratch";
import type { StructureV6ShadowDebugCandidate } from "./structureShadowTypes";

type ScreenPt = { x: number; y: number };

export type StructureV6ExtrudedSliceDebug = {
  slice: StructureV6FaceSlice;
  t: number;
  offsetX: number;
  offsetY: number;
  canvas: HTMLCanvasElement;
  pixelCount: number;
  contentBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
};

export type StructureV6FaceSliceDebugData = {
  structureInstanceId: string;
  zBand: number;
  requestedSemanticBucket: ShadowV6SemanticBucket;
  semanticBucket: ShadowV6SemanticBucket;
  requestedStructureIndex: number;
  selectedStructureIndex: number;
  candidateCount: number;
  sourceTriangleCount: number;
  nonEmptySliceCount: number;
  faceBounds: { minX: number; minY: number; maxX: number; maxY: number };
  faceCanvas: HTMLCanvasElement;
  axis: StructureV6SliceAxis;
  slices: ReadonlyArray<{
    slice: StructureV6FaceSlice;
    canvas: HTMLCanvasElement;
    pixelCount: number;
    contentBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  }>;
  shadowVector: ScreenPt;
  displacedCanvasOrigin: ScreenPt;
  faceCanvasOrigin: ScreenPt;
  mergedShadowDrawOrigin: ScreenPt;
  displacedSlices: readonly StructureV6ExtrudedSliceDebug[];
  displacedSlicesCanvas: HTMLCanvasElement;
  mergedShadowCanvas: HTMLCanvasElement;
};

export type StructureV6FaceSliceCastMode = "baselineToTop" | "constantMax";

export type StructureV6VerticalShadowMaskDebugData = {
  structureInstanceId: string;
  zBand: number;
  requestedSemanticBucket: ShadowV6SemanticBucket;
  requestedStructureIndex: number;
  selectedStructureIndex: number;
  candidateCount: number;
  shadowVector: ScreenPt;
  bucketAShadow: StructureV6FaceSliceDebugData | null;
  bucketBShadow: StructureV6FaceSliceDebugData | null;
  topShadow: StructureV6FaceSliceDebugData | null;
  mergedVerticalShadowDrawOrigin: ScreenPt;
  mergedVerticalShadowCanvas: HTMLCanvasElement;
};

type BuildStructureV6FaceSliceDebugOptions = {
  axisOverride?: StructureV6SliceAxis;
  useSunRelativeAxis?: boolean;
  castMode?: StructureV6FaceSliceCastMode;
  disableSlicing?: boolean;
};

function normalizeScreenVector(v: ScreenPt): ScreenPt {
  const len = Math.hypot(v.x, v.y);
  if (!(len > 1e-6)) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function dotScreenVectors(a: ScreenPt, b: ScreenPt): number {
  return a.x * b.x + a.y * b.y;
}

function perpendicularScreenVector(v: ScreenPt): ScreenPt {
  return { x: v.y, y: -v.x };
}

function buildStructureV6SunRelativeSliceAxis(
  faceWidth: number,
  faceHeight: number,
  shadowVector: ScreenPt,
): StructureV6SliceAxis {
  const width = Math.max(1, Math.ceil(faceWidth));
  const height = Math.max(1, Math.ceil(faceHeight));
  const sliceDir = normalizeScreenVector(shadowVector);
  const sliceNormal = normalizeScreenVector(perpendicularScreenVector(sliceDir));
  const corners: ScreenPt[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  let minT = Number.POSITIVE_INFINITY;
  let maxT = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < corners.length; i++) {
    const t = dotScreenVectors(corners[i], sliceNormal);
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }
  if (!Number.isFinite(minT) || !Number.isFinite(maxT)) {
    minT = 0;
    maxT = 1;
  }
  if (Math.abs(maxT - minT) < 1e-6) maxT = minT + 1;
  return {
    sliceDir,
    sliceNormal,
    minT,
    maxT,
  };
}

export function countStructureV6CandidateTrianglesForBucket(
  candidate: StructureV6ShadowDebugCandidate,
  bucket: ShadowV6SemanticBucket,
): number {
  let count = 0;
  for (let i = 0; i < candidate.triangles.length; i++) {
    if (candidate.triangles[i].semanticBucket === bucket) count += 1;
  }
  return count;
}

function filterStructureV6CandidateForBucket(
  candidate: StructureV6ShadowDebugCandidate,
  bucket: ShadowV6SemanticBucket,
): StructureV6ShadowDebugCandidate {
  const triangles = candidate.triangles.filter((triangle) => triangle.semanticBucket === bucket);
  return {
    structureInstanceId: candidate.structureInstanceId,
    sourceImage: candidate.sourceImage,
    sourceImageWidth: candidate.sourceImageWidth,
    sourceImageHeight: candidate.sourceImageHeight,
    triangles,
    zBand: candidate.zBand,
  };
}

export function buildStructureV6FaceSliceDebugData(
  candidate: StructureV6ShadowDebugCandidate,
  requestedSemanticBucket: ShadowV6SemanticBucket,
  semanticBucket: ShadowV6SemanticBucket,
  requestedStructureIndex: number,
  selectedStructureIndex: number,
  candidateCount: number,
  requestedSliceCount: number,
  shadowVector: ScreenPt,
  options?: BuildStructureV6FaceSliceDebugOptions,
): StructureV6FaceSliceDebugData | null {
  if (candidate.triangles.length <= 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let ti = 0; ti < candidate.triangles.length; ti++) {
    const tri = candidate.triangles[ti].dstTriangle;
    for (let vi = 0; vi < tri.length; vi++) {
      const p = tri[vi];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  const pad = 1;
  const originX = Math.floor(minX) - pad;
  const originY = Math.floor(minY) - pad;
  const width = Math.max(1, Math.ceil(maxX - minX) + pad * 2);
  const height = Math.max(1, Math.ceil(maxY - minY) + pad * 2);
  const scratch = getStructureShadowV6FaceScratchContext(width, height);
  if (!scratch) return null;
  const faceCtx = scratch.ctx;
  faceCtx.setTransform(1, 0, 0, 1, 0, 0);
  faceCtx.globalAlpha = 1;
  faceCtx.globalCompositeOperation = "source-over";
  faceCtx.clearRect(0, 0, width, height);
  for (let ti = 0; ti < candidate.triangles.length; ti++) {
    const tri = candidate.triangles[ti];
    const [s0, s1, s2] = tri.srcTriangle;
    const [d0, d1, d2] = tri.dstTriangle;
    drawTexturedTriangle(
      faceCtx,
      candidate.sourceImage,
      candidate.sourceImageWidth,
      candidate.sourceImageHeight,
      s0,
      s1,
      s2,
      { x: d0.x - originX, y: d0.y - originY },
      { x: d1.x - originX, y: d1.y - originY },
      { x: d2.x - originX, y: d2.y - originY },
    );
  }
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = width;
  faceCanvas.height = height;
  const faceCanvasCtx = faceCanvas.getContext("2d");
  if (!faceCanvasCtx) return null;
  configurePixelPerfect(faceCanvasCtx);
  faceCanvasCtx.imageSmoothingEnabled = false;
  faceCanvasCtx.clearRect(0, 0, width, height);
  faceCanvasCtx.drawImage(scratch.canvas, 0, 0);

  const axis = options?.axisOverride
    ?? (options?.useSunRelativeAxis
      ? buildStructureV6SunRelativeSliceAxis(width, height, shadowVector)
      : buildStructureV6SliceAxis(width, height, semanticBucket));
  const castMode = options?.castMode ?? "baselineToTop";
  const disableSlicing = options?.disableSlicing === true;
  if (disableSlicing) {
    const offsetX = shadowVector.x;
    const offsetY = shadowVector.y;
    const displacedMinX = Math.min(0, offsetX);
    const displacedMinY = Math.min(0, offsetY);
    const displacedMaxX = Math.max(width, width + offsetX);
    const displacedMaxY = Math.max(height, height + offsetY);
    const displacedPad = 1;
    const displacedOriginX = Math.floor(displacedMinX) - displacedPad;
    const displacedOriginY = Math.floor(displacedMinY) - displacedPad;
    const displacedWidth = Math.max(1, Math.ceil(displacedMaxX - displacedMinX) + displacedPad * 2);
    const displacedHeight = Math.max(1, Math.ceil(displacedMaxY - displacedMinY) + displacedPad * 2);
    const displacedSlicesCanvas = document.createElement("canvas");
    displacedSlicesCanvas.width = displacedWidth;
    displacedSlicesCanvas.height = displacedHeight;
    const displacedSlicesCtx = displacedSlicesCanvas.getContext("2d");
    if (!displacedSlicesCtx) return null;
    configurePixelPerfect(displacedSlicesCtx);
    displacedSlicesCtx.imageSmoothingEnabled = false;
    displacedSlicesCtx.clearRect(0, 0, displacedWidth, displacedHeight);
    displacedSlicesCtx.drawImage(
      faceCanvas,
      Math.round(offsetX - displacedOriginX),
      Math.round(offsetY - displacedOriginY),
    );
    const mergedShadowCanvas = document.createElement("canvas");
    mergedShadowCanvas.width = displacedWidth;
    mergedShadowCanvas.height = displacedHeight;
    const mergedShadowCtx = mergedShadowCanvas.getContext("2d");
    if (!mergedShadowCtx) return null;
    configurePixelPerfect(mergedShadowCtx);
    mergedShadowCtx.imageSmoothingEnabled = false;
    mergedShadowCtx.clearRect(0, 0, displacedWidth, displacedHeight);
    mergedShadowCtx.drawImage(displacedSlicesCanvas, 0, 0);
    mergedShadowCtx.globalCompositeOperation = "source-in";
    mergedShadowCtx.fillStyle = "rgba(0,0,0,0.78)";
    mergedShadowCtx.fillRect(0, 0, displacedWidth, displacedHeight);
    mergedShadowCtx.globalCompositeOperation = "source-over";
    return {
      structureInstanceId: candidate.structureInstanceId,
      zBand: candidate.zBand,
      requestedSemanticBucket,
      semanticBucket,
      requestedStructureIndex,
      selectedStructureIndex,
      candidateCount,
      sourceTriangleCount: candidate.triangles.length,
      nonEmptySliceCount: candidate.triangles.length > 0 ? 1 : 0,
      faceBounds: { minX, minY, maxX, maxY },
      faceCanvas,
      axis,
      slices: [],
      shadowVector,
      displacedCanvasOrigin: { x: displacedOriginX, y: displacedOriginY },
      faceCanvasOrigin: { x: originX, y: originY },
      mergedShadowDrawOrigin: { x: originX + displacedOriginX, y: originY + displacedOriginY },
      displacedSlices: [],
      displacedSlicesCanvas,
      mergedShadowCanvas,
    };
  }
  const sliceCount = clampStructureV6SliceCount(requestedSliceCount);
  const sliceDefs = buildStructureV6FaceSlices(axis, sliceCount);
  const sourceImageData = faceCtx.getImageData(0, 0, width, height);
  const source = sourceImageData.data;
  const perSliceData: Uint8ClampedArray[] = new Array(sliceDefs.length);
  const perSlicePixelCounts: number[] = new Array(sliceDefs.length);
  const perSliceBounds: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = new Array(sliceDefs.length);
  for (let i = 0; i < sliceDefs.length; i++) {
    perSliceData[i] = new Uint8ClampedArray(source.length);
    perSlicePixelCounts[i] = 0;
    perSliceBounds[i] = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) << 2;
      const alpha = source[pixelIndex + 3] | 0;
      if (alpha <= 0) continue;
      const sliceIndex = resolveStructureV6SliceIndex(
        x + 0.5,
        y + 0.5,
        axis,
        sliceDefs.length,
      );
      const out = perSliceData[sliceIndex];
      out[pixelIndex] = source[pixelIndex];
      out[pixelIndex + 1] = source[pixelIndex + 1];
      out[pixelIndex + 2] = source[pixelIndex + 2];
      out[pixelIndex + 3] = source[pixelIndex + 3];
      perSlicePixelCounts[sliceIndex] += 1;
      const bounds = perSliceBounds[sliceIndex];
      if (x < bounds.minX) bounds.minX = x;
      if (y < bounds.minY) bounds.minY = y;
      if (x > bounds.maxX) bounds.maxX = x;
      if (y > bounds.maxY) bounds.maxY = y;
    }
  }
  const slices = sliceDefs.map((slice, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      configurePixelPerfect(ctx);
      ctx.imageSmoothingEnabled = false;
      const imageData = ctx.createImageData(width, height);
      imageData.data.set(perSliceData[index]);
      ctx.putImageData(imageData, 0, 0);
    }
    return {
      slice,
      canvas,
      pixelCount: perSlicePixelCounts[index],
      contentBounds: perSlicePixelCounts[index] > 0
        ? {
            minX: perSliceBounds[index].minX,
            minY: perSliceBounds[index].minY,
            maxX: perSliceBounds[index].maxX,
            maxY: perSliceBounds[index].maxY,
          }
        : null,
    };
  });
  const nonEmptySlices = slices.filter((sliceEntry) => sliceEntry.pixelCount > 0);
  const castSlices = nonEmptySlices.length > 0 ? nonEmptySlices : slices;
  const sliceDenominator = Math.max(1, castSlices.length - 1);
  const displacedSlices: StructureV6ExtrudedSliceDebug[] = new Array(castSlices.length);
  let displacedMinX = 0;
  let displacedMinY = 0;
  let displacedMaxX = width;
  let displacedMaxY = height;
  for (let i = 0; i < castSlices.length; i++) {
    const t = castMode === "constantMax"
      ? 1
      : castSlices.length <= 1
        ? 0
        : i / sliceDenominator;
    const offsetX = shadowVector.x * t;
    const offsetY = shadowVector.y * t;
    const sliceEntry = castSlices[i];
    displacedSlices[i] = {
      slice: sliceEntry.slice,
      t,
      offsetX,
      offsetY,
      canvas: sliceEntry.canvas,
      pixelCount: sliceEntry.pixelCount,
      contentBounds: sliceEntry.contentBounds,
    };
    const content = sliceEntry.contentBounds;
    if (!content) continue;
    const minXWithOffset = content.minX + offsetX;
    const minYWithOffset = content.minY + offsetY;
    const maxXWithOffset = content.maxX + 1 + offsetX;
    const maxYWithOffset = content.maxY + 1 + offsetY;
    if (minXWithOffset < displacedMinX) displacedMinX = minXWithOffset;
    if (minYWithOffset < displacedMinY) displacedMinY = minYWithOffset;
    if (maxXWithOffset > displacedMaxX) displacedMaxX = maxXWithOffset;
    if (maxYWithOffset > displacedMaxY) displacedMaxY = maxYWithOffset;
  }
  const displacedPad = 1;
  const displacedOriginX = Math.floor(displacedMinX) - displacedPad;
  const displacedOriginY = Math.floor(displacedMinY) - displacedPad;
  const displacedWidth = Math.max(1, Math.ceil(displacedMaxX - displacedMinX) + displacedPad * 2);
  const displacedHeight = Math.max(1, Math.ceil(displacedMaxY - displacedMinY) + displacedPad * 2);
  const displacedSlicesCanvas = document.createElement("canvas");
  displacedSlicesCanvas.width = displacedWidth;
  displacedSlicesCanvas.height = displacedHeight;
  const displacedSlicesCtx = displacedSlicesCanvas.getContext("2d");
  if (!displacedSlicesCtx) return null;
  configurePixelPerfect(displacedSlicesCtx);
  displacedSlicesCtx.imageSmoothingEnabled = false;
  displacedSlicesCtx.clearRect(0, 0, displacedWidth, displacedHeight);
  for (let i = 0; i < displacedSlices.length; i++) {
    const sliceEntry = displacedSlices[i];
    if (!sliceEntry.contentBounds) continue;
    displacedSlicesCtx.drawImage(
      sliceEntry.canvas,
      Math.round(sliceEntry.offsetX - displacedOriginX),
      Math.round(sliceEntry.offsetY - displacedOriginY),
    );
  }
  const mergedShadowCanvas = document.createElement("canvas");
  mergedShadowCanvas.width = displacedWidth;
  mergedShadowCanvas.height = displacedHeight;
  const mergedShadowCtx = mergedShadowCanvas.getContext("2d");
  if (!mergedShadowCtx) return null;
  configurePixelPerfect(mergedShadowCtx);
  mergedShadowCtx.imageSmoothingEnabled = false;
  mergedShadowCtx.clearRect(0, 0, displacedWidth, displacedHeight);
  mergedShadowCtx.drawImage(displacedSlicesCanvas, 0, 0);
  mergedShadowCtx.globalCompositeOperation = "source-in";
  mergedShadowCtx.fillStyle = "rgba(0,0,0,0.78)";
  mergedShadowCtx.fillRect(0, 0, displacedWidth, displacedHeight);
  mergedShadowCtx.globalCompositeOperation = "source-over";
  return {
    structureInstanceId: candidate.structureInstanceId,
    zBand: candidate.zBand,
    requestedSemanticBucket,
    semanticBucket,
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    sourceTriangleCount: candidate.triangles.length,
    nonEmptySliceCount: nonEmptySlices.length,
    faceBounds: { minX, minY, maxX, maxY },
    faceCanvas,
    axis,
    slices,
    shadowVector,
    displacedCanvasOrigin: { x: displacedOriginX, y: displacedOriginY },
    faceCanvasOrigin: { x: originX, y: originY },
    mergedShadowDrawOrigin: { x: originX + displacedOriginX, y: originY + displacedOriginY },
    displacedSlices,
    displacedSlicesCanvas,
    mergedShadowCanvas,
  };
}

export function buildStructureV6VerticalShadowMaskDebugData(
  candidate: StructureV6ShadowDebugCandidate,
  requestedSemanticBucket: ShadowV6SemanticBucket,
  requestedStructureIndex: number,
  selectedStructureIndex: number,
  candidateCount: number,
  requestedSliceCount: number,
  shadowVector: ScreenPt,
): StructureV6VerticalShadowMaskDebugData | null {
  const bucketAShadow = buildStructureV6FaceSliceDebugData(
    filterStructureV6CandidateForBucket(candidate, "EAST_WEST"),
    requestedSemanticBucket,
    "EAST_WEST",
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    requestedSliceCount,
    shadowVector,
  );
  const bucketBShadow = buildStructureV6FaceSliceDebugData(
    filterStructureV6CandidateForBucket(candidate, "SOUTH_NORTH"),
    requestedSemanticBucket,
    "SOUTH_NORTH",
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    requestedSliceCount,
    shadowVector,
  );
  const topSource = filterStructureV6CandidateForBucket(candidate, "TOP");
  const topShadow = buildStructureV6FaceSliceDebugData(
    topSource,
    requestedSemanticBucket,
    "TOP",
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    requestedSliceCount,
    shadowVector,
    {
      disableSlicing: true,
    },
  );
  if (!bucketAShadow && !bucketBShadow && !topShadow) return null;

  const bucketShadows = [bucketAShadow, bucketBShadow, topShadow].filter(
    (entry): entry is StructureV6FaceSliceDebugData => entry !== null,
  );
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < bucketShadows.length; i++) {
    const bucket = bucketShadows[i];
    const drawX = bucket.mergedShadowDrawOrigin.x;
    const drawY = bucket.mergedShadowDrawOrigin.y;
    minX = Math.min(minX, drawX);
    minY = Math.min(minY, drawY);
    maxX = Math.max(maxX, drawX + bucket.displacedSlicesCanvas.width);
    maxY = Math.max(maxY, drawY + bucket.displacedSlicesCanvas.height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  const mergedPad = 1;
  const mergedOriginX = Math.floor(minX) - mergedPad;
  const mergedOriginY = Math.floor(minY) - mergedPad;
  const mergedWidth = Math.max(1, Math.ceil(maxX - minX) + mergedPad * 2);
  const mergedHeight = Math.max(1, Math.ceil(maxY - minY) + mergedPad * 2);
  const mergedVerticalShadowCanvas = document.createElement("canvas");
  mergedVerticalShadowCanvas.width = mergedWidth;
  mergedVerticalShadowCanvas.height = mergedHeight;
  const mergedVerticalShadowCtx = mergedVerticalShadowCanvas.getContext("2d");
  if (!mergedVerticalShadowCtx) return null;
  configurePixelPerfect(mergedVerticalShadowCtx);
  mergedVerticalShadowCtx.imageSmoothingEnabled = false;
  mergedVerticalShadowCtx.clearRect(0, 0, mergedWidth, mergedHeight);
  for (let i = 0; i < bucketShadows.length; i++) {
    const bucket = bucketShadows[i];
    mergedVerticalShadowCtx.drawImage(
      bucket.displacedSlicesCanvas,
      Math.round(bucket.mergedShadowDrawOrigin.x - mergedOriginX),
      Math.round(bucket.mergedShadowDrawOrigin.y - mergedOriginY),
    );
  }
  // Tint once after unioning coverage so overlapping buckets do not add extra darkness.
  mergedVerticalShadowCtx.globalCompositeOperation = "source-in";
  mergedVerticalShadowCtx.fillStyle = "rgba(0,0,0,0.78)";
  mergedVerticalShadowCtx.fillRect(0, 0, mergedWidth, mergedHeight);
  mergedVerticalShadowCtx.globalCompositeOperation = "source-over";

  return {
    structureInstanceId: candidate.structureInstanceId,
    zBand: candidate.zBand,
    requestedSemanticBucket,
    requestedStructureIndex,
    selectedStructureIndex,
    candidateCount,
    shadowVector,
    bucketAShadow,
    bucketBShadow,
    topShadow,
    mergedVerticalShadowDrawOrigin: { x: mergedOriginX, y: mergedOriginY },
    mergedVerticalShadowCanvas,
  };
}
