import type { CacheMetricsSnapshot } from "./cacheMetricsRegistry";
import { sampleCacheMetricsRegistry } from "./cacheMetricsRegistry";

type FrameCounters = {
  drawImageCalls: number;
  drawImageByTag: Record<DrawTag, number>;
  gradientCreateCalls: number;
  addColorStopCalls: number;
  saveCalls: number;
  saveByTag: Record<DrawTag, number>;
  restoreCalls: number;
  restoreByTag: Record<DrawTag, number>;
  closuresCreated: number;
  sliceKeySorts: number;
  drawableSorts: number;
  fullCanvasBlits: number;
  tileLoopIterations: number;
  tileLoopRadius: number;
  groundStaticSurfaceExamined: number;
  groundStaticSurfaceAuthorityFiltered: number;
  groundStaticSurfaceFallbackEmitted: number;
  groundStaticDecalExamined: number;
  groundStaticDecalAuthorityFiltered: number;
  groundStaticDecalFallbackEmitted: number;
  structureTotalSubmissions: number;
  structureRectMeshSubmissions: number;
  structureRectMeshMigratedToQuad: number;
  structureMonolithicGroupSubmissions: number;
  structureMonolithicTriangles: number;
  structureSingleQuadSubmissions: number;
  structureQuadApproxAccepted: number;
  structureQuadApproxRejected: number;
  structureTrianglesSubmitted: number;
  structureEstimatedTrianglesAvoided: number;
  zBandCount: number;
  lightBandCount: number;
  maskBuilds: number;
  maskCacheHits: number;
  maskCacheMisses: number;
  maskRasterChunks: number;
  maskDrawEntries: number;
  backendWebglCommands: number;
  backendCanvasFallbackCommands: number;
  backendUnsupportedCommands: number;
  backendWebglGroundCommands: number;
  backendUnsupportedGroundCommands: number;
  backendRequested: "canvas2d" | "webgl";
  backendSelected: "canvas2d" | "webgl";
  backendDefault: "canvas2d" | "webgl";
  backendWebglReadyForDefault: boolean;
  backendFallbackReason: string | null;
  backendUnsupportedCommandKeys: string[];
  backendWebglByAxes: Record<string, number>;
  backendCanvasFallbackByAxes: Record<string, number>;
  backendUnsupportedByAxes: Record<string, number>;
  backendUnsupportedBySemanticFamily: Record<string, number>;
  backendPartiallyHandledAxes: string[];
  webglDrawCalls: number;
  webglBatches: number;
  webglTextureBinds: number;
  webglBufferUploads: number;
  webglCanvasComposites: number;
  webglProjectedSurfaceDraws: number;
  webglTrianglesSubmitted: number;
  webglUniqueTextures: number;
  webglGroundChunkDraws: number;
  webglGroundChunksVisible: number;
  webglGroundChunkTextureUploads: number;
  canvasGroundChunkDraws: number;
  canvasGroundChunksVisible: number;
  canvasGroundChunkRebuilds: number;
  staticAtlasRequests: number;
  staticAtlasHits: number;
  staticAtlasMisses: number;
  staticAtlasBypasses: number;
  staticAtlasFallbacks: number;
  staticAtlasTextures: number;
  dynamicAtlasRequests: number;
  dynamicAtlasHits: number;
  dynamicAtlasMisses: number;
  dynamicAtlasBypasses: number;
  dynamicAtlasFallbacks: number;
  dynamicAtlasTextures: number;
};

type Snapshot = {
  drawImageCallsPerFrame: number;
  drawImageByTagPerFrame: Record<DrawTag, number>;
  gradientCreateCallsPerFrame: number;
  addColorStopCallsPerFrame: number;
  saveCallsPerFrame: number;
  saveByTagPerFrame: Record<DrawTag, number>;
  restoreCallsPerFrame: number;
  restoreByTagPerFrame: Record<DrawTag, number>;
  closuresCreatedPerFrame: number;
  sliceKeySortsPerFrame: number;
  drawableSortsPerFrame: number;
  fullCanvasBlitsPerFrame: number;
  tileLoopIterationsPerFrame: number;
  tileLoopRadius: number;
  groundStaticSurfaceExaminedPerFrame: number;
  groundStaticSurfaceAuthorityFilteredPerFrame: number;
  groundStaticSurfaceFallbackEmittedPerFrame: number;
  groundStaticDecalExaminedPerFrame: number;
  groundStaticDecalAuthorityFilteredPerFrame: number;
  groundStaticDecalFallbackEmittedPerFrame: number;
  structureTotalSubmissionsPerFrame: number;
  structureRectMeshSubmissionsPerFrame: number;
  structureRectMeshMigratedToQuadPerFrame: number;
  structureMonolithicGroupSubmissionsPerFrame: number;
  structureMonolithicTrianglesPerFrame: number;
  structureSingleQuadSubmissionsPerFrame: number;
  structureQuadApproxAcceptedPerFrame: number;
  structureQuadApproxRejectedPerFrame: number;
  structureTrianglesSubmittedPerFrame: number;
  structureEstimatedTrianglesAvoidedPerFrame: number;
  zBandCountPerFrame: number;
  lightBandCountPerFrame: number;
  maskBuildsPerFrame: number;
  maskCacheHitsPerFrame: number;
  maskCacheMissesPerFrame: number;
  maskRasterChunksPerFrame: number;
  maskDrawEntriesPerFrame: number;
  backendWebglCommandsPerFrame: number;
  backendCanvasFallbackCommandsPerFrame: number;
  backendUnsupportedCommandsPerFrame: number;
  backendWebglGroundCommandsPerFrame: number;
  backendUnsupportedGroundCommandsPerFrame: number;
  backendRequested: "canvas2d" | "webgl";
  backendSelected: "canvas2d" | "webgl";
  backendDefault: "canvas2d" | "webgl";
  backendWebglReadyForDefault: boolean;
  backendFallbackReason: string | null;
  backendUnsupportedCommandKeys: string[];
  backendWebglByAxesPerFrame: Record<string, number>;
  backendCanvasFallbackByAxesPerFrame: Record<string, number>;
  backendUnsupportedByAxesPerFrame: Record<string, number>;
  backendUnsupportedBySemanticFamilyPerFrame: Record<string, number>;
  backendPartiallyHandledAxes: string[];
  webglDrawCallsPerFrame: number;
  webglBatchesPerFrame: number;
  webglTextureBindsPerFrame: number;
  webglBufferUploadsPerFrame: number;
  webglCanvasCompositesPerFrame: number;
  webglProjectedSurfaceDrawsPerFrame: number;
  webglTrianglesSubmittedPerFrame: number;
  webglUniqueTexturesPerFrame: number;
  webglGroundChunkDrawsPerFrame: number;
  webglGroundChunksVisiblePerFrame: number;
  webglGroundChunkTextureUploadsPerFrame: number;
  canvasGroundChunkDrawsPerFrame: number;
  canvasGroundChunksVisiblePerFrame: number;
  canvasGroundChunkRebuildsPerFrame: number;
  staticAtlasRequestsPerFrame: number;
  staticAtlasHitsPerFrame: number;
  staticAtlasMissesPerFrame: number;
  staticAtlasBypassesPerFrame: number;
  staticAtlasFallbacksPerFrame: number;
  staticAtlasTexturesPerFrame: number;
  dynamicAtlasRequestsPerFrame: number;
  dynamicAtlasHitsPerFrame: number;
  dynamicAtlasMissesPerFrame: number;
  dynamicAtlasBypassesPerFrame: number;
  dynamicAtlasFallbacksPerFrame: number;
  dynamicAtlasTexturesPerFrame: number;
  cacheMetrics: CacheMetricsSnapshot;
};

