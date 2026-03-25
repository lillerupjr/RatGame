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
    family: "triangle:structureTriangleGroup",
    disposition: "PORT_STAGE_D_NOW",
    reason: "Highest-priority hard geometry family: command data already carries triangle points, UV-space source points, cutout state, and pass ordering.",
  },
  {
    family: "decal:runtimeSidewalkTop",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Runtime top baking and ramp projection parity are still outside the hard-geometry migration focus.",
  },
  {
    family: "decal:runtimeDecalTop",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Runtime decal baking and ramp-fit projection still need a later focused parity pass.",
  },
  {
    family: "sprite:vfxClip",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Legacy unresolved clip draws are not part of the Stage D structure-geometry target.",
  },
  {
    family: "sprite:pickup",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Still mixes textured sprites with fallback shapes and relight overlays.",
  },
  {
    family: "sprite:enemy",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Animation, relight, and aura-side behaviors remain Canvas-backed.",
  },
  {
    family: "sprite:npc",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Legacy animated character path is not a Stage D geometry blocker.",
  },
  {
    family: "sprite:neutralMob",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Legacy animated neutral-mob path is not a Stage D geometry blocker.",
  },
  {
    family: "sprite:projectileSpark",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Only the portable imageSprite path is WebGL-ready; legacy spark fallback remains Canvas-backed.",
  },
  {
    family: "sprite:projectile",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Still mixes sprite bodies, followers, and other parity-sensitive effects.",
  },
  {
    family: "sprite:player",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Player rendering still depends on layered relight and fallback behavior outside Stage D scope.",
  },
  {
    family: "primitive:entityShadow",
    disposition: "DEFER_STAGE_E",
    reason: "Shadow-heavy migration is intentionally deferred until after structure geometry parity is stable.",
  },
  {
    family: "primitive:playerBeam",
    disposition: "DEFER_STAGE_E",
    reason: "Beam/path rendering is not required for Stage D structure completeness.",
  },
  {
    family: "primitive:floatingText",
    disposition: "DEFER_STAGE_E",
    reason: "Canvas text remains the parity reference and no backend-neutral text rewrite is planned here.",
  },
  {
    family: "primitive:playerWedge",
    disposition: "DEFER_STAGE_E",
    reason: "Debug/path wedge rendering can stay Canvas-backed without blocking WebGL structure migration.",
  },
  {
    family: "overlay:zoneObjective",
    disposition: "KEEP_CANVAS_FALLBACK",
    reason: "Zone-objective overlay rendering is not part of the hard-geometry migration target.",
  },
  {
    family: "debug:debugPass",
    disposition: "DEFER_STAGE_E",
    reason: "General debug rendering stays Canvas-backed unless a specific parity check requires migration.",
  },
];

export function getStageDDeferredFamilyMatrix(): readonly StageDDeferredFamilyEntry[] {
  return STAGE_D_DEFERRED_FAMILY_MATRIX;
}
