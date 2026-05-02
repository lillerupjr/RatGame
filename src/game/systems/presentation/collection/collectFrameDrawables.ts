// @system   presentation/rendering
// @owns     orchestrate ground, effect, entity, and structure drawable collection
// @doc      docs/canonical/presentation_rendering_pipeline.md
// @agents   no per-family collection logic, frame sorting, or backend submission — see collectGroundDrawables.ts, collectEntityDrawables.ts, collectStructureDrawables.ts, and renderWorldConsumers.ts

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
