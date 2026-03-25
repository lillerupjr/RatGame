import type { RenderFrameContext } from "./renderFrameContext";
import type { RenderFrameBuilder } from "../frame/renderFrameBuilder";

export interface WorldPassContext {
  frame: RenderFrameContext;
  frameBuilder: RenderFrameBuilder;
  structureV6VerticalShadowDebugDataList: readonly unknown[];
}

export interface WorldPassResult {}
