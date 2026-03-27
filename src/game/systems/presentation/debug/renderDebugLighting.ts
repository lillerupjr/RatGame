import { getRenderPerfSnapshot } from "../renderPerfCounters";
import type { RenderDebugScreenPassInput } from "./debugRenderTypes";
import { drawStructureV6FaceSliceDebugPanel } from "./renderDebugStructures";
import { describeRenderBackendFallbackReason } from "../backend/renderBackendSelection";
import type { CacheMetricSample } from "../cacheMetricsRegistry";
import type { WorldBatchAudit, WorldBatchBreakReason } from "./worldBatchAudit";

function summarizeBackendFamilyCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([key, value]) => `${key}:${value.toFixed(1)}`);
  return entries.length > 0 ? entries.join(" ") : "none";
}

function summarizeBackendSemanticFamilyCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([key, value]) => `${key}:${value.toFixed(1)}`);
  return entries.length > 0 ? entries.join(" ") : "none";
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

function summarizeTopCaches(caches: CacheMetricSample[]): CacheMetricSample[] {
  return [...caches]
    .sort((a, b) => {
      const aBytes = a.approxBytes ?? -1;
      const bBytes = b.approxBytes ?? -1;
      if (aBytes !== bBytes) return bBytes - aBytes;
      if (a.entryCount !== b.entryCount) return b.entryCount - a.entryCount;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 6);
}

function summarizeWorldBreakReasons(audit: WorldBatchAudit): string {
  const reasons: WorldBatchBreakReason[] = [
    "texture changed",
    "shader/material changed",
    "blend mode changed",
    "primitive type changed",
    "render family changed",
    "unsupported/fallback path changed",
    "non-batchable path",
    "other state incompatibility",
  ];
  return reasons
    .filter((reason) => audit.breakReasonCounts[reason] > 0)
    .map((reason) => `${reason}:${audit.breakReasonCounts[reason]}`)
    .slice(0, 4)
    .join(" ");
}

export function renderDebugLightingOverlay(input: RenderDebugScreenPassInput): void {
  const {
    ctx,
    cssW,
    cssH,
    dpr,
    flags,
    renderPerfCountersEnabled,
    structureShadowRouting,
    structureV6VerticalShadowDebugData,
    structureV6ShadowDebugCandidateCount,
    structureV6ShadowCastCount,
    structureV6ShadowCacheStats,
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
    worldBatchAudit,
  } = input;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = "12px monospace";
  ctx.fillStyle = "#fff";

  if (
    structureShadowRouting.usesV6Debug
    && flags.shadowV6FaceSliceDebugOverlay
    && structureV6VerticalShadowDebugData
  ) {
    drawStructureV6FaceSliceDebugPanel(ctx, cssW, cssH, structureV6VerticalShadowDebugData);
  }

  const perf = getRenderPerfSnapshot();
  if (renderPerfCountersEnabled) {
    const tag = perf.drawImageByTagPerFrame;
    const saveTag = perf.saveByTagPerFrame;
    const restoreTag = perf.restoreByTagPerFrame;
    const rendererSpecificLines = perf.backendSelected === "webgl"
      ? [
          `gl draw/frame: ${perf.webglDrawCallsPerFrame.toFixed(1)} gl batches/frame: ${perf.webglBatchesPerFrame.toFixed(1)}`,
          `texBind/frame: ${perf.webglTextureBindsPerFrame.toFixed(1)} bufUpload/frame: ${perf.webglBufferUploadsPerFrame.toFixed(1)}`,
          `gl composites/frame: ${perf.webglCanvasCompositesPerFrame.toFixed(1)} projectedSurface/frame: ${perf.webglProjectedSurfaceDrawsPerFrame.toFixed(1)} triSubmit/frame: ${perf.webglTrianglesSubmittedPerFrame.toFixed(1)}`,
          `groundChunkDraw/frame: ${perf.webglGroundChunkDrawsPerFrame.toFixed(1)} visibleGroundChunks/frame: ${perf.webglGroundChunksVisiblePerFrame.toFixed(1)} groundChunkTextureUpload/frame: ${perf.webglGroundChunkTextureUploadsPerFrame.toFixed(1)}`,
          `gl uniqueTextures/frame: ${perf.webglUniqueTexturesPerFrame.toFixed(1)}`,
        ]
      : [
          `drawImage/frame: ${perf.drawImageCallsPerFrame.toFixed(1)}`,
          `groundChunkDraw/frame: ${perf.canvasGroundChunkDrawsPerFrame.toFixed(1)} visibleChunks/frame: ${perf.canvasGroundChunksVisiblePerFrame.toFixed(1)} rebuildChunks/frame: ${perf.canvasGroundChunkRebuildsPerFrame.toFixed(1)}`,
          `tag void:${tag.void.toFixed(1)} floors:${tag.floors.toFixed(1)} decals:${tag.decals.toFixed(1)} ent:${tag.entities.toFixed(1)}`,
          `tag structLive:${tag["structures:live"].toFixed(1)} structShadow:${tag["structures:shadow"].toFixed(1)}`,
          `tag lighting:${tag.lighting.toFixed(1)} untagged:${tag.untagged.toFixed(1)}`,
          `gradientCreate/frame: ${perf.gradientCreateCallsPerFrame.toFixed(1)} addColorStop/frame: ${perf.addColorStopCallsPerFrame.toFixed(1)}`,
          `save/frame: ${perf.saveCallsPerFrame.toFixed(1)} restore/frame: ${perf.restoreCallsPerFrame.toFixed(1)}`,
          `saveTag fl:${saveTag.floors.toFixed(1)} de:${saveTag.decals.toFixed(1)} li:${saveTag.lighting.toFixed(1)} un:${saveTag.untagged.toFixed(1)}`,
          `saveTag structLive:${saveTag["structures:live"].toFixed(1)} structShadow:${saveTag["structures:shadow"].toFixed(1)}`,
          `restoreTag fl:${restoreTag.floors.toFixed(1)} de:${restoreTag.decals.toFixed(1)} li:${restoreTag.lighting.toFixed(1)} un:${restoreTag.untagged.toFixed(1)}`,
          `restoreTag structLive:${restoreTag["structures:live"].toFixed(1)} structShadow:${restoreTag["structures:shadow"].toFixed(1)}`,
          `fullCanvasBlits/frame: ${perf.fullCanvasBlitsPerFrame.toFixed(1)}`,
        ];
    const cacheSummaryLines = (() => {
      const cacheMetrics = perf.cacheMetrics;
      const topCaches = summarizeTopCaches(cacheMetrics.caches);
      const lines = [
        `cache totals: entries:${cacheMetrics.totalEntries} bytes:${formatCacheBytes(cacheMetrics.totalKnownBytes)} hit:${cacheMetrics.totalHits} miss:${cacheMetrics.totalMisses} rate:${formatCacheHitRate(cacheMetrics.totalHits, cacheMetrics.totalMisses)}`,
        `cache churn: insert:${cacheMetrics.totalInserts} evict:${cacheMetrics.totalEvictions} clear:${cacheMetrics.totalClears} budget:${formatCacheBytes(cacheMetrics.totalBudgetBytes)}`,
      ];
      for (const cache of topCaches) {
        lines.push(
          `cache ${cache.name} kind:${cache.kind} entries:${cache.entryCount} bytes:${formatCacheBytes(cache.approxBytes)} hit:${cache.hits} miss:${cache.misses} evict:${cache.evictions} clear:${cache.clears} status:${cache.status}${cache.notes ? ` notes:${cache.notes}` : ""}`,
        );
      }
      return lines;
    })();
    const perfLines = [
      ...rendererSpecificLines,
      `groundAuthority surface/frame: seen:${perf.groundStaticSurfaceExaminedPerFrame.toFixed(1)} filtered:${perf.groundStaticSurfaceAuthorityFilteredPerFrame.toFixed(1)} fallback:${perf.groundStaticSurfaceFallbackEmittedPerFrame.toFixed(1)}`,
      `groundAuthority decal/frame: seen:${perf.groundStaticDecalExaminedPerFrame.toFixed(1)} filtered:${perf.groundStaticDecalAuthorityFilteredPerFrame.toFixed(1)} fallback:${perf.groundStaticDecalFallbackEmittedPerFrame.toFixed(1)}`,
      ...(worldBatchAudit
        ? [
            `worldBatch(${worldBatchAudit.inspectedBackend}): cmd:${worldBatchAudit.totalWorldCommands} batch:${worldBatchAudit.totalWorldBatches} avg:${worldBatchAudit.averageRunLength.toFixed(1)} max:${worldBatchAudit.maxRunLength} cont:${worldBatchAudit.compatibleContinuations} breaks:${worldBatchAudit.totalBatchBreaks}`,
            `worldBreaks: ${summarizeWorldBreakReasons(worldBatchAudit) || "none"}`,
            ...worldBatchAudit.familySummaries
              .slice(0, 5)
              .map((summary) => (
                `worldFam ${summary.family} cmd:${summary.commands} batch:${summary.batches} avg:${summary.averageRunLength.toFixed(1)} max:${summary.maxRunLength} tex:${summary.uniqueTextures} dom:${summary.dominantBreakReason}`
              )),
            ...worldBatchAudit.sampleBoundaries
              .slice(0, 3)
              .map((boundary) => (
                `worldBoundary ${boundary.index}->${boundary.index + 1} ${boundary.reason} | ${boundary.previous} -> ${boundary.next}`
              )),
          ]
        : []),
      `closures/frame: ${perf.closuresCreatedPerFrame.toFixed(1)}`,
      `sliceSorts/frame: ${perf.sliceKeySortsPerFrame.toFixed(1)} drawableSorts/frame: ${perf.drawableSortsPerFrame.toFixed(1)}`,
      `tileRadius: ${perf.tileLoopRadius.toFixed(0)} tileLoopIters/frame: ${perf.tileLoopIterationsPerFrame.toFixed(1)}`,
      `triAdmission: mode=${structureTriangleAdmissionMode} authority=${structureTriangleAdmissionMode === "viewport" ? "viewportRect" : "sharedRenderDistance(tileRadius)"} tileRadius=${sliderPadding}`,
      `triCutout: ${structureTriangleCutoutEnabled ? "on" : "off"} center=${playerCameraTx},${playerCameraTy} size=${structureTriangleCutoutHalfWidth}x${structureTriangleCutoutHalfHeight} alpha=${structureTriangleCutoutAlpha.toFixed(2)}`,
      `bands z:${perf.zBandCountPerFrame.toFixed(1)} light:${perf.lightBandCountPerFrame.toFixed(1)} masks build:${perf.maskBuildsPerFrame.toFixed(1)} hit:${perf.maskCacheHitsPerFrame.toFixed(1)} miss:${perf.maskCacheMissesPerFrame.toFixed(1)}`,
      `masks rasterChunks/frame: ${perf.maskRasterChunksPerFrame.toFixed(1)} drawEntries/frame: ${perf.maskDrawEntriesPerFrame.toFixed(1)}`,
      `backend: req=${perf.backendRequested} selected=${perf.backendSelected} default=${perf.backendDefault} webglDefault=${perf.backendWebglReadyForDefault ? "yes" : "no"}`,
      `backend counts: webgl:${perf.backendWebglCommandsPerFrame.toFixed(1)} canvas:${perf.backendCanvasFallbackCommandsPerFrame.toFixed(1)} unsupported:${perf.backendUnsupportedCommandsPerFrame.toFixed(1)}`,
      `backend ground: webgl:${perf.backendWebglGroundCommandsPerFrame.toFixed(1)} unsupported:${perf.backendUnsupportedGroundCommandsPerFrame.toFixed(1)}`,
      `backend fallback reason: ${describeRenderBackendFallbackReason(perf.backendFallbackReason)}`,
      `backend unsupported axes: ${perf.backendUnsupportedCommandKeys.length > 0 ? perf.backendUnsupportedCommandKeys.join(", ") : "none"}`,
      `backend unsupported semantic families: ${summarizeBackendSemanticFamilyCounts(perf.backendUnsupportedBySemanticFamilyPerFrame)}`,
      `backend webgl axes: ${summarizeBackendFamilyCounts(perf.backendWebglByAxesPerFrame)}`,
      `backend canvas axes: ${summarizeBackendFamilyCounts(perf.backendCanvasFallbackByAxesPerFrame)}`,
      `backend partial axes: ${perf.backendPartiallyHandledAxes.length > 0 ? perf.backendPartiallyHandledAxes.join(", ") : "none"}`,
      ...cacheSummaryLines,
    ];
    ctx.textAlign = "right";
    const perfX = cssW - 8;
    const perfLineH = 16;
    const perfY0 = cssH - 8 - perfLineH * (perfLines.length - 1);
    for (let i = 0; i < perfLines.length; i++) {
      ctx.fillText(perfLines[i], perfX, perfY0 + i * perfLineH);
    }
    ctx.textAlign = "left";
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
    const sunLine = `shadowSun ${shadowSunModel.timeLabel} caster:${flags.shadowCasterMode} elev:${shadowSunModel.elevationDeg.toFixed(1)} ambElev:${ambientSunLighting.ambientElevationDeg.toFixed(1)} ambDark:${ambientSunLighting.ambientDarkness01.toFixed(3)} dir:${shadowSunModel.directionLabel} f(${forward.x.toFixed(3)},${forward.y.toFixed(3)},${forward.z.toFixed(3)}) p(${projection.x.toFixed(3)},${projection.y.toFixed(3)}) step:${shadowSunModel.stepKey}`;
    ctx.fillText(sunLine, 8, screenDebugLineY);
    screenDebugLineY += 16;

    if (structureShadowRouting.usesV6Debug) {
      const selectedId = structureV6VerticalShadowDebugData?.structureInstanceId ?? "none";
      const bucketATris = structureV6VerticalShadowDebugData?.bucketAShadow?.sourceTriangleCount ?? 0;
      const bucketBTriCount = structureV6VerticalShadowDebugData?.bucketBShadow?.sourceTriangleCount ?? 0;
      const topTriCount = structureV6VerticalShadowDebugData?.topShadow?.sourceTriangleCount ?? 0;
      const bucketACastSlices = structureV6VerticalShadowDebugData?.bucketAShadow?.nonEmptySliceCount ?? 0;
      const bucketBCastSlices = structureV6VerticalShadowDebugData?.bucketBShadow?.nonEmptySliceCount ?? 0;
      const topCastSlices = structureV6VerticalShadowDebugData?.topShadow?.nonEmptySliceCount ?? 0;
      const shadowVector = structureV6VerticalShadowDebugData?.shadowVector ?? { x: 0, y: 0 };
      const v6Mode = [
        flags.shadowV6OneStructureOnly ? "one" : flags.shadowV6AllStructures ? "all" : "none",
        flags.shadowV6VerticalOnly ? "verticalOnly" : "vertical+top",
        flags.shadowV6TopOnly ? "topOnly" : "top+vertical",
      ].join("|");
      const v6Line = `v6Diag buckets:${flags.shadowV6PrimarySemanticBucket}+${flags.shadowV6SecondarySemanticBucket}+${flags.shadowV6TopSemanticBucket} reqBucket:${flags.shadowV6RequestedSemanticBucket} structReq:${flags.shadowV6StructureIndex} selected:${selectedId} candidates:${structureV6ShadowDebugCandidateCount} castStruct:${structureV6ShadowCastCount} mode:${v6Mode} triEW:${bucketATris} triSN:${bucketBTriCount} triTOP:${topTriCount} castEW:${bucketACastSlices} castSN:${bucketBCastSlices} castTOP:${topCastSlices} vec(${shadowVector.x.toFixed(1)},${shadowVector.y.toFixed(1)})`;
      ctx.fillText(v6Line, 8, screenDebugLineY);
      screenDebugLineY += 16;
      const cacheStats = structureV6ShadowCacheStats;
      const v6CacheLine = `v6Cache sun:${cacheStats?.sunStepKey ?? shadowSunModel.stepKey} hit:${cacheStats?.cacheHits ?? 0} miss:${cacheStats?.cacheMisses ?? 0} rebuilt:${cacheStats?.rebuiltStructures ?? 0} reused:${cacheStats?.reusedStructures ?? 0} changed:${cacheStats?.sunStepChanged ? 1 : 0} force:${(flags.shadowV6ForceRefresh || cacheStats?.forceRefresh) ? 1 : 0} size:${cacheStats?.cacheSize ?? 0}`;
      ctx.fillText(v6CacheLine, 8, screenDebugLineY);
      screenDebugLineY += 16;
    }
  }

  if (flags.showRoadSemantic) {
    ctx.fillText(`roadW(player): ${roadWidthAtPlayer}`, 8, screenDebugLineY);
  }
  ctx.restore();
}