export type DrawTag =
  | "untagged"
  | "void"
  | "floors"
  | "decals"
  | "entities"
  | "structures:live"
  | "structures:shadow"
  | "mask:building"
  | "mask:shadow"
  | "lighting";

const DRAW_TAGS: DrawTag[] = [
  "untagged",
  "void",
  "floors",
  "decals",
  "entities",
  "structures:live",
  "structures:shadow",
  "mask:building",
  "mask:shadow",
  "lighting",
];

function makeZeroByTag(): Record<DrawTag, number> {
  return {
    untagged: 0,
    void: 0,
    floors: 0,
    decals: 0,
    entities: 0,
    "structures:live": 0,
    "structures:shadow": 0,
    "mask:building": 0,
    "mask:shadow": 0,
    lighting: 0,
  };
}

const ZERO_FRAME: FrameCounters = {
  drawImageCalls: 0,
  drawImageByTag: makeZeroByTag(),
  gradientCreateCalls: 0,
  addColorStopCalls: 0,
  saveCalls: 0,
  saveByTag: makeZeroByTag(),
  restoreCalls: 0,
  restoreByTag: makeZeroByTag(),
  closuresCreated: 0,
  sliceKeySorts: 0,
  drawableSorts: 0,
  fullCanvasBlits: 0,
  tileLoopIterations: 0,
  tileLoopRadius: 0,
  groundStaticSurfaceExamined: 0,
  groundStaticSurfaceAuthorityFiltered: 0,
  groundStaticSurfaceFallbackEmitted: 0,
  groundStaticDecalExamined: 0,
  groundStaticDecalAuthorityFiltered: 0,
  groundStaticDecalFallbackEmitted: 0,
  structureTotalSubmissions: 0,
  structureRectMeshSubmissions: 0,
  structureRectMeshMigratedToQuad: 0,
  structureMonolithicGroupSubmissions: 0,
  structureMonolithicTriangles: 0,
  structureSingleQuadSubmissions: 0,
  structureQuadApproxAccepted: 0,
  structureQuadApproxRejected: 0,
  structureTrianglesSubmitted: 0,
  structureEstimatedTrianglesAvoided: 0,
  zBandCount: 0,
  lightBandCount: 0,
  maskBuilds: 0,
  maskCacheHits: 0,
  maskCacheMisses: 0,
  maskRasterChunks: 0,
  maskDrawEntries: 0,
  backendWebglCommands: 0,
  backendCanvasFallbackCommands: 0,
  backendUnsupportedCommands: 0,
  backendWebglGroundCommands: 0,
  backendUnsupportedGroundCommands: 0,
  backendRequested: "canvas2d",
  backendSelected: "canvas2d",
  backendDefault: "canvas2d",
  backendWebglReadyForDefault: false,
  backendFallbackReason: null,
  backendUnsupportedCommandKeys: [],
  backendWebglByAxes: {},
  backendCanvasFallbackByAxes: {},
  backendUnsupportedByAxes: {},
  backendUnsupportedBySemanticFamily: {},
  backendPartiallyHandledAxes: [],
  webglDrawCalls: 0,
  webglBatches: 0,
  webglTextureBinds: 0,
  webglBufferUploads: 0,
  webglCanvasComposites: 0,
  webglProjectedSurfaceDraws: 0,
  webglTrianglesSubmitted: 0,
  webglUniqueTextures: 0,
  webglGroundChunkDraws: 0,
  webglGroundChunksVisible: 0,
  webglGroundChunkTextureUploads: 0,
  canvasGroundChunkDraws: 0,
  canvasGroundChunksVisible: 0,
  canvasGroundChunkRebuilds: 0,
  staticAtlasRequests: 0,
  staticAtlasHits: 0,
  staticAtlasMisses: 0,
  staticAtlasBypasses: 0,
  staticAtlasFallbacks: 0,
  staticAtlasTextures: 0,
  dynamicAtlasRequests: 0,
  dynamicAtlasHits: 0,
  dynamicAtlasMisses: 0,
  dynamicAtlasBypasses: 0,
  dynamicAtlasFallbacks: 0,
  dynamicAtlasTextures: 0,
};

function makeZeroFrame(): FrameCounters {
  return {
    ...ZERO_FRAME,
    drawImageByTag: makeZeroByTag(),
    saveByTag: makeZeroByTag(),
    restoreByTag: makeZeroByTag(),
    backendUnsupportedCommandKeys: [],
    backendWebglByAxes: {},
    backendCanvasFallbackByAxes: {},
    backendUnsupportedByAxes: {},
    backendUnsupportedBySemanticFamily: {},
    backendPartiallyHandledAxes: [],
  };
}

let hooksInstalled = false;
let enabled = true;
let viewportW = 0;
let viewportH = 0;
let frame: FrameCounters = makeZeroFrame();
let accum: FrameCounters = makeZeroFrame();
let framesAccum = 0;
let lastReportSec = -1;
let webglUniqueTextureSet: WeakSet<object> = new WeakSet();

