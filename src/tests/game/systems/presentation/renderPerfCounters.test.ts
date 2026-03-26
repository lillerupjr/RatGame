import { describe, expect, it, vi } from "vitest";
import {
  beginRenderPerfFrame,
  countRenderWebGLBatch,
  countRenderWebGLBufferUpload,
  countRenderWebGLCanvasComposite,
  countRenderWebGLDrawCall,
  countRenderWebGLProjectedSurfaceDraw,
  countRenderWebGLTextureBind,
  countRenderWebGLTrianglesSubmitted,
  endRenderPerfFrame,
  getRenderPerfSnapshot,
  noteRenderWebGLTextureUsage,
  setRenderBackendStats,
  setRenderPerfCountersEnabled,
} from "../../../../game/systems/presentation/renderPerfCounters";
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
  });

  it("switches overlay perf text based on the selected backend", () => {
    const ctx = fakeCtx();

    resetPerfCounters();
    beginRenderPerfFrame(320, 180);
    countRenderWebGLDrawCall(4);
    countRenderWebGLBatch(3);
    countRenderWebGLTextureBind(6);
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
      structureTriangleAdmissionMode: "viewport",
      sliderPadding: 0,
      playerCameraTx: 0,
      playerCameraTy: 0,
      structureTriangleCutoutEnabled: false,
      structureTriangleCutoutHalfWidth: 0,
      structureTriangleCutoutHalfHeight: 0,
      structureTriangleCutoutAlpha: 0,
      roadWidthAtPlayer: 0,
    } as any);
    const webglLines = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(webglLines.some((line) => line.includes("gl draw/frame:"))).toBe(true);
    expect(webglLines.some((line) => line.includes("gl batches/frame:"))).toBe(true);
    expect(webglLines.some((line) => line.includes("drawImage/frame:"))).toBe(false);

    ctx.fillText.mockClear();

    resetPerfCounters();
    beginRenderPerfFrame(320, 180);
    setBackend("canvas2d");
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
      structureTriangleAdmissionMode: "viewport",
      sliderPadding: 0,
      playerCameraTx: 0,
      playerCameraTy: 0,
      structureTriangleCutoutEnabled: false,
      structureTriangleCutoutHalfWidth: 0,
      structureTriangleCutoutHalfHeight: 0,
      structureTriangleCutoutAlpha: 0,
      roadWidthAtPlayer: 0,
    } as any);
    const canvasLines = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(canvasLines.some((line) => line.includes("drawImage/frame:"))).toBe(true);
    expect(canvasLines.some((line) => line.includes("gl draw/frame:"))).toBe(false);
  });
});
