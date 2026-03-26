import type { AmbientSunLightingState } from "../../../../shadowSunV1";
import type { RenderFrameContext } from "./renderFrameContext";

export interface ScreenOverlayContext {
  frame: RenderFrameContext;
  ambientSunLighting: AmbientSunLightingState;
}