let snapshot: Snapshot = {
  drawImageCallsPerFrame: 0,
  drawImageByTagPerFrame: makeZeroByTag(),
  gradientCreateCallsPerFrame: 0,
  addColorStopCallsPerFrame: 0,
  saveCallsPerFrame: 0,
  saveByTagPerFrame: makeZeroByTag(),
  restoreCallsPerFrame: 0,
  restoreByTagPerFrame: makeZeroByTag(),
  closuresCreatedPerFrame: 0,
  sliceKeySortsPerFrame: 0,
  drawableSortsPerFrame: 0,
  fullCanvasBlitsPerFrame: 0,
  tileLoopIterationsPerFrame: 0,
  tileLoopRadius: 0,
  groundStaticSurfaceExaminedPerFrame: 0,
  groundStaticSurfaceAuthorityFilteredPerFrame: 0,
  groundStaticSurfaceFallbackEmittedPerFrame: 0,
  groundStaticDecalExaminedPerFrame: 0,
  groundStaticDecalAuthorityFilteredPerFrame: 0,
  groundStaticDecalFallbackEmittedPerFrame: 0,
  structureTotalSubmissionsPerFrame: 0,
  structureRectMeshSubmissionsPerFrame: 0,
  structureRectMeshMigratedToQuadPerFrame: 0,
  structureMonolithicGroupSubmissionsPerFrame: 0,
  structureMonolithicTrianglesPerFrame: 0,
  structureSingleQuadSubmissionsPerFrame: 0,
  structureQuadApproxAcceptedPerFrame: 0,
  structureQuadApproxRejectedPerFrame: 0,
  structureTrianglesSubmittedPerFrame: 0,
  structureEstimatedTrianglesAvoidedPerFrame: 0,
  zBandCountPerFrame: 0,
  lightBandCountPerFrame: 0,
  maskBuildsPerFrame: 0,
  maskCacheHitsPerFrame: 0,
  maskCacheMissesPerFrame: 0,
  maskRasterChunksPerFrame: 0,
  maskDrawEntriesPerFrame: 0,
  backendWebglCommandsPerFrame: 0,
  backendCanvasFallbackCommandsPerFrame: 0,
  backendUnsupportedCommandsPerFrame: 0,
  backendWebglGroundCommandsPerFrame: 0,
  backendUnsupportedGroundCommandsPerFrame: 0,
  backendRequested: "canvas2d",
  backendSelected: "canvas2d",
  backendDefault: "canvas2d",
  backendWebglReadyForDefault: false,
  backendFallbackReason: null,
  backendUnsupportedCommandKeys: [],
  backendWebglByAxesPerFrame: {},
  backendCanvasFallbackByAxesPerFrame: {},
  backendUnsupportedByAxesPerFrame: {},
  backendUnsupportedBySemanticFamilyPerFrame: {},
  backendPartiallyHandledAxes: [],
  webglDrawCallsPerFrame: 0,
  webglBatchesPerFrame: 0,
  webglTextureBindsPerFrame: 0,
  webglBufferUploadsPerFrame: 0,
  webglCanvasCompositesPerFrame: 0,
  webglProjectedSurfaceDrawsPerFrame: 0,
  webglTrianglesSubmittedPerFrame: 0,
  webglUniqueTexturesPerFrame: 0,
  webglGroundChunkDrawsPerFrame: 0,
  webglGroundChunksVisiblePerFrame: 0,
  webglGroundChunkTextureUploadsPerFrame: 0,
  canvasGroundChunkDrawsPerFrame: 0,
  canvasGroundChunksVisiblePerFrame: 0,
  canvasGroundChunkRebuildsPerFrame: 0,
  staticAtlasRequestsPerFrame: 0,
  staticAtlasHitsPerFrame: 0,
  staticAtlasMissesPerFrame: 0,
  staticAtlasBypassesPerFrame: 0,
  staticAtlasFallbacksPerFrame: 0,
  staticAtlasTexturesPerFrame: 0,
  dynamicAtlasRequestsPerFrame: 0,
  dynamicAtlasHitsPerFrame: 0,
  dynamicAtlasMissesPerFrame: 0,
  dynamicAtlasBypassesPerFrame: 0,
  dynamicAtlasFallbacksPerFrame: 0,
  dynamicAtlasTexturesPerFrame: 0,
  cacheMetrics: {
    caches: [],
    totalEntries: 0,
    totalKnownBytes: 0,
    totalHits: 0,
    totalMisses: 0,
    totalInserts: 0,
    totalEvictions: 0,
    totalClears: 0,
    totalBudgetBytes: 0,
  },
};

function mergeCountMaps(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function divideCountMap(source: Record<string, number>, denom: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) out[key] = value / denom;
  return out;
}

let currentDrawTag: DrawTag = "untagged";

function resetFrameCounters(): void {
  frame = makeZeroFrame();
  currentDrawTag = "untagged";
  webglUniqueTextureSet = new WeakSet();
}

function installHooks(): void {
  if (hooksInstalled) return;
  if (typeof CanvasRenderingContext2D === "undefined") return;
  hooksInstalled = true;

  const proto = CanvasRenderingContext2D.prototype as any;
  const gradProto = (globalThis as any).CanvasGradient?.prototype as any;

  const origDrawImage = proto.drawImage;
  const origSave = proto.save;
  const origRestore = proto.restore;
  const origCreateRadialGradient = proto.createRadialGradient;
  const origCreateLinearGradient = proto.createLinearGradient;

  proto.drawImage = function drawImagePatched(...args: any[]) {
    if (!enabled) return origDrawImage.apply(this, args);
    frame.drawImageCalls += 1;
    frame.drawImageByTag[currentDrawTag] += 1;
    const src = args[0] as { width?: number; height?: number } | undefined;
    if (src && typeof src.width === "number" && typeof src.height === "number") {
      if (
        viewportW > 0 &&
        viewportH > 0 &&
        Math.abs(src.width - viewportW) <= 1 &&
        Math.abs(src.height - viewportH) <= 1
      ) {
        frame.fullCanvasBlits += 1;
      }
    }
    return origDrawImage.apply(this, args);
  };

  proto.save = function savePatched(...args: any[]) {
    if (!enabled) return origSave.apply(this, args);
    frame.saveCalls += 1;
    frame.saveByTag[currentDrawTag] += 1;
    return origSave.apply(this, args);
  };

  proto.restore = function restorePatched(...args: any[]) {
    if (!enabled) return origRestore.apply(this, args);
    frame.restoreCalls += 1;
    frame.restoreByTag[currentDrawTag] += 1;
    return origRestore.apply(this, args);
  };

  proto.createRadialGradient = function createRadialGradientPatched(...args: any[]) {
    if (!enabled) return origCreateRadialGradient.apply(this, args);
    frame.gradientCreateCalls += 1;
    return origCreateRadialGradient.apply(this, args);
  };

  proto.createLinearGradient = function createLinearGradientPatched(...args: any[]) {
    if (!enabled) return origCreateLinearGradient.apply(this, args);
    frame.gradientCreateCalls += 1;
    return origCreateLinearGradient.apply(this, args);
  };

  if (gradProto && typeof gradProto.addColorStop === "function") {
    const origAddColorStop = gradProto.addColorStop;
    gradProto.addColorStop = function addColorStopPatched(...args: any[]) {
      if (!enabled) return origAddColorStop.apply(this, args);
      frame.addColorStopCalls += 1;
      return origAddColorStop.apply(this, args);
    };
  }
}

