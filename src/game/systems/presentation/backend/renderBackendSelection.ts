import type { RenderSettings } from "../../../../userSettings";
import type { RenderBackendId } from "./renderBackendCapabilities";
import type { AttachedWebGLSurface } from "./webglSurface";
import { getFinalBackendMatrix } from "./renderFinalBackendMatrix";

export type RenderBackendPolicy = {
  defaultBackend: RenderBackendId;
  webglReadyForDefault: boolean;
  webglOptInAllowed: boolean;
  blockers: string[];
};

export type RenderBackendSelection = {
  requestedBackend: RenderBackendId;
  selectedBackend: RenderBackendId;
  fallbackReason: string | null;
  policy: RenderBackendPolicy;
};

export const WEBGL_SURFACE_UNAVAILABLE_REASON = "webgl-surface-unavailable";
export const WEBGL_INIT_UNAVAILABLE_REASON = "webgl-init-unavailable";
export const WEBGL_RUNTIME_FAILURE_REASON = "webgl-runtime-failure";

function computeRenderBackendPolicy(): RenderBackendPolicy {
  const matrix = getFinalBackendMatrix();
  const blockers = matrix
    .filter((entry) => entry.classification === "BLOCKED_SIGNOFF")
    .map((entry) => `${entry.family}: ${entry.reason}`);
  return {
    defaultBackend: blockers.length > 0 ? "canvas2d" : "webgl",
    webglReadyForDefault: blockers.length === 0,
    webglOptInAllowed: true,
    blockers,
  };
}

export function getRenderBackendPolicy(): RenderBackendPolicy {
  return computeRenderBackendPolicy();
}

export function resolveRenderBackendSelection(
  renderSettings: Pick<RenderSettings, "renderBackend"> | null | undefined,
  webglSurface: AttachedWebGLSurface | null,
  webglFailureReason: string | null = null,
): RenderBackendSelection {
  const policy = computeRenderBackendPolicy();
  const requestedBackend = renderSettings?.renderBackend === "webgl"
    ? "webgl"
    : renderSettings?.renderBackend === "canvas2d"
      ? "canvas2d"
      : policy.defaultBackend;

  if (requestedBackend === "webgl" && !webglSurface) {
    return {
      requestedBackend,
      selectedBackend: "canvas2d",
      fallbackReason: webglFailureReason ?? WEBGL_SURFACE_UNAVAILABLE_REASON,
      policy,
    };
  }

  return {
    requestedBackend,
    selectedBackend: requestedBackend,
    fallbackReason: null,
    policy,
  };
}

export function describeRenderBackendFallbackReason(reason: string | null): string {
  if (reason === WEBGL_INIT_UNAVAILABLE_REASON) {
    return "WebGL initialization failed during bootstrap, so Canvas2D stayed active.";
  }
  if (reason === WEBGL_RUNTIME_FAILURE_REASON) {
    return "WebGL rendering failed at runtime, so the world backend fell back to Canvas2D.";
  }
  if (reason === WEBGL_SURFACE_UNAVAILABLE_REASON) {
    return "WebGL was requested but no WebGL surface/context was available, so Canvas2D stayed active.";
  }
  return "none";
}
