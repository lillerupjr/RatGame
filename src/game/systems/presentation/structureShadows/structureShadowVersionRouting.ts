import type { ShadowCasterMode } from "../../../../settings/settingsTypes";
import type { StructureShadowRenderMode, StructureShadowVersionId } from "./structureShadowTypes";

export function resolveStructureShadowVersion(mode: ShadowCasterMode): StructureShadowVersionId {
  return mode;
}

export function resolveStructureShadowRouting(mode: ShadowCasterMode): StructureShadowRenderMode {
  const resolved = resolveStructureShadowVersion(mode);
  const usesV6 = resolved === "v6SweepShadow" || resolved === "v6FaceSliceDebug";
  return {
    mode: resolved,
    usesV1: resolved === "v1Roof",
    usesV2: resolved === "v2AlphaSilhouette",
    usesHybrid: resolved === "v3HybridTriangles",
    usesV4: resolved === "v4SliceStrips",
    usesV5: resolved === "v5TriangleShadowMask",
    usesV6,
    usesV6Debug: resolved === "v6FaceSliceDebug",
  };
}