function foldCurrentFrame(nowSec: number): void {
  snapshot = {
    ...snapshot,
    backendWebglCommandsPerFrame: frame.backendWebglCommands,
    backendCanvasFallbackCommandsPerFrame: frame.backendCanvasFallbackCommands,
    backendUnsupportedCommandsPerFrame: frame.backendUnsupportedCommands,
    backendWebglGroundCommandsPerFrame: frame.backendWebglGroundCommands,
    backendUnsupportedGroundCommandsPerFrame: frame.backendUnsupportedGroundCommands,
    backendRequested: frame.backendRequested,
    backendSelected: frame.backendSelected,
    backendDefault: frame.backendDefault,
    backendWebglReadyForDefault: frame.backendWebglReadyForDefault,
    backendFallbackReason: frame.backendFallbackReason,
    backendUnsupportedCommandKeys: [...frame.backendUnsupportedCommandKeys],
    backendWebglByAxesPerFrame: { ...frame.backendWebglByAxes },
    backendCanvasFallbackByAxesPerFrame: { ...frame.backendCanvasFallbackByAxes },
    backendUnsupportedByAxesPerFrame: { ...frame.backendUnsupportedByAxes },
    backendUnsupportedBySemanticFamilyPerFrame: { ...frame.backendUnsupportedBySemanticFamily },
    backendPartiallyHandledAxes: [...frame.backendPartiallyHandledAxes],
    webglDrawCallsPerFrame: frame.webglDrawCalls,
    webglBatchesPerFrame: frame.webglBatches,
    webglTextureBindsPerFrame: frame.webglTextureBinds,
    webglBufferUploadsPerFrame: frame.webglBufferUploads,
    webglCanvasCompositesPerFrame: frame.webglCanvasComposites,
    webglProjectedSurfaceDrawsPerFrame: frame.webglProjectedSurfaceDraws,
    webglTrianglesSubmittedPerFrame: frame.webglTrianglesSubmitted,
    webglUniqueTexturesPerFrame: frame.webglUniqueTextures,
    webglGroundChunkDrawsPerFrame: frame.webglGroundChunkDraws,
    webglGroundChunksVisiblePerFrame: frame.webglGroundChunksVisible,
    webglGroundChunkTextureUploadsPerFrame: frame.webglGroundChunkTextureUploads,
    canvasGroundChunkDrawsPerFrame: frame.canvasGroundChunkDraws,
    canvasGroundChunksVisiblePerFrame: frame.canvasGroundChunksVisible,
    canvasGroundChunkRebuildsPerFrame: frame.canvasGroundChunkRebuilds,
    staticAtlasRequestsPerFrame: frame.staticAtlasRequests,
    staticAtlasHitsPerFrame: frame.staticAtlasHits,
    staticAtlasMissesPerFrame: frame.staticAtlasMisses,
    staticAtlasBypassesPerFrame: frame.staticAtlasBypasses,
    staticAtlasFallbacksPerFrame: frame.staticAtlasFallbacks,
    staticAtlasTexturesPerFrame: frame.staticAtlasTextures,
    dynamicAtlasRequestsPerFrame: frame.dynamicAtlasRequests,
    dynamicAtlasHitsPerFrame: frame.dynamicAtlasHits,
    dynamicAtlasMissesPerFrame: frame.dynamicAtlasMisses,
    dynamicAtlasBypassesPerFrame: frame.dynamicAtlasBypasses,
    dynamicAtlasFallbacksPerFrame: frame.dynamicAtlasFallbacks,
    dynamicAtlasTexturesPerFrame: frame.dynamicAtlasTextures,
    cacheMetrics: sampleCacheMetricsRegistry(),
    groundStaticSurfaceExaminedPerFrame: frame.groundStaticSurfaceExamined,
    groundStaticSurfaceAuthorityFilteredPerFrame: frame.groundStaticSurfaceAuthorityFiltered,
    groundStaticSurfaceFallbackEmittedPerFrame: frame.groundStaticSurfaceFallbackEmitted,
    groundStaticDecalExaminedPerFrame: frame.groundStaticDecalExamined,
    groundStaticDecalAuthorityFilteredPerFrame: frame.groundStaticDecalAuthorityFiltered,
    groundStaticDecalFallbackEmittedPerFrame: frame.groundStaticDecalFallbackEmitted,
    structureTotalSubmissionsPerFrame: frame.structureTotalSubmissions,
    structureRectMeshSubmissionsPerFrame: frame.structureRectMeshSubmissions,
    structureRectMeshMigratedToQuadPerFrame: frame.structureRectMeshMigratedToQuad,
    structureMonolithicGroupSubmissionsPerFrame: frame.structureMonolithicGroupSubmissions,
    structureMonolithicTrianglesPerFrame: frame.structureMonolithicTriangles,
    structureSingleQuadSubmissionsPerFrame: frame.structureSingleQuadSubmissions,
    structureQuadApproxAcceptedPerFrame: frame.structureQuadApproxAccepted,
    structureQuadApproxRejectedPerFrame: frame.structureQuadApproxRejected,
    structureTrianglesSubmittedPerFrame: frame.structureTrianglesSubmitted,
    structureEstimatedTrianglesAvoidedPerFrame: frame.structureEstimatedTrianglesAvoided,
  };

  accum.drawImageCalls += frame.drawImageCalls;
  for (let i = 0; i < DRAW_TAGS.length; i++) {
    const tag = DRAW_TAGS[i];
    accum.drawImageByTag[tag] += frame.drawImageByTag[tag];
  }
  accum.gradientCreateCalls += frame.gradientCreateCalls;
  accum.addColorStopCalls += frame.addColorStopCalls;
  accum.saveCalls += frame.saveCalls;
  for (let i = 0; i < DRAW_TAGS.length; i++) {
    const tag = DRAW_TAGS[i];
    accum.saveByTag[tag] += frame.saveByTag[tag];
  }
  accum.restoreCalls += frame.restoreCalls;
  for (let i = 0; i < DRAW_TAGS.length; i++) {
    const tag = DRAW_TAGS[i];
    accum.restoreByTag[tag] += frame.restoreByTag[tag];
  }
  accum.closuresCreated += frame.closuresCreated;
  accum.sliceKeySorts += frame.sliceKeySorts;
  accum.drawableSorts += frame.drawableSorts;
  accum.fullCanvasBlits += frame.fullCanvasBlits;
  accum.tileLoopIterations += frame.tileLoopIterations;
  accum.tileLoopRadius = frame.tileLoopRadius;
  accum.groundStaticSurfaceExamined += frame.groundStaticSurfaceExamined;
  accum.groundStaticSurfaceAuthorityFiltered += frame.groundStaticSurfaceAuthorityFiltered;
  accum.groundStaticSurfaceFallbackEmitted += frame.groundStaticSurfaceFallbackEmitted;
  accum.groundStaticDecalExamined += frame.groundStaticDecalExamined;
  accum.groundStaticDecalAuthorityFiltered += frame.groundStaticDecalAuthorityFiltered;
  accum.groundStaticDecalFallbackEmitted += frame.groundStaticDecalFallbackEmitted;
  accum.structureTotalSubmissions += frame.structureTotalSubmissions;
  accum.structureRectMeshSubmissions += frame.structureRectMeshSubmissions;
  accum.structureRectMeshMigratedToQuad += frame.structureRectMeshMigratedToQuad;
  accum.structureMonolithicGroupSubmissions += frame.structureMonolithicGroupSubmissions;
  accum.structureMonolithicTriangles += frame.structureMonolithicTriangles;
  accum.structureSingleQuadSubmissions += frame.structureSingleQuadSubmissions;
  accum.structureQuadApproxAccepted += frame.structureQuadApproxAccepted;
  accum.structureQuadApproxRejected += frame.structureQuadApproxRejected;
  accum.structureTrianglesSubmitted += frame.structureTrianglesSubmitted;
  accum.structureEstimatedTrianglesAvoided += frame.structureEstimatedTrianglesAvoided;
  accum.zBandCount += frame.zBandCount;
  accum.lightBandCount += frame.lightBandCount;
  accum.maskBuilds += frame.maskBuilds;
  accum.maskCacheHits += frame.maskCacheHits;
  accum.maskCacheMisses += frame.maskCacheMisses;
  accum.maskRasterChunks += frame.maskRasterChunks;
  accum.maskDrawEntries += frame.maskDrawEntries;
  accum.backendWebglCommands += frame.backendWebglCommands;
  accum.backendCanvasFallbackCommands += frame.backendCanvasFallbackCommands;
  accum.backendUnsupportedCommands += frame.backendUnsupportedCommands;
  accum.backendRequested = frame.backendRequested;
  accum.backendSelected = frame.backendSelected;
  accum.backendDefault = frame.backendDefault;
  accum.backendWebglReadyForDefault = frame.backendWebglReadyForDefault;
  accum.backendFallbackReason = frame.backendFallbackReason;
  accum.webglDrawCalls += frame.webglDrawCalls;
  accum.webglBatches += frame.webglBatches;
  accum.webglTextureBinds += frame.webglTextureBinds;
  accum.webglBufferUploads += frame.webglBufferUploads;
  accum.webglCanvasComposites += frame.webglCanvasComposites;
  accum.webglProjectedSurfaceDraws += frame.webglProjectedSurfaceDraws;
  accum.webglTrianglesSubmitted += frame.webglTrianglesSubmitted;
  accum.webglUniqueTextures += frame.webglUniqueTextures;
  accum.webglGroundChunkDraws += frame.webglGroundChunkDraws;
  accum.webglGroundChunksVisible += frame.webglGroundChunksVisible;
  accum.webglGroundChunkTextureUploads += frame.webglGroundChunkTextureUploads;
  accum.canvasGroundChunkDraws += frame.canvasGroundChunkDraws;
  accum.canvasGroundChunksVisible += frame.canvasGroundChunksVisible;
  accum.canvasGroundChunkRebuilds += frame.canvasGroundChunkRebuilds;
  accum.staticAtlasRequests += frame.staticAtlasRequests;
  accum.staticAtlasHits += frame.staticAtlasHits;
  accum.staticAtlasMisses += frame.staticAtlasMisses;
  accum.staticAtlasBypasses += frame.staticAtlasBypasses;
  accum.staticAtlasFallbacks += frame.staticAtlasFallbacks;
  accum.staticAtlasTextures += frame.staticAtlasTextures;
  accum.dynamicAtlasRequests += frame.dynamicAtlasRequests;
  accum.dynamicAtlasHits += frame.dynamicAtlasHits;
  accum.dynamicAtlasMisses += frame.dynamicAtlasMisses;
  accum.dynamicAtlasBypasses += frame.dynamicAtlasBypasses;
  accum.dynamicAtlasFallbacks += frame.dynamicAtlasFallbacks;
  accum.dynamicAtlasTextures += frame.dynamicAtlasTextures;
  mergeCountMaps(accum.backendWebglByAxes, frame.backendWebglByAxes);
  mergeCountMaps(accum.backendCanvasFallbackByAxes, frame.backendCanvasFallbackByAxes);
  mergeCountMaps(accum.backendUnsupportedByAxes, frame.backendUnsupportedByAxes);
  mergeCountMaps(accum.backendUnsupportedBySemanticFamily, frame.backendUnsupportedBySemanticFamily);
  if (frame.backendUnsupportedCommandKeys.length > 0) {
    for (let i = 0; i < frame.backendUnsupportedCommandKeys.length; i++) {
      if (!accum.backendUnsupportedCommandKeys.includes(frame.backendUnsupportedCommandKeys[i])) {
        accum.backendUnsupportedCommandKeys.push(frame.backendUnsupportedCommandKeys[i]);
      }
    }
  }
  if (frame.backendPartiallyHandledAxes.length > 0) {
    for (let i = 0; i < frame.backendPartiallyHandledAxes.length; i++) {
      if (!accum.backendPartiallyHandledAxes.includes(frame.backendPartiallyHandledAxes[i])) {
        accum.backendPartiallyHandledAxes.push(frame.backendPartiallyHandledAxes[i]);
      }
    }
  }
  framesAccum += 1;

  if (lastReportSec < 0) lastReportSec = nowSec;
  const elapsed = nowSec - lastReportSec;
  if (elapsed >= 1) {
    const denom = Math.max(1, framesAccum);
    const byTag = makeZeroByTag();
    const saveByTag = makeZeroByTag();
    const restoreByTag = makeZeroByTag();
    for (let i = 0; i < DRAW_TAGS.length; i++) {
      const tag = DRAW_TAGS[i];
      byTag[tag] = accum.drawImageByTag[tag] / denom;
      saveByTag[tag] = accum.saveByTag[tag] / denom;
      restoreByTag[tag] = accum.restoreByTag[tag] / denom;
    }
    snapshot = {
      drawImageCallsPerFrame: accum.drawImageCalls / denom,
      drawImageByTagPerFrame: byTag,
      gradientCreateCallsPerFrame: accum.gradientCreateCalls / denom,
      addColorStopCallsPerFrame: accum.addColorStopCalls / denom,
      saveCallsPerFrame: accum.saveCalls / denom,
      saveByTagPerFrame: saveByTag,
      restoreCallsPerFrame: accum.restoreCalls / denom,
      restoreByTagPerFrame: restoreByTag,
      closuresCreatedPerFrame: accum.closuresCreated / denom,
      sliceKeySortsPerFrame: accum.sliceKeySorts / denom,
      drawableSortsPerFrame: accum.drawableSorts / denom,
      fullCanvasBlitsPerFrame: accum.fullCanvasBlits / denom,
      tileLoopIterationsPerFrame: accum.tileLoopIterations / denom,
      tileLoopRadius: accum.tileLoopRadius,
      groundStaticSurfaceExaminedPerFrame: accum.groundStaticSurfaceExamined / denom,
      groundStaticSurfaceAuthorityFilteredPerFrame: accum.groundStaticSurfaceAuthorityFiltered / denom,
      groundStaticSurfaceFallbackEmittedPerFrame: accum.groundStaticSurfaceFallbackEmitted / denom,
      groundStaticDecalExaminedPerFrame: accum.groundStaticDecalExamined / denom,
      groundStaticDecalAuthorityFilteredPerFrame: accum.groundStaticDecalAuthorityFiltered / denom,
      groundStaticDecalFallbackEmittedPerFrame: accum.groundStaticDecalFallbackEmitted / denom,
      structureTotalSubmissionsPerFrame: accum.structureTotalSubmissions / denom,
      structureRectMeshSubmissionsPerFrame: accum.structureRectMeshSubmissions / denom,
      structureRectMeshMigratedToQuadPerFrame: accum.structureRectMeshMigratedToQuad / denom,
      structureMonolithicGroupSubmissionsPerFrame: accum.structureMonolithicGroupSubmissions / denom,
      structureMonolithicTrianglesPerFrame: accum.structureMonolithicTriangles / denom,
      structureSingleQuadSubmissionsPerFrame: accum.structureSingleQuadSubmissions / denom,
      structureQuadApproxAcceptedPerFrame: accum.structureQuadApproxAccepted / denom,
      structureQuadApproxRejectedPerFrame: accum.structureQuadApproxRejected / denom,
      structureTrianglesSubmittedPerFrame: accum.structureTrianglesSubmitted / denom,
      structureEstimatedTrianglesAvoidedPerFrame: accum.structureEstimatedTrianglesAvoided / denom,
      zBandCountPerFrame: accum.zBandCount / denom,
      lightBandCountPerFrame: accum.lightBandCount / denom,
      maskBuildsPerFrame: accum.maskBuilds / denom,
      maskCacheHitsPerFrame: accum.maskCacheHits / denom,
      maskCacheMissesPerFrame: accum.maskCacheMisses / denom,
      maskRasterChunksPerFrame: accum.maskRasterChunks / denom,
      maskDrawEntriesPerFrame: accum.maskDrawEntries / denom,
      backendWebglCommandsPerFrame: accum.backendWebglCommands / denom,
      backendCanvasFallbackCommandsPerFrame: accum.backendCanvasFallbackCommands / denom,
      backendUnsupportedCommandsPerFrame: accum.backendUnsupportedCommands / denom,
      backendWebglGroundCommandsPerFrame: accum.backendWebglGroundCommands / denom,
      backendUnsupportedGroundCommandsPerFrame: accum.backendUnsupportedGroundCommands / denom,
      backendRequested: accum.backendRequested,
      backendSelected: accum.backendSelected,
      backendDefault: accum.backendDefault,
      backendWebglReadyForDefault: accum.backendWebglReadyForDefault,
      backendFallbackReason: accum.backendFallbackReason,
      backendUnsupportedCommandKeys: [...accum.backendUnsupportedCommandKeys],
      backendWebglByAxesPerFrame: divideCountMap(accum.backendWebglByAxes, denom),
      backendCanvasFallbackByAxesPerFrame: divideCountMap(accum.backendCanvasFallbackByAxes, denom),
      backendUnsupportedByAxesPerFrame: divideCountMap(accum.backendUnsupportedByAxes, denom),
      backendUnsupportedBySemanticFamilyPerFrame: divideCountMap(accum.backendUnsupportedBySemanticFamily, denom),
      backendPartiallyHandledAxes: [...accum.backendPartiallyHandledAxes],
      webglDrawCallsPerFrame: accum.webglDrawCalls / denom,
      webglBatchesPerFrame: accum.webglBatches / denom,
      webglTextureBindsPerFrame: accum.webglTextureBinds / denom,
      webglBufferUploadsPerFrame: accum.webglBufferUploads / denom,
      webglCanvasCompositesPerFrame: accum.webglCanvasComposites / denom,
      webglProjectedSurfaceDrawsPerFrame: accum.webglProjectedSurfaceDraws / denom,
      webglTrianglesSubmittedPerFrame: accum.webglTrianglesSubmitted / denom,
      webglUniqueTexturesPerFrame: accum.webglUniqueTextures / denom,
      webglGroundChunkDrawsPerFrame: accum.webglGroundChunkDraws / denom,
      webglGroundChunksVisiblePerFrame: accum.webglGroundChunksVisible / denom,
      webglGroundChunkTextureUploadsPerFrame: accum.webglGroundChunkTextureUploads / denom,
      canvasGroundChunkDrawsPerFrame: accum.canvasGroundChunkDraws / denom,
      canvasGroundChunksVisiblePerFrame: accum.canvasGroundChunksVisible / denom,
      canvasGroundChunkRebuildsPerFrame: accum.canvasGroundChunkRebuilds / denom,
      staticAtlasRequestsPerFrame: accum.staticAtlasRequests / denom,
      staticAtlasHitsPerFrame: accum.staticAtlasHits / denom,
      staticAtlasMissesPerFrame: accum.staticAtlasMisses / denom,
      staticAtlasBypassesPerFrame: accum.staticAtlasBypasses / denom,
      staticAtlasFallbacksPerFrame: accum.staticAtlasFallbacks / denom,
      staticAtlasTexturesPerFrame: accum.staticAtlasTextures / denom,
      dynamicAtlasRequestsPerFrame: accum.dynamicAtlasRequests / denom,
      dynamicAtlasHitsPerFrame: accum.dynamicAtlasHits / denom,
      dynamicAtlasMissesPerFrame: accum.dynamicAtlasMisses / denom,
      dynamicAtlasBypassesPerFrame: accum.dynamicAtlasBypasses / denom,
      dynamicAtlasFallbacksPerFrame: accum.dynamicAtlasFallbacks / denom,
      dynamicAtlasTexturesPerFrame: accum.dynamicAtlasTextures / denom,
      cacheMetrics: sampleCacheMetricsRegistry(),
    };
    accum = makeZeroFrame();
    framesAccum = 0;
    lastReportSec = nowSec;
  }
}

