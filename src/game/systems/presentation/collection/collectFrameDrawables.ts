import { collectGroundDrawables } from "./collectGroundDrawables";
import { collectEffectDrawables } from "./collectEffectDrawables";
import { collectEntityDrawables } from "./collectEntityDrawables";
import { collectStructureDrawables } from "./collectStructureDrawables";
import type {
  CollectionContext,
  CollectionContextResult,
} from "../contracts/collectionContext";

export function collectFrameDrawables(context: CollectionContext): CollectionContextResult {
  collectGroundDrawables(context);
  collectEffectDrawables(context);
  collectEntityDrawables(context);
  return collectStructureDrawables(context);
}
