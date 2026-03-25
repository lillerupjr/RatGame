import type { RenderFrameContext } from "./renderFrameContext";
import type { RenderFrameBuilder } from "../frame/renderFrameBuilder";

export interface CollectionContext {
  frame: RenderFrameContext;
  frameBuilder: RenderFrameBuilder;
  didQueueStructureCutoutDebugRect: boolean;
  structureV6VerticalShadowDebugData: unknown;
  structureV6VerticalShadowDebugDataList: readonly unknown[];
  structureV6ShadowCacheStats: unknown;
}

export interface CollectionContextResult {
  didQueueStructureCutoutDebugRect: boolean;
  structureV6VerticalShadowDebugData: unknown;
  structureV6VerticalShadowDebugDataList: readonly unknown[];
  structureV6ShadowCacheStats: unknown;
}