export function beginRenderPerfFrame(viewW: number, viewH: number): void {
  if (!enabled) return;
  installHooks();
  viewportW = viewW;
  viewportH = viewH;
  resetFrameCounters();
}

export function endRenderPerfFrame(nowSec: number): void {
  if (!enabled) return;
  foldCurrentFrame(nowSec);
}

export function countRenderClosureCreated(n: number = 1): void {
  if (!enabled) return;
  frame.closuresCreated += n;
}

export function countRenderSliceKeySort(n: number = 1): void {
  if (!enabled) return;
  frame.sliceKeySorts += n;
}

export function countRenderDrawableSort(n: number = 1): void {
  if (!enabled) return;
  frame.drawableSorts += n;
}

export function setRenderPerfDrawTag(tag: DrawTag | null): void {
  if (!enabled) return;
  currentDrawTag = tag ?? "untagged";
}

export function countRenderTileLoopIteration(n: number = 1): void {
  if (!enabled) return;
  frame.tileLoopIterations += n;
}

export function setRenderTileLoopRadius(radius: number): void {
  if (!enabled) return;
  frame.tileLoopRadius = radius;
}

export function countRenderGroundStaticSurfaceExamined(n: number = 1): void {
  if (!enabled) return;
  frame.groundStaticSurfaceExamined += n;
}

