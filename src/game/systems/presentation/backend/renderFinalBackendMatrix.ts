import type { RenderBackendId } from "./renderBackendCapabilities";

export type FinalBackendClassification =
  | "WEBGL_PRIMARY"
  | "WEBGL_SUPPORTED_CANVAS_FALLBACK_ALLOWED"
  | "INTENTIONALLY_CANVAS_ONLY"
  | "BLOCKED_SIGNOFF"
  | "DEFER_FUTURE_PROJECT";

export type RenderParityStatus =
  | "parity_verified"
  | "parity_pending_manual"
  | "fallback_safe"
  | "blocked";

export type FinalBackendMatrixEntry = {
  family: string;
  classification: FinalBackendClassification;
  currentRoute: RenderBackendId | "mixed";
  parityStatus: RenderParityStatus;
  reason: string;
  releaseDefaultAllowed: boolean;
};

const FINAL_BACKEND_MATRIX: readonly FinalBackendMatrixEntry[] = [
  {
    family: "worldSprite:quad",
    classification: "BLOCKED_SIGNOFF",
    currentRoute: "mixed",
    parityStatus: "blocked",
    reason: "Descriptor-backed sprite fallback payloads still produce mixed backend placement and block WebGL-by-default signoff.",
    releaseDefaultAllowed: false,
  },
  {
    family: "screenOverlay:quad",
    classification: "WEBGL_PRIMARY",
    currentRoute: "webgl",
    parityStatus: "parity_pending_manual",
    reason: "Screen-space quads are fully canonical and map directly to WebGL.",
    releaseDefaultAllowed: true,
  },
  {
    family: "screenOverlay:primitive",
    classification: "WEBGL_SUPPORTED_CANVAS_FALLBACK_ALLOWED",
    currentRoute: "mixed",
    parityStatus: "parity_pending_manual",
    reason: "Ambient darkness is WebGL-capable, while floating text intentionally remains Canvas-backed in Phase 1.",
    releaseDefaultAllowed: true,
  },
  {
    family: "worldPrimitive:primitive",
    classification: "BLOCKED_SIGNOFF",
    currentRoute: "mixed",
    parityStatus: "blocked",
    reason: "Primitive families still rely on mixed backend support, so default-backend signoff remains deferred to Phase 3.",
    releaseDefaultAllowed: false,
  },
  {
    family: "groundSurface:quad",
    classification: "WEBGL_PRIMARY",
    currentRoute: "webgl",
    parityStatus: "parity_pending_manual",
    reason: "Ground surfaces now emit a single quad-native payload with explicit four-corner geometry.",
    releaseDefaultAllowed: true,
  },
  {
    family: "groundDecal:quad",
    classification: "WEBGL_PRIMARY",
    currentRoute: "webgl",
    parityStatus: "parity_pending_manual",
    reason: "Ground decals now emit quad-native payloads and no longer rely on backend-time realization.",
    releaseDefaultAllowed: true,
  },
  {
    family: "debug:primitive",
    classification: "DEFER_FUTURE_PROJECT",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Debug families intentionally remain Canvas-backed until after semantic and form enforcement are complete.",
    releaseDefaultAllowed: true,
  },
];

export function getFinalBackendMatrix(): readonly FinalBackendMatrixEntry[] {
  return FINAL_BACKEND_MATRIX;
}
