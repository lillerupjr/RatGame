import { collectGroundDrawables } from "./collectGroundDrawables";
import { collectEffectDrawables } from "./collectEffectDrawables";
import { collectEntityDrawables } from "./collectEntityDrawables";
import { collectStructureDrawables } from "./collectStructureDrawables";

export type RenderCollectionContext = Record<string, any>;

export function collectFrameDrawables(context: RenderCollectionContext): {
  didQueueStructureCutoutDebugRect: boolean;
  structureV6VerticalShadowDebugData: unknown;
} {
  collectGroundDrawables(context);
  collectEffectDrawables(context);
  collectEntityDrawables(context);
  return collectStructureDrawables(context);
}
