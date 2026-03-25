import type { RenderFrameContext } from "./renderFrameContext";

export interface WorldPassContext {
  frame: RenderFrameContext;
  structureV6VerticalShadowDebugDataList: readonly unknown[];
  drawSweepShadowBand?: (zBand: number, firstZBand: number) => void;
}

export interface WorldPassResult {}
