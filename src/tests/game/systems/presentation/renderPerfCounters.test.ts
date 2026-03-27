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
  countRenderWebGLBatch,
  countRenderWebGLBufferUpload,
  countRenderWebGLCanvasComposite,
  countRenderWebGLDrawCall,
  countRenderWebGLGroundChunkDraw,
  countRenderWebGLGroundChunkTextureUpload,
  countRenderWebGLGroundChunksVisible,
  countRenderWebGLProjectedSurfaceDraw,
  countRenderWebGLTextureBind,
  countRenderWebGLTrianglesSubmitted,
  endRenderPerfFrame,
  getRenderPerfSnapshot,
  noteRenderWebGLTextureUsage,
  setRenderBackendStats,
  setRenderPerfCountersEnabled,
} from "../../../../game/systems/presentation/renderPerfCounters";
import {
  registerCacheMetricSource,
  resetCacheMetricsRegistryForTests,
} from "../../../../game/systems/presentation/cacheMetricsRegistry";
import { renderDebugLightingOverlay } from "../../../../game/systems/presentation/debug/renderDebugLighting";

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
    webglByAxes: selectedBackend === "webgl" ? { "groundSurface:projectedSurface": 2 } : {},
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
  });

  it("switches overlay perf text based on the selected backend", () => {
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
    setBackend("webgl");
    publishCurrentPerfFrame();
    renderDebugLightingOverlay({
      ctx,
      cssW: 320,
      cssH: 180,
      dpr: 1,
      flags: {},
      renderPerfCountersEnabled: true,
      structureShadowRouting: { usesV6Debug: false },
      structureV6VerticalShadowDebugData: null,
      structureV6ShadowDebugCandidateCount: 0,
      structureV6ShadowCastCount: 0,
      structureV6ShadowCacheStats: null,
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
    expect(webglLines.some((line) => line.includes("gl draw/frame:"))).toBe(true);
    expect(webglLines.some((line) => line.includes("gl batches/frame:"))).toBe(true);
    expect(webglLines.some((line) => line.includes("groundChunkDraw/frame:"))).toBe(true);
    expect(webglLines.some((line) => line.includes("groundChunkTextureUpload/frame:"))).toBe(true);
    expect(webglLines.some((line) => line.includes("groundAuthority surface/frame: seen:12.0 filtered:9.0 fallback:3.0"))).toBe(true);
    expect(webglLines.some((line) => line.includes("groundAuthority decal/frame: seen:7.0 filtered:4.0 fallback:3.0"))).toBe(true);
    expect(webglLines.some((line) => line.includes("worldBatch(webgl): cmd:12 batch:5 avg:2.4 max:4 cont:7 breaks:4"))).toBe(true);
    expect(webglLines.some((line) => line.includes("worldBreaks: texture changed:2 render family changed:1 unsupported/fallback path changed:1"))).toBe(true);
    expect(webglLines.some((line) => line.includes("worldFam props cmd:6 batch:3 avg:2.0 max:3 tex:2 dom:texture changed"))).toBe(true);
    expect(webglLines.some((line) => line.includes("worldBoundary 3->4 texture changed"))).toBe(true);
    expect(webglLines.some((line) => line.includes("cache totals:"))).toBe(true);
    expect(webglLines.some((line) => line.includes("cache testCache"))).toBe(true);
    expect(webglLines.some((line) => line.includes("status:warning"))).toBe(true);
    expect(webglLines.some((line) => line.includes("drawImage/frame:"))).toBe(false);

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
      flags: {},
      renderPerfCountersEnabled: true,
      structureShadowRouting: { usesV6Debug: false },
      structureV6VerticalShadowDebugData: null,
      structureV6ShadowDebugCandidateCount: 0,
      structureV6ShadowCastCount: 0,
      structureV6ShadowCacheStats: null,
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
    expect(canvasLines.some((line) => line.includes("drawImage/frame:"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("groundChunkDraw/frame:"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("groundAuthority surface/frame: seen:4.0 filtered:3.0 fallback:1.0"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("groundAuthority decal/frame: seen:2.0 filtered:1.0 fallback:1.0"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("cache totals:"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("cache testCache"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("gl draw/frame:"))).toBe(false);
  });
});
