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
  backendUnsupportedVariants: string[];
  backendWebglByFamily: Record<string, number>;
  backendCanvasFallbackByFamily: Record<string, number>;
  backendUnsupportedByFamily: Record<string, number>;
  backendUnsupportedByKind: Record<string, number>;
  backendPartiallyHandledFamilies: string[];
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
  backendUnsupportedVariants: string[];
  backendWebglByFamilyPerFrame: Record<string, number>;
  backendCanvasFallbackByFamilyPerFrame: Record<string, number>;
  backendUnsupportedByFamilyPerFrame: Record<string, number>;
  backendUnsupportedByKindPerFrame: Record<string, number>;
  backendPartiallyHandledFamilies: string[];
};

export type DrawTag =
  | "untagged"
  | "void"
  | "floors"
  | "decals"
  | "entities"
  | "structures"
  | "mask:building"
  | "mask:shadow"
  | "lighting";

const DRAW_TAGS: DrawTag[] = [
  "untagged",
  "void",
  "floors",
  "decals",
  "entities",
  "structures",
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
    structures: 0,
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
  backendUnsupportedVariants: [],
  backendWebglByFamily: {},
  backendCanvasFallbackByFamily: {},
  backendUnsupportedByFamily: {},
  backendUnsupportedByKind: {},
  backendPartiallyHandledFamilies: [],
};

function makeZeroFrame(): FrameCounters {
  return {
    ...ZERO_FRAME,
    drawImageByTag: makeZeroByTag(),
    saveByTag: makeZeroByTag(),
    restoreByTag: makeZeroByTag(),
    backendUnsupportedVariants: [],
    backendWebglByFamily: {},
    backendCanvasFallbackByFamily: {},
    backendUnsupportedByFamily: {},
    backendUnsupportedByKind: {},
    backendPartiallyHandledFamilies: [],
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
  backendUnsupportedVariants: [],
  backendWebglByFamilyPerFrame: {},
  backendCanvasFallbackByFamilyPerFrame: {},
  backendUnsupportedByFamilyPerFrame: {},
  backendUnsupportedByKindPerFrame: {},
  backendPartiallyHandledFamilies: [],
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
  mergeCountMaps(accum.backendWebglByFamily, frame.backendWebglByFamily);
  mergeCountMaps(accum.backendCanvasFallbackByFamily, frame.backendCanvasFallbackByFamily);
  mergeCountMaps(accum.backendUnsupportedByFamily, frame.backendUnsupportedByFamily);
  if (frame.backendUnsupportedVariants.length > 0) {
    for (let i = 0; i < frame.backendUnsupportedVariants.length; i++) {
      if (!accum.backendUnsupportedVariants.includes(frame.backendUnsupportedVariants[i])) {
        accum.backendUnsupportedVariants.push(frame.backendUnsupportedVariants[i]);
      }
    }
  }
  if (frame.backendPartiallyHandledFamilies.length > 0) {
    for (let i = 0; i < frame.backendPartiallyHandledFamilies.length; i++) {
      if (!accum.backendPartiallyHandledFamilies.includes(frame.backendPartiallyHandledFamilies[i])) {
        accum.backendPartiallyHandledFamilies.push(frame.backendPartiallyHandledFamilies[i]);
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
      backendUnsupportedVariants: [...accum.backendUnsupportedVariants],
      backendWebglByFamilyPerFrame: divideCountMap(accum.backendWebglByFamily, denom),
      backendCanvasFallbackByFamilyPerFrame: divideCountMap(accum.backendCanvasFallbackByFamily, denom),
      backendUnsupportedByFamilyPerFrame: divideCountMap(accum.backendUnsupportedByFamily, denom),
      backendUnsupportedByKindPerFrame: divideCountMap(accum.backendUnsupportedByKind, denom),
      backendPartiallyHandledFamilies: [...accum.backendPartiallyHandledFamilies],
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
  unsupportedVariants: readonly string[];
  webglByFamily: Readonly<Record<string, number>>;
  canvasFallbackByFamily: Readonly<Record<string, number>>;
  unsupportedByFamily: Readonly<Record<string, number>>;
  unsupportedByKind: Readonly<Record<string, number>>;
  partiallyHandledFamilies: readonly string[];
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
  frame.backendUnsupportedVariants = [...input.unsupportedVariants];
  frame.backendWebglByFamily = { ...input.webglByFamily };
  frame.backendCanvasFallbackByFamily = { ...input.canvasFallbackByFamily };
  frame.backendUnsupportedByFamily = { ...input.unsupportedByFamily };
  frame.backendUnsupportedByKind = { ...input.unsupportedByKind };
  frame.backendPartiallyHandledFamilies = [...input.partiallyHandledFamilies];
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
      backendUnsupportedVariants: [],
      backendWebglByFamilyPerFrame: {},
      backendCanvasFallbackByFamilyPerFrame: {},
      backendUnsupportedByFamilyPerFrame: {},
      backendUnsupportedByKindPerFrame: {},
      backendPartiallyHandledFamilies: [],
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
