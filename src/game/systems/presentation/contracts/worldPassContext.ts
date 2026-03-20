import type { RenderFrameContext } from "./renderFrameContext";

export interface WorldPassContext {
  frame: RenderFrameContext;
  v5ShadowAnchorDiagnostic: unknown;
  structureV6VerticalShadowDebugDataList: readonly unknown[];
}

export interface WorldPassResult {
  v5ShadowAnchorDiagnostic: unknown;
}
