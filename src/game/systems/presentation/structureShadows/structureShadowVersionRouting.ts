import type { ShadowCasterMode } from "../../../../settings/settingsTypes";
import type { StructureShadowFrameResult, StructureShadowRenderMode, StructureShadowVersionId } from "./structureShadowTypes";

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

export function shouldBuildStructureV6ShadowMasks(
  routing: Pick<StructureShadowRenderMode, "usesV6Sweep" | "usesV6Debug">,
): boolean {
  return routing.usesV6Debug;
}

export function shouldBuildStructureV6ShadowMasksForFrame(
  frame: Pick<StructureShadowFrameResult, "routing">,
): boolean {
  return shouldBuildStructureV6ShadowMasks(frame.routing);
}
