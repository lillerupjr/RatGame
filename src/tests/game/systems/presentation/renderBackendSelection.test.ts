import { describe, expect, it } from "vitest";
import {
  resolveRenderBackendSelection,
  WEBGL_INIT_UNAVAILABLE_REASON,
  WEBGL_RUNTIME_FAILURE_REASON,
} from "../../../../game/systems/presentation/backend/renderBackendSelection";
import { getFinalBackendMatrix } from "../../../../game/systems/presentation/backend/renderFinalBackendMatrix";
import {
  attachWebGLWorldSurface,
  getAttachedWebGLWorldSurface,
  getRenderableWebGLWorldSurface,
  getWebGLWorldSurfaceFailureReason,
  noteWebGLWorldSurfaceFailure,
  syncWorldCanvasBackendVisibility,
} from "../../../../game/systems/presentation/backend/webglSurface";

describe("render backend selection", () => {
  it("keeps WebGL as the default policy while still allowing Canvas2D fallback", () => {
    const blockers = getFinalBackendMatrix().filter((entry) => entry.classification === "BLOCKED_SIGNOFF");
    expect(blockers.map((entry) => entry.family)).toEqual([
      "worldSprite:quad",
      "worldPrimitive:primitive",
    ]);

    const defaultSelection = resolveRenderBackendSelection(undefined, null);
    expect(defaultSelection.requestedBackend).toBe("webgl");
    expect(defaultSelection.selectedBackend).toBe("canvas2d");
    expect(defaultSelection.policy.defaultBackend).toBe("webgl");
    expect(defaultSelection.policy.webglReadyForDefault).toBe(true);

    const missingSurface = resolveRenderBackendSelection({ renderBackend: "webgl" } as any, null, WEBGL_INIT_UNAVAILABLE_REASON);
    expect(missingSurface.requestedBackend).toBe("webgl");
    expect(missingSurface.selectedBackend).toBe("canvas2d");
    expect(missingSurface.fallbackReason).toBe(WEBGL_INIT_UNAVAILABLE_REASON);

    const webglSelection = resolveRenderBackendSelection({ renderBackend: "webgl" } as any, {
      canvas: { style: {} } as any,
      gl: {} as any,
    });
    expect(webglSelection.selectedBackend).toBe("webgl");
    expect(webglSelection.fallbackReason).toBeNull();
  });

  it("stores surface failure state and keeps visibility aligned with the effective backend", () => {
    const worldCanvas = { style: {} } as any;
    const webglCanvas = { style: {} } as any;
    attachWebGLWorldSurface(worldCanvas, {
      canvas: webglCanvas,
      gl: {} as any,
    });

    expect(getAttachedWebGLWorldSurface(worldCanvas)?.canvas).toBe(webglCanvas);
    expect(getRenderableWebGLWorldSurface(worldCanvas)?.canvas).toBe(webglCanvas);
    expect(getWebGLWorldSurfaceFailureReason(worldCanvas)).toBeNull();

    syncWorldCanvasBackendVisibility(worldCanvas, "webgl", true);
    expect(webglCanvas.style.visibility).toBe("visible");
    expect(worldCanvas.style.opacity).toBe("0");

    noteWebGLWorldSurfaceFailure(worldCanvas, WEBGL_RUNTIME_FAILURE_REASON);
    expect(getRenderableWebGLWorldSurface(worldCanvas)).toBeNull();
    expect(getWebGLWorldSurfaceFailureReason(worldCanvas)).toBe(WEBGL_RUNTIME_FAILURE_REASON);

    syncWorldCanvasBackendVisibility(worldCanvas, "webgl", true);
    expect(webglCanvas.style.visibility).toBe("hidden");
    expect(worldCanvas.style.opacity).toBe("1");

    syncWorldCanvasBackendVisibility(worldCanvas, "canvas2d", true);
    expect(webglCanvas.style.visibility).toBe("hidden");
    expect(worldCanvas.style.opacity).toBe("1");
  });
});
