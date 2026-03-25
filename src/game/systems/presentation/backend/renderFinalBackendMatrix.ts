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
    family: "sprite:imageSprite",
    classification: "WEBGL_PRIMARY",
    currentRoute: "webgl",
    parityStatus: "parity_pending_manual",
    reason: "Resolved image-frame sprite draws are backend-neutral and fully supported by the textured-quad path.",
    releaseDefaultAllowed: true,
  },
  {
    family: "sprite:renderPieceSprite",
    classification: "WEBGL_PRIMARY",
    currentRoute: "webgl",
    parityStatus: "parity_pending_manual",
    reason: "Quad-safe structure/world sprite pieces are WebGL-native.",
    releaseDefaultAllowed: true,
  },
  {
    family: "decal:imageTop",
    classification: "WEBGL_PRIMARY",
    currentRoute: "mixed",
    parityStatus: "parity_pending_manual",
    reason: "Flat image tops render in WebGL; projected/ocean variants still use explicit Canvas fallback.",
    releaseDefaultAllowed: true,
  },
  {
    family: "primitive:zoneEffect",
    classification: "WEBGL_SUPPORTED_CANVAS_FALLBACK_ALLOWED",
    currentRoute: "mixed",
    parityStatus: "parity_pending_manual",
    reason: "Non-FIRE zone effects render in WebGL; FIRE remains a deliberate Canvas fallback.",
    releaseDefaultAllowed: true,
  },
  {
    family: "overlay:structureOverlay",
    classification: "WEBGL_PRIMARY",
    currentRoute: "webgl",
    parityStatus: "parity_pending_manual",
    reason: "Quad-safe structure overlays are handled directly by WebGL.",
    releaseDefaultAllowed: true,
  },
  {
    family: "overlay:screenTint",
    classification: "WEBGL_PRIMARY",
    currentRoute: "webgl",
    parityStatus: "parity_pending_manual",
    reason: "Screen-space tint is a direct fullscreen-quad path.",
    releaseDefaultAllowed: true,
  },
  {
    family: "overlay:ambientDarkness",
    classification: "WEBGL_PRIMARY",
    currentRoute: "webgl",
    parityStatus: "parity_pending_manual",
    reason: "Ambient darkness is handled as screen-space quads in WebGL.",
    releaseDefaultAllowed: true,
  },
  {
    family: "light:projectedLight",
    classification: "WEBGL_PRIMARY",
    currentRoute: "webgl",
    parityStatus: "parity_pending_manual",
    reason: "Projected additive light pieces map cleanly to WebGL textured draws.",
    releaseDefaultAllowed: true,
  },
  {
    family: "triangle:structureTriangleGroup",
    classification: "WEBGL_SUPPORTED_CANVAS_FALLBACK_ALLOWED",
    currentRoute: "mixed",
    parityStatus: "parity_pending_manual",
    reason: "Primary structure triangles render in WebGL; compare-distance debug overlays remain explicit Canvas fallback.",
    releaseDefaultAllowed: true,
  },
  {
    family: "decal:runtimeSidewalkTop",
    classification: "BLOCKED_SIGNOFF",
    currentRoute: "canvas2d",
    parityStatus: "blocked",
    reason: "Runtime baked top projection and ramp parity remain Canvas-only and materially affect ground-heavy scenes.",
    releaseDefaultAllowed: false,
  },
  {
    family: "decal:runtimeDecalTop",
    classification: "BLOCKED_SIGNOFF",
    currentRoute: "canvas2d",
    parityStatus: "blocked",
    reason: "Runtime decal baking and ramp-fit projection are still Canvas-only and visible in road/decal-heavy scenes.",
    releaseDefaultAllowed: false,
  },
  {
    family: "sprite:vfxClip",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Legacy unresolved clip draws remain safe on Canvas and do not block backend operation.",
    releaseDefaultAllowed: true,
  },
  {
    family: "sprite:pickup",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Still mixes sprite draws with vector fallback and relight overlays.",
    releaseDefaultAllowed: true,
  },
  {
    family: "sprite:enemy",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Legacy animation and relight behavior remain Canvas-backed for now.",
    releaseDefaultAllowed: true,
  },
  {
    family: "sprite:npc",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Legacy animated NPC rendering remains Canvas-backed.",
    releaseDefaultAllowed: true,
  },
  {
    family: "sprite:neutralMob",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Legacy neutral-mob animation path remains Canvas-backed.",
    releaseDefaultAllowed: true,
  },
  {
    family: "sprite:projectileSpark",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Portable spark image path exists, but legacy fallback remains Canvas-backed.",
    releaseDefaultAllowed: true,
  },
  {
    family: "sprite:projectile",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Still mixes projectile bodies with follower/effect behavior outside the current WebGL scope.",
    releaseDefaultAllowed: true,
  },
  {
    family: "sprite:player",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Player relight and fallback behavior remain Canvas-backed.",
    releaseDefaultAllowed: true,
  },
  {
    family: "primitive:entityShadow",
    classification: "DEFER_FUTURE_PROJECT",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Shadow-heavy migration is a separate future rendering project.",
    releaseDefaultAllowed: true,
  },
  {
    family: "primitive:playerBeam",
    classification: "DEFER_FUTURE_PROJECT",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Path-style beam rendering remains intentionally Canvas-backed.",
    releaseDefaultAllowed: true,
  },
  {
    family: "primitive:floatingText",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Canvas text remains the intended implementation.",
    releaseDefaultAllowed: true,
  },
  {
    family: "primitive:playerWedge",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Debug/path wedge rendering does not need WebGL for release correctness.",
    releaseDefaultAllowed: true,
  },
  {
    family: "overlay:zoneObjective",
    classification: "INTENTIONALLY_CANVAS_ONLY",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "Zone-objective overlay rendering remains Canvas-backed without blocking release use.",
    releaseDefaultAllowed: true,
  },
  {
    family: "debug:debugPass",
    classification: "DEFER_FUTURE_PROJECT",
    currentRoute: "canvas2d",
    parityStatus: "fallback_safe",
    reason: "General debug rendering remains Canvas-backed and does not block world-backend signoff.",
    releaseDefaultAllowed: true,
  },
];

export function getFinalBackendMatrix(): readonly FinalBackendMatrixEntry[] {
  return FINAL_BACKEND_MATRIX;
}

export function getFinalBackendMatrixByFamily(): Readonly<Record<string, FinalBackendMatrixEntry>> {
  const out: Record<string, FinalBackendMatrixEntry> = {};
  for (let i = 0; i < FINAL_BACKEND_MATRIX.length; i++) {
    out[FINAL_BACKEND_MATRIX[i].family] = FINAL_BACKEND_MATRIX[i];
  }
  return out;
}
