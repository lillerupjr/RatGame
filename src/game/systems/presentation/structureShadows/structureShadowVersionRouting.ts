import type { StructureShadowRenderMode } from "./structureShadowTypes";

export function resolveStructureShadowRouting(): StructureShadowRenderMode {
  return {
    usesV6Sweep: true,
  };
}