export function countRenderGroundStaticSurfaceAuthorityFiltered(n: number = 1): void {
  if (!enabled) return;
  frame.groundStaticSurfaceAuthorityFiltered += n;
}

export function countRenderGroundStaticSurfaceFallbackEmitted(n: number = 1): void {
  if (!enabled) return;
  frame.groundStaticSurfaceFallbackEmitted += n;
}

export function countRenderGroundStaticDecalExamined(n: number = 1): void {
  if (!enabled) return;
  frame.groundStaticDecalExamined += n;
}

export function countRenderGroundStaticDecalAuthorityFiltered(n: number = 1): void {
  if (!enabled) return;
  frame.groundStaticDecalAuthorityFiltered += n;
}

export function countRenderGroundStaticDecalFallbackEmitted(n: number = 1): void {
  if (!enabled) return;
  frame.groundStaticDecalFallbackEmitted += n;
}

export function countRenderStructureTotalSubmission(n: number = 1): void {
  if (!enabled) return;
  frame.structureTotalSubmissions += n;
}

export function countRenderStructureRectMeshSubmission(n: number = 1): void {
  if (!enabled) return;
  frame.structureRectMeshSubmissions += n;
}

export function countRenderStructureRectMeshMigratedToQuad(n: number = 1): void {
  if (!enabled) return;
  frame.structureRectMeshMigratedToQuad += n;
}

