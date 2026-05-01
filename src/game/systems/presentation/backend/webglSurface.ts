import type { RenderBackendId } from "./renderBackendCapabilities";

const WEBGL_SURFACE_STATE_KEY = "__ratgameWebglSurfaceState";

export type AttachedWebGLSurface = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
};

export type WebGLWorldSurfaceState = {
  surface: AttachedWebGLSurface | null;
  failureReason: string | null;
};

type WorldCanvasWithWebGL = HTMLCanvasElement & {
  [WEBGL_SURFACE_STATE_KEY]?: WebGLWorldSurfaceState;
};

function getOrCreateState(worldCanvas: HTMLCanvasElement): WebGLWorldSurfaceState {
  const canvasWithState = worldCanvas as WorldCanvasWithWebGL;
  if (!canvasWithState[WEBGL_SURFACE_STATE_KEY]) {
    canvasWithState[WEBGL_SURFACE_STATE_KEY] = {
      surface: null,
      failureReason: null,
    };
  }
  return canvasWithState[WEBGL_SURFACE_STATE_KEY] as WebGLWorldSurfaceState;
}

export function attachWebGLWorldSurface(
  worldCanvas: HTMLCanvasElement,
  surface: AttachedWebGLSurface,
): void {
  const state = getOrCreateState(worldCanvas);
  state.surface = surface;
  state.failureReason = null;
}

export function noteWebGLWorldSurfaceFailure(
  worldCanvas: HTMLCanvasElement,
  reason: string,
): void {
  const state = getOrCreateState(worldCanvas);
  state.failureReason = reason;
}

export function clearWebGLWorldSurfaceFailure(
  worldCanvas: HTMLCanvasElement,
): void {
  const state = getOrCreateState(worldCanvas);
  state.failureReason = null;
}

export function getWebGLWorldSurfaceState(
  worldCanvas: HTMLCanvasElement,
): WebGLWorldSurfaceState {
  return getOrCreateState(worldCanvas);
}

export function getAttachedWebGLWorldSurface(
  worldCanvas: HTMLCanvasElement,
): AttachedWebGLSurface | null {
  return getOrCreateState(worldCanvas).surface;
}

export function getRenderableWebGLWorldSurface(
  worldCanvas: HTMLCanvasElement,
): AttachedWebGLSurface | null {
  const state = getOrCreateState(worldCanvas);
  if (state.failureReason) return null;
  return state.surface;
}

export function getWebGLWorldSurfaceFailureReason(
  worldCanvas: HTMLCanvasElement,
): string | null {
  return getOrCreateState(worldCanvas).failureReason;
}

export function syncWorldCanvasBackendVisibility(
  worldCanvas: HTMLCanvasElement,
  selectedBackend: RenderBackendId,
  visible: boolean,
): void {
  const state = getOrCreateState(worldCanvas);
  const surface = state.surface;
  if (!surface) return;
  const showWebGL = visible && selectedBackend === "webgl" && !state.failureReason;
  surface.canvas.style.opacity = showWebGL ? "1" : "0";
  surface.canvas.style.visibility = showWebGL ? "visible" : "hidden";
  worldCanvas.style.opacity = showWebGL ? "0" : "1";
  worldCanvas.style.visibility = "visible";
}
