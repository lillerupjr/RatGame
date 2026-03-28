import { getRenderPerfSnapshot } from "../renderPerfCounters";
import type { RenderDebugScreenPassInput } from "./debugRenderTypes";
import { describeRenderBackendFallbackReason } from "../backend/renderBackendSelection";
import type { CacheMetricSample } from "../cacheMetricsRegistry";
import type { WorldBatchAudit, WorldBatchBreakReason, WorldBatchFamilySummary } from "./worldBatchAudit";

type FramePerf = {
  off: string[];
  overview: string[];
  world: string[];
  structures: string[];
  textures: string[];
  ground: string[];
  lighting: string[];
  cache: string[];
  all: string[];
};

function formatValue(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function formatCacheBytes(bytes: number | null): string {
  if (bytes == null) return "unknown";
  const mib = bytes / (1024 * 1024);
  if (mib >= 10) return `${mib.toFixed(0)}MiB`;
  if (mib >= 1) return `${mib.toFixed(1)}MiB`;
  const kib = bytes / 1024;
  if (kib >= 10) return `${kib.toFixed(0)}KiB`;
  return `${kib.toFixed(1)}KiB`;
}

function formatCacheHitRate(hits: number, misses: number): string {
  const total = hits + misses;
  if (total <= 0) return "n/a";
  return `${((hits / total) * 100).toFixed(0)}%`;
}

function summarizeTopCaches(caches: CacheMetricSample[], limit = 3): CacheMetricSample[] {
  return [...caches]
    .sort((a, b) => {
      const aBytes = a.approxBytes ?? -1;
      const bBytes = b.approxBytes ?? -1;
      if (aBytes !== bBytes) return bBytes - aBytes;
      if (a.entryCount !== b.entryCount) return b.entryCount - a.entryCount;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

function topBreakReasons(audit: WorldBatchAudit | null | undefined, limit = 3): string {
  if (!audit) return "none";
  const reasons: WorldBatchBreakReason[] = [
    "texture changed",
    "render family changed",
    "shader/material changed",
    "blend mode changed",
    "primitive type changed",
    "unsupported/fallback path changed",
    "non-batchable path",
    "other state incompatibility",
  ];
  const top = reasons
    .filter((reason) => audit.breakReasonCounts[reason] > 0)
    .sort((a, b) => audit.breakReasonCounts[b] - audit.breakReasonCounts[a])
    .slice(0, limit)
    .map((reason) => `${reason}:${audit.breakReasonCounts[reason]}`);
  return top.length > 0 ? top.join(" ") : "none";
}

function topFamiliesByUniqueTextures(families: readonly WorldBatchFamilySummary[], limit = 3): WorldBatchFamilySummary[] {
  return [...families]
    .sort((a, b) => b.uniqueTextures - a.uniqueTextures || b.commands - a.commands || a.family.localeCompare(b.family))
    .slice(0, limit);
}

function familyByName(audit: WorldBatchAudit | null | undefined, family: string): WorldBatchFamilySummary | null {
  return audit?.familySummaries.find((summary) => summary.family === family) ?? null;
}

function buildFramePerf(input: RenderDebugScreenPassInput): FramePerf {
  const perf = getRenderPerfSnapshot();
  const audit = input.worldBatchAudit ?? null;
  const frameDraws = perf.backendSelected === "webgl"
    ? perf.webglDrawCallsPerFrame
    : perf.drawImageCallsPerFrame;
  const frameBatches = perf.backendSelected === "webgl"
    ? perf.webglBatchesPerFrame
    : (audit?.totalWorldBatches ?? 0);
  const quadPct = audit && audit.totalWorldCommands > 0 ? (audit.quadCommands / audit.totalWorldCommands) * 100 : 0;
  const triPct = audit && audit.totalWorldCommands > 0 ? (audit.triangleCommands / audit.totalWorldCommands) * 100 : 0;
  const sharedTexturePct = audit && audit.texturedCommands > 0 && audit.uniqueTextures > 0
    ? ((audit.texturedCommands - audit.uniqueTextures) / audit.texturedCommands) * 100
    : 0;
  const cacheMetrics = perf.cacheMetrics;
  const groundChunkCacheMetric = cacheMetrics.caches.find((cache) => cache.name === "groundChunks") ?? null;
  const structureFamily = familyByName(audit, "structures");
  const entityFamily = familyByName(audit, "entities");
  const propFamily = familyByName(audit, "props");
  const dropFamily = familyByName(audit, "drops");
  const lightFamily = familyByName(audit, "lights");

  const overview = [
    `perf(overview): fps:${formatValue(input.fps)} frame:${formatValue(input.frameTimeMs)}ms`,
    `draws:${formatValue(frameDraws)} batches:${formatValue(frameBatches)} breaks:${audit?.totalBatchBreaks ?? 0}`,
    `world: cmd:${audit?.totalWorldCommands ?? 0} avgBatch:${audit?.averageRunLength.toFixed(1) ?? "0.0"} maxBatch:${audit?.maxRunLength ?? 0}`,
    `breaks: ${topBreakReasons(audit, 2)}`,
    `geom: tri:${formatValue(perf.webglTrianglesSubmittedPerFrame || perf.structureTrianglesSubmittedPerFrame)} quad:${audit?.quadCommands ?? 0} tri%:${formatPercent(triPct)} quad%:${formatPercent(quadPct)}`,
    `textures: unique:${formatValue(perf.webglUniqueTexturesPerFrame)} binds:${formatValue(perf.webglTextureBindsPerFrame)} shared:${formatPercent(sharedTexturePct)}`,
  ];
  const world = [
    `perf(world): cmd:${audit?.totalWorldCommands ?? 0} batch:${audit?.totalWorldBatches ?? 0} avg:${audit?.averageRunLength.toFixed(1) ?? "0.0"} max:${audit?.maxRunLength ?? 0}`,
    `runs: texAvg:${audit?.runLengths?.averageTextureRun?.toFixed(1) ?? "0.0"} texMax:${audit?.runLengths?.maxTextureRun ?? 0} compAvg:${audit?.runLengths?.averageCompatibleRun?.toFixed(1) ?? "0.0"} compMax:${audit?.runLengths?.maxCompatibleRun ?? 0}`,
    `breaks:${audit?.totalBatchBreaks ?? 0} cont:${audit?.compatibleContinuations ?? 0}`,
    `breaksTop: ${topBreakReasons(audit, 4)}`,
    ...(audit?.reorderProbes?.map((probe) => (
      `probe${probe.windowSize}: batch:${probe.totalWorldBatches} avg:${probe.averageRunLength.toFixed(1)} tex:${probe.textureBreaks} fam:${probe.renderFamilyBreaks} risk:${probe.riskCount}`
    )) ?? []),
    `riskDetail: ov:${audit?.reorderProbes?.[2]?.overlapRiskCount ?? 0} feet:${audit?.reorderProbes?.[2]?.feetSortYRiskCount ?? 0} group:${audit?.reorderProbes?.[2]?.groupBoundaryRiskCount ?? 0}`,
    `geomMix: quad:${audit?.quadCommands ?? 0} tri:${audit?.triangleCommands ?? 0} batchable:${audit?.batchableCommands ?? 0}`,
    `family entities:${entityFamily?.batches ?? 0}/${entityFamily?.commands ?? 0} props:${propFamily?.batches ?? 0}/${propFamily?.commands ?? 0}`,
    `family drops:${dropFamily?.batches ?? 0}/${dropFamily?.commands ?? 0} structures:${structureFamily?.batches ?? 0}/${structureFamily?.commands ?? 0}`,
  ];
  const structures = [
    `perf(structures): total:${formatValue(perf.structureTotalSubmissionsPerFrame)} rect:${formatValue(perf.structureRectMeshSubmissionsPerFrame)} rectQuad:${formatValue(perf.structureRectMeshMigratedToQuadPerFrame)}`,
    `mono: groups:${formatValue(perf.structureMonolithicGroupSubmissionsPerFrame)} tri:${formatValue(perf.structureMonolithicTrianglesPerFrame)}`,
    `quadSafe: single:${formatValue(perf.structureSingleQuadSubmissionsPerFrame)} accept:${formatValue(perf.structureQuadApproxAcceptedPerFrame)} reject:${formatValue(perf.structureQuadApproxRejectedPerFrame)}`,
    `triangles: now:${formatValue(perf.structureTrianglesSubmittedPerFrame)} avoided:${formatValue(perf.structureEstimatedTrianglesAvoidedPerFrame)}`,
    `batch: ${structureFamily ? `cmd:${structureFamily.commands} batch:${structureFamily.batches} avg:${structureFamily.averageRunLength.toFixed(1)} dom:${structureFamily.dominantBreakReason}` : "none"}`,
  ];
  const textures = [
    `perf(textures): unique:${formatValue(perf.webglUniqueTexturesPerFrame)} binds:${formatValue(perf.webglTextureBindsPerFrame)} uploads:${formatValue(perf.webglBufferUploadsPerFrame)}`,
    `breaks(texture): ${audit?.breakReasonCounts["texture changed"] ?? 0} shared:${formatPercent(sharedTexturePct)}`,
    ...topFamiliesByUniqueTextures(audit?.familySummaries ?? [], 3).map((summary) => (
      `texFam ${summary.family}: unique:${summary.uniqueTextures} cmd:${summary.commands} batch:${summary.batches} dom:${summary.dominantBreakReason}`
    )),
  ];
  const ground = [
    `perf(ground): surf seen:${formatValue(perf.groundStaticSurfaceExaminedPerFrame)} filtered:${formatValue(perf.groundStaticSurfaceAuthorityFilteredPerFrame)} fallback:${formatValue(perf.groundStaticSurfaceFallbackEmittedPerFrame)}`,
    `decal seen:${formatValue(perf.groundStaticDecalExaminedPerFrame)} filtered:${formatValue(perf.groundStaticDecalAuthorityFilteredPerFrame)} fallback:${formatValue(perf.groundStaticDecalFallbackEmittedPerFrame)}`,
    perf.backendSelected === "webgl"
      ? `chunks: visible:${formatValue(perf.webglGroundChunksVisiblePerFrame)} quads:${formatValue(perf.webglGroundChunkDrawsPerFrame)}`
      : `chunks: visible:${formatValue(perf.canvasGroundChunksVisiblePerFrame)} quads:${formatValue(perf.canvasGroundChunkDrawsPerFrame)} rebuild:${formatValue(perf.canvasGroundChunkRebuildsPerFrame)}`,
    `backendGround: webgl:${formatValue(perf.backendWebglGroundCommandsPerFrame)} unsupported:${formatValue(perf.backendUnsupportedGroundCommandsPerFrame)}`,
  ];
  const lighting = [
    `perf(lighting): masks build:${formatValue(perf.maskBuildsPerFrame)} hit:${formatValue(perf.maskCacheHitsPerFrame)} miss:${formatValue(perf.maskCacheMissesPerFrame)}`,
    `maskWork: raster:${formatValue(perf.maskRasterChunksPerFrame)} draw:${formatValue(perf.maskDrawEntriesPerFrame)} bands:${formatValue(perf.lightBandCountPerFrame)}`,
    `sun: ${input.shadowSunModel.timeLabel} elev:${input.shadowSunModel.elevationDeg.toFixed(1)} amb:${input.ambientSunLighting.ambientDarkness01.toFixed(3)}`,
    `backend: req=${perf.backendRequested} sel=${perf.backendSelected} fallback=${describeRenderBackendFallbackReason(perf.backendFallbackReason)}`,
    `family lights: ${lightFamily ? `cmd:${lightFamily.commands} batch:${lightFamily.batches} avg:${lightFamily.averageRunLength.toFixed(1)} dom:${lightFamily.dominantBreakReason}` : "none"}`,
  ];
  const cache = [
    `perf(cache): entries:${cacheMetrics.totalEntries} bytes:${formatCacheBytes(cacheMetrics.totalKnownBytes)} budget:${formatCacheBytes(cacheMetrics.totalBudgetBytes)}`,
    `hit:${cacheMetrics.totalHits} miss:${cacheMetrics.totalMisses} rate:${formatCacheHitRate(cacheMetrics.totalHits, cacheMetrics.totalMisses)}`,
    `churn: ins:${cacheMetrics.totalInserts} evict:${cacheMetrics.totalEvictions} clear:${cacheMetrics.totalClears}`,
    ...(groundChunkCacheMetric ? [`groundChunks: ${groundChunkCacheMetric.notes ?? "mode:unknown"}`] : []),
    ...summarizeTopCaches(cacheMetrics.caches, 3).map((cache) => (
      `cache ${cache.name}: entries:${cache.entryCount} bytes:${formatCacheBytes(cache.approxBytes)} status:${cache.status}`
    )),
  ];

  return {
    off: [],
    overview,
    world,
    structures,
    textures,
    ground,
    lighting,
    cache,
    all: [
      ...overview,
      ...world,
      ...structures,
      ...textures,
      ...ground,
      ...lighting,
      ...cache,
    ],
  };
}

function drawPerfLines(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, lines: readonly string[]): void {
  ctx.textAlign = "right";
  const x = cssW - 8;
  const lineH = 16;
  const y0 = cssH - 8 - lineH * (lines.length - 1);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y0 + i * lineH);
  }
  ctx.textAlign = "left";
}

function drawPerfGrid(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, lines: readonly string[]): void {
  if (lines.length <= 0) return;
  const lineH = 16;
  const availableHeight = Math.max(lineH, cssH - 16);
  const rowsPerColumn = Math.max(1, Math.floor(availableHeight / lineH));
  const columnCount = Math.max(1, Math.ceil(lines.length / rowsPerColumn));
  const gutter = 16;
  const columnWidth = Math.max(180, Math.floor((cssW - 16 - gutter * Math.max(0, columnCount - 1)) / columnCount));
  const topY = 16;

  ctx.textAlign = "right";
  for (let i = 0; i < lines.length; i++) {
    const column = Math.floor(i / rowsPerColumn);
    const row = i % rowsPerColumn;
    const x = cssW - 8 - (columnCount - 1 - column) * (columnWidth + gutter);
    const y = topY + row * lineH;
    ctx.fillText(lines[i], x, y);
  }
  ctx.textAlign = "left";
}

export function renderDebugLightingOverlay(input: RenderDebugScreenPassInput): void {
  const {
    ctx,
    cssW,
    cssH,
    dpr,
    flags,
    renderPerfCountersEnabled,
    shadowSunModel,
    ambientSunLighting,
    shadowSunDayCycleStatus,
    structureTriangleAdmissionMode,
    sliderPadding,
    playerCameraTx,
    playerCameraTy,
    structureTriangleCutoutEnabled,
    structureTriangleCutoutHalfWidth,
    structureTriangleCutoutHalfHeight,
    structureTriangleCutoutAlpha,
    roadWidthAtPlayer,
  } = input;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = "12px monospace";
  ctx.fillStyle = "#fff";

  if (renderPerfCountersEnabled) {
    const framePerf = buildFramePerf(input);
    const mode = flags.perfOverlayMode ?? "overview";
    const perfLines = mode === "all" ? framePerf.all : framePerf[mode].slice(0, 10);
    if (perfLines.length > 0) {
      if (mode === "all") {
        drawPerfGrid(ctx, cssW, cssH, perfLines);
      } else {
        drawPerfLines(ctx, cssW, cssH, perfLines);
      }
    }
  }

  let screenDebugLineY = 30;
  if (shadowSunDayCycleStatus.enabled) {
    const cycleLine = `dayCycle active mode:${shadowSunDayCycleStatus.cycleModeLabel} x${shadowSunDayCycleStatus.multiplier} steps:${shadowSunDayCycleStatus.stepsPerDay} span:${shadowSunDayCycleStatus.stepSpanMinutes.toFixed(1)}m seed:${shadowSunDayCycleStatus.manualSeedLabel} cont:${shadowSunDayCycleStatus.continuousTimeLabel} quant:${shadowSunDayCycleStatus.quantizedTimeLabel} idx:${shadowSunDayCycleStatus.stepIndex} ambElev:${ambientSunLighting.ambientElevationDeg.toFixed(1)} ambDark:${ambientSunLighting.ambientDarkness01.toFixed(3)} state:${shadowSunDayCycleStatus.advancing ? "advancing" : "frozen"} changed:${shadowSunDayCycleStatus.stepChanged ? 1 : 0} clamped:${shadowSunDayCycleStatus.advancementClamped ? 1 : 0} base:${shadowSunDayCycleStatus.baseRateLabel}`;
    ctx.fillText(cycleLine, 8, screenDebugLineY);
    screenDebugLineY += 16;
  }
  if (flags.showStructureTriangleFootprint) {
    const forward = shadowSunModel.forward;
    const projection = shadowSunModel.projectionDirection;
    const sunLine = `shadowSun ${shadowSunModel.timeLabel} elev:${shadowSunModel.elevationDeg.toFixed(1)} ambElev:${ambientSunLighting.ambientElevationDeg.toFixed(1)} ambDark:${ambientSunLighting.ambientDarkness01.toFixed(3)} dir:${shadowSunModel.directionLabel} f(${forward.x.toFixed(3)},${forward.y.toFixed(3)},${forward.z.toFixed(3)}) p(${projection.x.toFixed(3)},${projection.y.toFixed(3)}) step:${shadowSunModel.stepKey}`;
    ctx.fillText(sunLine, 8, screenDebugLineY);
    screenDebugLineY += 16;
  }

  if (flags.showRoadSemantic) {
    ctx.fillText(`roadW(player): ${roadWidthAtPlayer}`, 8, screenDebugLineY);
  }
  if (renderPerfCountersEnabled) {
    const perf = getRenderPerfSnapshot();
    const line = `triAdmission:${structureTriangleAdmissionMode} tileRadius:${sliderPadding} cutout:${structureTriangleCutoutEnabled ? "on" : "off"} center:${playerCameraTx},${playerCameraTy} size:${structureTriangleCutoutHalfWidth}x${structureTriangleCutoutHalfHeight} alpha:${structureTriangleCutoutAlpha.toFixed(2)} zBands:${formatValue(perf.zBandCountPerFrame)}`;
    ctx.fillText(line, 8, screenDebugLineY);
  }
  ctx.restore();
}