export function countRenderStructureMonolithicGroupSubmission(n: number = 1): void {
  if (!enabled) return;
  frame.structureMonolithicGroupSubmissions += n;
}

export function countRenderStructureMonolithicTriangles(n: number = 1): void {
  if (!enabled) return;
  frame.structureMonolithicTriangles += n;
}

export function countRenderStructureSingleQuadSubmission(n: number = 1): void {
  if (!enabled) return;
  frame.structureSingleQuadSubmissions += n;
}

export function countRenderStructureQuadApproxAccepted(n: number = 1): void {
  if (!enabled) return;
  frame.structureQuadApproxAccepted += n;
}

export function countRenderStructureQuadApproxRejected(n: number = 1): void {
  if (!enabled) return;
  frame.structureQuadApproxRejected += n;
}

export function countRenderStructureTrianglesSubmitted(n: number = 1): void {
  if (!enabled) return;
  frame.structureTrianglesSubmitted += n;
}

export function countRenderStructureEstimatedTrianglesAvoided(n: number = 1): void {
  if (!enabled) return;
  frame.structureEstimatedTrianglesAvoided += n;
}

export function setRenderZBandCount(count: number): void {
  if (!enabled) return;
  frame.zBandCount = Math.max(0, count | 0);
}

export function setRenderLightBandCount(count: number): void {
  if (!enabled) return;
  frame.lightBandCount = Math.max(0, count | 0);
}

export function countRenderMaskBuild(n: number = 1): void {
  if (!enabled) return;
  frame.maskBuilds += n;
}

export function countRenderMaskCacheHit(n: number = 1): void {
  if (!enabled) return;
  frame.maskCacheHits += n;
}

export function countRenderMaskCacheMiss(n: number = 1): void {
  if (!enabled) return;
  frame.maskCacheMisses += n;
}

export function countRenderMaskRasterChunk(n: number = 1): void {
  if (!enabled) return;
  frame.maskRasterChunks += n;
}

export function countRenderMaskDrawEntry(n: number = 1): void {
  if (!enabled) return;
  frame.maskDrawEntries += n;
}

export function countRenderWebGLDrawCall(n: number = 1): void {
  if (!enabled) return;
  frame.webglDrawCalls += n;
}

export function countRenderWebGLBatch(n: number = 1): void {
  if (!enabled) return;
  frame.webglBatches += n;
}

export function countRenderWebGLTextureBind(n: number = 1): void {
  if (!enabled) return;
  frame.webglTextureBinds += n;
}

export function countRenderWebGLBufferUpload(n: number = 1): void {
  if (!enabled) return;
  frame.webglBufferUploads += n;
}

export function countRenderWebGLCanvasComposite(n: number = 1): void {
  if (!enabled) return;
  frame.webglCanvasComposites += n;
}

export function countRenderWebGLProjectedSurfaceDraw(n: number = 1): void {
  if (!enabled) return;
  frame.webglProjectedSurfaceDraws += n;
}

export function countRenderWebGLTrianglesSubmitted(n: number = 1): void {
  if (!enabled) return;
  frame.webglTrianglesSubmitted += n;
}

export function countRenderWebGLGroundChunkDraw(n: number = 1): void {
  if (!enabled) return;
  frame.webglGroundChunkDraws += n;
}

export function countRenderWebGLGroundChunksVisible(n: number = 1): void {
  if (!enabled) return;
  frame.webglGroundChunksVisible += n;
}

export function countRenderWebGLGroundChunkTextureUpload(n: number = 1): void {
  if (!enabled) return;
  frame.webglGroundChunkTextureUploads += n;
}

export function countRenderCanvasGroundChunkDraw(n: number = 1): void {
  if (!enabled) return;
  frame.canvasGroundChunkDraws += n;
}

export function countRenderCanvasGroundChunksVisible(n: number = 1): void {
  if (!enabled) return;
  frame.canvasGroundChunksVisible += n;
}

export function countRenderCanvasGroundChunkRebuild(n: number = 1): void {
  if (!enabled) return;
  frame.canvasGroundChunkRebuilds += n;
}

export function countRenderStaticAtlasRequest(n: number = 1): void {
  if (!enabled) return;
  frame.staticAtlasRequests += n;
}

export function countRenderStaticAtlasHit(n: number = 1): void {
  if (!enabled) return;
  frame.staticAtlasHits += n;
}

export function countRenderStaticAtlasMiss(n: number = 1): void {
  if (!enabled) return;
  frame.staticAtlasMisses += n;
}

export function countRenderStaticAtlasBypass(n: number = 1): void {
  if (!enabled) return;
  frame.staticAtlasBypasses += n;
}

export function countRenderStaticAtlasFallback(n: number = 1): void {
  if (!enabled) return;
  frame.staticAtlasFallbacks += n;
}

export function setRenderStaticAtlasTextureCount(count: number): void {
  if (!enabled) return;
  frame.staticAtlasTextures = Math.max(0, count | 0);
}

export function countRenderDynamicAtlasRequest(n: number = 1): void {
  if (!enabled) return;
  frame.dynamicAtlasRequests += n;
}

export function countRenderDynamicAtlasHit(n: number = 1): void {
  if (!enabled) return;
  frame.dynamicAtlasHits += n;
}

export function countRenderDynamicAtlasMiss(n: number = 1): void {
  if (!enabled) return;
  frame.dynamicAtlasMisses += n;
}

export function countRenderDynamicAtlasBypass(n: number = 1): void {
  if (!enabled) return;
  frame.dynamicAtlasBypasses += n;
}

export function countRenderDynamicAtlasFallback(n: number = 1): void {
  if (!enabled) return;
  frame.dynamicAtlasFallbacks += n;
}

export function setRenderDynamicAtlasTextureCount(count: number): void {
  if (!enabled) return;
  frame.dynamicAtlasTextures = Math.max(0, count | 0);
}

export function noteRenderWebGLTextureUsage(source: object | null | undefined): void {
  if (!enabled || !source || (typeof source !== "object" && typeof source !== "function")) return;
  if (webglUniqueTextureSet.has(source)) return;
  webglUniqueTextureSet.add(source);
  frame.webglUniqueTextures += 1;
}

