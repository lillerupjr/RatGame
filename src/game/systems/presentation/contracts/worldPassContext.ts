import type { RenderFrameContext } from "./renderFrameContext";

export interface WorldPassContext {
  frame: RenderFrameContext;
  v5ShadowAnchorDiagnostic: unknown;
  structureV6VerticalShadowDebugDataList: readonly unknown[];
  drawSweepShadowBand?: (zBand: number, firstZBand: number) => void;
}

export interface WorldPassResult {
  v5ShadowAnchorDiagnostic: unknown;
}
