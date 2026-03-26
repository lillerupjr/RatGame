import type { RenderFrameContext } from "./renderFrameContext";
import type { RenderDebugScreenPassInput } from "../debug/debugRenderTypes";

export interface UiPassContext {
  frame: RenderFrameContext;
  perfDebugScreenInput?: RenderDebugScreenPassInput | null;
}
