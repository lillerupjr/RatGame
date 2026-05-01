import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginRenderPerfFrame,
  countRenderCanvasGroundChunkDraw,
  countRenderCanvasGroundChunkRebuild,
  countRenderCanvasGroundChunksVisible,
  countRenderGroundStaticDecalAuthorityFiltered,
  countRenderGroundStaticDecalExamined,
  countRenderGroundStaticDecalFallbackEmitted,
  countRenderGroundStaticSurfaceAuthorityFiltered,
  countRenderGroundStaticSurfaceExamined,
  countRenderGroundStaticSurfaceFallbackEmitted,
  countRenderStructureEstimatedTrianglesAvoided,
  countRenderStructureGroupedPostSubmission,
  countRenderStructureGroupedPreSubmission,
  countRenderStructureMonolithicGroupSubmission,
  countRenderStructureMonolithicTriangles,
  countRenderStructureMergedSliceCacheHit,
  countRenderStructureMergedSliceCacheMiss,
  countRenderStructureMergedSliceCacheRebuild,
  countRenderStructureMergedSliceSubmission,
  countRenderStructureQuadApproxAccepted,
  countRenderStructureQuadApproxRejected,
  countRenderStructureRectMeshMigratedToQuad,
  countRenderStructureRectMeshSubmission,
  countRenderStructureSingleQuadSubmission,
  countRenderStructureTotalSubmission,
  countRenderStructureTrianglesSubmitted,
  countRenderStaticAtlasBypass,
  countRenderStaticAtlasFallback,
  countRenderStaticAtlasHit,
  countRenderStaticAtlasMiss,
  countRenderStaticAtlasRequest,
  countRenderWebGLBatch,
  countRenderWebGLBufferUpload,
  countRenderWebGLCanvasComposite,
  countRenderWebGLDrawCall,
  countRenderDynamicAtlasBypass,
  countRenderDynamicAtlasFallback,
  countRenderDynamicAtlasHit,
  countRenderDynamicAtlasMiss,
  countRenderDynamicAtlasRequest,
  countRenderWebGLGroundChunkDraw,
  countRenderWebGLGroundChunkTextureUpload,
  countRenderWebGLGroundChunksVisible,
  countRenderWebGLProjectedSurfaceDraw,
  countRenderWebGLTextureBind,
  countRenderWebGLTrianglesSubmitted,
  endRenderPerfFrame,
  getRenderPerfSnapshot,
  noteRenderWebGLTextureUsage,
  setRenderDynamicAtlasTextureCount,
  setRenderBackendStats,
  setRenderPerfCountersEnabled,
  setRenderStaticAtlasTextureCount,
} from "../../../../game/systems/presentation/renderPerfCounters";
import {
  registerCacheMetricSource,
  resetCacheMetricsRegistryForTests,
} from "../../../../game/systems/presentation/cacheMetricsRegistry";
import {
  buildLoadProfilerOverlayLines,
  buildRenderDebugLightingSnapshotText,
  renderDebugLightingOverlay,
} from "../../../../game/systems/presentation/debug/renderDebugLighting";
import type { LoadProfilerSummary } from "../../../../game/app/loadingFlow";

function resetPerfCounters(): void {
  setRenderPerfCountersEnabled(false);
  setRenderPerfCountersEnabled(true);
}

function publishCurrentPerfFrame(): void {
  endRenderPerfFrame(0);
  endRenderPerfFrame(1);
}

function fakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    fillText: vi.fn(),
    font: "",
    fillStyle: "#fff",
    textAlign: "left" as CanvasTextAlign,
  } as unknown as CanvasRenderingContext2D & {
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    setTransform: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
  };
}

function makeFlags(mode: "off" | "overview" | "world" | "structures" | "textures" | "ground" | "lighting" | "cache" | "all" = "overview") {
  return {
    perfOverlayMode: mode,
    showStructureTriangleFootprint: false,
    showRoadSemantic: false,
  } as any;
}

function setBackend(selectedBackend: "canvas2d" | "webgl"): void {
  setRenderBackendStats({
    requestedBackend: selectedBackend,
    selectedBackend,
    defaultBackend: selectedBackend,
    webglReadyForDefault: selectedBackend === "webgl",
    fallbackReason: null,
    webglCommandCount: selectedBackend === "webgl" ? 4 : 0,
    canvasFallbackCommandCount: 0,
    unsupportedCommandCount: 0,
    webglGroundCommandCount: selectedBackend === "webgl" ? 2 : 0,
    unsupportedGroundCommandCount: 0,
    unsupportedCommandKeys: [],
    webglByAxes: selectedBackend === "webgl" ? { "groundSurface:quad": 2 } : {},
    canvasFallbackByAxes: {},
    unsupportedByAxes: {},
    unsupportedBySemanticFamily: {},
    partiallyHandledAxes: [],
  });
}

