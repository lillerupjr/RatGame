import type { RuntimeDecalSetId } from "../content/runtimeDecalConfig";
import { ROAD_CENTER_MARKING_VARIANT_INDEX } from "./roadMarkings";

export function roadMarkingDecalScale(setId: RuntimeDecalSetId, variantIndex: number): number {
  return setId === "road_markings" && variantIndex === ROAD_CENTER_MARKING_VARIANT_INDEX ? 2 : 1;
}

export function shouldPixelSnapRoadMarking(setId: RuntimeDecalSetId, _variantIndex: number): boolean {
  return setId === "road_markings";
}