export function setRenderBackendStats(input: {
  requestedBackend: "canvas2d" | "webgl";
  selectedBackend: "canvas2d" | "webgl";
  defaultBackend: "canvas2d" | "webgl";
  webglReadyForDefault: boolean;
  fallbackReason: string | null;
  webglCommandCount: number;
  canvasFallbackCommandCount: number;
  unsupportedCommandCount: number;
  webglGroundCommandCount: number;
  unsupportedGroundCommandCount: number;
  unsupportedCommandKeys: readonly string[];
  webglByAxes: Readonly<Record<string, number>>;
  canvasFallbackByAxes: Readonly<Record<string, number>>;
  unsupportedByAxes: Readonly<Record<string, number>>;
  unsupportedBySemanticFamily: Readonly<Record<string, number>>;
  partiallyHandledAxes: readonly string[];
}): void {
  if (!enabled) return;
  frame.backendRequested = input.requestedBackend;
  frame.backendSelected = input.selectedBackend;
  frame.backendDefault = input.defaultBackend;
  frame.backendWebglReadyForDefault = input.webglReadyForDefault;
  frame.backendFallbackReason = input.fallbackReason;
  frame.backendWebglCommands = Math.max(0, input.webglCommandCount | 0);
  frame.backendCanvasFallbackCommands = Math.max(0, input.canvasFallbackCommandCount | 0);
  frame.backendUnsupportedCommands = Math.max(0, input.unsupportedCommandCount | 0);
  frame.backendWebglGroundCommands = Math.max(0, input.webglGroundCommandCount | 0);
  frame.backendUnsupportedGroundCommands = Math.max(0, input.unsupportedGroundCommandCount | 0);
  frame.backendUnsupportedCommandKeys = [...input.unsupportedCommandKeys];
  frame.backendWebglByAxes = { ...input.webglByAxes };
  frame.backendCanvasFallbackByAxes = { ...input.canvasFallbackByAxes };
  frame.backendUnsupportedByAxes = { ...input.unsupportedByAxes };
  frame.backendUnsupportedBySemanticFamily = { ...input.unsupportedBySemanticFamily };
  frame.backendPartiallyHandledAxes = [...input.partiallyHandledAxes];
}

export function getRenderPerfSnapshot(): Snapshot {
  if (!enabled) {
    return {
      drawImageCallsPerFrame: 0,
      drawImageByTagPerFrame: makeZeroByTag(),
      gradientCreateCallsPerFrame: 0,
      addColorStopCallsPerFrame: 0,
      saveCallsPerFrame: 0,
      saveByTagPerFrame: makeZeroByTag(),
      restoreCallsPerFrame: 0,
      restoreByTagPerFrame: makeZeroByTag(),
      closuresCreatedPerFrame: 0,
      sliceKeySortsPerFrame: 0,
      drawableSortsPerFrame: 0,
      fullCanvasBlitsPerFrame: 0,
      tileLoopIterationsPerFrame: 0,
      tileLoopRadius: 0,
      groundStaticSurfaceExaminedPerFrame: 0,
      groundStaticSurfaceAuthorityFilteredPerFrame: 0,
      groundStaticSurfaceFallbackEmittedPerFrame: 0,
      groundStaticDecalExaminedPerFrame: 0,
      groundStaticDecalAuthorityFilteredPerFrame: 0,
      groundStaticDecalFallbackEmittedPerFrame: 0,
      structureTotalSubmissionsPerFrame: 0,
      structureRectMeshSubmissionsPerFrame: 0,
      structureRectMeshMigratedToQuadPerFrame: 0,
      structureMonolithicGroupSubmissionsPerFrame: 0,
      structureMonolithicTrianglesPerFrame: 0,
      structureSingleQuadSubmissionsPerFrame: 0,
      structureQuadApproxAcceptedPerFrame: 0,
      structureQuadApproxRejectedPerFrame: 0,
      structureTrianglesSubmittedPerFrame: 0,
      structureEstimatedTrianglesAvoidedPerFrame: 0,
      zBandCountPerFrame: 0,
      lightBandCountPerFrame: 0,
      maskBuildsPerFrame: 0,
      maskCacheHitsPerFrame: 0,
      maskCacheMissesPerFrame: 0,
      maskRasterChunksPerFrame: 0,
      maskDrawEntriesPerFrame: 0,
      backendWebglCommandsPerFrame: 0,
      backendCanvasFallbackCommandsPerFrame: 0,
      backendUnsupportedCommandsPerFrame: 0,
      backendWebglGroundCommandsPerFrame: 0,
      backendUnsupportedGroundCommandsPerFrame: 0,
      backendRequested: "canvas2d",
      backendSelected: "canvas2d",
      backendDefault: "canvas2d",
      backendWebglReadyForDefault: false,
      backendFallbackReason: null,
      backendUnsupportedCommandKeys: [],
      backendWebglByAxesPerFrame: {},
      backendCanvasFallbackByAxesPerFrame: {},
      backendUnsupportedByAxesPerFrame: {},
      backendUnsupportedBySemanticFamilyPerFrame: {},
      backendPartiallyHandledAxes: [],
      webglDrawCallsPerFrame: 0,
      webglBatchesPerFrame: 0,
      webglTextureBindsPerFrame: 0,
      webglBufferUploadsPerFrame: 0,
      webglCanvasCompositesPerFrame: 0,
      webglProjectedSurfaceDrawsPerFrame: 0,
      webglTrianglesSubmittedPerFrame: 0,
      webglUniqueTexturesPerFrame: 0,
      webglGroundChunkDrawsPerFrame: 0,
      webglGroundChunksVisiblePerFrame: 0,
      webglGroundChunkTextureUploadsPerFrame: 0,
      canvasGroundChunkDrawsPerFrame: 0,
      canvasGroundChunksVisiblePerFrame: 0,
      canvasGroundChunkRebuildsPerFrame: 0,
      staticAtlasRequestsPerFrame: 0,
      staticAtlasHitsPerFrame: 0,
      staticAtlasMissesPerFrame: 0,
      staticAtlasBypassesPerFrame: 0,
      staticAtlasFallbacksPerFrame: 0,
      staticAtlasTexturesPerFrame: 0,
      dynamicAtlasRequestsPerFrame: 0,
      dynamicAtlasHitsPerFrame: 0,
      dynamicAtlasMissesPerFrame: 0,
      dynamicAtlasBypassesPerFrame: 0,
      dynamicAtlasFallbacksPerFrame: 0,
      dynamicAtlasTexturesPerFrame: 0,
      cacheMetrics: {
        caches: [],
        totalEntries: 0,
        totalKnownBytes: 0,
        totalHits: 0,
        totalMisses: 0,
        totalInserts: 0,
        totalEvictions: 0,
        totalClears: 0,
        totalBudgetBytes: 0,
      },
    };
  }
  return snapshot;
}

export function setRenderPerfCountersEnabled(next: boolean): void {
  enabled = !!next;
  if (!enabled) {
    resetFrameCounters();
    accum = makeZeroFrame();
    framesAccum = 0;
    lastReportSec = -1;
    currentDrawTag = "untagged";
  }
}
