import type { RenderFrameContext } from "./renderFrameContext";
import type { RenderFrameBuilder } from "../frame/renderFrameBuilder";

export interface CollectionContext {
  frame: RenderFrameContext;
  frameBuilder: RenderFrameBuilder;
  didQueueStructureCutoutDebugRect: boolean;
}

export interface CollectionContextResult {
  didQueueStructureCutoutDebugRect: boolean;
}
