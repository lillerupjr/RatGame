// @system   shadow-lighting/system
// @owns     select the active structure-shadow routing metadata for frame context
// @doc      docs/canonical/shadow_lighting_system.md
// @agents   no shadow algorithms or slice geometry — see structureShadowFrameContext.ts and structure_geometry_slicing_system.md

import type { StructureShadowRenderMode } from "./structureShadowTypes";

export function resolveStructureShadowRouting(): StructureShadowRenderMode {
  return {
    usesV6Sweep: true,
  };
}
