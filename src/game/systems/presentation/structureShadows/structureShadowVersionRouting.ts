import type { ShadowCasterMode } from "../../../../settings/settingsTypes";
import type { StructureShadowRenderMode, StructureShadowVersionId } from "./structureShadowTypes";

export function resolveStructureShadowVersion(mode: ShadowCasterMode): StructureShadowVersionId {
  return mode;
}

export function resolveStructureShadowRouting(mode: ShadowCasterMode): StructureShadowRenderMode {
  const resolved = resolveStructureShadowVersion(mode);
  return {
    mode: resolved,
    usesV6Sweep: resolved === "v6SweepShadow",
    usesV6Debug: resolved === "v6FaceSliceDebug",
  };
}
