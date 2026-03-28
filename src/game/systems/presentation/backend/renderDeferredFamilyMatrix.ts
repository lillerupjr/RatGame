export type StageDDeferredDisposition =
  | "PORT_STAGE_D_NOW"
  | "KEEP_CANVAS_FALLBACK"
  | "BLOCKED_BY_CONTRACT_GAP"
  | "DEFER_STAGE_E";

export type StageDDeferredFamilyEntry = {
  family: string;
  disposition: StageDDeferredDisposition;
  reason: string;
};

const STAGE_D_DEFERRED_FAMILY_MATRIX: readonly StageDDeferredFamilyEntry[] = [
  {
    family: "groundSurface:quad",
    disposition: "PORT_STAGE_D_NOW",
    reason: "Ground surfaces now use one quad-native payload; backend cleanup remains deferred to Phase 3.",
  },
  {
    family: "groundDecal:quad",
    disposition: "PORT_STAGE_D_NOW",
    reason: "Ground decals now emit quad-native payloads; backend cleanup remains deferred to Phase 3.",
  },
  {
    family: "worldSprite:quad",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Descriptor-backed sprite fallback payloads are not part of Stage D geometry work.",
  },
  {
    family: "worldPrimitive:primitive",
    disposition: "DEFER_STAGE_E",
    reason: "Primitive normalization stays deferred until after geometry and ground forms are fully canonical.",
  },
  {
    family: "screenOverlay:primitive",
    disposition: "DEFER_STAGE_E",
    reason: "Floating text and other screen primitives remain Canvas-backed for now.",
  },
  {
    family: "debug:primitive",
    disposition: "DEFER_STAGE_E",
    reason: "Debug rendering remains Canvas-backed unless a targeted parity check requires more work.",
  },
];

export function getStageDDeferredFamilyMatrix(): readonly StageDDeferredFamilyEntry[] {
  return STAGE_D_DEFERRED_FAMILY_MATRIX;
}
