import type { RenderFrameContext } from "./renderFrameContext";

export interface CollectionContext {
  frame: RenderFrameContext;
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