describe("render perf counters", () => {
  beforeEach(() => {
    resetCacheMetricsRegistryForTests();
  });

  it("builds compact load profiler overlay lines only when summary data exists", () => {
    const summary: LoadProfilerSummary = {
      status: "completed",
      mapId: "downtown",
      startedAtMs: 0,
      completedAtMs: 150,
      totalLoadTimeMs: 150,
      firstVisibleFrameTimeMs: 162,
      fullyReadyTimeMs: null,
      topPhases: [
        {
          name: "PREWARM_DEPENDENCIES",
          stage: "PREWARM_DEPENDENCIES",
          order: 2,
          status: "completed",
          durationMs: 60,
          attemptCount: 1,
          startedAtMs: 30,
          endedAtMs: 90,
          metadata: { mapId: "downtown" },
        },
        {
          name: "PREPARE_STRUCTURE_TRIANGLES",
          stage: "PREPARE_STRUCTURE_TRIANGLES",
          order: 3,
          status: "completed",
          durationMs: 30,
          attemptCount: 1,
          startedAtMs: 90,
          endedAtMs: 120,
          metadata: { mapId: "downtown" },
        },
        {
          name: "PRECOMPUTE_STATIC_MAP",
          stage: "PRECOMPUTE_STATIC_MAP",
          order: 1,
          status: "completed",
          durationMs: 20,
          attemptCount: 1,
          startedAtMs: 10,
          endedAtMs: 30,
          metadata: { mapId: "downtown" },
        },
      ],
    };

    expect(buildLoadProfilerOverlayLines(null)).toEqual([]);
    expect(buildLoadProfilerOverlayLines({
      ...summary,
      status: "idle",
      totalLoadTimeMs: null,
    })).toEqual([]);
    expect(buildLoadProfilerOverlayLines(summary)).toEqual([
      "LOAD total:150ms first:162ms ready:n/a",
      "LOAD 1 PREWARM_DEPENDENCIES:60ms",
      "LOAD 2 PREPARE_STRUCTURE_TRIANGLES:30ms",
      "LOAD 3 PRECOMPUTE_STATIC_MAP:20ms",
    ]);
  });

  it("captures WebGL frame counters in the shared snapshot model", () => {
    resetPerfCounters();
    beginRenderPerfFrame(320, 180);
    countRenderWebGLDrawCall(3);
    countRenderWebGLBatch(2);
    countRenderWebGLTextureBind(5);
    countRenderWebGLBufferUpload(7);
    countRenderWebGLCanvasComposite(1);
    countRenderWebGLProjectedSurfaceDraw(2);
    countRenderWebGLTrianglesSubmitted(9);
    countRenderWebGLGroundChunkDraw(3);
    countRenderWebGLGroundChunksVisible(4);
    countRenderWebGLGroundChunkTextureUpload(1);
    countRenderGroundStaticSurfaceExamined(10);
    countRenderGroundStaticSurfaceAuthorityFiltered(8);
    countRenderGroundStaticSurfaceFallbackEmitted(2);
    countRenderGroundStaticDecalExamined(6);
    countRenderGroundStaticDecalAuthorityFiltered(5);
    countRenderGroundStaticDecalFallbackEmitted(1);
    countRenderStructureTotalSubmission(7);
    countRenderStructureRectMeshSubmission(3);
    countRenderStructureRectMeshMigratedToQuad(3);
    countRenderStructureMonolithicGroupSubmission(4);
    countRenderStructureMonolithicTriangles(18);
    countRenderStructureSingleQuadSubmission(4);
    countRenderStructureQuadApproxAccepted(1);
    countRenderStructureQuadApproxRejected(3);
    countRenderStructureGroupedPreSubmission(6);
    countRenderStructureGroupedPostSubmission(2);
    countRenderStructureMergedSliceSubmission(2);
    countRenderStructureMergedSliceCacheHit(5);
    countRenderStructureMergedSliceCacheMiss(1);
    countRenderStructureMergedSliceCacheRebuild(1);
    countRenderStructureTrianglesSubmitted(12);
    countRenderStructureEstimatedTrianglesAvoided(9);
    countRenderStaticAtlasRequest(5);
    countRenderStaticAtlasHit(4);
    countRenderStaticAtlasMiss(1);
    countRenderStaticAtlasBypass(2);
    countRenderStaticAtlasFallback(1);
    setRenderStaticAtlasTextureCount(3);
    countRenderDynamicAtlasRequest(7);
    countRenderDynamicAtlasHit(3);
    countRenderDynamicAtlasMiss(4);
    countRenderDynamicAtlasBypass(5);
    countRenderDynamicAtlasFallback(4);
    setRenderDynamicAtlasTextureCount(6);
    noteRenderWebGLTextureUsage({ id: "a" });
    noteRenderWebGLTextureUsage({ id: "b" });
    setBackend("webgl");
    publishCurrentPerfFrame();

    const snapshot = getRenderPerfSnapshot();
    expect(snapshot.backendSelected).toBe("webgl");
    expect(snapshot.webglDrawCallsPerFrame).toBe(3);
    expect(snapshot.webglBatchesPerFrame).toBe(2);
    expect(snapshot.webglTextureBindsPerFrame).toBe(5);
    expect(snapshot.webglBufferUploadsPerFrame).toBe(7);
    expect(snapshot.webglCanvasCompositesPerFrame).toBe(1);
    expect(snapshot.webglProjectedSurfaceDrawsPerFrame).toBe(2);
    expect(snapshot.webglTrianglesSubmittedPerFrame).toBe(9);
    expect(snapshot.webglUniqueTexturesPerFrame).toBe(2);
    expect(snapshot.webglGroundChunkDrawsPerFrame).toBe(3);
    expect(snapshot.webglGroundChunksVisiblePerFrame).toBe(4);
    expect(snapshot.webglGroundChunkTextureUploadsPerFrame).toBe(1);
    expect(snapshot.groundStaticSurfaceExaminedPerFrame).toBe(10);
    expect(snapshot.groundStaticSurfaceAuthorityFilteredPerFrame).toBe(8);
    expect(snapshot.groundStaticSurfaceFallbackEmittedPerFrame).toBe(2);
    expect(snapshot.groundStaticDecalExaminedPerFrame).toBe(6);
    expect(snapshot.groundStaticDecalAuthorityFilteredPerFrame).toBe(5);
    expect(snapshot.groundStaticDecalFallbackEmittedPerFrame).toBe(1);
    expect(snapshot.structureTotalSubmissionsPerFrame).toBe(7);
    expect(snapshot.structureRectMeshSubmissionsPerFrame).toBe(3);
    expect(snapshot.structureRectMeshMigratedToQuadPerFrame).toBe(3);
    expect(snapshot.structureMonolithicGroupSubmissionsPerFrame).toBe(4);
    expect(snapshot.structureMonolithicTrianglesPerFrame).toBe(18);
    expect(snapshot.structureSingleQuadSubmissionsPerFrame).toBe(4);
    expect(snapshot.structureQuadApproxAcceptedPerFrame).toBe(1);
    expect(snapshot.structureQuadApproxRejectedPerFrame).toBe(3);
    expect(snapshot.structureGroupedPreSubmissionsPerFrame).toBe(6);
    expect(snapshot.structureGroupedPostSubmissionsPerFrame).toBe(2);
    expect(snapshot.structureMergedSliceSubmissionsPerFrame).toBe(2);
    expect(snapshot.structureMergedSliceCacheHitsPerFrame).toBe(5);
    expect(snapshot.structureMergedSliceCacheMissesPerFrame).toBe(1);
    expect(snapshot.structureMergedSliceCacheRebuildsPerFrame).toBe(1);
    expect(snapshot.structureTrianglesSubmittedPerFrame).toBe(12);
    expect(snapshot.structureEstimatedTrianglesAvoidedPerFrame).toBe(9);
    expect(snapshot.staticAtlasRequestsPerFrame).toBe(5);
    expect(snapshot.staticAtlasHitsPerFrame).toBe(4);
    expect(snapshot.staticAtlasMissesPerFrame).toBe(1);
    expect(snapshot.staticAtlasBypassesPerFrame).toBe(2);
    expect(snapshot.staticAtlasFallbacksPerFrame).toBe(1);
    expect(snapshot.staticAtlasTexturesPerFrame).toBe(3);
    expect(snapshot.dynamicAtlasRequestsPerFrame).toBe(7);
    expect(snapshot.dynamicAtlasHitsPerFrame).toBe(3);
    expect(snapshot.dynamicAtlasMissesPerFrame).toBe(4);
    expect(snapshot.dynamicAtlasBypassesPerFrame).toBe(5);
    expect(snapshot.dynamicAtlasFallbacksPerFrame).toBe(4);
    expect(snapshot.dynamicAtlasTexturesPerFrame).toBe(6);
  });

  it("includes hostile spawn overlay rows in the perf snapshot text", () => {
    const ctx = fakeCtx();

    const snapshotText = buildRenderDebugLightingSnapshotText({
      ctx,
      cssW: 320,
      cssH: 180,
      dpr: 1,
      flags: makeFlags("overview"),
      fps: 60,
      frameTimeMs: 16.7,
      renderPerfCountersEnabled: true,
      shadowSunModel: { forward: { x: 0, y: 0, z: 0 }, projectionDirection: { x: 0, y: 0 }, timeLabel: "", elevationDeg: 0, directionLabel: "", stepKey: "" },
      shadowSunDayCycleStatus: {
        enabled: false,
        cycleModeLabel: "",
        multiplier: 1,
        stepsPerDay: 0,
        stepSpanMinutes: 0,
        manualSeedLabel: "",
        continuousTimeLabel: "",
        quantizedTimeLabel: "",
        stepIndex: 0,
        advancing: false,
        stepChanged: false,
        advancementClamped: false,
        baseRateLabel: "",
      },
      ambientSunLighting: {
        ambientElevationDeg: 0,
        ambientDarkness01: 0,
      },
      structureTriangleAdmissionMode: "viewport",
      sliderPadding: 0,
      playerCameraTx: 0,
      playerCameraTy: 0,
      structureTriangleCutoutEnabled: false,
      structureTriangleCutoutHalfWidth: 0,
      structureTriangleCutoutHalfHeight: 0,
      structureTriangleCutoutAlpha: 0,
      roadWidthAtPlayer: 0,
      worldBatchAudit: null,
      hostileSpawnDebug: {
        budget: 5.2,
        powerPerSec: 1.3,
        liveThreat: 8.0,
        liveThreatCap: 12.0,
        stockpileCap: 15.6,
        threatRoom: 4.0,
        spawnCooldownSec: 0.8,
        burstCooldownSec: 6.2,
        lastMode: "normal",
        totalAliveHostileEnemies: 14,
        aliveByRole: {
          baseline_chaser: 6,
          fast_chaser: 3,
          tank: 2,
          ranged: 2,
          suicide: 1,
          leaper: 0,
          special: 0,
        },
        lastRequests: [
          { enemyId: 1 as any, count: 3, reason: "normal" },
          { enemyId: 2 as any, count: 2, reason: "normal" },
        ],
        requestCount: 2,
        spawnAttempts: 5,
        successfulSpawns: 3,
        failedPlacements: 2,
      },
    } as any);

    expect(snapshotText).toContain("SPAWN ECON:");
    expect(snapshotText).toContain("budget: 5.20");
    expect(snapshotText).toContain("threat: 8.00 / 12.00");
    expect(snapshotText).toContain("STATE:");
    expect(snapshotText).toContain("mode: normal");
    expect(snapshotText).toContain("last: Minionx3.0 Runnerx2.0");
    expect(snapshotText).toContain("ALIVE:");
    expect(snapshotText).toContain("roles: base=6.0 fast=3.0 tank=2.0 ranged=2.0 suicide=1.0 leaper=0.0 special=0.0");
    expect(snapshotText).toContain("EXEC:");
    expect(snapshotText).toContain("req: 2.0");
    expect(snapshotText).toContain("fail: 2.0");
  });

  it("groups overlay diagnostics by selected perf mode", () => {
    const ctx = fakeCtx();
    registerCacheMetricSource({
      name: "testCache",
      budgetBytes: 1024,
      sample: () => ({
        name: "testCache",
        kind: "derived",
        entryCount: 3,
        approxBytes: 2048,
        hits: 9,
        misses: 1,
        inserts: 2,
        evictions: 0,
        clears: 1,
        bounded: true,
        hasEviction: false,
      }),
    });

    resetPerfCounters();
    beginRenderPerfFrame(320, 180);
    countRenderWebGLDrawCall(4);
    countRenderWebGLBatch(3);
    countRenderWebGLTextureBind(6);
    countRenderWebGLGroundChunkDraw(2);
    countRenderWebGLGroundChunksVisible(5);
    countRenderWebGLGroundChunkTextureUpload(1);
    countRenderGroundStaticSurfaceExamined(12);
    countRenderGroundStaticSurfaceAuthorityFiltered(9);
    countRenderGroundStaticSurfaceFallbackEmitted(3);
    countRenderGroundStaticDecalExamined(7);
    countRenderGroundStaticDecalAuthorityFiltered(4);
    countRenderGroundStaticDecalFallbackEmitted(3);
    countRenderStructureTotalSubmission(5);
    countRenderStructureRectMeshSubmission(2);
    countRenderStructureRectMeshMigratedToQuad(2);
    countRenderStructureMonolithicGroupSubmission(3);
    countRenderStructureMonolithicTriangles(14);
    countRenderStructureSingleQuadSubmission(3);
    countRenderStructureQuadApproxAccepted(1);
    countRenderStructureQuadApproxRejected(2);
    countRenderStructureGroupedPreSubmission(4);
    countRenderStructureGroupedPostSubmission(1);
    countRenderStructureMergedSliceSubmission(1);
    countRenderStructureMergedSliceCacheHit(2);
    countRenderStructureMergedSliceCacheMiss(1);
    countRenderStructureMergedSliceCacheRebuild(1);
    countRenderStructureTrianglesSubmitted(10);
    countRenderStructureEstimatedTrianglesAvoided(6);
    countRenderStaticAtlasRequest(2717);
    countRenderStaticAtlasHit(2717);
    setRenderStaticAtlasTextureCount(3);
    countRenderDynamicAtlasRequest(12);
    countRenderDynamicAtlasHit(4);
    countRenderDynamicAtlasMiss(8);
    countRenderDynamicAtlasBypass(37);
    countRenderDynamicAtlasFallback(8);
    setRenderDynamicAtlasTextureCount(6);
    setBackend("webgl");
    publishCurrentPerfFrame();
    renderDebugLightingOverlay({
      ctx,
      cssW: 320,
      cssH: 180,
      dpr: 1,
      flags: makeFlags("overview"),
      fps: 60,
      frameTimeMs: 16.7,
      renderPerfCountersEnabled: true,
      shadowSunModel: { forward: { x: 0, y: 0, z: 0 }, projectionDirection: { x: 0, y: 0 }, timeLabel: "", elevationDeg: 0, directionLabel: "", stepKey: "" },
      shadowSunDayCycleStatus: {
        enabled: false,
        cycleModeLabel: "",
        multiplier: 1,
        stepsPerDay: 0,
        stepSpanMinutes: 0,
        manualSeedLabel: "",
        continuousTimeLabel: "",
        quantizedTimeLabel: "",
        stepIndex: 0,
        advancing: false,
        stepChanged: false,
        advancementClamped: false,
        baseRateLabel: "",
      },
      ambientSunLighting: {
        ambientElevationDeg: 0,
        ambientDarkness01: 0,
      },
      structureTriangleAdmissionMode: "viewport",
      sliderPadding: 0,
      playerCameraTx: 0,
      playerCameraTy: 0,
      structureTriangleCutoutEnabled: false,
      structureTriangleCutoutHalfWidth: 0,
      structureTriangleCutoutHalfHeight: 0,
      structureTriangleCutoutAlpha: 0,
      roadWidthAtPlayer: 0,
      worldBatchAudit: {
        inspectedBackend: "webgl",
        compatibilityFields: ["semanticFamily/finalForm", "texture identity"],
        totalWorldCommands: 12,
        quadCommands: 6,
        triangleCommands: 4,
        batchableCommands: 10,
        texturedCommands: 8,
        uniqueTextures: 3,
        totalWorldBatches: 5,
        averageRunLength: 2.4,
        maxRunLength: 4,
        compatibleContinuations: 7,
        totalBatchBreaks: 4,
        breakReasonCounts: {
          "compatible continuation": 7,
          "render family changed": 1,
          "primitive type changed": 0,
          "shader/material changed": 0,
          "texture changed": 2,
          "blend mode changed": 0,
          "unsupported/fallback path changed": 1,
          "non-batchable path": 0,
          "other state incompatibility": 0,
        },
        familySummaries: [{
          family: "props",
          commands: 6,
          batches: 3,
          averageRunLength: 2,
          maxRunLength: 3,
          uniqueTextures: 2,
          dominantBreakReason: "texture changed",
        }],
        sampleBoundaries: [{
          index: 3,
          reason: "texture changed",
          previous: "props worldSprite:quad texturedTriangles tex1 normal world",
          next: "props worldSprite:quad texturedTriangles tex2 normal world",
        }],
      },
    } as any);
    const webglLines = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(webglLines.some((line) => line.includes("perf(overview): fps:60"))).toBe(true);
    expect(webglLines.some((line) => line.includes("draws:4.0 batches:3.0 breaks:4"))).toBe(true);
    expect(webglLines.some((line) => line.includes("world: cmd:12 avgBatch:2.4 maxBatch:4"))).toBe(true);
    expect(webglLines.some((line) => line.includes("breaks: texture changed:2"))).toBe(true);
    expect(webglLines.some((line) => line.includes("textures: unique:0.0 binds:6.0"))).toBe(true);
    expect(webglLines.some((line) => line.includes("atlas(static): req:2717"))).toBe(true);
    expect(webglLines.some((line) => line.includes("atlas(dynamic): req:12 hit:4.0 miss:8.0 bypass:37"))).toBe(true);
    expect(webglLines.some((line) => line.includes("cache testCache"))).toBe(false);
    expect(webglLines.some((line) => line.includes("groundAuthority"))).toBe(false);

    const snapshotText = buildRenderDebugLightingSnapshotText({
      ctx,
      cssW: 320,
      cssH: 180,
      dpr: 1,
      flags: makeFlags("overview"),
      fps: 60,
      frameTimeMs: 16.7,
      renderPerfCountersEnabled: true,
      shadowSunModel: { forward: { x: 0, y: 0, z: 0 }, projectionDirection: { x: 0, y: 0 }, timeLabel: "", elevationDeg: 0, directionLabel: "", stepKey: "" },
      shadowSunDayCycleStatus: {
        enabled: false,
        cycleModeLabel: "",
        multiplier: 1,
        stepsPerDay: 0,
        stepSpanMinutes: 0,
        manualSeedLabel: "",
        continuousTimeLabel: "",
        quantizedTimeLabel: "",
        stepIndex: 0,
        advancing: false,
        stepChanged: false,
        advancementClamped: false,
        baseRateLabel: "",
      },
      ambientSunLighting: {
        ambientElevationDeg: 0,
        ambientDarkness01: 0,
      },
      structureTriangleAdmissionMode: "viewport",
      sliderPadding: 0,
      playerCameraTx: 0,
      playerCameraTy: 0,
      structureTriangleCutoutEnabled: false,
      structureTriangleCutoutHalfWidth: 0,
      structureTriangleCutoutHalfHeight: 0,
      structureTriangleCutoutAlpha: 0,
      roadWidthAtPlayer: 0,
      worldBatchAudit: {
        inspectedBackend: "webgl",
        compatibilityFields: ["semanticFamily/finalForm", "texture identity"],
        totalWorldCommands: 12,
        quadCommands: 6,
        triangleCommands: 4,
        batchableCommands: 10,
        texturedCommands: 8,
        uniqueTextures: 3,
        totalWorldBatches: 5,
        averageRunLength: 2.4,
        maxRunLength: 4,
        compatibleContinuations: 7,
        totalBatchBreaks: 4,
        breakReasonCounts: {
          "compatible continuation": 7,
          "render family changed": 1,
          "primitive type changed": 0,
          "shader/material changed": 0,
          "texture changed": 2,
          "blend mode changed": 0,
          "unsupported/fallback path changed": 1,
          "non-batchable path": 0,
          "other state incompatibility": 0,
        },
        familySummaries: [{
          family: "props",
          commands: 6,
          batches: 3,
          averageRunLength: 2,
          maxRunLength: 3,
          uniqueTextures: 2,
          dominantBreakReason: "texture changed",
        }],
        sampleBoundaries: [{
          index: 3,
          reason: "texture changed",
          previous: "props worldSprite:quad texturedTriangles tex1 normal world",
          next: "props worldSprite:quad texturedTriangles tex2 normal world",
        }],
      },
    } as any);
    expect(snapshotText).toContain("Perf Snapshot backend:webgl");
    expect(snapshotText).toContain("perf(overview): fps:60");
    expect(snapshotText).toContain("atlas(static): req:2717");
    expect(snapshotText).toContain("triAdmission:viewport");

    ctx.fillText.mockClear();

    renderDebugLightingOverlay({
      ctx,
      cssW: 320,
      cssH: 180,
      dpr: 1,
      flags: makeFlags("cache"),
      fps: 60,
      frameTimeMs: 16.7,
      renderPerfCountersEnabled: true,
      shadowSunModel: { forward: { x: 0, y: 0, z: 0 }, projectionDirection: { x: 0, y: 0 }, timeLabel: "", elevationDeg: 0, directionLabel: "", stepKey: "" },
      shadowSunDayCycleStatus: {
        enabled: false,
        cycleModeLabel: "",
        multiplier: 1,
        stepsPerDay: 0,
        stepSpanMinutes: 0,
        manualSeedLabel: "",
        continuousTimeLabel: "",
        quantizedTimeLabel: "",
        stepIndex: 0,
        advancing: false,
        stepChanged: false,
        advancementClamped: false,
        baseRateLabel: "",
      },
      ambientSunLighting: {
        ambientElevationDeg: 0,
        ambientDarkness01: 0,
      },
      structureTriangleAdmissionMode: "viewport",
      sliderPadding: 0,
      playerCameraTx: 0,
      playerCameraTy: 0,
      structureTriangleCutoutEnabled: false,
      structureTriangleCutoutHalfWidth: 0,
      structureTriangleCutoutHalfHeight: 0,
      structureTriangleCutoutAlpha: 0,
      roadWidthAtPlayer: 0,
      worldBatchAudit: null,
    } as any);
    const cacheLines = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(cacheLines.some((line) => line.includes("perf(cache): entries:3 bytes:2.0KiB"))).toBe(true);
    expect(cacheLines.some((line) => line.includes("cache testCache: entries:3 bytes:2.0KiB status:warning"))).toBe(true);

    ctx.fillText.mockClear();

    renderDebugLightingOverlay({
      ctx,
      cssW: 320,
      cssH: 180,
      dpr: 1,
      flags: makeFlags("world"),
      fps: 60,
      frameTimeMs: 16.7,
      renderPerfCountersEnabled: true,
      shadowSunModel: { forward: { x: 0, y: 0, z: 0 }, projectionDirection: { x: 0, y: 0 }, timeLabel: "", elevationDeg: 0, directionLabel: "", stepKey: "" },
      shadowSunDayCycleStatus: {
        enabled: false,
        cycleModeLabel: "",
        multiplier: 1,
        stepsPerDay: 0,
        stepSpanMinutes: 0,
        manualSeedLabel: "",
        continuousTimeLabel: "",
        quantizedTimeLabel: "",
        stepIndex: 0,
        advancing: false,
        stepChanged: false,
        advancementClamped: false,
        baseRateLabel: "",
      },
      ambientSunLighting: {
        ambientElevationDeg: 0,
        ambientDarkness01: 0,
      },
      structureTriangleAdmissionMode: "viewport",
      sliderPadding: 0,
      playerCameraTx: 0,
      playerCameraTy: 0,
      structureTriangleCutoutEnabled: false,
      structureTriangleCutoutHalfWidth: 0,
      structureTriangleCutoutHalfHeight: 0,
      structureTriangleCutoutAlpha: 0,
      roadWidthAtPlayer: 0,
      worldBatchAudit: {
        inspectedBackend: "webgl",
        compatibilityFields: ["semanticFamily/finalForm", "texture identity"],
        totalWorldCommands: 12,
        quadCommands: 6,
        triangleCommands: 4,
        batchableCommands: 10,
        texturedCommands: 8,
        uniqueTextures: 3,
        totalWorldBatches: 5,
        averageRunLength: 2.4,
        maxRunLength: 4,
        compatibleContinuations: 7,
        totalBatchBreaks: 4,
        breakReasonCounts: {
          "compatible continuation": 7,
          "render family changed": 1,
          "primitive type changed": 0,
          "shader/material changed": 0,
          "texture changed": 2,
          "blend mode changed": 0,
          "unsupported/fallback path changed": 1,
          "non-batchable path": 0,
          "other state incompatibility": 0,
        },
        familySummaries: [{
          family: "props",
          commands: 6,
          batches: 3,
          averageRunLength: 2,
          maxRunLength: 3,
          uniqueTextures: 2,
          dominantBreakReason: "texture changed",
        }],
        sampleBoundaries: [],
        topTextureBreakCauses: [
          {
            label: "props:staticAtlas:p0 -> entities:dynamicAtlas:p0",
            count: 2,
            previous: "props worldSprite:quad texturedTriangles tex1 normal world",
            next: "entities worldSprite:quad texturedTriangles tex2 normal world",
          },
        ],
        runLengths: {
          averageTextureRun: 1.6,
          maxTextureRun: 3,
          averageCompatibleRun: 2.4,
          maxCompatibleRun: 4,
        },
        reorderProbes: [
          { windowSize: 4, totalWorldBatches: 4, averageRunLength: 3, totalBatchBreaks: 3, textureBreaks: 1, renderFamilyBreaks: 1, riskCount: 2, overlapRiskCount: 1, feetSortYRiskCount: 1, groupBoundaryRiskCount: 2 },
          { windowSize: 8, totalWorldBatches: 3, averageRunLength: 4, totalBatchBreaks: 2, textureBreaks: 1, renderFamilyBreaks: 0, riskCount: 3, overlapRiskCount: 2, feetSortYRiskCount: 2, groupBoundaryRiskCount: 3 },
          { windowSize: 16, totalWorldBatches: 2, averageRunLength: 6, totalBatchBreaks: 1, textureBreaks: 0, renderFamilyBreaks: 0, riskCount: 5, overlapRiskCount: 3, feetSortYRiskCount: 4, groupBoundaryRiskCount: 5 },
        ],
      },
    } as any);
    const worldLines = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(worldLines.some((line) => line.includes("runs: texAvg:1.6 texMax:3 compAvg:2.4 compMax:4"))).toBe(true);
    expect(worldLines.some((line) => line.includes("probe4: batch:4 avg:3.0 tex:1 fam:1 risk:2"))).toBe(true);
    expect(worldLines.some((line) => line.includes("riskDetail: ov:3 feet:4 group:5"))).toBe(true);

    ctx.fillText.mockClear();

    resetPerfCounters();
    beginRenderPerfFrame(320, 180);
    countRenderCanvasGroundChunkDraw(3);
    countRenderCanvasGroundChunksVisible(5);
    countRenderCanvasGroundChunkRebuild(2);
    countRenderGroundStaticSurfaceExamined(4);
    countRenderGroundStaticSurfaceAuthorityFiltered(3);
    countRenderGroundStaticSurfaceFallbackEmitted(1);
    countRenderGroundStaticDecalExamined(2);
    countRenderGroundStaticDecalAuthorityFiltered(1);
    countRenderGroundStaticDecalFallbackEmitted(1);
    countRenderStructureTotalSubmission(4);
    countRenderStructureRectMeshSubmission(2);
    countRenderStructureRectMeshMigratedToQuad(2);
    countRenderStructureMonolithicGroupSubmission(2);
    countRenderStructureMonolithicTriangles(8);
    countRenderStructureSingleQuadSubmission(2);
    countRenderStructureGroupedPreSubmission(2);
    countRenderStructureGroupedPostSubmission(1);
    countRenderStructureMergedSliceSubmission(1);
    countRenderStructureMergedSliceCacheHit(2);
    countRenderStructureMergedSliceCacheMiss(1);
    countRenderStructureMergedSliceCacheRebuild(1);
    countRenderStructureTrianglesSubmitted(8);
    countRenderStructureEstimatedTrianglesAvoided(4);
    setBackend("canvas2d");
    publishCurrentPerfFrame();
    const canvasSnapshot = getRenderPerfSnapshot();
    expect(canvasSnapshot.canvasGroundChunkDrawsPerFrame).toBe(3);
    expect(canvasSnapshot.canvasGroundChunksVisiblePerFrame).toBe(5);
    expect(canvasSnapshot.canvasGroundChunkRebuildsPerFrame).toBe(2);
    expect(canvasSnapshot.groundStaticSurfaceAuthorityFilteredPerFrame).toBe(3);
    expect(canvasSnapshot.groundStaticDecalFallbackEmittedPerFrame).toBe(1);
    renderDebugLightingOverlay({
      ctx,
      cssW: 320,
      cssH: 180,
      dpr: 1,
      flags: makeFlags("ground"),
      fps: 58,
      frameTimeMs: 17.2,
      renderPerfCountersEnabled: true,
      shadowSunModel: { forward: { x: 0, y: 0, z: 0 }, projectionDirection: { x: 0, y: 0 }, timeLabel: "", elevationDeg: 0, directionLabel: "", stepKey: "" },
      shadowSunDayCycleStatus: {
        enabled: false,
        cycleModeLabel: "",
        multiplier: 1,
        stepsPerDay: 0,
        stepSpanMinutes: 0,
        manualSeedLabel: "",
        continuousTimeLabel: "",
        quantizedTimeLabel: "",
        stepIndex: 0,
        advancing: false,
        stepChanged: false,
        advancementClamped: false,
        baseRateLabel: "",
      },
      ambientSunLighting: {
        ambientElevationDeg: 0,
        ambientDarkness01: 0,
      },
      structureTriangleAdmissionMode: "viewport",
      sliderPadding: 0,
      playerCameraTx: 0,
      playerCameraTy: 0,
      structureTriangleCutoutEnabled: false,
      structureTriangleCutoutHalfWidth: 0,
      structureTriangleCutoutHalfHeight: 0,
      structureTriangleCutoutAlpha: 0,
      roadWidthAtPlayer: 0,
      worldBatchAudit: null,
    } as any);
    const canvasLines = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(canvasLines.some((line) => line.includes("perf(ground): surf seen:4.0 filtered:3.0 fallback:1.0"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("decal seen:2.0 filtered:1.0 fallback:1.0"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("chunks: visible:5.0 quads:3.0 rebuild:2.0"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("cache testCache"))).toBe(false);
    expect(canvasLines.some((line) => line.includes("gl draw/frame:"))).toBe(false);

    ctx.fillText.mockClear();

    renderDebugLightingOverlay({
      ctx,
      cssW: 900,
      cssH: 500,
      dpr: 1,
      flags: makeFlags("all"),
      fps: 58,
      frameTimeMs: 17.2,
      renderPerfCountersEnabled: true,
      shadowSunModel: { forward: { x: 0, y: 0, z: 0 }, projectionDirection: { x: 0, y: 0 }, timeLabel: "", elevationDeg: 0, directionLabel: "", stepKey: "" },
      shadowSunDayCycleStatus: {
        enabled: false,
        cycleModeLabel: "",
        multiplier: 1,
        stepsPerDay: 0,
        stepSpanMinutes: 0,
        manualSeedLabel: "",
        continuousTimeLabel: "",
        quantizedTimeLabel: "",
        stepIndex: 0,
        advancing: false,
        stepChanged: false,
        advancementClamped: false,
        baseRateLabel: "",
      },
      ambientSunLighting: {
        ambientElevationDeg: 0,
        ambientDarkness01: 0,
      },
      structureTriangleAdmissionMode: "viewport",
      sliderPadding: 0,
      playerCameraTx: 0,
      playerCameraTy: 0,
      structureTriangleCutoutEnabled: false,
      structureTriangleCutoutHalfWidth: 0,
      structureTriangleCutoutHalfHeight: 0,
      structureTriangleCutoutAlpha: 0,
      roadWidthAtPlayer: 0,
      worldBatchAudit: {
        inspectedBackend: "webgl",
        compatibilityFields: ["semanticFamily/finalForm", "texture identity"],
        totalWorldCommands: 12,
        quadCommands: 6,
        triangleCommands: 4,
        batchableCommands: 10,
        texturedCommands: 8,
        uniqueTextures: 3,
        totalWorldBatches: 5,
        averageRunLength: 2.4,
        maxRunLength: 4,
        compatibleContinuations: 7,
        totalBatchBreaks: 4,
        breakReasonCounts: {
          "compatible continuation": 7,
          "render family changed": 1,
          "primitive type changed": 0,
          "shader/material changed": 0,
          "texture changed": 2,
          "blend mode changed": 0,
          "unsupported/fallback path changed": 1,
          "non-batchable path": 0,
          "other state incompatibility": 0,
        },
        familySummaries: [{
          family: "props",
          commands: 6,
          batches: 3,
          averageRunLength: 2,
          maxRunLength: 3,
          uniqueTextures: 2,
          dominantBreakReason: "texture changed",
        }],
        sampleBoundaries: [],
        topTextureBreakCauses: [
          {
            label: "props:staticAtlas:p0 -> entities:dynamicAtlas:p0",
            count: 2,
            previous: "props worldSprite:quad texturedTriangles tex1 normal world",
            next: "entities worldSprite:quad texturedTriangles tex2 normal world",
          },
        ],
        runLengths: {
          averageTextureRun: 1.6,
          maxTextureRun: 3,
          averageCompatibleRun: 2.4,
          maxCompatibleRun: 4,
        },
        reorderProbes: [
          { windowSize: 4, totalWorldBatches: 4, averageRunLength: 3, totalBatchBreaks: 3, textureBreaks: 1, renderFamilyBreaks: 1, riskCount: 2, overlapRiskCount: 1, feetSortYRiskCount: 1, groupBoundaryRiskCount: 2 },
          { windowSize: 8, totalWorldBatches: 3, averageRunLength: 4, totalBatchBreaks: 2, textureBreaks: 1, renderFamilyBreaks: 0, riskCount: 3, overlapRiskCount: 2, feetSortYRiskCount: 2, groupBoundaryRiskCount: 3 },
          { windowSize: 16, totalWorldBatches: 2, averageRunLength: 6, totalBatchBreaks: 1, textureBreaks: 0, renderFamilyBreaks: 0, riskCount: 5, overlapRiskCount: 3, feetSortYRiskCount: 4, groupBoundaryRiskCount: 5 },
        ],
      },
    } as any);
    const allLines = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(allLines.some((line) => line.includes("perf(overview): fps:58"))).toBe(true);
    expect(allLines.some((line) => line.includes("perf(world): cmd:12 batch:5"))).toBe(true);
    expect(allLines.some((line) => line.includes("perf(structures): total:4.0 rect:2.0 rectQuad:2.0"))).toBe(true);
    expect(allLines.some((line) => line.includes("grouping: pre:2.0 post:1.0"))).toBe(true);
    expect(allLines.some((line) => line.includes("merged: submit:1.0 hit:2.0 miss:1.0 rebuild:1.0"))).toBe(true);
    expect(allLines.some((line) => line.includes("texBreak1: 2x props:staticAtlas:p0 -> entities:dynamicAtlas:p0"))).toBe(true);
    expect(allLines.some((line) => line.includes("perf(ground): surf seen:4.0 filtered:3.0 fallback:1.0"))).toBe(true);
    expect(allLines.some((line) => line.includes("perf(cache): entries:3 bytes:2.0KiB"))).toBe(true);
  });
});
